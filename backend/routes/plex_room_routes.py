"""
Unified Plex Room — public + admin API surface.
All values in coins (₵). Counter-proposal economics — no in-app burn.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from config import db
from services.plex_room import (
    create_room, get_room_state, set_mode, set_visual_override,
    join_room, leave_room, list_live_rooms, VALID_MODES,
)
from utils.auth_dependencies import get_current_user_from_session

router = APIRouter(prefix="/plex", tags=["plex-room"])


class CreateRoomRequest(BaseModel):
    initial_mode: str = Field(default="GAMING")


@router.post("/rooms")
async def plex_create(
    body: CreateRoomRequest,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    if body.initial_mode not in VALID_MODES:
        return {"ok": False, "reason": "invalid_mode"}
    user_name = (
        current_user.get("name")
        or current_user.get("user_name")
        or current_user.get("email", "Host").split("@")[0]
    )
    return await create_room(
        db, host_id=current_user["user_id"], host_name=user_name,
        initial_mode=body.initial_mode,
    )


@router.get("/rooms/live")
async def plex_list_live(
    limit: int = Query(default=30, ge=1, le=100),
) -> Dict[str, Any]:
    rows = await list_live_rooms(db, limit=limit)
    return {"rows": rows, "count": len(rows)}


@router.get("/rooms/{room_id}")
async def plex_get(room_id: str) -> Dict[str, Any]:
    return await get_room_state(db, room_id)


class JoinRequest(BaseModel):
    interests: Optional[List[str]] = Field(default=None, max_length=20)


@router.post("/rooms/{room_id}/join")
async def plex_join(
    room_id: str,
    body: JoinRequest,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    user_name = (
        current_user.get("name")
        or current_user.get("user_name")
        or current_user.get("email", "Guest").split("@")[0]
    )
    return await join_room(
        db, room_id=room_id, user_id=current_user["user_id"],
        user_name=user_name, interests=body.interests,
    )


@router.post("/rooms/{room_id}/leave")
async def plex_leave(
    room_id: str,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    return await leave_room(
        db, room_id=room_id, user_id=current_user["user_id"],
    )


class ModeRequest(BaseModel):
    mode: str = Field(...)


@router.post("/rooms/{room_id}/mode")
async def plex_set_mode(
    room_id: str,
    body: ModeRequest,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    return await set_mode(
        db, room_id=room_id, mode=body.mode,
        actor_id=current_user["user_id"],
    )


class OverrideRequest(BaseModel):
    override_id: Optional[str] = Field(default=None, max_length=64)


@router.post("/rooms/{room_id}/visual-override")
async def plex_set_visual_override(
    room_id: str,
    body: OverrideRequest,
    current_user=Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    return await set_visual_override(
        db, room_id=room_id, override_id=body.override_id,
        actor_id=current_user["user_id"],
    )
