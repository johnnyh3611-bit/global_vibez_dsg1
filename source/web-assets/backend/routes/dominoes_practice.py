"""
Dominoes Practice — Block Dominoes (Double-Six) vs 1 AI opponent.

Endpoints:
    POST /api/dominoes-practice/start       — start a fresh match
    GET  /api/dominoes-practice/state       — current state
    POST /api/dominoes-practice/play        — play a tile {tile_id, side}
    POST /api/dominoes-practice/draw        — draw from the boneyard
    POST /api/dominoes-practice/pass        — pass when blocked
    POST /api/dominoes-practice/next-round  — start the next round after a win
"""
from __future__ import annotations
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_current_user
from utils.dominoes_game import DominoesGame

router = APIRouter(prefix="/dominoes-practice", tags=["dominoes-practice"])

_MATCHES: Dict[str, DominoesGame] = {}


class StartRequest(BaseModel):
    target_score: int = Field(default=150, ge=50, le=500)


class PlayRequest(BaseModel):
    tile_id: str
    side: str  # "left" | "right"


async def _user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.user_id


def _serialise(game: DominoesGame, user_id: str) -> Dict[str, Any]:
    view = game.to_view(requester="south")
    view["user_id"] = user_id
    view["mode"] = "practice"
    return view


@router.post("/start")
async def start(payload: StartRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = DominoesGame(user_position="south", target_score=payload.target_score)
    _MATCHES[uid] = game
    return {"success": True, "game": _serialise(game, uid)}


@router.get("/state")
async def state(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    return {"success": True, "game": _serialise(game, uid)}


@router.post("/play")
async def play(payload: PlayRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        placed = game.play(payload.tile_id, payload.side)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    out = _serialise(game, uid)
    out["last_play"] = placed
    return {"success": True, "game": out}


@router.post("/draw")
async def draw(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        drawn = game.draw()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    out = _serialise(game, uid)
    out["drawn"] = drawn
    return {"success": True, "game": out}


@router.post("/pass")
async def pass_turn(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.pass_turn()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"success": True, "game": _serialise(game, uid)}


@router.post("/next-round")
async def next_round(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.next_round()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"success": True, "game": _serialise(game, uid)}
