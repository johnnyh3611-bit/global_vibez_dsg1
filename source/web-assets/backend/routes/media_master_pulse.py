"""Media Master Pulse — founder analytics endpoint.

Single-shot read returning a real-time snapshot of where attention and
money are flowing across the Media Master ecosystem:
  • Top hottest rooms by current Hype Score
  • Vibe Radio stations ranked by skip/keep pool size
  • Lifetime $VIBEZ deposited into each DSG TV channel
  • Affiliate Chair sponsor revenue leaderboard
  • Active break-in alert count
  • Last N auto-clips minted by AI Scout

Lives under `/api/media-master-pulse/*`. The admin frontend at
`/admin/media-master-pulse` renders this as a single founder ops pane.

Access policy: this is intentionally *read-only* and we trust the
`/admin/*` route guard in the frontend rather than re-implementing
admin auth here. Existing admin routes (admin.py, admin_dashboard.py)
also rely on the frontend guard + the absence of mutating endpoints.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorClient

from services.media_master_constants import (
    DSG_TV_CHANNELS, VIBE_RADIO_STATIONS,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/media-master-pulse", tags=["media-master-pulse"])

_db = AsyncIOMotorClient(os.environ.get("MONGO_URL"))[
    os.environ.get("DB_NAME", "global_vibez_dsg")
]


# ──────────────────────────────────────────── Helpers ──
async def _hottest_rooms(limit: int = 5) -> List[Dict[str, Any]]:
    """Return the top-N current rooms by latest hype_score."""
    cursor = _db.media_scout_hype.find({}, {"_id": 0}).sort("hype_score", -1)
    return await cursor.to_list(limit)


async def _station_bid_pools() -> List[Dict[str, Any]]:
    """For each Vibe Radio station, surface the active skip/keep pool
    (if any). Stations with no active bid show pools=0 so the dashboard
    can render a uniform row count."""
    out = []
    for s in VIBE_RADIO_STATIONS:
        bid = await _db.media_radio_skip_bids.find_one(
            {"station_id": s["station_id"], "status": "active"}, {"_id": 0},
        )
        out.append({
            "station_id": s["station_id"],
            "name": s["name"],
            "skip_pool": (bid or {}).get("skip_pool", 0),
            "keep_pool": (bid or {}).get("keep_pool", 0),
            "track_id": (bid or {}).get("track_id"),
        })
    # Sort by skip_pool desc so the most-pressured station is first
    out.sort(key=lambda r: r["skip_pool"], reverse=True)
    return out


async def _channel_revenue() -> List[Dict[str, Any]]:
    """Lifetime $VIBEZ deposited per DSG TV channel — aggregates the
    coin_ledger rows tagged with our unlock reason prefix."""
    rows: List[Dict[str, Any]] = []
    for ch in DSG_TV_CHANNELS:
        if not ch["requires_paywall"]:
            rows.append({
                "channel_id": ch["channel_id"],
                "name": ch["name"],
                "lifetime_coins": 0,
                "paywall": False,
            })
            continue
        # Match the exact reason string emitted by the unlock endpoint.
        reason_prefix = f"DSG TV unlock · {ch['name']}"
        pipeline = [
            {"$match": {"reason": reason_prefix}},
            # Ledger rows are negative for debits; we want the absolute total.
            {"$group": {"_id": None, "total": {"$sum": "$coins"}}},
        ]
        agg = await _db.coin_ledger.aggregate(pipeline).to_list(1)
        coins_in = abs(int((agg[0]["total"] if agg else 0)))
        rows.append({
            "channel_id": ch["channel_id"],
            "name": ch["name"],
            "lifetime_coins": coins_in,
            "paywall": True,
            "coin_price": ch["coin_price"],
        })
    rows.sort(key=lambda r: r["lifetime_coins"], reverse=True)
    return rows


async def _sponsor_leaderboard(limit: int = 10) -> List[Dict[str, Any]]:
    """Affiliate Chair holders ranked by `lifetime_payouts_coins`. The
    payouts counter is bumped by the (future) revenue-share allocator;
    today this surface shows 0s when nothing has flowed yet — that's
    a valid empty state rather than a bug."""
    cursor = _db.media_artist_sponsorships.find({}, {"_id": 0})
    rows = await cursor.to_list(500)
    by_chair: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        cid = r["chair_user_id"]
        if cid not in by_chair:
            by_chair[cid] = {
                "chair_user_id": cid,
                "sponsorship_count": 0,
                "lifetime_payouts_coins": 0,
            }
        by_chair[cid]["sponsorship_count"] += 1
        by_chair[cid]["lifetime_payouts_coins"] += int(r.get("lifetime_payouts_coins", 0))
    ranked = list(by_chair.values())
    ranked.sort(key=lambda r: r["lifetime_payouts_coins"], reverse=True)
    return ranked[:limit]


# ──────────────────────────────────────────── Endpoint ──
@router.get("/snapshot")
async def get_snapshot(hot_limit: int = 5, clip_limit: int = 8) -> Dict[str, Any]:
    """One-call founder dashboard read."""
    now_iso = datetime.now(timezone.utc).isoformat()

    # Active break-in alerts (unexpired).
    active_alerts = await _db.media_scout_alerts.find(
        {"expires_at": {"$gt": now_iso}}, {"_id": 0},
    ).sort("created_at", -1).to_list(50)

    # Latest auto-clips for the activity strip.
    recent_clips = await _db.media_scout_clips.find({}, {"_id": 0}).sort(
        "created_at", -1,
    ).to_list(clip_limit)

    hottest_rooms = await _hottest_rooms(hot_limit)
    station_pools = await _station_bid_pools()
    channel_revenue = await _channel_revenue()
    sponsors = await _sponsor_leaderboard()

    return {
        "generated_at": now_iso,
        "hottest_rooms": hottest_rooms,
        "station_bid_pools": station_pools,
        "channel_revenue": channel_revenue,
        "sponsor_leaderboard": sponsors,
        "active_break_ins": active_alerts,
        "recent_clips": recent_clips,
        "totals": {
            "total_lifetime_channel_coins": sum(c["lifetime_coins"] for c in channel_revenue),
            "active_sponsorships": sum(s["sponsorship_count"] for s in sponsors),
            "active_break_in_count": len(active_alerts),
        },
    }
