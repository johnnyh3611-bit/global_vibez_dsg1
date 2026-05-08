"""
Turn Timer — 15-second turn watchdog + FORCE_AUTO_PLAY fallback.

Implements `Global_Vibez_Sovereign_Game_Logic_Fix.pdf` directive B across
any card game that has a concept of "whose turn is it".

Each turn, the game route stamps `turn_started_at_ms = int(time.time()*1000)`
onto the game doc. Clients poll `POST /api/turn-timer/check` with
`{game_id, game_type, current_player}` and if the elapsed time exceeds
the 15-second threshold we flip `FORCE_AUTO_PLAY=true` on the doc so the
next route call auto-plays the lowest card.

Shared helpers so Bid Whist, Spades, any future turn-based game can
opt in with 3 lines of code.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.sovereign_validator import TURN_TIMER_MS, validate_turn_time
from utils.database import get_database

router = APIRouter(prefix="/turn-timer", tags=["turn-timer"])


GAME_COLLECTIONS: Dict[str, str] = {
    "bid_whist": "bid_whist_games",
    "spades": "spades_games",
    "hearts": "hearts_games",
}


def now_ms() -> int:
    return int(time.time() * 1000)


async def stamp_turn_start(db, game_type: str, game_id: str) -> None:
    """Called by a route every time the turn advances to a human player.
    Writes `turn_started_at_ms` onto the game doc."""
    coll_name = GAME_COLLECTIONS.get(game_type)
    if not coll_name:
        return
    await db[coll_name].update_one(
        {"game_id": game_id},
        {"$set": {
            "turn_started_at_ms": now_ms(),
            "turn_started_iso": datetime.now(timezone.utc).isoformat(),
        }},
    )


class TurnCheckPayload(BaseModel):
    game_id: str = Field(..., min_length=3)
    game_type: str = Field(..., min_length=3)
    current_player: Optional[str] = None


@router.post("/check")
async def check_turn(payload: TurnCheckPayload) -> Dict[str, Any]:
    """Returns `{status, elapsed_ms, timer_ms, should_auto_play}`.
    `status` is "TIME_OK" or "FORCE_AUTO_PLAY" per the PDF sentinel."""
    coll_name = GAME_COLLECTIONS.get(payload.game_type)
    if not coll_name:
        raise HTTPException(400, f"Unknown game_type: {payload.game_type}")
    db = get_database()
    game = await db[coll_name].find_one({"game_id": payload.game_id}, {"_id": 0, "turn_started_at_ms": 1})
    if not game:
        raise HTTPException(404, "Game not found")
    start_ms = int(game.get("turn_started_at_ms") or now_ms())
    elapsed_ms = now_ms() - start_ms
    status = validate_turn_time(start_ms)
    return {
        "status": status,
        "elapsed_ms": elapsed_ms,
        "timer_ms": TURN_TIMER_MS,
        "should_auto_play": status == "FORCE_AUTO_PLAY",
    }


def pick_lowest_card(hand: list, led_suit: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Return the lowest-value card in `hand`. If `led_suit` is provided
    and the player holds that suit, must-follow — pick the lowest of that
    suit. This is the "AI plays their lowest card" rule from PDF-B."""
    if not hand:
        return None
    rank_map = {"2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
                "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14}
    def rank_of(card: Dict[str, Any]) -> int:
        v = card.get("value", card.get("rank"))
        if isinstance(v, (int, float)):
            return int(v)
        return rank_map.get(str(v).upper(), 0)
    if led_suit:
        suited = [c for c in hand if str(c.get("suit", "")).lower() == str(led_suit).lower()]
        if suited:
            return min(suited, key=rank_of)
    return min(hand, key=rank_of)


__all__ = [
    "router",
    "stamp_turn_start",
    "check_turn",
    "pick_lowest_card",
    "GAME_COLLECTIONS",
]
