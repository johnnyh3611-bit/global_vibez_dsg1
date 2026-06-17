"""
Crews — small persistent groups (4-12 people) with shared earnings,
shared rooms, shared leaderboards (Feb 2026 founder roadmap, item 4/8).

A Crew is the strongest retention multiplier in social right now. Squad
streams, co-watching, shared chair pools, shared boards. MVP API:
create, join, leave, list, get; rooms / earnings / leaderboard surfaces
will build on top of these primitives.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Final

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field


MIN_CREW_SIZE: Final[int] = 1
MAX_CREW_SIZE: Final[int] = 12


_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "vibez_global")
_client = AsyncIOMotorClient(_MONGO_URL)
_db = _client[_DB_NAME]
_crews_col = _db["crews"]


router = APIRouter(prefix="/crews", tags=["crews"])


class CreateCrewBody(BaseModel):
    name: str = Field(..., min_length=2, max_length=40)
    owner_user_id: str = Field(..., min_length=1)
    motto: str | None = Field(default=None, max_length=140)


@router.post("/create")
async def create_crew(body: CreateCrewBody):
    crew_id = uuid.uuid4().hex
    doc = {
        "crew_id": crew_id,
        "name": body.name,
        "motto": body.motto or "",
        "owner_user_id": body.owner_user_id,
        "members": [body.owner_user_id],
        "shared_chair_pool": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _crews_col.insert_one(doc)
    doc.pop("_id", None)
    return {"crew_id": crew_id, "crew": doc}


@router.get("/list")
async def list_crews(user_id: str):
    """All crews a given user is part of."""
    cursor = _crews_col.find({"members": user_id}, {"_id": 0})
    crews = await cursor.to_list(length=50)
    return {"user_id": user_id, "crews": crews, "count": len(crews)}


@router.get("/{crew_id}")
async def get_crew(crew_id: str):
    crew = await _crews_col.find_one({"crew_id": crew_id}, {"_id": 0})
    if not crew:
        raise HTTPException(404, "Crew not found")
    return crew


class JoinBody(BaseModel):
    user_id: str = Field(..., min_length=1)


@router.post("/{crew_id}/join")
async def join_crew(crew_id: str, body: JoinBody):
    crew = await _crews_col.find_one({"crew_id": crew_id}, {"_id": 0, "members": 1})
    if not crew:
        raise HTTPException(404, "Crew not found")
    if body.user_id in crew.get("members", []):
        return {"status": "already_member", "crew_id": crew_id}
    if len(crew.get("members", [])) >= MAX_CREW_SIZE:
        raise HTTPException(409, f"Crew is full ({MAX_CREW_SIZE} max)")
    await _crews_col.update_one(
        {"crew_id": crew_id}, {"$addToSet": {"members": body.user_id}}
    )
    return {"status": "joined", "crew_id": crew_id}


@router.post("/{crew_id}/leave")
async def leave_crew(crew_id: str, body: JoinBody):
    await _crews_col.update_one(
        {"crew_id": crew_id}, {"$pull": {"members": body.user_id}}
    )
    return {"status": "left", "crew_id": crew_id}


@router.get("/leaderboard/top")
async def top_crews(limit: int = 10):
    """Largest crews by member count — surface for the social graph."""
    if limit > 100:
        limit = 100
    cursor = _crews_col.find({}, {"_id": 0}).limit(500)
    crews = await cursor.to_list(length=500)
    crews.sort(key=lambda c: len(c.get("members", [])), reverse=True)
    return {"top": crews[:limit], "count": min(len(crews), limit)}
