"""
Pinochle Practice — single-player vs 3 AI opponents.

Endpoints:
    POST /api/pinochle-practice/start
    GET  /api/pinochle-practice/state
    POST /api/pinochle-practice/bid           {amount}
    POST /api/pinochle-practice/pass-bid
    POST /api/pinochle-practice/name-trump    {suit}
    POST /api/pinochle-practice/play          {card}
    POST /api/pinochle-practice/new-hand
"""
from __future__ import annotations
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_current_user
from utils.pinochle_game import PinochleGame

router = APIRouter(prefix="/pinochle-practice", tags=["pinochle-practice"])

_MATCHES: Dict[str, PinochleGame] = {}


class StartRequest(BaseModel):
    mode: str = "single"  # "single" or "double" for double-deck Pinochle


class BidRequest(BaseModel):
    amount: int


class NameTrumpRequest(BaseModel):
    suit: str


class CardRequest(BaseModel):
    card: Dict[str, Any]


async def _user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.user_id


def _serialise(game: PinochleGame, user_id: str, sequence: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    view = game.to_view()
    # The engine's `mode` field already exposes "single"/"double" — use a
    # distinct key for the session type so it doesn't collide.
    view["session_type"] = "practice"
    view["user_id"] = user_id
    if sequence is not None:
        view["play_sequence"] = sequence
    return view


@router.post("/start")
async def start(payload: StartRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = PinochleGame(user_position="south", mode=payload.mode)
    _MATCHES[uid] = game
    bots = game.run_bots()
    return {"success": True, "game": _serialise(game, uid, bots)}


@router.get("/state")
async def state(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    return {"success": True, "game": _serialise(game, uid)}


@router.post("/bid")
async def bid(payload: BidRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.place_bid(game.user_position, payload.amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    bots = game.run_bots()
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
    bots = game.run_bots()
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
    bots = game.run_bots()
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
    bots = game.run_bots()
    return {"success": True, "game": _serialise(game, uid, bots)}
