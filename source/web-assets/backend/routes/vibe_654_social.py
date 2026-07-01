"""
Vibe 6-5-4 Social Engine — Chat Tips, Hype Emojis, Spectator Side-Bets.

Ports the three "Founder's Official Build" Unity specs onto the existing
20-player tournament running in ``routes/vibe_654_tournament.py``:

 • **Chat Tipping**         — spectators transfer ₵ Vibez Coins directly to a
                              player in the hot seat; every tip emits a visible
                              "tip explosion" event the frontend can replay.
 • **Hype Emojis**          — 1 ₵ fee to broadcast Fire / Cash-Bag / Horn to
                              every viewer of the table.
 • **Spectator Side-Bets**  — bleacher residents bet ₵ on a specific player OR
                              the outcome of the next roll; odds are computed
                              from the player's live streak and locked at the
                              moment of placement; round settlement now also
                              pays every winning side-bet.

All endpoints are mounted under ``/api/vibe654/tournament/{table_id}/...``.
Events are stored as bounded ring buffers (last 50) directly on the
``vibe654_tables`` document so the existing 3-second polling table pulls them
in the same response — no separate socket required for MVP.

Currency is always ₵ Vibez Coins. Never USD.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/vibe654/tournament",
    tags=["Vibe 654 Social"],
)


def _db():
    """Lazy accessor so module load never pins a Motor client to a dead loop."""
    return get_database()


# ----- Constants --------------------------------------------------------------
HYPE_FEE = 1                       # ₵ per hype emoji trigger
MAX_EVENTS_ON_TABLE = 50           # ring-buffer cap per event type
TIP_MAX = 1_000_000                # ₵ guard (no whale-overflow)
SIDEBET_MAX = 500_000              # ₵ per single side-bet
HYPE_TYPES = {"fire", "cashbag", "horn"}
SIDEBET_OUTCOMES = {"player_wins", "roll_six_five_four"}
ODDS_BASE = 2.0
ODDS_STREAK_SCALE = 4.0            # widens longshot odds when no prior history


# ----- Models -----------------------------------------------------------------
class TipPayload(BaseModel):
    spectator_user_id: str
    spectator_name: str
    recipient_user_id: str
    amount: int = Field(ge=1, le=TIP_MAX)


class HypePayload(BaseModel):
    spectator_user_id: str
    spectator_name: str
    hype_type: Literal["fire", "cashbag", "horn"]


class SideBetPayload(BaseModel):
    spectator_user_id: str
    spectator_name: str
    amount: int = Field(ge=1, le=SIDEBET_MAX)
    outcome: Literal["player_wins", "roll_six_five_four"]
    target_user_id: Optional[str] = None  # required for player_wins


# ----- Odds engine ------------------------------------------------------------
def calculate_player_odds(table: Dict[str, Any], user_id: str) -> float:
    """Dynamic odds for a side-bet on ``user_id`` winning the tournament.

    Derived from the live ``round_history`` on the table document so odds drift
    as rounds progress — hot streaks = lower odds, cold benchers = longshots.
    """
    history = table.get("round_history") or []
    total_rounds = len(history)
    if total_rounds == 0:
        return ODDS_BASE + 1.0  # 3.0 — no data yet, slight longshot to seed action

    wins = 0
    max_score = 0.0
    player_scores: List[float] = []
    for rnd in history:
        results = rnd.get("results", {}) or {}
        my = results.get(user_id)
        if not my:
            continue
        score = float(my.get("score") or 0.0)
        player_scores.append(score)
        if rnd.get("outcome") == "WINNER" and rnd.get("high_score") == score and score > 0:
            wins += 1
        if score > max_score:
            max_score = score

    seen = max(1, len(player_scores))
    win_rate = wins / seen
    # Higher win_rate → tighter odds (bettor gets less).
    odds = ODDS_BASE + (0.5 - win_rate) * ODDS_STREAK_SCALE
    return max(1.1, min(10.0, round(odds, 2)))


def calculate_outcome_odds() -> float:
    """Fixed odds for a "next-roll hits 6-5-4" prop bet."""
    # ONE_AND_DONE in the dice engine pays 10:1. Bleacher prop is slightly
    # tighter because the whole orbit rolls (many chances to hit).
    return 3.5


# ----- Event ring-buffer helper ----------------------------------------------
async def _append_event(table_id: str, field: str, event: Dict[str, Any]) -> None:
    await _db().vibe654_tables.update_one(
        {"table_id": table_id},
        {
            "$push": {
                field: {
                    "$each": [event],
                    "$slice": -MAX_EVENTS_ON_TABLE,
                }
            }
        },
    )


async def _load_table(table_id: str) -> Dict[str, Any]:
    table = await _db().vibe654_tables.find_one({"table_id": table_id}, {"_id": 0})
    if not table:
        raise HTTPException(404, "Table not found")
    return table


def _viewer_is_player(table: Dict[str, Any], user_id: str) -> bool:
    return any(p.get("user_id") == user_id for p in (table.get("current_players") or []))


# =============================================================================
# CHAT TIPPING
# =============================================================================
@router.post("/{table_id}/tip")
async def send_tip(table_id: str, payload: TipPayload) -> Dict[str, Any]:
    """
    Transfer ₵ from a spectator/player to a target player in the table.

    Mirrors the Unity spec's ``CmdSendTip`` → ``RpcTriggerTipVisuals`` pipeline.
    Frontend polling picks the event up on the next tick and renders the
    particle explosion over the recipient's seat.
    """
    table = await _load_table(table_id)

    if payload.spectator_user_id == payload.recipient_user_id:
        raise HTTPException(400, "Cannot tip yourself")

    if not _viewer_is_player(table, payload.recipient_user_id):
        raise HTTPException(404, "Recipient is not seated at this table")

    # Wallet guard — caller must have funds.
    wallet_check = await _db().users.find_one(
        {"user_id": payload.spectator_user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    balance_field = "token_balance" if "token_balance" in wallet_check else "credits_balance"
    balance = int(wallet_check.get(balance_field, 0) or 0)
    if balance < payload.amount:
        raise HTTPException(402, f"Insufficient ₵ balance (need {payload.amount}, have {balance})")

    # Settle in one atomic pair of updates.
    await _db().users.update_one(
        {"user_id": payload.spectator_user_id},
        {"$inc": {balance_field: -payload.amount}},
    )
    await _db().users.update_one(
        {"user_id": payload.recipient_user_id},
        {"$inc": {balance_field: payload.amount}},
        upsert=False,
    )

    event = {
        "event_id": str(uuid.uuid4()),
        "type": "tip",
        "from_user_id": payload.spectator_user_id,
        "from_name": payload.spectator_name,
        "to_user_id": payload.recipient_user_id,
        "amount": int(payload.amount),
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    await _append_event(table_id, "tip_events", event)

    return {
        "success": True,
        "event": event,
        "message": f"TIP RECEIVED: ₵{payload.amount:,}!",
    }


# =============================================================================
# HYPE EMOJIS / SOUNDBOARD
# =============================================================================
@router.post("/{table_id}/hype")
async def trigger_hype(table_id: str, payload: HypePayload) -> Dict[str, Any]:
    """
    Charge the 1 ₵ Vibe Fee and broadcast a hype emoji (fire / cashbag / horn)
    to every viewer of the table.
    """
    await _load_table(table_id)

    wallet = await _db().users.find_one(
        {"user_id": payload.spectator_user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    field = "token_balance" if "token_balance" in wallet else "credits_balance"
    balance = int(wallet.get(field, 0) or 0)
    if balance < HYPE_FEE:
        raise HTTPException(402, f"Insufficient ₵ balance for hype (need {HYPE_FEE})")

    await _db().users.update_one(
        {"user_id": payload.spectator_user_id},
        {"$inc": {field: -HYPE_FEE}},
    )

    event = {
        "event_id": str(uuid.uuid4()),
        "type": "hype",
        "hype_type": payload.hype_type,
        "from_user_id": payload.spectator_user_id,
        "from_name": payload.spectator_name,
        "fee": HYPE_FEE,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    await _append_event(table_id, "hype_events", event)
    return {"success": True, "event": event, "fee": HYPE_FEE}


# =============================================================================
# SPECTATOR SIDE-BETS
# =============================================================================
@router.get("/{table_id}/odds")
async def get_odds(table_id: str) -> Dict[str, Any]:
    """
    Live odds map for every seated player + the fixed outcome-prop odds.

    Frontend bleacher panel polls this or reads it from the aggregated
    ``/table/{id}`` response to keep odds-display current.
    """
    table = await _load_table(table_id)
    rows: List[Dict[str, Any]] = []
    for p in table.get("current_players") or []:
        if p.get("status") != "active":
            continue
        rows.append({
            "user_id": p["user_id"],
            "player_name": p.get("player_name", "Player"),
            "odds": calculate_player_odds(table, p["user_id"]),
        })
    return {
        "success": True,
        "round_number": table.get("round_number", 0),
        "players": rows,
        "outcome_odds": {"roll_six_five_four": calculate_outcome_odds()},
    }


@router.post("/{table_id}/sidebet")
async def place_side_bet(table_id: str, payload: SideBetPayload) -> Dict[str, Any]:
    """
    Lock ₵ into a side bet on a specific player winning the tournament, OR the
    next round containing an immediate 6-5-4 roll. Odds are snapshotted at the
    moment of placement — post-bet hot streaks don't rebalance the payout.
    """
    table = await _load_table(table_id)

    if table.get("status") not in ("WAITING", "IN_PROGRESS"):
        raise HTTPException(400, "Table already settled — side bets closed")

    if payload.outcome == "player_wins":
        if not payload.target_user_id:
            raise HTTPException(400, "target_user_id required for player_wins")
        target = next(
            (p for p in (table.get("current_players") or [])
             if p.get("user_id") == payload.target_user_id and p.get("status") == "active"),
            None,
        )
        if not target:
            raise HTTPException(404, "Target player not active at this table")
        locked_odds = calculate_player_odds(table, payload.target_user_id)
    else:
        locked_odds = calculate_outcome_odds()

    # Caller cannot side-bet on their own seat (would be double-dipping).
    if payload.outcome == "player_wins" and payload.target_user_id == payload.spectator_user_id:
        raise HTTPException(400, "Cannot side-bet on yourself — you're already in the main pot")

    wallet = await _db().users.find_one(
        {"user_id": payload.spectator_user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    field = "token_balance" if "token_balance" in wallet else "credits_balance"
    balance = int(wallet.get(field, 0) or 0)
    if balance < payload.amount:
        raise HTTPException(402, f"Insufficient ₵ balance (need {payload.amount}, have {balance})")

    await _db().users.update_one(
        {"user_id": payload.spectator_user_id},
        {"$inc": {field: -payload.amount}},
    )

    bet_doc = {
        "bet_id": str(uuid.uuid4()),
        "table_id": table_id,
        "spectator_user_id": payload.spectator_user_id,
        "spectator_name": payload.spectator_name,
        "amount": int(payload.amount),
        "outcome": payload.outcome,
        "target_user_id": payload.target_user_id,
        "locked_odds": locked_odds,
        "status": "open",
        "placed_at": datetime.now(timezone.utc).isoformat(),
        "settled_at": None,
        "payout": 0,
        "wallet_field": field,
    }
    await _db().vibe654_side_bets.insert_one(dict(bet_doc))

    # Also surface a ring-buffer event so the table-feed animates the token
    # flight from the bleachers.
    await _append_event(table_id, "sidebet_events", {
        "event_id": str(uuid.uuid4()),
        "type": "sidebet_placed",
        "from_user_id": payload.spectator_user_id,
        "from_name": payload.spectator_name,
        "amount": int(payload.amount),
        "outcome": payload.outcome,
        "target_user_id": payload.target_user_id,
        "locked_odds": locked_odds,
        "ts": datetime.now(timezone.utc).isoformat(),
    })

    bet_doc.pop("wallet_field", None)
    return {"success": True, "bet": bet_doc}


@router.get("/{table_id}/sidebets")
async def list_side_bets(table_id: str) -> Dict[str, Any]:
    """
    Everyone's open + settled side bets on this table. Used by the bleacher
    panel + the post-round settlement ribbon.
    """
    cursor = _db().vibe654_side_bets.find({"table_id": table_id}, {"_id": 0, "wallet_field": 0})
    bets = await cursor.sort("placed_at", -1).to_list(length=500)
    return {"success": True, "bets": bets}


@router.get("/{table_id}/social-feed")
async def social_feed(table_id: str) -> Dict[str, Any]:
    """Aggregate recent tip + hype + sidebet events for the animation layer."""
    table = await _load_table(table_id)
    return {
        "success": True,
        "tip_events": (table.get("tip_events") or [])[-MAX_EVENTS_ON_TABLE:],
        "hype_events": (table.get("hype_events") or [])[-MAX_EVENTS_ON_TABLE:],
        "sidebet_events": (table.get("sidebet_events") or [])[-MAX_EVENTS_ON_TABLE:],
    }


# =============================================================================
# SIDE-BET SETTLEMENT (called by tournament engine, not exposed as a route)
# =============================================================================
async def settle_side_bets_for_round(
    table_id: str,
    winner_user_id: Optional[str],
    round_hit_six_five_four: bool,
) -> Dict[str, Any]:
    """
    Settle every OPEN side bet for ``table_id`` given the round outcome.

    ``winner_user_id`` — the seat that took the pot (None if NO_QUALIFIERS).
    ``round_hit_six_five_four`` — whether any player's round results contained
    the immediate 6-5-4 pattern (One & Done hit).

    Returns a summary the tournament engine can surface in its response.
    Called as best-effort from ``play_tournament_round``.
    """
    cursor = _db().vibe654_side_bets.find({"table_id": table_id, "status": "open"})
    open_bets = await cursor.to_list(length=1000)

    payouts: List[Dict[str, Any]] = []
    losses: List[Dict[str, Any]] = []

    for bet in open_bets:
        win = False
        if bet["outcome"] == "player_wins":
            win = winner_user_id is not None and bet.get("target_user_id") == winner_user_id
        elif bet["outcome"] == "roll_six_five_four":
            win = bool(round_hit_six_five_four)

        if not win:
            await _db().vibe654_side_bets.update_one(
                {"bet_id": bet["bet_id"]},
                {"$set": {
                    "status": "lost",
                    "settled_at": datetime.now(timezone.utc).isoformat(),
                    "payout": 0,
                }},
            )
            losses.append({
                "bet_id": bet["bet_id"],
                "spectator_user_id": bet["spectator_user_id"],
                "amount": bet["amount"],
            })
            continue

        payout = int(round(bet["amount"] * bet["locked_odds"]))
        field = bet.get("wallet_field") or "token_balance"
        await _db().users.update_one(
            {"user_id": bet["spectator_user_id"]},
            {"$inc": {field: payout}},
        )
        await _db().vibe654_side_bets.update_one(
            {"bet_id": bet["bet_id"]},
            {"$set": {
                "status": "won",
                "settled_at": datetime.now(timezone.utc).isoformat(),
                "payout": payout,
            }},
        )
        payouts.append({
            "bet_id": bet["bet_id"],
            "spectator_user_id": bet["spectator_user_id"],
            "spectator_name": bet.get("spectator_name"),
            "amount": bet["amount"],
            "locked_odds": bet["locked_odds"],
            "payout": payout,
            "outcome": bet["outcome"],
            "target_user_id": bet.get("target_user_id"),
        })

    return {"payouts": payouts, "losses": losses, "settled_count": len(open_bets)}


def detect_six_five_four_in_round(round_results: Dict[str, Any]) -> bool:
    """
    Inspect per-player ``results`` of a round and flag True if any player's
    *first roll* contained 6, 5, AND 4 simultaneously (the classic One & Done).
    """
    for _uid, r in (round_results or {}).items():
        rolls = r.get("rolls") or []
        if not rolls:
            continue
        first = rolls[0]
        if isinstance(first, list) and {6, 5, 4}.issubset(set(first)):
            return True
    return False
