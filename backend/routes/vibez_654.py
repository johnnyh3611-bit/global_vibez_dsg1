"""
Vibez 654 — dice game backend (Solo Vault · 5-dice classic rules).

OFFICIAL RULES — the one canonical ruleset used in every room including the
High Roller Solo Vault and the 20-player Coliseum:
  • 5 dice. Max 3 rolls per session.
  • Sequential qualification: roll a 6, then a 5, then a 4 — in that order.
    The first die showing 6 locks as your 6, then the first 5 locks, then
    the first 4 locks. Extra 6s/5s/4s count as point dice.
  • After qualifying (6-5-4 all locked), the *two remaining* dice = point.
    Higher point = better. Range: 2 (worst) → 12 (best, two sixes).
  • Between rolls the player chooses **Roll Again** (spend a roll trying to
    improve their point dice) or **Stand** (lock the current state as final).
  • If all 3 rolls elapse without qualifying → BUST, score = 0.
  • Standing before qualifying → score = 0 (bet is lost).

Endpoints (all under /api):
  POST /api/vibez-654/start        — create a new 5-dice session
  POST /api/vibez-654/roll         — roll the non-locked dice
  POST /api/vibez-654/stand        — lock current state as final
  GET  /api/vibez-654/state/{id}   — full snapshot
  GET  /api/vibez-654/leaderboard  — top 10 scores in last 24h
"""
from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

NUM_DICE = 5
MAX_ROLLS = 3  # official ruleset — 3 rolls to qualify


def _apply_654_pass(
    roll: List[int],
    has_6: bool,
    has_5: bool,
    has_4: bool,
) -> Dict[str, Any]:
    """
    Apply the sequential 6→5→4 qualification on a fresh roll.

    Returns the updated flags AND the point_dice (the dice left over after
    peeling off the first 6, first 5, first 4 encountered in qualifying
    order). Also returns `residual_dice` — the dice still IN PLAY after the
    peel (i.e., the `roll` minus the just-locked qualifiers). The frontend
    uses this so the tray visually drops the locked die when a 6/5/4 gets
    qualified, matching the official rule: *"each qualifier removes a die
    from the roll."*
    """
    remaining = list(roll)
    if not has_6 and 6 in remaining:
        has_6 = True
        remaining.remove(6)
    if has_6 and not has_5 and 5 in remaining:
        has_5 = True
        remaining.remove(5)
    if has_5 and not has_4 and 4 in remaining:
        has_4 = True
        remaining.remove(4)
    qualified = has_6 and has_5 and has_4
    return {
        "has_6": has_6,
        "has_5": has_5,
        "has_4": has_4,
        "qualified": qualified,
        "point_dice": remaining if qualified else [],
        "residual_dice": remaining,  # always exposed (qualified or not)
    }


class SideBetIn(BaseModel):
    """One side-bet placed at session start. Locked at first roll."""
    type: str = Field(min_length=2, max_length=32)
    amount: int = Field(ge=1, le=100000)


# Allowed side bets + their gross payout multipliers. Mirrors
# `vibe_654_dice.py:check_side_bets` but evaluated against the
# 5-dice ROLL #1 (not the residual). Gross payout = bet * mult,
# net to player = mult * bet (the bet itself is not refunded —
# it's already debited at start).
SIDE_BET_TYPES: Dict[str, int] = {
    "TRIPLE_6": 30,
    "ONE_AND_DONE": 10,
    "ANY_STRAIGHT": 100,
    "STRAIGHT_1": 500,
    "STRAIGHT_2": 500,
    "STRAIGHT_3": 500,
    "STRAIGHT_4": 500,
    "STRAIGHT_5": 500,
    "STRAIGHT_6": 500,
    "SMALL_STRAIGHT": 30,
    "LARGE_STRAIGHT": 100,
}


def _evaluate_side_bets(first_roll: List[int], side_bets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Evaluate side bets against the FIRST 5-dice roll. Returns one
    result row per bet (won boolean + payout int). Payout excludes the
    original stake — that was already debited."""
    results: List[Dict[str, Any]] = []
    if not first_roll or len(first_roll) < 5:
        # Defensive: side bets only evaluate vs the actual 5-dice opening roll.
        return [{"type": sb["type"], "amount": sb["amount"], "won": False, "payout": 0} for sb in side_bets]

    counts = {n: first_roll.count(n) for n in range(1, 7)}
    is_straight_set = len(set(first_roll)) == 1
    rolled_num = first_roll[0] if is_straight_set else 0
    sorted_uniq = sorted(set(first_roll))
    is_large_straight = sorted_uniq in ([1, 2, 3, 4, 5], [2, 3, 4, 5, 6])
    is_small_straight = any(
        sorted_uniq[i:i + 4] == list(range(sorted_uniq[i], sorted_uniq[i] + 4))
        for i in range(max(0, len(sorted_uniq) - 3))
    )

    for sb in side_bets:
        bet_type = sb["type"]
        amount = int(sb["amount"])
        won = False
        payout = 0

        if bet_type == "TRIPLE_6":
            won = counts[6] >= 3
        elif bet_type == "ONE_AND_DONE":
            won = all(x in first_roll for x in (6, 5, 4))
        elif bet_type == "ANY_STRAIGHT":
            won = is_straight_set
        elif bet_type.startswith("STRAIGHT_") and bet_type[9:].isdigit():
            n = int(bet_type[9:])
            won = is_straight_set and rolled_num == n
        elif bet_type == "SMALL_STRAIGHT":
            won = is_small_straight and not is_large_straight
        elif bet_type == "LARGE_STRAIGHT":
            won = is_large_straight

        if won:
            mult = SIDE_BET_TYPES.get(bet_type, 0)
            payout = amount * mult

        results.append({"type": bet_type, "amount": amount, "won": won, "payout": payout})
    return results


class StartPayload(BaseModel):
    bet: int = Field(default=0, ge=0, le=100000)
    side_bets: List[SideBetIn] = Field(default_factory=list, max_length=11)


class RollPayload(BaseModel):
    game_id: str


class StandPayload(BaseModel):
    game_id: str


@router.post("/vibez-654/start")
async def start_game(payload: StartPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")

    db = get_database()

    # Side-bet validation up-front: every bet type must be in the allowlist.
    side_bets_in: List[Dict[str, Any]] = []
    side_bets_total = 0
    for sb in payload.side_bets:
        if sb.type not in SIDE_BET_TYPES:
            raise HTTPException(400, f"Unknown side bet type: {sb.type}")
        side_bets_in.append({"type": sb.type, "amount": int(sb.amount)})
        side_bets_total += int(sb.amount)

    # Optional ₵ bet — debits stake + side-bet stakes immediately so the
    # money is locked. Settlement (winnings credit-back) happens on stand.
    debit_total = int(payload.bet) + side_bets_total
    if debit_total > 0:
        from utils.wallet_fields import pick_wallet_field_for_debit  # noqa: PLC0415
        u = await db.users.find_one(
            {"user_id": user.user_id},
            {"_id": 0, "token_balance": 1, "credits_balance": 1},
        ) or {}
        try:
            field, _bal = pick_wallet_field_for_debit(u, debit_total)
        except ValueError:
            raise HTTPException(402, "Insufficient ₵ Vibez Coin balance.")
        # Debit the combined stake atomically.
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$inc": {field: -debit_total}},
        )

    game = {
        "game_id": f"v654_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "bet": int(payload.bet),
        "side_bets": side_bets_in,            # what the player placed
        "side_bets_total": side_bets_total,    # debited up-front
        "side_bet_results": [],                # filled in on first roll
        "side_bet_payout": 0,                  # filled in on first roll
        # Dice state
        "has_6": False,
        "has_5": False,
        "has_4": False,
        "qualified": False,
        "point_dice": [],          # leftover dice once qualified
        "residual_dice": [],       # dice still in play (post-peel) — always populated
        "last_roll_dice": [],      # what the player just rolled
        "rolls": 0,
        "rolls_remaining": MAX_ROLLS,
        # Legacy compat fields so the old frontend still renders locked chips.
        "locked_dice": [],
        "unlocked_dice": [],
        # Meta
        "status": "active",
        "score": 0,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "history": [],
    }
    await db.vibez_654_games.insert_one(game)
    game.pop("_id", None)
    return game


@router.post("/vibez-654/roll")
async def roll_dice(payload: RollPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")

    db = get_database()
    game = await db.vibez_654_games.find_one(
        {"game_id": payload.game_id, "user_id": user.user_id},
        {"_id": 0},
    )
    if not game:
        raise HTTPException(404, "Game not found")
    if game["status"] != "active":
        raise HTTPException(400, f"Game is {game['status']}")
    if game["rolls"] >= MAX_ROLLS:
        raise HTTPException(400, "No rolls remaining — must stand")

    # Roll dice.
    # If not yet qualified → roll 5 minus whatever qualifiers already locked.
    # If qualified → re-roll the current point_dice (player wants to improve).
    has_6 = bool(game.get("has_6"))
    has_5 = bool(game.get("has_5"))
    has_4 = bool(game.get("has_4"))
    already_qualified_before = bool(game.get("qualified"))

    if already_qualified_before:
        num_to_roll = len(game.get("point_dice") or [])
        if num_to_roll == 0:
            num_to_roll = NUM_DICE - 3  # fallback safety
    else:
        num_to_roll = NUM_DICE - sum([has_6, has_5, has_4])

    fresh = [random.randint(1, 6) for _ in range(max(num_to_roll, 0))]

    if already_qualified_before:
        # Already qualified — the fresh dice ARE the new point dice. Don't
        # re-peel 6/5/4 because those qualifiers are already locked.
        point_dice = list(fresh)
        residual_dice = list(fresh)
        qualified = True
    else:
        out = _apply_654_pass(fresh, has_6, has_5, has_4)
        has_6, has_5, has_4 = out["has_6"], out["has_5"], out["has_4"]
        qualified = out["qualified"]
        point_dice = out["point_dice"]  # may be [] if not yet qualified
        residual_dice = out["residual_dice"]  # always populated

    rolls = game["rolls"] + 1
    rolls_remaining = MAX_ROLLS - rolls

    # SIDE BETS — evaluate ONLY on roll #1 against the full 5-dice opener.
    side_bet_results = list(game.get("side_bet_results") or [])
    side_bet_payout = int(game.get("side_bet_payout") or 0)
    if rolls == 1 and game.get("side_bets"):
        side_bet_results = _evaluate_side_bets(fresh, game["side_bets"])
        side_bet_payout = sum(r["payout"] for r in side_bet_results)

    # Legacy compat projection for any UI that still reads these fields.
    locked_dice: List[int] = []
    if has_6:
        locked_dice.append(6)
    if has_5:
        locked_dice.append(5)
    if has_4:
        locked_dice.append(4)
    unlocked_dice = point_dice if qualified else []

    update = {
        "has_6": has_6,
        "has_5": has_5,
        "has_4": has_4,
        "qualified": qualified,
        "point_dice": point_dice,
        "residual_dice": residual_dice,
        "last_roll_dice": fresh,
        "rolls": rolls,
        "rolls_remaining": rolls_remaining,
        "locked_dice": locked_dice,
        "unlocked_dice": unlocked_dice,
        "side_bet_results": side_bet_results,
        "side_bet_payout": side_bet_payout,
    }
    last_roll = {
        "roll_no": rolls,
        "dice": fresh,
        "has_6": has_6,
        "has_5": has_5,
        "has_4": has_4,
        "qualified": qualified,
        "point_dice": point_dice,
        "residual_dice": residual_dice,
    }
    game.update(update)

    # No rolls left → auto-settle.
    if rolls_remaining <= 0:
        return await _settle(db, game, auto_stand=True, last_roll=last_roll)

    await db.vibez_654_games.update_one(
        {"game_id": game["game_id"]},
        {"$set": update, "$push": {"history": last_roll}},
    )
    return {**game, "last_roll": last_roll}


@router.post("/vibez-654/stand")
async def stand(payload: StandPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")

    db = get_database()
    game = await db.vibez_654_games.find_one(
        {"game_id": payload.game_id, "user_id": user.user_id},
        {"_id": 0},
    )
    if not game:
        raise HTTPException(404, "Game not found")
    if game["status"] != "active":
        return {**game, "already_ended": True}
    return await _settle(db, game, auto_stand=False)


async def _settle(
    db,
    game: Dict[str, Any],
    auto_stand: bool,
    last_roll: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Finalise the game and settle the ₵ bet. Score = sum of point_dice if the
    player qualified (6-5-4 all locked); else 0.
    """
    qualified = bool(game.get("qualified"))
    point_dice = game.get("point_dice") or []
    score = sum(point_dice) if qualified else 0
    won = score > 0
    side_bet_payout = int(game.get("side_bet_payout") or 0)

    payout = 0
    net_payout = 0
    tax_deducted = 0
    if game["bet"] > 0 or side_bet_payout > 0:
        from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415
        # Pick whichever wallet field has the higher balance. Shared helper
        # keeps the value-based selection consistent across the codebase.
        uw = await db.users.find_one(
            {"user_id": game["user_id"]},
            {"_id": 0, "token_balance": 1, "credits_balance": 1},
        ) or {}
        field = pick_wallet_field_for_credit(uw)
        # Stake (and side-bet stakes) were already debited at start. Settlement
        # only CREDITS winnings — the original stakes are not refunded except
        # via the multiplier on a winning hand.
        credit_total = 0
        if won and game["bet"] > 0:
            # Bracketed payouts tuned for the real 5-dice score range (2-12):
            #   score  2-4  → 1.5x bet
            #   score  5-7  → 2x bet
            #   score  8-10 → 3x bet
            #   score 11-12 → 5x bet (two-sixes rarity)
            if score >= 11:
                multiplier = 5.0
            elif score >= 8:
                multiplier = 3.0
            elif score >= 5:
                multiplier = 2.0
            else:
                multiplier = 1.5
            payout = int(game["bet"] * multiplier)
            # Sovereign Tax — applied only to NET winnings (above stake).
            from services.sovereign_validator import apply_sovereign_tax  # noqa: PLC0415
            net_winnings = max(0, payout - int(game["bet"]))
            tax_split = apply_sovereign_tax(net_winnings)
            tax_deducted = tax_split["tax"]
            # Credit = stake-back + net winnings after tax.
            credit_total += int(game["bet"]) + tax_split["net"]
            net_payout = int(game["bet"]) + tax_split["net"]
            # Route the taxed portion through the Sovereign Treasury ledger.
            if tax_deducted > 0:
                from services.sovereign_engine import process_transaction  # noqa: PLC0415
                await process_transaction(
                    db,
                    user_id=game["user_id"],
                    amount=net_winnings,
                    tx_type="vibez_654_winnings",
                    metadata={"game_id": game["game_id"], "score": score},
                )

        # Side-bet winnings — credited gross (already-locked stakes don't come back;
        # only the multiplier payout does, matching the gross-payout convention in
        # `vibe_654_dice.py`).
        if side_bet_payout > 0:
            credit_total += side_bet_payout

        if credit_total > 0:
            await db.users.update_one(
                {"user_id": game["user_id"]},
                {"$inc": {field: credit_total}},
            )

    now = datetime.now(timezone.utc).isoformat()
    final = {
        "status": "ended",
        "score": score,
        "ended_at": now,
        "auto_stand": auto_stand,
        "payout": payout,
        "net_payout": net_payout,
        "sovereign_tax": tax_deducted,
    }
    push_op = {"$push": {"history": last_roll}} if last_roll else {}
    await db.vibez_654_games.update_one(
        {"game_id": game["game_id"]},
        {"$set": final, **push_op},
    )

    # Best-effort: friend-action notifier (Florida Flow social ping).
    try:
        from routes.friend_notifier import emit_friend_event
        await emit_friend_event(
            user_id=game["user_id"],
            event="VIBEZ_654_SCORE",
            payload={"score": score, "game_id": game["game_id"]},
        )
    except Exception:
        pass

    # Profit-share accrual — +1 stake per round played.
    try:
        from routes.profit_share import accrue_stake
        await accrue_stake(game["user_id"], "vibez_654_played", meta={"game_id": game["game_id"], "score": score})
    except Exception:
        pass

    return {**game, **final, "last_roll": last_roll}


@router.get("/vibez-654/state/{game_id}")
async def get_state(game_id: str, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    game = await db.vibez_654_games.find_one(
        {"game_id": game_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not game:
        raise HTTPException(404, "Game not found")
    return game


@router.get("/vibez-654/leaderboard")
async def leaderboard():
    """Top 10 highest non-zero scores in the last 24h."""
    db = get_database()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    cursor = db.vibez_654_games.find(
        {"status": "ended", "score": {"$gt": 0}, "ended_at": {"$gte": cutoff}},
        {"_id": 0, "user_id": 1, "score": 1, "game_id": 1, "ended_at": 1},
    ).sort("score", -1).limit(10)
    rows = await cursor.to_list(length=10)
    return {"window": "24h", "count": len(rows), "rows": rows}


@router.get("/vibez-654/history")
async def my_history(http_request: Request, limit: int = 10):
    """Caller's last `limit` ended games (newest first). Powers the Recent
    Rolls drawer in the player UI. Excludes _id, returns a compact shape."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    limit = max(1, min(int(limit), 50))
    cursor = db.vibez_654_games.find(
        {"user_id": user.user_id, "status": "ended"},
        {
            "_id": 0,
            "game_id": 1,
            "bet": 1,
            "score": 1,
            "qualified": 1,
            "point_dice": 1,
            "rolls": 1,
            "history": 1,
            "side_bets": 1,
            "side_bet_results": 1,
            "side_bet_payout": 1,
            "payout": 1,
            "net_payout": 1,
            "ended_at": 1,
        },
    ).sort("ended_at", -1).limit(limit)
    rows = await cursor.to_list(length=limit)
    return {"count": len(rows), "rows": rows}


@router.get("/vibez-654/side-bet-types")
async def side_bet_types():
    """Static catalog of side bets (type → multiplier). Frontend uses this to
    render the Side Bets drawer without hard-coding the table."""
    return {
        "types": [
            {"type": k, "multiplier": v, "label": k.replace("_", " ").title()}
            for k, v in SIDE_BET_TYPES.items()
        ]
    }
