"""
Underground Live Network — Music & Dance Battles + Crowd Judge.
(P2 from Master Blueprint — May 2026 founder ask.)

The Underground hosts late-night live battles. Audiences can:
  • View the active battle (POV stream URL — placeholder until WebRTC).
  • Vote for a contestant (1 vote/user/battle, weighted 2× for chair-holders).
  • Track a real-time crowd-judge meter that decides the winner at close.

Winning contestant: 70% of the pool (Sovereign Tax-net), 30% to the house.
Voting is FREE — the engagement is the product; pool comes from sponsor
buy-ins recorded on the battle document.

ENDPOINTS (mounted under /api):
  GET  /api/underground-live/battles    — list scheduled + live battles
  GET  /api/underground-live/active     — currently-live battle, if any
  POST /api/underground-live/vote       — cast crowd-judge vote
  POST /api/underground-live/admin/seed — admin seed (founder-only)
  POST /api/underground-live/admin/close — admin finalize battle
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

router = APIRouter()

# Single source of seed battles so a fresh DB still renders a lobby.
SEED_BATTLES: List[Dict[str, Any]] = [
    {
        "battle_id": "ul_seed_music_friday",
        "kind": "music",
        "title": "Friday Night Cypher",
        "starts_at_iso": (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat(),
        "status": "scheduled",
        "contestants": [
            {"id": "c_rio", "name": "Rio Maverick", "tagline": "South-FL bars · 6× champ"},
            {"id": "c_solene", "name": "Solene K", "tagline": "Brooklyn drill · undefeated"},
        ],
        "pool_vibe": 25_000,
        "stream_url": None,
    },
    {
        "battle_id": "ul_seed_dance_saturday",
        "kind": "dance",
        "title": "Saturday Floor War",
        "starts_at_iso": (datetime.now(timezone.utc) + timedelta(hours=28)).isoformat(),
        "status": "scheduled",
        "contestants": [
            {"id": "c_nimbus", "name": "Nimbus Crew", "tagline": "4-on-4 popping"},
            {"id": "c_aether", "name": "Aether Trio", "tagline": "Krump · litefeet"},
        ],
        "pool_vibe": 18_000,
        "stream_url": None,
    },
]


class VotePayload(BaseModel):
    battle_id: str = Field(min_length=4, max_length=64)
    contestant_id: str = Field(min_length=2, max_length=24)


async def _seed_if_empty(db) -> None:
    count = await db.underground_battles.count_documents({})
    if count == 0:
        await db.underground_battles.insert_many([{**b, "votes": {}} for b in SEED_BATTLES])


@router.get("/underground-live/battles")
async def list_battles():
    db = get_database()
    await _seed_if_empty(db)
    rows = await db.underground_battles.find(
        {"status": {"$in": ["scheduled", "live"]}},
        {"_id": 0, "votes": 0},
    ).sort("starts_at_iso", 1).to_list(50)
    return {"count": len(rows), "battles": rows}


@router.get("/underground-live/active")
async def active_battle():
    db = get_database()
    await _seed_if_empty(db)
    doc = await db.underground_battles.find_one({"status": "live"}, {"_id": 0})
    if not doc:
        # Auto-promote the first scheduled battle if its kickoff has passed.
        upcoming = await db.underground_battles.find_one(
            {"status": "scheduled", "starts_at_iso": {"$lte": datetime.now(timezone.utc).isoformat()}},
            {"_id": 0},
            sort=[("starts_at_iso", 1)],
        )
        if upcoming:
            await db.underground_battles.update_one(
                {"battle_id": upcoming["battle_id"]},
                {"$set": {"status": "live", "live_since": datetime.now(timezone.utc).isoformat()}},
            )
            upcoming["status"] = "live"
            doc = upcoming
    if not doc:
        return {"battle": None}
    # Tally votes for the crowd meter.
    votes = doc.pop("votes", {}) or {}
    tally: Dict[str, int] = {}
    for v in votes.values():
        cid = v.get("contestant_id")
        tally[cid] = tally.get(cid, 0) + int(v.get("weight") or 1)
    total = sum(tally.values()) or 1
    doc["crowd_meter"] = {cid: round(100 * w / total) for cid, w in tally.items()}
    doc["total_votes"] = len(votes)
    return {"battle": doc}


@router.post("/underground-live/vote")
async def cast_vote(payload: VotePayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Sign in to vote")
    db = get_database()
    battle = await db.underground_battles.find_one({"battle_id": payload.battle_id}, {"_id": 0})
    if not battle:
        raise HTTPException(404, "Battle not found")
    if battle.get("status") != "live":
        raise HTTPException(400, "Battle is not live")
    contestants = battle.get("contestants") or []
    if not any(c["id"] == payload.contestant_id for c in contestants):
        raise HTTPException(400, "Unknown contestant")

    # Chair holders = 2× vote weight.
    chair = await db.chairs.find_one({"user_id": user.user_id}, {"_id": 0, "chair_id": 1})
    weight = 2 if chair else 1
    await db.underground_battles.update_one(
        {"battle_id": payload.battle_id},
        {"$set": {f"votes.{user.user_id}": {
            "contestant_id": payload.contestant_id,
            "weight": weight,
            "voted_at": datetime.now(timezone.utc).isoformat(),
        }}},
    )
    return {"status": "vote_cast", "weight": weight}


@router.post("/underground-live/admin/seed")
async def admin_seed(http_request: Request):
    user = await get_current_user(http_request)
    if not user or not (getattr(user, "is_admin", False) or getattr(user, "role", "") == "admin"):
        raise HTTPException(403, "Admin only")
    db = get_database()
    await db.underground_battles.delete_many({})
    await db.underground_battles.insert_many([{**b, "votes": {}} for b in SEED_BATTLES])
    return {"status": "seeded", "count": len(SEED_BATTLES)}


@router.post("/underground-live/admin/close")
async def admin_close(payload: VotePayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user or not (getattr(user, "is_admin", False) or getattr(user, "role", "") == "admin"):
        raise HTTPException(403, "Admin only")
    db = get_database()
    battle = await db.underground_battles.find_one({"battle_id": payload.battle_id}, {"_id": 0})
    if not battle:
        raise HTTPException(404, "Battle not found")
    votes = battle.get("votes", {}) or {}
    tally: Dict[str, int] = {}
    for v in votes.values():
        cid = v.get("contestant_id")
        tally[cid] = tally.get(cid, 0) + int(v.get("weight") or 1)
    if not tally:
        raise HTTPException(400, "No votes")
    winner_id = max(tally.items(), key=lambda kv: kv[1])[0]
    pool = int(battle.get("pool_vibe") or 0)
    # 70% to winner, 30% to house (no Sovereign Tax on FREE pool — sponsor-fed).
    winner_share = int(pool * 0.7)
    await db.underground_battles.update_one(
        {"battle_id": payload.battle_id},
        {"$set": {
            "status": "closed",
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "winner_contestant_id": winner_id,
            "winner_share_vibe": winner_share,
            "final_tally": tally,
        }},
    )
    return {"status": "closed", "winner": winner_id, "winner_share_vibe": winner_share}
