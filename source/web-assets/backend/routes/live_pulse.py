"""
Live Pulse — per-category live audience counter + Hot Rooms surfacer.

Two endpoints powering the dashboard's "Live Right Now" pill strip and
the "Hot Rooms" carousel directly beneath it:

  GET /api/live-pulse/categories  — per-category audience totals.
  GET /api/live-pulse/hot-rooms   — top N individual rooms by audience.

We aggregate whatever live-audience signals we already have today.
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
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
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


async def _streams_signal() -> tuple[Dict[str, int], List[Dict[str, Any]]]:
    """Pull live streams from `routes.streaming` (in-memory `mock_streams`
    today; will swap to MongoDB transparently when streaming.py migrates).
    Returns (per-category viewer-sum, normalized hot-room entries).

    Maps stream `category` → live-pulse category id. Anything we don't
    recognise rolls up under 'social' so the count is never invisible.
    """
    per_category: Dict[str, int] = {cid: 0 for cid in CATEGORY_IDS}
    hot: List[Dict[str, Any]] = []
    try:
        from routes.streaming import mock_streams  # noqa: PLC0415
    except Exception:
        return per_category, hot

    cat_map = {
        "gaming": "games",
        "music": "music",
        "dating": "dating",
        "watch": "watch",
        "lifestyle": "lifestyle",
        "social": "social",
    }
    for s in mock_streams.values():
        if not s.get("is_live"):
            continue
        cat = cat_map.get(s.get("category"), "social")
        viewers = int(s.get("viewers") or 0)
        if viewers <= 0:
            continue
        per_category[cat] = per_category.get(cat, 0) + viewers
        hot.append({
            "id": s.get("id"),
            "name": s.get("title") or "Live Stream",
            "category": cat,
            "audience": viewers,
            "path": f"/streaming/{s.get('id')}",
            "network": "LIVE_STREAM",
            # Cloudflare Stream playback URL goes here when wired. The
            # frontend prefers `preview_video_url` over the static image
            # when present — see HotRoomsCarousel preview popover. Mock
            # streams don't have one yet; emitted as None to lock the
            # contract.
            "preview_video_url": _cloudflare_preview_url(s),
        })
    return per_category, hot


def _cloudflare_preview_url(stream: Dict[str, Any]) -> Optional[str]:
    """Resolve a muted 30-second live preview URL for a stream.

    Today: returns None for every stream (Cloudflare Stream not wired).
    When `stream.cloudflare_playback_url` (HLS `.m3u8`) starts persisting,
    this is the only function that flips — the frontend already renders
    the `<video>` element when the field is non-null.
    """
    cf = stream.get("cloudflare_playback_url") or stream.get("hls_url")
    if not cf:
        return None
    # `#t=-30` is a media-fragment URI: the browser auto-scrubs to the
    # last 30 seconds of the live stream. HLS players ignore the fragment
    # server-side, so this is a safe append.
    return f"{cf}#t=-30"


@router.get("/categories")
async def get_category_pulse() -> Dict[str, Any]:
    """Return live audience counts keyed by category id.
    Shape: `{ "counts": { "watch": 12, "games": 0, ... }, "total": 12 }`.
    """
    counts: Dict[str, int] = {cid: 0 for cid in CATEGORY_IDS}
    try:
        counts["watch"] += await _sum_audience("cinema_network_rooms")
        counts["watch"] += await _sum_audience("cinema_rooms")
    except Exception as e:
        logger.warning("Live pulse 'watch' aggregation failed: %s", e)

    # Fold in live streams across every category they advertise.
    try:
        stream_counts, _ = await _streams_signal()
        for cid, n in stream_counts.items():
            counts[cid] = counts.get(cid, 0) + n
    except Exception as e:
        logger.warning("Live pulse streams aggregation failed: %s", e)

    return {
        "counts": counts,
        "total": sum(counts.values()),
    }


@router.get("/hot-rooms")
async def get_hot_rooms(limit: int = Query(default=3, ge=1, le=10)) -> Dict[str, Any]:
    """Return the top N individual rooms by audience across all live
    surfaces. Normalised into a single shape so the dashboard can render
    one carousel for everything.

    Shape: `{ "rooms": [{ id, name, category, audience, path, network }] }`.
    """
    rooms: List[Dict[str, Any]] = []
    try:
        # Free TV watch parties.
        async for doc in (
            _db().cinema_network_rooms
            .find({"audience_count": {"$gt": 0}, "is_private": False}, {"_id": 0})
            .sort("audience_count", -1)
            .limit(limit)
        ):
            rooms.append({
                "id": doc.get("room_id"),
                "name": doc.get("name") or "Free TV Room",
                "category": "watch",
                "audience": int(doc.get("audience_count") or 0),
                "path": f"/free-tv/{doc.get('room_id')}",
                "network": doc.get("active_network"),
                "preview_video_url": None,  # Cloudflare Stream future wire-up.
            })

        # DSG public-domain cinema rooms.
        async for doc in (
            _db().cinema_rooms
            .find({"audience_count": {"$gt": 0}, "is_private": False}, {"_id": 0})
            .sort("audience_count", -1)
            .limit(limit)
        ):
            rooms.append({
                "id": doc.get("room_id"),
                "name": doc.get("name") or "Cinema Room",
                "category": "watch",
                "audience": int(doc.get("audience_count") or 0),
                "path": "/cinema-room",
                "network": "DSG_CINEMA",
                "preview_video_url": None,  # Cloudflare Stream future wire-up.
            })
    except Exception as e:
        logger.warning("Live pulse hot-rooms Mongo aggregation failed: %s", e)

    # Live streams source is in-memory; never blocked by Mongo health.
    try:
        _, hot_streams = await _streams_signal()
        rooms.extend(hot_streams)
    except Exception as e:
        logger.warning("Live pulse hot-rooms streams signal failed: %s", e)

    # Category → preview image. Public-domain Unsplash thumbnails so the
    # carousel cards have a real cinematic preview even before live
    # thumbnails come online from Cloudflare Stream.
    _CAT_THUMB = {
        "watch":     "https://images.unsplash.com/photo-1485095329183-d0797cdc5676?w=640",
        "games":     "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=640",
        "music":     "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=640",
        "dating":    "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=640",
        "lifestyle": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=640",
        "social":    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=640",
        "earnings":  "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=640",
    }
    for r in rooms:
        r.setdefault("preview_image_url", _CAT_THUMB.get(r["category"], _CAT_THUMB["watch"]))

    # Final cross-source sort + trim. Cheap: at most 2 × limit entries.
    rooms.sort(key=lambda r: r["audience"], reverse=True)
    return {"rooms": rooms[:limit]}

