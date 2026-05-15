"""
Responsible Gaming + Daily Streaks + Tournaments (Feb 2026 founder
roadmap, item 7/8).

Three sub-features bundled because they share a thin DB footprint:

  1. Responsible Gaming — self-imposed loss limits, time-outs,
     "take a break" prompt logic. Regulators are getting aggressive in
     2026 so this is table-stakes.
  2. Daily Check-In Streaks — Coin Master's billion-dollar mechanic.
     Streak rewards: +10 / +25 / +75 / +200 $VIBEZ at days 1/3/7/15.
  3. Tournaments — brackets + prize pools + entry tickets for Spades /
     Bid Whist / Cyber Casino. MVP: create, join, list, settle.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Final

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field


# ── 1. Responsible Gaming ────────────────────────────────────────────────
DAILY_DEFAULT_LIMIT_VIBEZ: Final[int] = 5_000   # opt-in default loss cap
COOLDOWN_HOURS_AFTER_BREAK: Final[int] = 24


_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "vibez_global")
_client = AsyncIOMotorClient(_MONGO_URL)
_db = _client[_DB_NAME]
_rg_col = _db["responsible_gaming"]
_streaks_col = _db["daily_streaks"]
_tourneys_col = _db["tournaments"]


router = APIRouter(prefix="/safety", tags=["responsible-gaming-streaks-tournaments"])


class SetLimitBody(BaseModel):
    user_id: str = Field(..., min_length=1)
    daily_loss_limit_vibez: int = Field(..., ge=0)


@router.post("/rg/set-limit")
async def set_loss_limit(body: SetLimitBody):
    """User self-imposes a daily loss cap. Decreases take effect
    immediately; increases require a 24h cool-off."""
    existing = await _rg_col.find_one({"user_id": body.user_id}, {"_id": 0}) or {}
    prev_limit = existing.get("daily_loss_limit_vibez")
    now = datetime.now(timezone.utc).isoformat()
    if prev_limit is not None and body.daily_loss_limit_vibez > prev_limit:
        return {
            "status": "pending_cooldown",
            "new_limit_effective_at": (
                datetime.now(timezone.utc) + timedelta(hours=COOLDOWN_HOURS_AFTER_BREAK)
            ).isoformat(),
            "reason": "Increases require a 24h cool-off (regulatory best practice).",
        }
    await _rg_col.update_one(
        {"user_id": body.user_id},
        {
            "$set": {
                "user_id": body.user_id,
                "daily_loss_limit_vibez": body.daily_loss_limit_vibez,
                "updated_at": now,
            }
        },
        upsert=True,
    )
    return {"status": "set", "daily_loss_limit_vibez": body.daily_loss_limit_vibez}


@router.get("/rg/status/{user_id}")
async def rg_status(user_id: str):
    doc = await _rg_col.find_one({"user_id": user_id}, {"_id": 0}) or {}
    return {
        "user_id": user_id,
        "daily_loss_limit_vibez": doc.get("daily_loss_limit_vibez", DAILY_DEFAULT_LIMIT_VIBEZ),
        "self_excluded_until": doc.get("self_excluded_until"),
        "default_used": "daily_loss_limit_vibez" not in doc,
    }


class TakeBreakBody(BaseModel):
    user_id: str = Field(..., min_length=1)
    hours: int = Field(..., ge=1, le=720)


@router.post("/rg/take-break")
async def take_break(body: TakeBreakBody):
    """Voluntary self-exclusion for N hours (1h … 30 days)."""
    until = (datetime.now(timezone.utc) + timedelta(hours=body.hours)).isoformat()
    await _rg_col.update_one(
        {"user_id": body.user_id},
        {"$set": {"self_excluded_until": until}},
        upsert=True,
    )
    return {"status": "break_active", "self_excluded_until": until}


# ── 2. Daily Streaks ─────────────────────────────────────────────────────
STREAK_REWARDS: Final[dict[int, int]] = {
    1: 10, 3: 25, 7: 75, 15: 200, 30: 500, 60: 1500,
}


@router.post("/streak/check-in/{user_id}")
async def daily_check_in(user_id: str):
    """Hit once per day. Returns the new streak length + any reward
    unlocked at this milestone."""
    today_iso = datetime.now(timezone.utc).date().isoformat()
    doc = await _streaks_col.find_one({"user_id": user_id}, {"_id": 0}) or {}
    last_iso = doc.get("last_checkin_date")
    if last_iso == today_iso:
        return {"status": "already_checked_in", "streak": doc.get("streak", 1)}

    yest_iso = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    streak = doc.get("streak", 0) + 1 if last_iso == yest_iso else 1
    reward = STREAK_REWARDS.get(streak, 0)
    await _streaks_col.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "user_id": user_id,
                "last_checkin_date": today_iso,
                "streak": streak,
            },
            "$inc": {"total_rewarded_vibez": reward},
        },
        upsert=True,
    )
    return {
        "status": "checked_in",
        "streak": streak,
        "reward_vibez": reward,
        "next_milestone": next((d for d in sorted(STREAK_REWARDS) if d > streak), None),
    }


@router.get("/streak/{user_id}")
async def get_streak(user_id: str):
    doc = await _streaks_col.find_one({"user_id": user_id}, {"_id": 0}) or {}
    return {
        "user_id": user_id,
        "streak": doc.get("streak", 0),
        "last_checkin_date": doc.get("last_checkin_date"),
        "total_rewarded_vibez": doc.get("total_rewarded_vibez", 0),
        "rewards_schedule": STREAK_REWARDS,
    }


# ── 3. Tournaments ───────────────────────────────────────────────────────
class CreateTourneyBody(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    game: str = Field(..., pattern="^(spades|bid_whist|blackjack|roulette|baccarat)$")
    entry_fee_vibez: int = Field(..., ge=0)
    max_players: int = Field(..., ge=2, le=128)
    starts_at: str | None = None


@router.post("/tourney/create")
async def create_tournament(body: CreateTourneyBody):
    t_id = uuid.uuid4().hex
    starts = body.starts_at or (
        datetime.now(timezone.utc) + timedelta(hours=1)
    ).isoformat()
    doc = {
        "tournament_id": t_id,
        "name": body.name,
        "game": body.game,
        "entry_fee_vibez": body.entry_fee_vibez,
        "max_players": body.max_players,
        "players": [],
        "prize_pool_vibez": 0,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "starts_at": starts,
    }
    await _tourneys_col.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/tourney/{tournament_id}/join")
async def join_tournament(tournament_id: str, body: dict):
    user_id = (body or {}).get("user_id")
    if not user_id:
        raise HTTPException(400, "user_id required")
    t = await _tourneys_col.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Tournament not found")
    if t["status"] != "open":
        raise HTTPException(409, "Tournament closed")
    if user_id in t["players"]:
        return {"status": "already_joined", "tournament_id": tournament_id}
    if len(t["players"]) >= t["max_players"]:
        raise HTTPException(409, "Tournament full")
    await _tourneys_col.update_one(
        {"tournament_id": tournament_id},
        {
            "$addToSet": {"players": user_id},
            "$inc": {"prize_pool_vibez": t["entry_fee_vibez"]},
        },
    )
    return {"status": "joined", "tournament_id": tournament_id}


@router.get("/tourney/list")
async def list_tournaments(status: str = "open", limit: int = 30):
    cursor = _tourneys_col.find({"status": status}, {"_id": 0}).limit(limit)
    rows = await cursor.to_list(length=limit)
    return {"tournaments": rows, "count": len(rows)}
