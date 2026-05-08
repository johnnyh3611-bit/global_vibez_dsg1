"""
War Practice — single-player vs 1 AI opponent.

Endpoints:
    POST /api/war-practice/start
    GET  /api/war-practice/state
    POST /api/war-practice/play-round
"""
from __future__ import annotations
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_current_user
from utils.war_game import WarGame

router = APIRouter(prefix="/war-practice", tags=["war-practice"])

_MATCHES: Dict[str, WarGame] = {}


class StartRequest(BaseModel):
    max_rounds: int = 50


async def _user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.user_id


def _serialise(game: WarGame, user_id: str, last: Dict[str, Any] | None = None) -> Dict[str, Any]:
    view = game.to_view()
    view["mode"] = "practice"
    view["user_id"] = user_id
    if last is not None:
        view["last_battle"] = last
    return view


@router.post("/start")
async def start(payload: StartRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = WarGame(user_position="south", max_rounds=payload.max_rounds)
    _MATCHES[uid] = game
    return {"success": True, "game": _serialise(game, uid)}


@router.get("/state")
async def state(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    return {"success": True, "game": _serialise(game, uid)}


@router.post("/play-round")
async def play_round(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        last = game.play_round(game.user_position)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"success": True, "game": _serialise(game, uid, last)}
