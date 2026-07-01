"""
Euchre Practice — single-player vs 3 AI opponents.

Endpoints:
    POST /api/euchre-practice/start
    GET  /api/euchre-practice/state
    POST /api/euchre-practice/order-up
    POST /api/euchre-practice/name-trump  {suit}
    POST /api/euchre-practice/pass-bid
    POST /api/euchre-practice/discard     {card}
    POST /api/euchre-practice/play        {card}
    POST /api/euchre-practice/new-hand
"""
from __future__ import annotations
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_current_user
from utils.euchre_game import EuchreGame

router = APIRouter(prefix="/euchre-practice", tags=["euchre-practice"])

_MATCHES: Dict[str, EuchreGame] = {}


class StartRequest(BaseModel):
    pass


class NameTrumpRequest(BaseModel):
    suit: str


class CardRequest(BaseModel):
    card: Dict[str, Any]


async def _user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.user_id


def _serialise(game: EuchreGame, user_id: str, sequence: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    view = game.to_view()
    view["mode"] = "practice"
    view["user_id"] = user_id
    if sequence is not None:
        view["play_sequence"] = sequence
    return view


def _run_bots_until_user(game: EuchreGame) -> List[Dict[str, Any]]:
    return game.run_bots()


@router.post("/start")
async def start(_payload: StartRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = EuchreGame(user_position="south")
    _MATCHES[uid] = game
    bots = _run_bots_until_user(game)
    return {"success": True, "game": _serialise(game, uid, bots)}


@router.get("/state")
async def state(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    return {"success": True, "game": _serialise(game, uid)}


@router.post("/order-up")
async def order_up(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.order_up(game.user_position)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    bots = _run_bots_until_user(game)
    return {"success": True, "game": _serialise(game, uid, bots)}


@router.post("/name-trump")
async def name_trump(payload: NameTrumpRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.name_trump(game.user_position, payload.suit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    bots = _run_bots_until_user(game)
    return {"success": True, "game": _serialise(game, uid, bots)}


@router.post("/pass-bid")
async def pass_bid(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.pass_bid(game.user_position)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    bots = _run_bots_until_user(game)
    return {"success": True, "game": _serialise(game, uid, bots)}


@router.post("/discard")
async def discard(payload: CardRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.discard_after_order(game.user_position, payload.card)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    bots = _run_bots_until_user(game)
    return {"success": True, "game": _serialise(game, uid, bots)}


@router.post("/play")
async def play(payload: CardRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.play(game.user_position, payload.card)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    bots: List[Dict[str, Any]] = []
    if game.phase == "playing":
        bots = _run_bots_until_user(game)
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
    bots = _run_bots_until_user(game)
    return {"success": True, "game": _serialise(game, uid, bots)}
