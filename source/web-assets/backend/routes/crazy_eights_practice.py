"""
Crazy Eights Practice — single-player vs 3 AI opponents.

Endpoints:
    POST /api/crazy-eights-practice/start      → fresh match
    GET  /api/crazy-eights-practice/state      → current view
    POST /api/crazy-eights-practice/play       → {card, declared_suit?}
    POST /api/crazy-eights-practice/declare    → {suit}  (resolve pending wild)
    POST /api/crazy-eights-practice/draw       → no body
    POST /api/crazy-eights-practice/new-hand   → next hand after scoring
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_current_user
from utils.crazy_eights_game import CrazyEightsGame

router = APIRouter(prefix="/crazy-eights-practice", tags=["crazy-eights-practice"])

_MATCHES: Dict[str, CrazyEightsGame] = {}


class StartRequest(BaseModel):
    pass


class PlayRequest(BaseModel):
    card: Dict[str, Any]
    declared_suit: Optional[str] = None


class DeclareRequest(BaseModel):
    suit: str


async def _user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.user_id


def _serialise(game: CrazyEightsGame, user_id: str, sequence: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    view = game.to_view()
    view["mode"] = "practice"
    view["user_id"] = user_id
    if sequence is not None:
        view["play_sequence"] = sequence
    return view


@router.post("/start")
async def start(_payload: StartRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = CrazyEightsGame(user_position="south")
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


@router.post("/play")
async def play(payload: PlayRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        result = game.play(game.user_position, payload.card, payload.declared_suit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    sequence: List[Dict[str, Any]] = [{
        "player": game.user_position,
        "card": payload.card,
        "wild": payload.card.get("rank") == "8",
        "declared": game.declared_suit,
        "wild_pending": result.get("wild_pending", False),
        "hand_complete": result.get("hand_complete", False),
        "winner": result.get("winner"),
    }]
    if not result.get("hand_complete") and not result.get("wild_pending"):
        sequence.extend(game.run_bots())
    return {"success": True, "game": _serialise(game, uid, sequence)}


@router.post("/declare")
async def declare(payload: DeclareRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        game.declare_suit(game.user_position, payload.suit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    sequence: List[Dict[str, Any]] = []
    if game.phase == "playing" and game.turn != game.user_position:
        sequence = game.run_bots()
    return {"success": True, "game": _serialise(game, uid, sequence)}


@router.post("/draw")
async def draw(request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        result = game.draw(game.user_position)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    sequence: List[Dict[str, Any]] = [{"player": game.user_position, "drew": True, **result}]
    if game.phase == "playing" and game.turn != game.user_position:
        sequence.extend(game.run_bots())
    return {"success": True, "game": _serialise(game, uid, sequence)}


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
