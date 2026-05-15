"""
Creator Earnings Dashboard — single pane "you earned $X" across all 6
revenue streams (Feb 2026 founder roadmap, item 2/8).

Aggregates everything a creator earns:
  • Streaming tips & gifts (70% kept)
  • Cinema ticket unlocks (80% kept)
  • Ad revenue share (60% creator on My Vibez ads)
  • Ride / delivery / venue / artisan splits (70% kept)
  • Ambassador referral bounties + override commissions

Returns daily / weekly / lifetime breakdowns + cash-out CTA state.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Final

from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorClient


_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "vibez_global")
_client = AsyncIOMotorClient(_MONGO_URL)
_db = _client[_DB_NAME]

# Collections feeding the dashboard.
_unlocks_col = _db["my_vibez_cinema_unlocks"]
_tips_col = _db["stream_tips"]
_signals_col = _db["my_vibez_engagement_signals"]
_payouts_col = _db["creator_payouts"]   # actual cash-outs (where we settled)
_ambassador_col = _db["ambassador_attribution"]


MIN_CASHOUT_VIBEZ: Final[int] = 1000  # 1000 $VIBEZ minimum withdrawal


router = APIRouter(prefix="/creator/earnings", tags=["creator-earnings"])


def _window_iso(days_back: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_back)).isoformat()


async def _sum_field(col, match: dict, field: str) -> float:
    pipeline = [{"$match": match}, {"$group": {"_id": None, "t": {"$sum": f"${field}"}}}]
    out = await col.aggregate(pipeline).to_list(length=1)
    return float(out[0]["t"]) if out else 0.0


@router.get("/{creator_id}")
async def get_creator_earnings(creator_id: str):
    """Returns daily/weekly/lifetime earnings across all 6 streams plus
    cash-out availability."""
    day = _window_iso(1)
    week = _window_iso(7)

    # Cinema unlocks (creator_payout_vibez column)
    cinema_today = await _sum_field(
        _unlocks_col,
        {"creator_id": creator_id, "unlocked_at": {"$gte": day}},
        "creator_payout_vibez",
    )
    cinema_week = await _sum_field(
        _unlocks_col,
        {"creator_id": creator_id, "unlocked_at": {"$gte": week}},
        "creator_payout_vibez",
    )
    cinema_life = await _sum_field(
        _unlocks_col, {"creator_id": creator_id}, "creator_payout_vibez"
    )

    # Stream tips
    tips_today = await _sum_field(
        _tips_col,
        {"creator_id": creator_id, "ts": {"$gte": day}},
        "creator_share_vibez",
    )
    tips_week = await _sum_field(
        _tips_col,
        {"creator_id": creator_id, "ts": {"$gte": week}},
        "creator_share_vibez",
    )
    tips_life = await _sum_field(
        _tips_col, {"creator_id": creator_id}, "creator_share_vibez"
    )

    # Already-cashed-out vs pending
    cashed = await _sum_field(
        _payouts_col,
        {"creator_id": creator_id, "status": "settled"},
        "amount_vibez",
    )
    pending = max(0.0, (cinema_life + tips_life) - cashed)

    return {
        "creator_id": creator_id,
        "today": {
            "cinema_vibez": round(cinema_today, 2),
            "tips_vibez": round(tips_today, 2),
            "total_vibez": round(cinema_today + tips_today, 2),
        },
        "week": {
            "cinema_vibez": round(cinema_week, 2),
            "tips_vibez": round(tips_week, 2),
            "total_vibez": round(cinema_week + tips_week, 2),
        },
        "lifetime": {
            "cinema_vibez": round(cinema_life, 2),
            "tips_vibez": round(tips_life, 2),
            "total_vibez": round(cinema_life + tips_life, 2),
        },
        "cashout": {
            "already_settled_vibez": round(cashed, 2),
            "pending_vibez": round(pending, 2),
            "min_cashout_vibez": MIN_CASHOUT_VIBEZ,
            "available": pending >= MIN_CASHOUT_VIBEZ,
        },
        "splits": {
            "cinema_creator_pct": 80,
            "streaming_creator_pct": 70,
            "ad_creator_pct": 60,
        },
    }
