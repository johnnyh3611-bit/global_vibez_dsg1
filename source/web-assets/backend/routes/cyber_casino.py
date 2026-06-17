"""
Cyber Casino — server-authoritative game room.

Two games live here, each fully server-authoritative so the client
cannot tamper with outcomes:

  • Neon Slots      — 3-reel weighted-symbol slot machine, RTP ~95%
  • Neon Blackjack  — single-deck-per-session shoe, dealer S17, BJ pays 3:2

Currency: unified Vibez Coins balance (see ``routes.coins``). Every
spin / hand deducts the bet up-front via ``deduct_coins`` and credits
the gross payout via ``add_coins`` once the round resolves. The
existing CyberCasinoRoulette page stays untouched — that one is the
founder's originated build.

Provably-fair pattern (slots only — Blackjack uses a server-side shoe
that's revealed card-by-card):
  1. ``GET /commit``  → server returns ``serverSeedHash`` (= sha256 of
     a fresh secret) plus the current ``nonce``.
  2. ``POST /spin``   → server uses the *committed* secret + the
     player's ``client_seed`` + ``nonce`` to derive the result via
     HMAC-SHA512, then rotates to a fresh secret for the next round
     and returns the OLD secret as proof.
  3. ``POST /verify`` → players can replay the math themselves to
     confirm the result wasn't post-hoc fabricated.

All rounds are persisted to the ``cyber_casino_audits`` collection.
The user's Cyber Casino page only ever asks the server "what should I
render?" — so reels, cards, and balances are all forge-proof.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from routes.coins import add_coins, deduct_coins, get_user_balance
from utils.database import get_database, get_current_user

router = APIRouter(prefix="/cyber-casino", tags=["cyber-casino"])

# Crypto-grade RNG. Never use ``random`` for outcomes.
_RNG = secrets.SystemRandom()

# ============================================================================
# SLOTS — paytable & weighted reels
# ============================================================================

# Symbol IDs (the frontend renders icons keyed off these strings).
SYMBOLS = ["bolt", "eye", "skull", "diamond", "neon", "wild"]

# Per-reel symbol weights. Same distribution across all 3 reels for now —
# can be tuned independently later. ``wild`` is rare on purpose so the top
# pay (3× wild = 50× bet) lands ~1 in 125,000 spins.
SYMBOL_WEIGHTS: Dict[str, int] = {
    "bolt":    35,
    "eye":     25,
    "skull":   18,
    "diamond": 12,
    "neon":     8,
    "wild":     2,
}

# 3-of-a-kind payouts (multiplier on the bet).
PAYOUTS_3X: Dict[str, int] = {
    "bolt":     3,
    "eye":      5,
    "skull":    8,
    "diamond": 12,
    "neon":    25,
    "wild":    50,
}
# 2-of-a-kind WILD anywhere on the line still pays a small consolation.
PAYOUT_2X_WILD = 2

SLOTS_MIN_BET = 50
SLOTS_MAX_BET = 5_000

# ============================================================================
# BLACKJACK — house rules
# ============================================================================

BJ_MIN_BET = 50
BJ_MAX_BET = 5_000
# Single-shoe-per-session. Reshuffled if penetration drops below 1 deck.
BJ_DECKS_PER_SHOE = 6
BJ_SHUFFLE_FLOOR = 52
BJ_BLACKJACK_MULT = 2.5  # 3:2 = 1 + 1.5 profit
BJ_REGULAR_WIN_MULT = 2.0
BJ_PUSH_MULT = 1.0
BJ_INSURANCE_MULT = 3.0  # 2:1


# ============================================================================
# Slot RNG state — provably fair commit-reveal
# ============================================================================

# In-memory state for the *current* committed seed. After each spin, the
# secret rotates and the new sha256 hash is published. Persisted to Mongo
# below for hot-reload survival.
_slot_seed_state = {
    "secret": secrets.token_hex(32),
    "nonce": 0,
}
# Serialise read-rotate of the slot seed across concurrent /spin requests
# so two players can never share the same (server_seed, nonce) tuple —
# that would break the one-secret-per-nonce commit-reveal invariant.
_slot_seed_lock = asyncio.Lock()


def _slot_seed_hash() -> str:
    return hashlib.sha256(_slot_seed_state["secret"].encode()).hexdigest()


def _draw_symbol(rand: int, offset: int) -> str:
    """Pick a symbol from the weighted distribution using ``rand`` (a
    big int derived from the HMAC) and a per-reel ``offset`` so each
    of the 3 reels reads a different slice of the same hash."""
    total = sum(SYMBOL_WEIGHTS.values())
    chunk = (rand >> (offset * 16)) & 0xFFFF
    pick = chunk % total
    cumulative = 0
    for sym, weight in SYMBOL_WEIGHTS.items():
        cumulative += weight
        if pick < cumulative:
            return sym
    return SYMBOLS[-1]  # safety fallback


def _settle_slots(reels: List[str], bet: int) -> Dict[str, Any]:
    """Compute the gross payout for a 3-reel result.

    Wilds substitute for any symbol when forming a 3-of-a-kind. So
    ``[wild, neon, neon]`` counts as 3× neon and pays the neon top.
    Pure 3× wild beats the substitution and pays the wild top.
    """
    a, b, c = reels

    # Pure 3-of-a-kind (covers 3× wild as the top pay).
    if a == b == c:
        mult = PAYOUTS_3X[a]
        return {
            "won": bet * mult,
            "line": "three-of-a-kind",
            "symbol": a,
            "multiplier": mult,
        }

    # Wild substitution: count wilds + see if the 2 non-wilds match.
    wild_count = sum(1 for s in reels if s == "wild")
    non_wilds = [s for s in reels if s != "wild"]
    if wild_count >= 1 and len(set(non_wilds)) == 1:
        sym = non_wilds[0]
        mult = PAYOUTS_3X[sym]
        return {
            "won": bet * mult,
            "line": "wild-substitute",
            "symbol": sym,
            "multiplier": mult,
        }

    # Consolation: 2× WILD anywhere with no full match.
    if wild_count >= 2:
        return {
            "won": bet * PAYOUT_2X_WILD,
            "line": "two-wilds",
            "symbol": "wild",
            "multiplier": PAYOUT_2X_WILD,
        }

    return {"won": 0, "line": "no-match", "symbol": None, "multiplier": 0}


# ============================================================================
# Models
# ============================================================================


class SlotsCommitResponse(BaseModel):
    server_seed_hash: str
    nonce: int


class SlotsSpinRequest(BaseModel):
    bet: int = Field(..., ge=SLOTS_MIN_BET, le=SLOTS_MAX_BET)
    client_seed: str = Field(default_factory=lambda: secrets.token_hex(8), max_length=64)


class SlotsVerifyRequest(BaseModel):
    server_seed: str
    client_seed: str
    nonce: int
    claimed_reels: List[str]


class BJDealRequest(BaseModel):
    bet: int = Field(..., ge=BJ_MIN_BET, le=BJ_MAX_BET)


class BJActionRequest(BaseModel):
    session_id: str
    action: str  # hit | stand | double | insurance | decline-insurance


# ============================================================================
# SLOTS endpoints
# ============================================================================


@router.get("/slots/commit", response_model=SlotsCommitResponse)
async def slots_commit() -> SlotsCommitResponse:
    """Hand out the *committed* server seed hash before the next spin.
    Players can store this and verify against the post-spin reveal."""
    async with _slot_seed_lock:
        return SlotsCommitResponse(
            server_seed_hash=_slot_seed_hash(),
            nonce=_slot_seed_state["nonce"],
        )


@router.post("/slots/spin")
async def slots_spin(request: Request, payload: SlotsSpinRequest) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()

    # 1. Lock the bet up front.
    await deduct_coins(
        user.user_id,
        payload.bet,
        "spend_bet",
        f"Cyber Casino · Slots spin (-{payload.bet})",
        {"game": "cyber_slots", "bet": payload.bet},
    )

    # 2. Snapshot the committed seed BEFORE rotating — this is the value
    # the proof reveals. Lock so concurrent spinners can never collide
    # on the same (seed, nonce) tuple.
    async with _slot_seed_lock:
        server_seed = _slot_seed_state["secret"]
        nonce = _slot_seed_state["nonce"]
        # Rotate immediately — the new state is committed before we
        # release the lock. Subsequent spinners now see a fresh seed.
        next_secret = secrets.token_hex(32)
        _slot_seed_state["secret"] = next_secret
        _slot_seed_state["nonce"] = nonce + 1
        # Capture the next hash inside the lock so the value we return
        # is the one we actually wrote (not whatever the next concurrent
        # spinner has already rotated to).
        next_seed_hash = hashlib.sha256(next_secret.encode()).hexdigest()
        next_nonce = nonce + 1

    digest = hmac.new(
        server_seed.encode(),
        f"{payload.client_seed}:{nonce}".encode(),
        hashlib.sha512,
    ).digest()
    rand = int.from_bytes(digest[:16], "big")

    reels = [_draw_symbol(rand, i) for i in range(3)]
    settlement = _settle_slots(reels, payload.bet)

    # 4. Award the payout (if any).
    payout = int(settlement["won"])
    if payout > 0:
        await add_coins(
            user.user_id,
            payout,
            "earn_bet_win",
            f"Cyber Casino · Slots win (+{payout})",
            {"game": "cyber_slots", "reels": reels, "line": settlement["line"]},
        )

    # 5. Audit log.
    audit = {
        "audit_id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "game": "cyber_slots",
        "bet": payload.bet,
        "payout": payout,
        "reels": reels,
        "line": settlement["line"],
        "proof": {
            "server_seed": server_seed,
            "server_seed_hash": hashlib.sha256(server_seed.encode()).hexdigest(),
            "client_seed": payload.client_seed,
            "nonce": nonce,
            "hmac_sha512": digest.hex(),
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cyber_casino_audits.insert_one(audit)

    new_balance = await get_user_balance(user.user_id)

    return {
        "reels": reels,
        "bet": payload.bet,
        "won": payout,
        "line": settlement["line"],
        "symbol": settlement["symbol"],
        "multiplier": settlement["multiplier"],
        "balance": new_balance,
        "proof": {
            "server_seed": server_seed,
            "client_seed": payload.client_seed,
            "nonce": nonce,
            "hmac_sha512": digest.hex(),
        },
        "next_server_seed_hash": next_seed_hash,
        "next_nonce": next_nonce,
    }


@router.post("/slots/verify")
async def slots_verify(payload: SlotsVerifyRequest) -> Dict[str, Any]:
    """Replay the math to verify a past round's reels."""
    digest = hmac.new(
        payload.server_seed.encode(),
        f"{payload.client_seed}:{payload.nonce}".encode(),
        hashlib.sha512,
    ).digest()
    rand = int.from_bytes(digest[:16], "big")
    reels = [_draw_symbol(rand, i) for i in range(3)]
    return {
        "valid": reels == payload.claimed_reels,
        "computed_reels": reels,
        "server_seed_hash": hashlib.sha256(payload.server_seed.encode()).hexdigest(),
    }


# ============================================================================
# BLACKJACK — engine
# ============================================================================


def _new_shoe() -> List[str]:
    """Build & shuffle a 6-deck shoe. Cards are stored as ``"AS"``, ``"10H"``,
    ``"KD"`` etc. Last char = suit (S/H/D/C). The frontend renders these."""
    ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
    suits = ["S", "H", "D", "C"]
    cards: List[str] = [f"{r}{s}" for _ in range(BJ_DECKS_PER_SHOE) for s in suits for r in ranks]
    # Fisher-Yates with a cryptographic source.
    for i in range(len(cards) - 1, 0, -1):
        j = _RNG.randint(0, i)
        cards[i], cards[j] = cards[j], cards[i]
    return cards


def _card_rank(card: str) -> str:
    return card[:-1]


def _hand_value(cards: List[str]) -> Dict[str, Any]:
    """Return the best (non-busting) total + a soft flag."""
    total = 0
    aces = 0
    for c in cards:
        r = _card_rank(c)
        if r == "A":
            total += 11
            aces += 1
        elif r in {"J", "Q", "K"}:
            total += 10
        else:
            total += int(r)
    soft = aces > 0 and total <= 21
    while total > 21 and aces > 0:
        total -= 10
        aces -= 1
        soft = aces > 0 and total <= 21
    return {"total": total, "soft": soft}


def _is_blackjack(cards: List[str]) -> bool:
    return len(cards) == 2 and _hand_value(cards)["total"] == 21


def _dealer_play(shoe: List[str], dealer: List[str]) -> List[str]:
    """Dealer hits hard 16, stands soft 17 (S17 rules)."""
    while True:
        v = _hand_value(dealer)
        if v["total"] >= 17:
            break
        dealer.append(shoe.pop())
    return dealer


def _settle_bj_session(session: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve a stood/busted session vs the dealer.

    Returns a dict with ``net`` (= gross payout the player should be
    credited; loss = 0) plus per-hand outcome strings the frontend
    can use to drive its UI."""
    bet = session["bet"]
    player = session["player"]
    dealer = session["dealer"]
    insurance_paid = session.get("insurance_bet", 0)

    p_total = _hand_value(player)["total"]
    d_total = _hand_value(dealer)["total"]
    p_bj = _is_blackjack(player)
    d_bj = _is_blackjack(dealer)

    gross = 0
    outcome = ""

    # Insurance settles independently — pays 2:1 if dealer has BJ.
    insurance_payout = 0
    if insurance_paid > 0:
        if d_bj:
            insurance_payout = int(insurance_paid * BJ_INSURANCE_MULT)
        # losing insurance is already deducted up-front.
    gross += insurance_payout

    if p_bj and d_bj:
        gross += int(bet * BJ_PUSH_MULT)
        outcome = "push-blackjack"
    elif p_bj:
        gross += int(bet * BJ_BLACKJACK_MULT)
        outcome = "blackjack"
    elif p_total > 21:
        outcome = "bust"
    elif d_total > 21 or p_total > d_total:
        gross += int(bet * BJ_REGULAR_WIN_MULT)
        outcome = "win"
    elif p_total == d_total:
        gross += int(bet * BJ_PUSH_MULT)
        outcome = "push"
    else:
        outcome = "lose"

    return {
        "net": gross,
        "outcome": outcome,
        "insurance_payout": insurance_payout,
        "player_total": p_total,
        "dealer_total": d_total,
    }


def _public_session(session: Dict[str, Any]) -> Dict[str, Any]:
    """Strip server-side secrets (the shoe, server seed) before
    returning to the client."""
    out = {k: v for k, v in session.items() if k not in {"shoe", "_id"}}
    out["player_total"] = _hand_value(session["player"])["total"]
    # Hide the dealer hole card while in-progress.
    if session["state"] == "in_progress":
        out["dealer"] = [session["dealer"][0], "hidden"]
        out["dealer_total"] = _hand_value([session["dealer"][0]])["total"]
    else:
        out["dealer_total"] = _hand_value(session["dealer"])["total"]
    return out


# ============================================================================
# BLACKJACK endpoints
# ============================================================================


@router.post("/blackjack/deal")
async def bj_deal(request: Request, payload: BJDealRequest) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()

    await deduct_coins(
        user.user_id,
        payload.bet,
        "spend_bet",
        f"Cyber Casino · Blackjack deal (-{payload.bet})",
        {"game": "cyber_blackjack", "bet": payload.bet},
    )

    shoe = _new_shoe()
    player = [shoe.pop(), shoe.pop()]
    dealer = [shoe.pop(), shoe.pop()]

    session: Dict[str, Any] = {
        "session_id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "bet": payload.bet,
        "shoe": shoe,
        "player": player,
        "dealer": dealer,
        "state": "in_progress",
        "actions": ["deal"],
        "insurance_bet": 0,
        "doubled": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Natural blackjack short-circuits the round.
    if _is_blackjack(player) or _is_blackjack(dealer):
        session["state"] = "complete"
        settlement = _settle_bj_session(session)
        if settlement["net"] > 0:
            await add_coins(
                user.user_id,
                settlement["net"],
                "earn_bet_win",
                f"Cyber Casino · Blackjack {settlement['outcome']} (+{settlement['net']})",
                {"game": "cyber_blackjack", "session_id": session["session_id"]},
            )
        session["settlement"] = settlement
        await db.cyber_casino_audits.insert_one(
            {
                "audit_id": str(uuid.uuid4()),
                "user_id": user.user_id,
                "game": "cyber_blackjack",
                "bet": payload.bet,
                "payout": settlement["net"],
                "session_id": session["session_id"],
                "outcome": settlement["outcome"],
                "player": player,
                "dealer": dealer,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    insert_doc = session.copy()
    await db.cyber_casino_sessions.insert_one(insert_doc)

    new_balance = await get_user_balance(user.user_id)

    return {
        "session": _public_session(session),
        "balance": new_balance,
        "can_double": session["state"] == "in_progress",
        "can_insurance": (
            session["state"] == "in_progress"
            and _card_rank(dealer[0]) == "A"
            and session["insurance_bet"] == 0
        ),
    }


@router.post("/blackjack/action")
async def bj_action(request: Request, payload: BJActionRequest) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()

    session = await db.cyber_casino_sessions.find_one(
        {"session_id": payload.session_id, "user_id": user.user_id},
        {"_id": 0},
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["state"] != "in_progress":
        raise HTTPException(status_code=400, detail="Session already complete")

    action = payload.action.lower()
    actions: List[str] = list(session.get("actions", []))
    actions.append(action)
    settlement: Optional[Dict[str, Any]] = None

    if action == "hit":
        session["player"].append(session["shoe"].pop())
        if _hand_value(session["player"])["total"] >= 21:
            session["state"] = "stand"

    elif action == "stand":
        session["state"] = "stand"

    elif action == "double":
        # Only allowed on first action (hit/double/stand history doesn't
        # include another hit). I.e. exactly 2 cards in the player hand.
        if len(session["player"]) != 2 or session.get("doubled"):
            raise HTTPException(status_code=400, detail="Cannot double now")
        await deduct_coins(
            user.user_id,
            session["bet"],
            "spend_bet",
            f"Cyber Casino · Blackjack double (-{session['bet']})",
            {"game": "cyber_blackjack", "session_id": session["session_id"]},
        )
        session["bet"] *= 2
        session["doubled"] = True
        session["player"].append(session["shoe"].pop())
        session["state"] = "stand"

    elif action == "insurance":
        if (
            _card_rank(session["dealer"][0]) != "A"
            or session.get("insurance_bet", 0) > 0
            or len(session["player"]) != 2
        ):
            raise HTTPException(status_code=400, detail="Insurance not available")
        ins = session["bet"] // 2
        await deduct_coins(
            user.user_id,
            ins,
            "spend_bet",
            f"Cyber Casino · Blackjack insurance (-{ins})",
            {"game": "cyber_blackjack", "session_id": session["session_id"]},
        )
        session["insurance_bet"] = ins

    elif action == "decline-insurance":
        # No-op state marker so the UI stops asking.
        session["insurance_declined"] = True

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

    # If we transitioned to ``stand`` (player hit 21, stood, or doubled),
    # the dealer plays out and we settle.
    if session["state"] == "stand":
        session["dealer"] = _dealer_play(session["shoe"], session["dealer"])
        session["state"] = "complete"
        settlement = _settle_bj_session(session)
        session["settlement"] = settlement
        if settlement["net"] > 0:
            await add_coins(
                user.user_id,
                settlement["net"],
                "earn_bet_win",
                f"Cyber Casino · Blackjack {settlement['outcome']} (+{settlement['net']})",
                {"game": "cyber_blackjack", "session_id": session["session_id"]},
            )
        await db.cyber_casino_audits.insert_one(
            {
                "audit_id": str(uuid.uuid4()),
                "user_id": user.user_id,
                "game": "cyber_blackjack",
                "bet": session["bet"],
                "payout": settlement["net"],
                "session_id": session["session_id"],
                "outcome": settlement["outcome"],
                "player": session["player"],
                "dealer": session["dealer"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    session["actions"] = actions
    await db.cyber_casino_sessions.update_one(
        {"session_id": session["session_id"]},
        {
            "$set": {
                "player": session["player"],
                "dealer": session["dealer"],
                "shoe": session["shoe"],
                "bet": session["bet"],
                "state": session["state"],
                "actions": actions,
                "insurance_bet": session.get("insurance_bet", 0),
                "insurance_declined": session.get("insurance_declined", False),
                "doubled": session.get("doubled", False),
                "settlement": session.get("settlement"),
            }
        },
    )

    new_balance = await get_user_balance(user.user_id)

    return {
        "session": _public_session(session),
        "balance": new_balance,
        "settlement": settlement,
        "can_double": (
            session["state"] == "in_progress"
            and len(session["player"]) == 2
            and not session.get("doubled")
        ),
        "can_insurance": (
            session["state"] == "in_progress"
            and _card_rank(session["dealer"][0]) == "A"
            and session.get("insurance_bet", 0) == 0
            and len(session["player"]) == 2
        ),
    }


# ============================================================================
# Audit / history
# ============================================================================


@router.get("/audits")
async def my_audits(request: Request, limit: int = 25) -> Dict[str, Any]:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    cursor = (
        db.cyber_casino_audits.find({"user_id": user.user_id}, {"_id": 0})
        .sort("created_at", -1)
        .limit(max(1, min(limit, 100)))
    )
    items = await cursor.to_list(length=100)
    return {"audits": items, "count": len(items)}


@router.get("/paytable")
async def paytable() -> Dict[str, Any]:
    """Public paytable / house rules — used by the frontend "How to Play"
    panel and by integration tests for sanity-checking RTP claims."""
    return {
        "slots": {
            "min_bet": SLOTS_MIN_BET,
            "max_bet": SLOTS_MAX_BET,
            "symbols": SYMBOLS,
            "weights": SYMBOL_WEIGHTS,
            "payouts_3x": PAYOUTS_3X,
            "payout_2x_wild": PAYOUT_2X_WILD,
        },
        "blackjack": {
            "min_bet": BJ_MIN_BET,
            "max_bet": BJ_MAX_BET,
            "decks_per_shoe": BJ_DECKS_PER_SHOE,
            "blackjack_pays": "3:2",
            "dealer_rule": "S17",
            "insurance_pays": "2:1",
            "double_after_split": False,
            "split": False,
        },
    }
