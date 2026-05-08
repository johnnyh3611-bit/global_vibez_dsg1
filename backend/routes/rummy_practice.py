"""
Rummy Practice — single-player vs 1-3 AI opponents (13-card Indian Rummy).

Endpoints:
    POST /api/rummy-practice/start         {num_players?: 2|3|4}
    GET  /api/rummy-practice/state
    POST /api/rummy-practice/draw-stock
    POST /api/rummy-practice/take-discard
    POST /api/rummy-practice/discard       {card}
    POST /api/rummy-practice/declare       {groups: list[list[card]]}
    POST /api/rummy-practice/new-hand
"""
from __future__ import annotations
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_current_user
from utils.rummy_game import RummyGame

router = APIRouter(prefix="/rummy-practice", tags=["rummy-practice"])

_MATCHES: Dict[str, RummyGame] = {}


class StartRequest(BaseModel):
    num_players: int = 4


class DiscardRequest(BaseModel):
    card: Dict[str, Any]


class DeclareRequest(BaseModel):
    groups: List[List[Dict[str, Any]]]


async def _user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.user_id


def _serialise(game: RummyGame, user_id: str, sequence: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    view = game.to_view()
    view["mode"] = "practice"
    view["user_id"] = user_id
    if sequence is not None:
        view["play_sequence"] = sequence
    return view


@router.post("/start")
async def start(payload: StartRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = RummyGame(user_position="south", num_players=payload.num_players)
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
        game.discard_card(game.user_position, payload.card)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    bots: List[Dict[str, Any]] = []
    if game.phase == "draw" and game.turn != game.user_position:
        bots = game.run_bots()
    return {"success": True, "game": _serialise(game, uid, bots)}


@router.post("/declare")
async def declare(payload: DeclareRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.declare(game.user_position, payload.groups)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"success": True, "game": _serialise(game, uid)}


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
