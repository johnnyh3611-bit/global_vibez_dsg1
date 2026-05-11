"""
Free-Stake Spectator Betting (P2 — May 2026).

Spectators in a multiplayer card room / sports event can place a FREE
"glory-only" prediction with no balance debit. Outcomes drive a leaderboard
and award a +5 ₵ engagement bonus on correct call (capped at 5/day) so the
spectator economy stays fun without inflating the float.

ENDPOINTS:
  POST /api/spectator-bet/place      — place free prediction
  POST /api/spectator-bet/settle     — admin / engine settles a market
  GET  /api/spectator-bet/my-bets    — caller's free bets
  GET  /api/spectator-bet/leaderboard — top spectators by hit rate
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

router = APIRouter()

DAILY_BONUS_CAP = 5
BONUS_PER_HIT = 5  # ₵ VIBE per correct call


class PlacePayload(BaseModel):
    market_id: str = Field(min_length=4, max_length=64)
    choice: str = Field(min_length=1, max_length=24)
    context: Optional[str] = Field(default=None, max_length=64)  # e.g. "sports", "card-room"


class SettlePayload(BaseModel):
    market_id: str
    winning_choice: str


@router.post("/spectator-bet/place")
async def place_free_bet(payload: PlacePayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Sign in to predict")
    db = get_database()
    # Idempotent: 1 free bet per user per market.
    existing = await db.free_spectator_bets.find_one(
        {"market_id": payload.market_id, "user_id": user.user_id},
        {"_id": 0},
    )
    if existing:
        return {"status": "already_placed", "bet": existing}
    bet = {
        "bet_id": f"fs_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "market_id": payload.market_id,
        "choice": payload.choice,
        "context": payload.context,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.free_spectator_bets.insert_one(bet)
    bet.pop("_id", None)
    return {"status": "placed", "bet": bet}


@router.post("/spectator-bet/settle")
async def settle_market(payload: SettlePayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user or not (getattr(user, "is_admin", False) or getattr(user, "role", "") == "admin"):
        raise HTTPException(403, "Admin only")
    db = get_database()
    bets = await db.free_spectator_bets.find(
        {"market_id": payload.market_id, "status": "pending"},
        {"_id": 0},
    ).to_list(None)
    if not bets:
        return {"status": "no_bets"}

    from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415
    today = datetime.now(timezone.utc).date().isoformat()
    settled = 0
    bonus_paid = 0
    for b in bets:
        won = b["choice"] == payload.winning_choice
        await db.free_spectator_bets.update_one(
            {"bet_id": b["bet_id"]},
            {"$set": {"status": "won" if won else "lost",
                       "settled_at": datetime.now(timezone.utc).isoformat(),
                       "winning_choice": payload.winning_choice}},
        )
        if won:
            # Cap daily bonus.
            day_doc = await db.spectator_bonus_caps.find_one(
                {"user_id": b["user_id"], "date": today}, {"_id": 0},
            ) or {"hits_today": 0}
            if day_doc.get("hits_today", 0) < DAILY_BONUS_CAP:
                uw = await db.users.find_one(
                    {"user_id": b["user_id"]},
                    {"_id": 0, "token_balance": 1, "credits_balance": 1},
                ) or {}
                field = pick_wallet_field_for_credit(uw)
                await db.users.update_one(
                    {"user_id": b["user_id"]},
                    {"$inc": {field: BONUS_PER_HIT}},
                )
                await db.spectator_bonus_caps.update_one(
                    {"user_id": b["user_id"], "date": today},
                    {"$inc": {"hits_today": 1}},
                    upsert=True,
                )
                bonus_paid += BONUS_PER_HIT
        settled += 1
    return {"status": "settled", "settled": settled, "bonus_paid_vibe": bonus_paid}


@router.get("/spectator-bet/my-bets")
async def my_bets(http_request: Request, limit: int = 20):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Sign in")
    db = get_database()
    rows = await db.free_spectator_bets.find(
        {"user_id": user.user_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(min(max(limit, 1), 50))
    return {"count": len(rows), "rows": rows}


@router.get("/spectator-bet/leaderboard")
async def leaderboard():
    """Top spectators by overall hit-rate (min 5 settled bets to qualify)."""
    db = get_database()
    pipeline = [
        {"$match": {"status": {"$in": ["won", "lost"]}}},
        {"$group": {
            "_id": "$user_id",
            "total": {"$sum": 1},
            "hits": {"$sum": {"$cond": [{"$eq": ["$status", "won"]}, 1, 0]}},
        }},
        {"$match": {"total": {"$gte": 5}}},
        {"$project": {
            "_id": 0, "user_id": "$_id", "total": 1, "hits": 1,
            "hit_rate": {"$divide": ["$hits", "$total"]},
        }},
        {"$sort": {"hit_rate": -1, "hits": -1}},
        {"$limit": 20},
    ]
    rows = await db.free_spectator_bets.aggregate(pipeline).to_list(20)
    return {"count": len(rows), "rows": rows}
