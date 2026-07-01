"""
Gin Rummy Practice — single-player vs 1 AI opponent (north).

Endpoints:
    POST /api/gin-rummy-practice/start
    GET  /api/gin-rummy-practice/state
    POST /api/gin-rummy-practice/draw-stock
    POST /api/gin-rummy-practice/take-discard
    POST /api/gin-rummy-practice/discard {card, knock}
    POST /api/gin-rummy-practice/new-hand
"""
from __future__ import annotations
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_current_user
from utils.gin_rummy_game import GinRummyGame

router = APIRouter(prefix="/gin-rummy-practice", tags=["gin-rummy-practice"])

_MATCHES: Dict[str, GinRummyGame] = {}


class StartRequest(BaseModel):
    pass


class DiscardRequest(BaseModel):
    card: Dict[str, Any]
    knock: bool = False


async def _user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.user_id


def _serialise(game: GinRummyGame, user_id: str, sequence: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    view = game.to_view()
    view["mode"] = "practice"
    view["user_id"] = user_id
    if sequence is not None:
        view["play_sequence"] = sequence
    return view


@router.post("/start")
async def start(_payload: StartRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = GinRummyGame(user_position="south")
    _MATCHES[uid] = game
    return {"success": True, "game": _serialise(game, uid, [])}


@router.get("/state")
async def state(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    return {"success": True, "game": _serialise(game, uid)}


@router.post("/draw-stock")
async def draw_stock(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.draw_stock(game.user_position)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"success": True, "game": _serialise(game, uid)}


@router.post("/take-discard")
async def take_discard(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.take_discard(game.user_position)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"success": True, "game": _serialise(game, uid)}


@router.post("/discard")
async def discard(payload: DiscardRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        result = game.discard_card(game.user_position, payload.card, knock=payload.knock)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    bots: List[Dict[str, Any]] = []
    if not result.get("end") and game.phase == "draw" and game.turn != game.user_position:
        bots = game.run_bots()
    return {"success": True, "game": _serialise(game, uid, bots)}


@router.post("/new-hand")
async def new_hand(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.begin_next_hand()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    bots: List[Dict[str, Any]] = []
    if game.turn != game.user_position:
        bots = game.run_bots()
    return {"success": True, "game": _serialise(game, uid, bots)}
