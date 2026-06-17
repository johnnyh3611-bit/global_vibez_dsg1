"""
Go Fish Practice — single-player vs 3 AI opponents.

Endpoints:
    POST /api/go-fish-practice/start         → fresh match
    GET  /api/go-fish-practice/state         → current view
    POST /api/go-fish-practice/ask           → {target, rank}
"""
from __future__ import annotations
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_current_user
from utils.go_fish_game import GoFishGame

router = APIRouter(prefix="/go-fish-practice", tags=["go-fish-practice"])

_MATCHES: Dict[str, GoFishGame] = {}


class StartRequest(BaseModel):
    pass


class AskRequest(BaseModel):
    target: str
    rank: str


async def _user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.user_id


def _serialise(game: GoFishGame, user_id: str, sequence: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    view = game.to_view()
    view["mode"] = "practice"
    view["user_id"] = user_id
    if sequence is not None:
        view["play_sequence"] = sequence
    return view


@router.post("/start")
async def start(_payload: StartRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = GoFishGame(user_position="south")
    _MATCHES[uid] = game
    bots: List[Dict[str, Any]] = []
    if game.turn != game.user_position:
        bots = game.run_bots()
    return {"success": True, "game": _serialise(game, uid, bots)}


@router.get("/state")
async def state(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    return {"success": True, "game": _serialise(game, uid)}


@router.post("/ask")
async def ask(payload: AskRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        result = game.ask(game.user_position, payload.target, payload.rank)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    sequence: List[Dict[str, Any]] = [result]
    if game.phase == "playing" and game.turn != game.user_position:
        sequence.extend(game.run_bots())
    return {"success": True, "game": _serialise(game, uid, sequence)}
