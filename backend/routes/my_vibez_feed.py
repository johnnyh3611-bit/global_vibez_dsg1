"""
Personalized For You Feed — heuristic ranker for the My Vibez short-form
video loop (Feb 2026 founder roadmap, item 1/8).

This is an MVP heuristic ranker that captures the TikTok-style signals
without needing a trained ML model on day one. Score formula:

    score = (engagement_rate * 0.45)
          + (creator_score   * 0.20)
          + (recency_boost   * 0.20)
          + (category_match  * 0.10)
          + (watch_completion * 0.05)

Where:
  • engagement_rate = (likes + 2*comments + 3*shares) / max(views, 1)
  • creator_score   = streamer's tier multiplier (1.0 → 2.0 for verified)
  • recency_boost   = exp(-hours_since_post / 48)
  • category_match  = 1.0 if matches user's last-viewed category, else 0.3
  • watch_completion = ema of viewer's avg completion %

Tracks engagement signals in MongoDB so the ranker improves over time.
Plugs into routes/my_vibez_optimization.py for theme metadata.
"""
from __future__ import annotations

import math
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field


_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "vibez_global")
_client = AsyncIOMotorClient(_MONGO_URL)
_db = _client[_DB_NAME]
_videos_col = _db["my_vibez_videos"]
_signals_col = _db["my_vibez_engagement_signals"]
_user_prefs_col = _db["my_vibez_user_prefs"]


SCORE_WEIGHTS = {
    "engagement": 0.45,
    "creator": 0.20,
    "recency": 0.20,
    "category_match": 0.10,
    "watch_completion": 0.05,
}


def _engagement_rate(v: dict) -> float:
    likes = v.get("likes", 0)
    comments = v.get("comments", 0)
    shares = v.get("shares", 0)
    views = max(v.get("views", 1), 1)
    return min((likes + 2 * comments + 3 * shares) / views, 1.0)


def _recency_boost(posted_at_iso: str | None) -> float:
    if not posted_at_iso:
        return 0.0
    try:
        posted = datetime.fromisoformat(posted_at_iso.replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    hrs = (datetime.now(timezone.utc) - posted).total_seconds() / 3600
    return math.exp(-hrs / 48)  # half-life ≈ 33 hours


async def _score_video(video: dict, user_prefs: dict) -> float:
    last_cat = user_prefs.get("last_category")
    cat_match = 1.0 if video.get("category") == last_cat else 0.3
    return (
        SCORE_WEIGHTS["engagement"] * _engagement_rate(video)
        + SCORE_WEIGHTS["creator"] * min(video.get("creator_score", 1.0) / 2.0, 1.0)
        + SCORE_WEIGHTS["recency"] * _recency_boost(video.get("posted_at"))
        + SCORE_WEIGHTS["category_match"] * cat_match
        + SCORE_WEIGHTS["watch_completion"] * user_prefs.get("avg_completion", 0.5)
    )


router = APIRouter(prefix="/my-vibez/feed", tags=["my-vibez-feed"])


@router.get("/personalized")
async def get_personalized_feed(user_id: str, limit: int = 20):
    """Returns a ranked list of videos for the given user.
    Falls back to recency-only when there's no engagement data yet."""
    if limit > 100:
        limit = 100
    prefs_doc = await _user_prefs_col.find_one({"user_id": user_id}, {"_id": 0}) or {}
    cursor = _videos_col.find(
        {"hidden": {"$ne": True}}, {"_id": 0}
    ).sort("posted_at", -1).limit(limit * 5)
    candidates = await cursor.to_list(length=limit * 5)
    if not candidates:
        return {"user_id": user_id, "feed": [], "count": 0, "ranker": "heuristic-v1"}
    scored = []
    for v in candidates:
        v["_score"] = await _score_video(v, prefs_doc)
        scored.append(v)
    scored.sort(key=lambda x: x["_score"], reverse=True)
    return {
        "user_id": user_id,
        "feed": scored[:limit],
        "count": min(len(scored), limit),
        "ranker": "heuristic-v1",
        "weights": SCORE_WEIGHTS,
    }


class EngagementSignal(BaseModel):
    user_id: str = Field(..., min_length=1)
    video_id: str = Field(..., min_length=1)
    event: str = Field(..., pattern="^(view|like|share|comment|skip|complete)$")
    watch_pct: Optional[float] = Field(None, ge=0, le=1)
    category: Optional[str] = None


@router.post("/signal")
async def record_signal(body: EngagementSignal, background_tasks: BackgroundTasks):
    """Records an engagement signal — updates per-user prefs (last
    category, EMA of watch completion) for future ranking calls."""
    await _signals_col.insert_one({
        **body.model_dump(),
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    update_doc: dict = {"$set": {"last_seen": datetime.now(timezone.utc).isoformat()}}
    if body.category:
        update_doc["$set"]["last_category"] = body.category
    if body.watch_pct is not None:
        # 80/20 EMA so brand-new completions still move the needle.
        prev = await _user_prefs_col.find_one(
            {"user_id": body.user_id}, {"_id": 0, "avg_completion": 1}
        ) or {}
        prev_ema = float(prev.get("avg_completion", 0.5))
        new_ema = 0.8 * prev_ema + 0.2 * body.watch_pct
        update_doc["$set"]["avg_completion"] = round(new_ema, 4)
    await _user_prefs_col.update_one(
        {"user_id": body.user_id}, update_doc, upsert=True
    )
    return {"status": "recorded", "event": body.event}


@router.get("/trending")
async def get_trending(limit: int = 20):
    """Global trending: top by engagement rate × recency, no personalization."""
    if limit > 100:
        limit = 100
    cursor = _videos_col.find({"hidden": {"$ne": True}}, {"_id": 0}).limit(500)
    cands = await cursor.to_list(length=500)
    for v in cands:
        v["_score"] = _engagement_rate(v) * _recency_boost(v.get("posted_at"))
    cands.sort(key=lambda x: x["_score"], reverse=True)
    return {"trending": cands[:limit], "count": min(len(cands), limit)}
