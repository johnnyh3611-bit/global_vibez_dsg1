"""
Recent Rooms — per-user room visit ledger for the Volumetric Galaxy
"Personal Homeworld" feature (2026-05-12 founder ask).

Every time a user visits a tracked room we log a row; the Volumetric
Galaxy queries this on mount to overlay each planet thumbnail with the
user's most-played room IN THAT CATEGORY (their "homeworld" planet).

Anti-abuse: cooldown of 5 seconds per (user, path) pair so a route
React-StrictMode double-fire doesn't double-count.

ENDPOINTS:
  POST /api/recent-rooms/log        — log a visit (idempotent within 5s)
  GET  /api/recent-rooms/me         — caller's per-category top rooms
  GET  /api/recent-rooms/leaderboard — global top rooms (5 min cache)
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

router = APIRouter()

COOLDOWN_SECONDS = 5  # anti-double-count


class LogPayload(BaseModel):
    path: str = Field(min_length=2, max_length=128)
    category: str = Field(min_length=2, max_length=24)
    label: Optional[str] = Field(default=None, max_length=64)
    emoji: Optional[str] = Field(default=None, max_length=8)


@router.post("/recent-rooms/log")
async def log_room_visit(payload: LogPayload, http_request: Request):
    """Log a single room visit. Idempotent within COOLDOWN_SECONDS."""
    user = await get_current_user(http_request)
    if not user:
        # Anonymous visitors can't have a homeworld — silent 204-ish.
        return {"status": "anon_skipped"}
    db = get_database()
    now = datetime.now(timezone.utc)
    threshold = (now - timedelta(seconds=COOLDOWN_SECONDS)).isoformat()
    # Cooldown: ignore if we already logged this user+path in the last 5s.
    recent = await db.room_visits.find_one(
        {"user_id": user.user_id, "path": payload.path, "visited_at": {"$gte": threshold}},
        {"_id": 0, "_visit_id": 1},
    )
    if recent:
        return {"status": "cooldown_skipped"}
    await db.room_visits.insert_one({
        "user_id": user.user_id,
        "path": payload.path,
        "category": payload.category,
        "label": payload.label,
        "emoji": payload.emoji,
        "visited_at": now.isoformat(),
    })
    return {"status": "logged", "path": payload.path}


@router.get("/recent-rooms/me")
async def my_homeworlds(http_request: Request):
    """Return caller's top room per category — the 'homeworld' for the
    Volumetric Galaxy thumbnail overlay."""
    user = await get_current_user(http_request)
    if not user:
        return {"homeworlds": {}}
    db = get_database()
    pipeline = [
        {"$match": {"user_id": user.user_id}},
        {"$group": {
            "_id": {"category": "$category", "path": "$path"},
            "visits": {"$sum": 1},
            "last_visited_at": {"$max": "$visited_at"},
            "label": {"$last": "$label"},
            "emoji": {"$last": "$emoji"},
        }},
        {"$sort": {"_id.category": 1, "visits": -1, "last_visited_at": -1}},
        {"$group": {
            "_id": "$_id.category",
            "top_path": {"$first": "$_id.path"},
            "top_label": {"$first": "$label"},
            "top_emoji": {"$first": "$emoji"},
            "top_visits": {"$first": "$visits"},
        }},
    ]
    rows = await db.room_visits.aggregate(pipeline).to_list(50)
    homeworlds: Dict[str, Any] = {}
    for r in rows:
        homeworlds[r["_id"]] = {
            "path": r["top_path"],
            "label": r["top_label"],
            "emoji": r["top_emoji"],
            "visits": r["top_visits"],
        }
    return {"homeworlds": homeworlds}


@router.get("/recent-rooms/leaderboard")
async def leaderboard():
    """Public — top rooms by visit count across all users."""
    db = get_database()
    pipeline = [
        {"$group": {
            "_id": "$path",
            "visits": {"$sum": 1},
            "category": {"$first": "$category"},
            "label": {"$first": "$label"},
            "emoji": {"$first": "$emoji"},
        }},
        {"$sort": {"visits": -1}},
        {"$limit": 20},
        {"$project": {"_id": 0, "path": "$_id", "visits": 1, "category": 1, "label": 1, "emoji": 1}},
    ]
    rows = await db.room_visits.aggregate(pipeline).to_list(20)
    return {"count": len(rows), "rows": rows}
