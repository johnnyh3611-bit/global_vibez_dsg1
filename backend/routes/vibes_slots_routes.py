"""
Vibes Slots HTTP routes — thin layer over services/vibes_slots.py.

Routes (prefix /api/games/vibes-slots):
  GET  /constants               Game constants for frontend
  GET  /jackpot/current         Live progressive jackpot amount + last winner
  POST /jackpot/feed            (admin) manually feed the jackpot pool
  POST /spin                    Execute one spin

Module-level JackpotPool. Production should mirror to MongoDB; this preview
keeps it in-process and survives only the backend lifetime.
"""
from __future__ import annotations

import random
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional

from services.vibes_slots import (
    REEL_COUNT, SYMBOLS,
    execute_spin,
    JackpotPool, feed_jackpot, reset_jackpot_after_win,
)
from services.coming_soon_engines import (
    VIBES_SLOTS_RTP, VIBES_SLOTS_JACKPOT_FEED_PCT,
)

router = APIRouter(prefix="/games/vibes-slots", tags=["vibes-slots"])

# In-process jackpot pool — seeded at $100,000.
_jackpot = JackpotPool()


class SpinRequest(BaseModel):
    stake: float = Field(..., ge=50)
    user_id: Optional[str] = None
    seed: Optional[int] = None
    active_user_count: int = Field(0, ge=0)


@router.get("/constants")
def constants() -> Dict:
    return {
        "name":               "Vibes Slots",
        "tagline":            "5 Reels · 1 Payline · Hit 5 Jokers for SOVEREIGN RAIN",
        "reel_count":         REEL_COUNT,
        "rtp_target":         VIBES_SLOTS_RTP,
        "jackpot_feed_pct":   VIBES_SLOTS_JACKPOT_FEED_PCT,
        "symbols":            {k: {"emoji": v["emoji"], "pay_3": v["pay_3"],
                                   "pay_4": v["pay_4"], "pay_5": v["pay_5"],
                                   "is_jackpot": v["is_jackpot"], "is_wild": v["is_wild"]}
                               for k, v in SYMBOLS.items()},
    }


@router.get("/jackpot/current")
def get_jackpot() -> Dict:
    return {
        "current_amount": _jackpot.current_amount,
        "last_winner":    _jackpot.last_winner,
        "last_won_at":    _jackpot.last_won_at,
    }


@router.post("/spin")
def spin(req: SpinRequest) -> Dict:
    res = execute_spin(
        stake=req.stake,
        seed=req.seed,
        active_user_count=req.active_user_count,
    )

    # Feed the jackpot pool with the 1% contribution
    feed_jackpot(_jackpot, res.jackpot_feed)

    # If jackpot hit, pay it out and reset the pool
    jackpot_paid = 0.0
    if res.is_jackpot_hit:
        won_at = datetime.now(timezone.utc).isoformat()
        winner_id = req.user_id or "anonymous"
        jackpot_paid, _ = reset_jackpot_after_win(_jackpot, winner_id, won_at)

    return {
        "reels":              res.reels,
        "stake":              res.stake,
        "matches":            res.matches,
        "anchor_symbol":      res.anchor_symbol,
        "payout_multiplier":  res.payout_multiplier,
        "gross_payout":       res.gross_payout,
        "jackpot_feed":       res.jackpot_feed,
        "jackpot_paid":       jackpot_paid,
        "is_jackpot_hit":     res.is_jackpot_hit,
        "sovereign_rain":     res.sovereign_rain_event,
        "current_jackpot":    _jackpot.current_amount,
    }


__all__ = ["router"]
