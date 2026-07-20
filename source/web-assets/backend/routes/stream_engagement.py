"""
Stream engagement — polls, Q&A, and light prediction stakes (not a casino).

Turns passive viewers into active participants using VibeCredits.

  POST /stream/{room_id}/polls
  GET  /stream/{room_id}/polls/active
  POST /stream/{room_id}/polls/{poll_id}/vote
  POST /stream/{room_id}/predict          — stake ₵ on an outcome (fun stake)
  POST /stream/{room_id}/qa
  GET  /stream/{room_id}/qa
  POST /rooms/host/personalize           — spend ₵ to theme your hosted room
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_current_user, get_database

router = APIRouter(tags=["stream-engagement"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CreatePoll(BaseModel):
    question: str = Field(min_length=3, max_length=200)
    options: List[str] = Field(min_length=2, max_length=6)


class VotePayload(BaseModel):
    option_index: int = Field(ge=0, le=5)


class PredictPayload(BaseModel):
    outcome: str = Field(min_length=1, max_length=80)
    stake_coins: int = Field(ge=10, le=5_000)


class QaPayload(BaseModel):
    question: str = Field(min_length=3, max_length=280)


class PersonalizePayload(BaseModel):
    room_id: str
    theme_id: str = "neon"
    display_name: Optional[str] = None
    # ₵ cost for personalization pack
    pack: str = "basic"  # basic=200, pro=750, flagship=2000


PERSONALIZE_PACKS = {
    "basic": {"coins": 200, "label": "Basic theme"},
    "pro": {"coins": 750, "label": "Pro theme + banner"},
    "flagship": {"coins": 2000, "label": "Flagship room kit"},
}


async def _debit(db, user_id: str, coins: int) -> None:
    from utils.wallet_fields import pick_wallet_field_for_debit  # noqa: PLC0415

    u = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    try:
        field, _ = pick_wallet_field_for_debit(u, coins)
    except ValueError:
        raise HTTPException(402, f"Need ₵{coins:,}")
    await db.users.update_one({"user_id": user_id}, {"$inc": {field: -coins}})


@router.post("/stream/{room_id}/polls")
async def create_poll(
    room_id: str, payload: CreatePoll, http_request: Request
) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    opts = [o.strip() for o in payload.options if o and o.strip()]
    if len(opts) < 2:
        raise HTTPException(400, "Need at least 2 options")
    db = get_database()
    poll = {
        "poll_id": f"poll_{uuid.uuid4().hex[:10]}",
        "room_id": room_id,
        "host_user_id": user.user_id,
        "question": payload.question.strip(),
        "options": opts,
        "votes": [0] * len(opts),
        "status": "active",
        "created_at": _now(),
    }
    await db.stream_polls.insert_one(dict(poll))
    poll.pop("_id", None)
    return {"ok": True, "poll": poll}


@router.get("/stream/{room_id}/polls/active")
async def active_polls(room_id: str) -> Dict[str, Any]:
    db = get_database()
    rows = await db.stream_polls.find(
        {"room_id": room_id, "status": "active"}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=10)
    return {"polls": rows}


@router.post("/stream/{room_id}/polls/{poll_id}/vote")
async def vote_poll(
    room_id: str, poll_id: str, payload: VotePayload, http_request: Request
) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    poll = await db.stream_polls.find_one(
        {"poll_id": poll_id, "room_id": room_id, "status": "active"}, {"_id": 0}
    )
    if not poll:
        raise HTTPException(404, "Poll not found")
    if payload.option_index >= len(poll.get("options") or []):
        raise HTTPException(400, "Invalid option")
    vote_key = f"{poll_id}::{user.user_id}"
    if await db.stream_poll_votes.find_one({"vote_key": vote_key}):
        return {"ok": True, "already": True}
    await db.stream_poll_votes.insert_one(
        {
            "vote_key": vote_key,
            "poll_id": poll_id,
            "user_id": user.user_id,
            "option_index": payload.option_index,
            "at": _now(),
        }
    )
    # Increment vote tally at index
    votes = list(poll.get("votes") or [])
    while len(votes) < len(poll["options"]):
        votes.append(0)
    votes[payload.option_index] += 1
    await db.stream_polls.update_one(
        {"poll_id": poll_id}, {"$set": {"votes": votes}}
    )
    return {"ok": True, "votes": votes}


@router.post("/stream/{room_id}/predict")
async def predict_outcome(
    room_id: str, payload: PredictPayload, http_request: Request
) -> Dict[str, Any]:
    """Fun stake on stream outcome — escrowed into a room prediction pool."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    await _debit(db, user.user_id, payload.stake_coins)
    bet = {
        "bet_id": f"sp_{uuid.uuid4().hex[:12]}",
        "room_id": room_id,
        "user_id": user.user_id,
        "outcome": payload.outcome.strip(),
        "stake_coins": payload.stake_coins,
        "status": "open",
        "at": _now(),
    }
    await db.stream_predictions.insert_one(dict(bet))
    await db.stream_prediction_pools.update_one(
        {"room_id": room_id},
        {
            "$inc": {
                "total_staked": payload.stake_coins,
                f"outcomes.{payload.outcome.strip()}": payload.stake_coins,
            },
            "$set": {"updated_at": _now()},
            "$setOnInsert": {"created_at": _now()},
        },
        upsert=True,
    )
    bet.pop("_id", None)
    return {
        "ok": True,
        "bet": bet,
        "message": "Prediction locked — not a gambling product; fun stake only.",
    }


@router.post("/stream/{room_id}/qa")
async def ask_qa(
    room_id: str, payload: QaPayload, http_request: Request
) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    q = {
        "qa_id": f"qa_{uuid.uuid4().hex[:10]}",
        "room_id": room_id,
        "user_id": user.user_id,
        "question": payload.question.strip(),
        "status": "open",
        "upvotes": 0,
        "at": _now(),
    }
    await db.stream_qa.insert_one(dict(q))
    q.pop("_id", None)
    return {"ok": True, "question": q}


@router.get("/stream/{room_id}/qa")
async def list_qa(room_id: str, limit: int = 30) -> Dict[str, Any]:
    db = get_database()
    rows = await db.stream_qa.find({"room_id": room_id}, {"_id": 0}).sort(
        "at", -1
    ).to_list(length=max(1, min(limit, 100)))
    return {"questions": rows}


@router.post("/rooms/host/personalize")
async def personalize_hosted_room(
    payload: PersonalizePayload, http_request: Request
) -> Dict[str, Any]:
    """Community-led growth — hosts spend ₵ to own their social space."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    pack = PERSONALIZE_PACKS.get(payload.pack)
    if not pack:
        raise HTTPException(400, "Unknown pack")
    db = get_database()
    await _debit(db, user.user_id, pack["coins"])
    room = {
        "room_id": payload.room_id,
        "host_user_id": user.user_id,
        "theme_id": payload.theme_id,
        "display_name": payload.display_name
        or f"{getattr(user, 'name', None) or 'Host'}'s Table",
        "pack": payload.pack,
        "coins_spent": pack["coins"],
        "updated_at": _now(),
    }
    await db.hosted_room_themes.update_one(
        {"room_id": payload.room_id, "host_user_id": user.user_id},
        {"$set": room, "$setOnInsert": {"created_at": _now()}},
        upsert=True,
    )
    return {"ok": True, "room": room, "pack": pack}
