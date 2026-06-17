"""
UNO Practice — single-player vs 3 AI opponents.

Endpoints:
    POST /api/uno-practice/start
    GET  /api/uno-practice/state
    POST /api/uno-practice/play     {card, declared_color?}
    POST /api/uno-practice/declare  {color}
    POST /api/uno-practice/draw
    POST /api/uno-practice/new-hand
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_current_user
from utils.uno_game import UnoGame

router = APIRouter(prefix="/uno-practice", tags=["uno-practice"])

_MATCHES: Dict[str, UnoGame] = {}


class StartRequest(BaseModel):
    pass


class PlayRequest(BaseModel):
    card: Dict[str, Any]
    declared_color: Optional[str] = None


class DeclareRequest(BaseModel):
    color: str


class ChallengeRequest(BaseModel):
    challenge: bool


async def _user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.user_id


def _serialise(game: UnoGame, user_id: str, sequence: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    view = game.to_view()
    view["mode"] = "practice"
    view["user_id"] = user_id
    if sequence is not None:
        view["play_sequence"] = sequence
    return view


@router.post("/start")
async def start(_payload: StartRequest, request: Request) -> Dict[str, Any]:
    uid = await _user_id(request)
    game = UnoGame(user_position="south")
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
        result = game.play(game.user_position, payload.card, payload.declared_color)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    sequence: List[Dict[str, Any]] = [{
        "player": game.user_position,
        "card": payload.card,
        "declared": game.pending_color,
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
        result = game.declare_color(game.user_position, payload.color)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    sequence: List[Dict[str, Any]] = []
    if not result.get("hand_complete") and game.phase == "playing" and game.turn != game.user_position:
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
    sequence: List[Dict[str, Any]] = [{"player": game.user_position, "drew": result.get("drew"), "passed": result.get("pass", False)}]
    if game.phase == "playing" and game.turn != game.user_position:
        sequence.extend(game.run_bots())
    return {"success": True, "game": _serialise(game, uid, sequence)}


@router.post("/challenge")
async def challenge(payload: ChallengeRequest, request: Request) -> Dict[str, Any]:
    """Resolve an open Wild Draw Four challenge for the user."""
    uid = await _user_id(request)
    game = _MATCHES.get(uid)
    if not game:
        raise HTTPException(status_code=404, detail="No active match")
    try:
        info = game.resolve_wild4_challenge(game.user_position, payload.challenge)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    sequence: List[Dict[str, Any]] = [{"player": game.user_position, "wild4_resolution": info}]
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
