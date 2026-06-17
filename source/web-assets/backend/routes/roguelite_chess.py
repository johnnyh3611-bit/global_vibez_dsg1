"""
roguelite_chess_router — 24-hr permadeath ladder (Revolutionary Games
Blueprint v1, May 2026 §Roguelite Chess Trial).

Mechanic
========
A daily 24-hour ladder. Each user gets a single Trial run per day:
  • One stack of "Lives" (default 3).
  • Each chess loss against a calibrated AI consumes 1 life.
  • Resignation also consumes 1 life.
  • Lives reset at the next UTC midnight.
  • Wins do NOT consume lives — they grant streak progress + a daily
    leaderboard score.
  • Hitting 0 lives ends the trial for the day. The user's final score
    locks and is published to the daily leaderboard.

Endpoints
---------
GET  /api/roguelite-chess/state
    Returns the user's current trial state (lives, score, streak,
    started_at, ends_at).
POST /api/roguelite-chess/start
    Idempotent — creates today's trial document if missing.
POST /api/roguelite-chess/record-result
    Body: { outcome: "win" | "loss" | "draw", elo_diff: int }
    Updates lives + score atomically.
GET  /api/roguelite-chess/leaderboard
    Top 50 finishers for the current UTC day.

Scoring
-------
  win   → +100 + max(0, elo_diff)
  draw  → +25
  loss  → -1 life

Storage
-------
Mongo collection `roguelite_chess_trials`:
  { _id, user_id, day_key (YYYY-MM-DD UTC), lives, score, streak,
    started_at, ended_at?, history: [{outcome, elo_diff, ts}] }
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
import os
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, Literal

from utils.database import get_current_user

log = logging.getLogger(__name__)

_MONGO_URL = os.environ.get("MONGO_URL")
_DB_NAME = os.environ.get("DB_NAME")
_client = AsyncIOMotorClient(_MONGO_URL) if _MONGO_URL else None
_db = _client[_DB_NAME] if _client and _DB_NAME else None

router = APIRouter(prefix="/roguelite-chess", tags=["roguelite-chess"])

DEFAULT_LIVES = 3


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _next_midnight_utc() -> datetime:
    now = datetime.now(timezone.utc)
    tomorrow = now + timedelta(days=1)
    return tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)


# ─────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────
class TrialState(BaseModel):
    day_key: str
    lives: int
    score: int
    streak: int
    started_at: datetime
    ends_at: datetime
    is_alive: bool


class RecordResultBody(BaseModel):
    outcome: Literal["win", "loss", "draw"]
    elo_diff: int = Field(default=0, ge=-1000, le=1000)


class LeaderboardEntry(BaseModel):
    user_id: str
    display_name: Optional[str] = None
    score: int
    lives: int
    streak: int
    is_alive: bool


# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────
async def _get_or_create(user_id: str) -> dict:
    if _db is None:
        raise HTTPException(503, "Database unavailable")
    day = _today_key()
    doc = await _db.roguelite_chess_trials.find_one(
        {"user_id": user_id, "day_key": day}, {"_id": 0}
    )
    if doc:
        return doc
    now = datetime.now(timezone.utc)
    new_doc = {
        "user_id": user_id,
        "day_key": day,
        "lives": DEFAULT_LIVES,
        "score": 0,
        "streak": 0,
        "started_at": now,
        "ended_at": None,
        "history": [],
    }
    await _db.roguelite_chess_trials.insert_one(dict(new_doc))
    return new_doc


# ─────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────
@router.get("/state", response_model=TrialState)
async def get_state(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(401, "Unauthenticated")
    user_id = getattr(user, "user_id", None) or getattr(user, "id", None) or getattr(user, "email", None)
    if not user_id:
        raise HTTPException(401, "Unauthenticated")
    doc = await _get_or_create(str(user_id))
    return TrialState(
        day_key=doc["day_key"],
        lives=doc["lives"],
        score=doc["score"],
        streak=doc["streak"],
        started_at=doc["started_at"],
        ends_at=_next_midnight_utc(),
        is_alive=doc["lives"] > 0 and doc.get("ended_at") is None,
    )


@router.post("/start", response_model=TrialState)
async def start(user=Depends(get_current_user)):
    """Idempotent — returns today's trial state."""
    return await get_state(user=user)


@router.post("/record-result", response_model=TrialState)
async def record_result(body: RecordResultBody, user=Depends(get_current_user)):
    if _db is None:
        raise HTTPException(503, "Database unavailable")
    if not user:
        raise HTTPException(401, "Unauthenticated")
    user_id = getattr(user, "user_id", None) or getattr(user, "id", None) or getattr(user, "email", None)
    if not user_id:
        raise HTTPException(401, "Unauthenticated")
    user_id = str(user_id)
    doc = await _get_or_create(user_id)
    if doc["lives"] <= 0 or doc.get("ended_at") is not None:
        raise HTTPException(409, "Trial already ended for today")

    new_lives = doc["lives"]
    new_score = doc["score"]
    new_streak = doc["streak"]
    if body.outcome == "win":
        new_score += 100 + max(0, body.elo_diff)
        new_streak += 1
    elif body.outcome == "draw":
        new_score += 25
        new_streak = 0
    else:  # loss
        new_lives -= 1
        new_streak = 0

    ended_at = datetime.now(timezone.utc) if new_lives <= 0 else None

    history_entry = {
        "outcome": body.outcome,
        "elo_diff": body.elo_diff,
        "ts": datetime.now(timezone.utc),
    }

    await _db.roguelite_chess_trials.update_one(
        {"user_id": user_id, "day_key": doc["day_key"]},
        {
            "$set": {
                "lives": new_lives,
                "score": new_score,
                "streak": new_streak,
                "ended_at": ended_at,
            },
            "$push": {"history": history_entry},
        },
    )

    fresh = await _db.roguelite_chess_trials.find_one(
        {"user_id": user_id, "day_key": doc["day_key"]}, {"_id": 0}
    )
    return TrialState(
        day_key=fresh["day_key"],
        lives=fresh["lives"],
        score=fresh["score"],
        streak=fresh["streak"],
        started_at=fresh["started_at"],
        ends_at=_next_midnight_utc(),
        is_alive=fresh["lives"] > 0 and fresh.get("ended_at") is None,
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(limit: int = 50):
    if _db is None:
        raise HTTPException(503, "Database unavailable")
    day = _today_key()
    cursor = (
        _db.roguelite_chess_trials.find(
            {"day_key": day},
            {
                "_id": 0,
                "user_id": 1,
                "score": 1,
                "lives": 1,
                "streak": 1,
                "ended_at": 1,
            },
        )
        .sort("score", -1)
        .limit(max(1, min(200, limit)))
    )
    rows = await cursor.to_list(length=limit)
    out: list[LeaderboardEntry] = []
    for r in rows:
        # Best-effort display name (read-only join — never crashes if missing).
        name = None
        try:
            u = await _db.users.find_one(
                {"$or": [{"_id": r["user_id"]}, {"email": r["user_id"]}]},
                {"_id": 0, "display_name": 1, "username": 1},
            )
            if u:
                name = u.get("display_name") or u.get("username")
        except Exception:
            pass
        out.append(
            LeaderboardEntry(
                user_id=r["user_id"],
                display_name=name,
                score=r.get("score", 0),
                lives=r.get("lives", 0),
                streak=r.get("streak", 0),
                is_alive=(r.get("lives", 0) > 0 and r.get("ended_at") is None),
            )
        )
    return out
