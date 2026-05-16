"""
Live Pulse — per-category live audience counter.

A single aggregator endpoint that powers the dashboard's "Live Right Now"
pill strip above the category tabs. We aggregate whatever live-audience
signals we already have today and return a single dict keyed by the
exact category IDs the frontend uses.

Today we have two reliable sources of truth:
  • `cinema_network_rooms.audience_count` — Free TV watch parties
  • `cinema_rooms.audience_count`         — DSG public-domain cinema

Both roll up into the 'watch' category. Other categories return 0 until
their respective rooms also persist a live audience count (tracked in
ROADMAP.md). The contract stays stable — frontend never breaks.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict

from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/live-pulse", tags=["live-pulse"])


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


# Category IDs MUST match `CATEGORIES` in DashboardNew.tsx so the pill
# and the tab strip read from the same vocabulary.
CATEGORY_IDS = ["watch", "dating", "games", "music", "lifestyle", "social", "earnings"]


async def _sum_audience(coll_name: str) -> int:
    """Return the sum of `audience_count` across rooms with at least one
    live viewer. We exclude `audience_count == 0` rows to keep the cursor
    cheap on tables that grow indefinitely."""
    coll = _db()[coll_name]
    total = 0
    async for doc in coll.find({"audience_count": {"$gt": 0}}, {"_id": 0, "audience_count": 1}):
        try:
            total += int(doc.get("audience_count") or 0)
        except (TypeError, ValueError):
            continue
    return total


@router.get("/categories")
async def get_category_pulse() -> Dict[str, Any]:
    """Return live audience counts keyed by category id.
    Shape: `{ "counts": { "watch": 12, "games": 0, ... }, "total": 12 }`.
    """
    watch_total = 0
    try:
        watch_total += await _sum_audience("cinema_network_rooms")
        watch_total += await _sum_audience("cinema_rooms")
    except Exception as e:
        logger.warning("Live pulse 'watch' aggregation failed: %s", e)

    counts: Dict[str, int] = {cid: 0 for cid in CATEGORY_IDS}
    counts["watch"] = watch_total
    return {
        "counts": counts,
        "total": sum(counts.values()),
    }
