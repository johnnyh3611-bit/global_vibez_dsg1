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

Uses the shared app database (`utils.database.get_database`) so it
ranks the same `my_vibez_videos` documents the content upload API writes.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field

from utils.database import get_database


SCORE_WEIGHTS = {
    "engagement": 0.45,
    "creator": 0.20,
    "recency": 0.20,
    "category_match": 0.10,
    "watch_completion": 0.05,
}


def _num(v: dict, *keys: str, default: float = 0) -> float:
    for k in keys:
        if k in v and v[k] is not None:
            try:
                return float(v[k])
            except (TypeError, ValueError):
                continue
    return default


def _engagement_rate(v: dict) -> float:
    likes = _num(v, "likes_count", "likes")
    comments = _num(v, "comments_count", "comments")
    shares = _num(v, "shares_count", "shares")
    views = max(_num(v, "views_count", "views", default=1), 1)
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


def normalize_video_doc(v: dict) -> dict:
    """Unify content-upload field names for the short-form UI."""
    out = {k: val for k, val in v.items() if k != "_id"}
    if not out.get("video_id"):
        out["video_id"] = out.get("id") or ""
    if "likes_count" not in out:
        out["likes_count"] = int(_num(out, "likes"))
    if "comments_count" not in out:
        out["comments_count"] = int(_num(out, "comments"))
    if "shares_count" not in out:
        out["shares_count"] = int(_num(out, "shares"))
    if "views_count" not in out:
        out["views_count"] = int(_num(out, "views"))
    if not out.get("created_at"):
        out["created_at"] = out.get("posted_at") or ""
    if not out.get("posted_at"):
        out["posted_at"] = out.get("created_at") or ""
    if not out.get("video_url") and out.get("content_url"):
        out["video_url"] = out["content_url"]
    if not out.get("creator_name"):
        out["creator_name"] = out.get("username") or out.get("creator_id") or "Creator"
    # Drop internal score before returning to clients that don't need it
    # (callers may keep _score for debugging).
    return out


async def _score_video(video: dict, user_prefs: dict) -> float:
    last_cat = user_prefs.get("last_category")
    cat_match = 1.0 if video.get("category") == last_cat else 0.3
    posted = video.get("posted_at") or video.get("created_at")
    return (
        SCORE_WEIGHTS["engagement"] * _engagement_rate(video)
        + SCORE_WEIGHTS["creator"] * min(_num(video, "creator_score", default=1.0) / 2.0, 1.0)
        + SCORE_WEIGHTS["recency"] * _recency_boost(posted)
        + SCORE_WEIGHTS["category_match"] * cat_match
        + SCORE_WEIGHTS["watch_completion"] * float(user_prefs.get("avg_completion", 0.5))
    )


async def rank_for_you(
    user_id: str,
    limit: int = 20,
    *,
    exclude_creator_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Core ranker used by both /feed/personalized and /feed/for-you."""
    if limit > 100:
        limit = 100
    db = get_database()
    prefs_doc = await db.my_vibez_user_prefs.find_one({"user_id": user_id}, {"_id": 0}) or {}
    query: Dict[str, Any] = {"hidden": {"$ne": True}}
    if exclude_creator_id:
        query["creator_id"] = {"$ne": exclude_creator_id}
    cursor = (
        db.my_vibez_videos.find(query, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit * 5)
    )
    candidates = await cursor.to_list(length=limit * 5)
    if not candidates:
        return {
            "user_id": user_id,
            "feed": [],
            "videos": [],
            "count": 0,
            "ranker": "heuristic-v1",
            "weights": SCORE_WEIGHTS,
        }
    scored: List[dict] = []
    for v in candidates:
        score = await _score_video(v, prefs_doc)
        doc = normalize_video_doc(v)
        doc["_score"] = round(score, 6)
        scored.append(doc)
    scored.sort(key=lambda x: x.get("_score", 0), reverse=True)
    top = scored[:limit]
    return {
        "user_id": user_id,
        "feed": top,
        "videos": top,
        "count": len(top),
        "ranker": "heuristic-v1",
        "weights": SCORE_WEIGHTS,
    }


router = APIRouter(prefix="/my-vibez/feed", tags=["my-vibez-feed"])


@router.get("/personalized")
async def get_personalized_feed(user_id: str, limit: int = 20):
    """Returns a ranked list of videos for the given user.
    Falls back to recency-only when there's no engagement data yet."""
    return await rank_for_you(user_id=user_id or "anon", limit=limit)


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
    db = get_database()
    await db.my_vibez_engagement_signals.insert_one({
        **body.model_dump(),
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    update_doc: dict = {"$set": {"last_seen": datetime.now(timezone.utc).isoformat()}}
    if body.category:
        update_doc["$set"]["last_category"] = body.category
    if body.watch_pct is not None:
        prev = await db.my_vibez_user_prefs.find_one(
            {"user_id": body.user_id}, {"_id": 0, "avg_completion": 1}
        ) or {}
        prev_ema = float(prev.get("avg_completion", 0.5))
        new_ema = 0.8 * prev_ema + 0.2 * body.watch_pct
        update_doc["$set"]["avg_completion"] = round(new_ema, 4)
    await db.my_vibez_user_prefs.update_one(
        {"user_id": body.user_id}, update_doc, upsert=True
    )
    return {"status": "recorded", "event": body.event}


@router.get("/trending")
async def get_trending(limit: int = 20):
    """Global trending: top by engagement rate × recency, no personalization."""
    if limit > 100:
        limit = 100
    db = get_database()
    cursor = db.my_vibez_videos.find({"hidden": {"$ne": True}}, {"_id": 0}).limit(500)
    cands = await cursor.to_list(length=500)
    for v in cands:
        posted = v.get("posted_at") or v.get("created_at")
        v["_score"] = _engagement_rate(v) * _recency_boost(posted)
    cands.sort(key=lambda x: x["_score"], reverse=True)
    videos = [normalize_video_doc(v) for v in cands[:limit]]
    return {"trending": videos, "videos": videos, "count": len(videos)}
