"""High Roller VIP tier — gated 10,000-coin-minimum casino room.

Endpoints under `/api/high-roller`:
  GET  /tiers                          — public list of Genius/Genesis/Apex pricing
  GET  /eligibility/{user_id}          — does this user have an active VIP window?
  POST /checkout                       — create a Stripe Checkout for a tier upgrade
  POST /blackjack/deal                 — VIP-gated Blackjack with 10k min bet
  POST /blackjack/action               — VIP-gated Blackjack action passthrough

Webhook fan-out (NOT a route here): on Stripe `checkout.session.completed`
with a `client_reference_id` starting with `vip:`, the existing
`stripe_payouts_webhook._handle_checkout_completed` delegates to
`apply_vip_grant()` below. Single source of truth for granting/extending
a user's VIP window.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import stripe
from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from services.high_roller_economy import (
    HIGH_ROLLER_MIN_BET,
    HIGH_ROLLER_GRANT_DAYS,
    HIGH_ROLLER_REF_PREFIX,
    VIP_TIERS,
    is_valid_tier,
    tier_price_usd,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/high-roller", tags=["high-roller"])

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY

_db = AsyncIOMotorClient(os.environ.get("MONGO_URL"))[
    os.environ.get("DB_NAME", "global_vibez_dsg")
]


# ────────────────────────────────────────────── Models ──
class CheckoutRequest(BaseModel):
    user_id: str
    tier: str  # "genius" | "genesis" | "apex"
    return_url: Optional[str] = None


class BlackjackDealRequest(BaseModel):
    user_id: str
    bet_amount: float
    side_bets: Optional[Dict[str, float]] = {}
    client_seed: Optional[str] = None


class BlackjackActionRequest(BaseModel):
    user_id: str
    session_id: str
    action: str  # 'hit', 'stand', 'double', 'split', 'insurance'
    hand_index: Optional[int] = 0


class RouletteBet(BaseModel):
    bet_type: str  # 'red', 'black', 'odd', 'even', 'low', 'high', 'straight', 'dozen1', 'dozen2', 'dozen3'
    bet_amount: float
    bet_value: Optional[int] = None  # for 'straight' (0-36)


class RouletteSpinRequest(BaseModel):
    user_id: str
    client_seed: str
    bets: List[RouletteBet]  # placed all at once


class BaccaratPlayRequest(BaseModel):
    user_id: str
    bet_type: str  # 'player' | 'banker' | 'tie'
    bet_amount: float


# ────────────────────────────────────────────── Helpers ──
async def _is_vip_active(user_id: str) -> Dict[str, Any]:
    """Single read returning {is_vip, tier, vip_until} for a user."""
    rec = await _db.high_roller_vip.find_one({"user_id": user_id}, {"_id": 0})
    now_iso = datetime.now(timezone.utc).isoformat()
    if not rec or not rec.get("vip_until") or rec["vip_until"] <= now_iso:
        return {"is_vip": False, "tier": None, "vip_until": None}
    return {
        "is_vip": True,
        "tier": rec.get("tier"),
        "vip_until": rec.get("vip_until"),
    }


async def _require_vip(user_id: str) -> Dict[str, Any]:
    """Raise 403 unless the user is currently inside their VIP window."""
    status = await _is_vip_active(user_id)
    if not status["is_vip"]:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "vip_required",
                "message": (
                    "High Roller rooms require an active VIP membership. "
                    "Upgrade at /casino/high-roller."
                ),
            },
        )
    return status


# ────────────────────────────────────────────── Endpoints ──
@router.get("/tiers")
async def list_tiers() -> Dict[str, Any]:
    """Public — render the High Roller pricing page."""
    return {
        "tiers": list(VIP_TIERS.values()),
        "min_bet": HIGH_ROLLER_MIN_BET,
        "duration_days": HIGH_ROLLER_GRANT_DAYS,
        "ref_prefix": HIGH_ROLLER_REF_PREFIX,
    }


@router.get("/eligibility/{user_id}")
async def get_eligibility(user_id: str) -> Dict[str, Any]:
    """Used by the High Roller room shell to gate entry, and by the
    upgrade page to show 'You're VIP · 12 days left' or 'Upgrade' CTAs.
    Wallet balance is intentionally NOT checked here — the per-game
    min-bet validators (10k floor) enforce that at deal time."""
    status = await _is_vip_active(user_id)
    return {
        "user_id": user_id,
        **status,
        "min_bet": HIGH_ROLLER_MIN_BET,
    }


@router.post("/checkout")
async def create_checkout(req: CheckoutRequest) -> Dict[str, Any]:
    """Spin a Stripe Checkout Session for a tier upgrade. The session's
    `client_reference_id` is `vip:<user_id>:<tier>` — the payouts webhook
    parses it and calls `apply_vip_grant`."""
    if not is_valid_tier(req.tier):
        raise HTTPException(400, detail=f"Unknown tier '{req.tier}'")

    price_usd = tier_price_usd(req.tier)
    tier_info = VIP_TIERS[req.tier]

    if not STRIPE_API_KEY:
        # Mock checkout for preview env / test runs.
        return {
            "mode": "mock",
            "checkout_url": (
                f"https://example.com/mock-checkout?user={req.user_id}"
                f"&tier={req.tier}&plan=high_roller"
            ),
            "tier": req.tier,
            "price_usd": price_usd,
            "duration_days": HIGH_ROLLER_GRANT_DAYS,
        }

    return_url = req.return_url or "https://globalvibezdsg.com/casino/high-roller"

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"High Roller VIP · {tier_info['label']}",
                        "description": (
                            f"{tier_info['tagline']} 30-day window. "
                            f"Includes the {HIGH_ROLLER_MIN_BET:,} ₵ min-bet VIP Blackjack room."
                        ),
                    },
                    "unit_amount": int(price_usd * 100),
                },
                "quantity": 1,
            }],
            success_url=f"{return_url}?vip=success",
            cancel_url=f"{return_url}?vip=cancel",
            client_reference_id=f"{HIGH_ROLLER_REF_PREFIX}{req.user_id}:{req.tier}",
            metadata={
                "kind": "high_roller_vip",
                "user_id": req.user_id,
                "tier": req.tier,
                "duration_days": str(HIGH_ROLLER_GRANT_DAYS),
            },
        )
    except stripe.error.StripeError as e:
        raise HTTPException(502, detail=f"Stripe checkout error: {e}")

    return {
        "mode": "live",
        "checkout_url": session.url,
        "session_id": session.id,
        "tier": req.tier,
        "price_usd": price_usd,
        "duration_days": HIGH_ROLLER_GRANT_DAYS,
    }


@router.post("/blackjack/deal")
async def vip_blackjack_deal(req: BlackjackDealRequest) -> Dict[str, Any]:
    """VIP-gated Blackjack deal. Enforces the 10,000 ₵ floor BEFORE
    delegating to the same engine used by the public Blackjack route.
    Keeps blackjack engine isolation: the public 50-coin floor remains
    untouched, and standard games' regression assertions don't fire."""
    await _require_vip(req.user_id)
    if req.bet_amount < HIGH_ROLLER_MIN_BET:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "below_high_roller_min",
                "message": (
                    f"High Roller minimum bet is ₵{HIGH_ROLLER_MIN_BET:,}. "
                    f"You bet ₵{int(req.bet_amount):,}."
                ),
                "min_bet": HIGH_ROLLER_MIN_BET,
            },
        )

    # Delegate to the public Blackjack engine. Same provably-fair seed
    # generation, same dealer logic — only the entry gate differs.
    from routes.blackjack import DealRequest, deal_initial_hand  # noqa: PLC0415
    deal_req = DealRequest(
        player_id=req.user_id,
        bet_amount=req.bet_amount,
        side_bets=req.side_bets or {},
        client_seed=req.client_seed,
        lightning_active=False,
    )
    result = await deal_initial_hand(deal_req)
    # Stamp the response so the frontend can render VIP chrome.
    if isinstance(result, dict):
        result["vip"] = True
        result["min_bet"] = HIGH_ROLLER_MIN_BET
    return result


@router.post("/blackjack/action")
async def vip_blackjack_action(req: BlackjackActionRequest) -> Dict[str, Any]:
    """VIP-gated Blackjack action passthrough (hit/stand/double/split)."""
    await _require_vip(req.user_id)
    from routes.blackjack import ActionRequest, player_action  # noqa: PLC0415

    action_req = ActionRequest(
        session_id=req.session_id,
        action=req.action,
        hand_index=req.hand_index or 0,
    )
    result = await player_action(action_req)
    if isinstance(result, dict):
        result["vip"] = True
    return result


# ────────────────────────────────────────────── VIP ROULETTE ──
# Bet-type payout multipliers (European 0-36 wheel). Straight pays 35:1,
# dozens/columns 2:1, red/black/even/odd/low/high 1:1. Standard Vegas rules.
_ROULETTE_PAYOUTS: Dict[str, int] = {
    "red": 1, "black": 1, "odd": 1, "even": 1,
    "low": 1, "high": 1,          # 1-18 / 19-36
    "dozen1": 2, "dozen2": 2, "dozen3": 2,
    "straight": 35,
}
_RED_NUMBERS = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}


def _roulette_bet_wins(bet: RouletteBet, winning: int) -> bool:
    """Resolve a single roulette bet against the winning number."""
    if winning == 0:
        # 0 is house (green) — only `straight 0` wins. All others lose.
        return bet.bet_type == "straight" and bet.bet_value == 0
    t = bet.bet_type
    if t == "red":     return winning in _RED_NUMBERS
    if t == "black":   return winning not in _RED_NUMBERS
    if t == "odd":     return winning % 2 == 1
    if t == "even":    return winning % 2 == 0
    if t == "low":     return 1 <= winning <= 18
    if t == "high":    return 19 <= winning <= 36
    if t == "dozen1":  return 1 <= winning <= 12
    if t == "dozen2":  return 13 <= winning <= 24
    if t == "dozen3":  return 25 <= winning <= 36
    if t == "straight":return bet.bet_value == winning
    return False


@router.post("/roulette/spin")
async def vip_roulette_spin(req: RouletteSpinRequest) -> Dict[str, Any]:
    """VIP-gated European roulette spin. Reuses the public route's
    provably-fair HMAC-SHA512 wheel and enforces the ₵10,000 floor on
    the sum of all chips placed in the round.

    Returns per-bet payout details so the frontend can render hit/miss
    rings around each placed chip, plus the standard provably-fair proof.
    """
    await _require_vip(req.user_id)
    if not req.bets:
        raise HTTPException(400, detail="At least one bet required")

    total_stake = sum(b.bet_amount for b in req.bets)
    if total_stake < HIGH_ROLLER_MIN_BET:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "below_high_roller_min",
                "message": (
                    f"High Roller minimum is ₵{HIGH_ROLLER_MIN_BET:,}. "
                    f"You staked ₵{int(total_stake):,}."
                ),
                "min_bet": HIGH_ROLLER_MIN_BET,
            },
        )
    # Validate every bet_type is recognised — cheaper to fail early than
    # to settle and find out we paid the wrong multiplier.
    for b in req.bets:
        if b.bet_type not in _ROULETTE_PAYOUTS:
            raise HTTPException(400, detail=f"Unknown roulette bet_type '{b.bet_type}'")
        if b.bet_type == "straight" and (b.bet_value is None or not 0 <= b.bet_value <= 36):
            raise HTTPException(400, detail="straight bet requires bet_value 0-36")

    from routes.roulette import SpinRequest, spin_roulette  # noqa: PLC0415
    spin_result = await spin_roulette(SpinRequest(clientSeed=req.client_seed))
    winning = int(spin_result["winningNumber"])

    settled = []
    total_payout = 0
    for b in req.bets:
        won = _roulette_bet_wins(b, winning)
        # Payout = stake × (multiplier+1) so the player gets back stake + winnings on a hit.
        payout = int(b.bet_amount * (_ROULETTE_PAYOUTS[b.bet_type] + 1)) if won else 0
        total_payout += payout
        settled.append({
            "bet_type": b.bet_type,
            "bet_value": b.bet_value,
            "bet_amount": int(b.bet_amount),
            "won": won,
            "payout": payout,
            "multiplier": _ROULETTE_PAYOUTS[b.bet_type] if won else 0,
        })

    return {
        "vip": True,
        "min_bet": HIGH_ROLLER_MIN_BET,
        "winning_number": winning,
        "color": "green" if winning == 0 else ("red" if winning in _RED_NUMBERS else "black"),
        "bets": settled,
        "total_stake": int(total_stake),
        "total_payout": total_payout,
        "net": total_payout - int(total_stake),
        "proof": spin_result.get("proof"),
        "next_server_hash": spin_result.get("nextServerHash"),
    }


@router.post("/roulette/server-hash")
async def vip_roulette_server_hash(user_id: str) -> Dict[str, Any]:
    """Pre-spin commitment hash + nonce. VIP-gated so non-members can't
    leak the next-round seed by polling."""
    await _require_vip(user_id)
    from routes.roulette import get_server_hash  # noqa: PLC0415
    out = await get_server_hash()
    out["vip"] = True
    return out


# ────────────────────────────────────────────── VIP BACCARAT ──
@router.post("/baccarat/play")
async def vip_baccarat_play(req: BaccaratPlayRequest, request: Request) -> Dict[str, Any]:
    """VIP-gated Baccarat. Enforces the ₵10,000 floor before delegating
    to the public Baccarat engine. Keeps the standard 50-coin floor on
    the public `/api/baccarat/play` endpoint untouched."""
    await _require_vip(req.user_id)
    if req.bet_amount < HIGH_ROLLER_MIN_BET:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "below_high_roller_min",
                "message": (
                    f"High Roller minimum is ₵{HIGH_ROLLER_MIN_BET:,}. "
                    f"You bet ₵{int(req.bet_amount):,}."
                ),
                "min_bet": HIGH_ROLLER_MIN_BET,
            },
        )
    if req.bet_type not in ("player", "banker", "tie"):
        raise HTTPException(400, detail="bet_type must be player/banker/tie")

    # Use the BaccaratGame engine directly so we don't depend on the
    # public route's auth flow (it requires a cookie-based current_user).
    from utils.baccarat_game import BaccaratGame  # noqa: PLC0415
    game = BaccaratGame()
    game.deal_initial_cards()
    game.apply_third_card_rules()
    game.determine_winner()
    state = game.get_game_state()
    winner = state.get("winner")
    payout = 0
    if winner == req.bet_type:
        # 1:1 on player, 19:20 on banker (5% house commission), 8:1 on tie.
        if req.bet_type == "player":
            payout = int(req.bet_amount * 2)
        elif req.bet_type == "banker":
            payout = int(req.bet_amount * 1.95)
        else:  # tie
            payout = int(req.bet_amount * 9)
    return {
        "vip": True,
        "min_bet": HIGH_ROLLER_MIN_BET,
        "game_id": str(uuid.uuid4()),
        "player_hand": state.get("player_hand"),
        "banker_hand": state.get("banker_hand"),
        "player_score": state.get("player_score"),
        "banker_score": state.get("banker_score"),
        "winner": winner,
        "bet_type": req.bet_type,
        "bet_amount": int(req.bet_amount),
        "payout": payout,
        "net": payout - int(req.bet_amount),
    }


# ────────────────────────────────────────────── Grant fn (webhook) ──
async def apply_vip_grant(
    user_id: str,
    tier: str,
    stripe_session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Idempotently extend a user's VIP window by 30 days.

    Called by `routes/stripe_payouts_webhook.py::_handle_checkout_completed`
    when the `client_reference_id` starts with `vip:`. Idempotency via
    `last_grant_session_id` — Stripe webhook retries are no-ops.

    Renewals don't reset the clock; they extend from the existing end date
    (same UX rule as Featured Streamers).
    """
    if not is_valid_tier(tier):
        logger.warning("apply_vip_grant: ignoring unknown tier '%s'", tier)
        return {}

    existing = await _db.high_roller_vip.find_one({"user_id": user_id}, {"_id": 0})
    if existing and existing.get("last_grant_session_id") == stripe_session_id:
        return existing  # already applied — Stripe retry

    now = datetime.now(timezone.utc)
    base = now
    if existing and existing.get("vip_until"):
        try:
            current = datetime.fromisoformat(existing["vip_until"])
            if current > now:
                base = current
        except ValueError:
            base = now
    new_until = base + timedelta(days=HIGH_ROLLER_GRANT_DAYS)

    doc = {
        "user_id": user_id,
        "tier": tier,  # most-recent tier wins; lower tiers can't downgrade an active higher tier
        "vip_until": new_until.isoformat(),
        "last_grant_session_id": stripe_session_id,
        "last_granted_at": now.isoformat(),
        "grant_count": (existing.get("grant_count", 0) if existing else 0) + 1,
    }
    # Don't downgrade an active higher tier on a lower-tier renewal.
    if existing:
        prior_tier = existing.get("tier")
        order = {"genius": 1, "genesis": 2, "apex": 3}
        if prior_tier in order and order.get(tier, 0) < order.get(prior_tier, 0):
            doc["tier"] = prior_tier

    await _db.high_roller_vip.update_one(
        {"user_id": user_id}, {"$set": doc}, upsert=True,
    )
    logger.info(
        "Granted VIP (%s) to %s until %s (session=%s)",
        doc["tier"], user_id, new_until.isoformat(), stripe_session_id,
    )
    return doc
