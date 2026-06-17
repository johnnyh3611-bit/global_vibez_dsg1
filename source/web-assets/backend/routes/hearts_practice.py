"""
Hearts Practice — single-player vs 3 AI opponents.

Endpoints:
    POST /api/hearts-practice/start          → fresh game + deal
    GET  /api/hearts-practice/state          → current view
    POST /api/hearts-practice/pass-cards     → user submits 3 cards
    POST /api/hearts-practice/play           → user plays a card
    POST /api/hearts-practice/new-hand       → start next hand after scoring
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_database, get_current_user
from utils.hearts_game import HeartsGame

router = APIRouter(prefix="/hearts-practice", tags=["hearts-practice"])

# A tiny in-memory match registry keyed by user_id. Each user has at most
# one active practice game at a time — matches the BW/Spades pattern.
_MATCHES: Dict[str, HeartsGame] = {}


# ----- models -----------------------------------------------------------


class StartRequest(BaseModel):
    pass


class PassRequest(BaseModel):
    cards: List[Dict[str, Any]]


class PlayRequest(BaseModel):
    card: Dict[str, Any]


# ----- helpers ----------------------------------------------------------


async def _user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.user_id


def _serialise(game: HeartsGame, user_id: str, last_play_sequence: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    view = game.to_view()
    view["mode"] = "practice"
    view["user_id"] = user_id
    if last_play_sequence is not None:
        view["play_sequence"] = last_play_sequence
    return view


# ----- endpoints --------------------------------------------------------


@router.post("/start")
async def start_match(_payload: StartRequest, request: Request) -> Dict[str, Any]:
    user_id = await _user_id(request)
    game = HeartsGame(user_position="south")
    _MATCHES[user_id] = game
    # Persist a tiny audit row (best-effort; ignore failure)
    try:
        db = get_database()
        await db.hearts_practice_audits.insert_one({
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "event": "match_start",
        })
    except Exception:
        pass
    return {"success": True, "game": _serialise(game, user_id)}


@router.get("/state")
async def state(request: Request) -> Dict[str, Any]:
    user_id = await _user_id(request)
    game = _MATCHES.get(user_id)
    if not game:
        raise HTTPException(status_code=404, detail="No active Hearts match")
    return {"success": True, "game": _serialise(game, user_id)}


@router.post("/pass-cards")
async def pass_cards(payload: PassRequest, request: Request) -> Dict[str, Any]:
    user_id = await _user_id(request)
    game = _MATCHES.get(user_id)
    if not game:
        raise HTTPException(status_code=404, detail="No active Hearts match")
    if game.phase != "passing":
        raise HTTPException(status_code=400, detail="Not in passing phase")
    try:
        game.submit_pass(game.user_position, payload.cards)
        game.all_bots_pass()
        game.resolve_passes()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    bot_steps = game.play_bot_turns()
    return {"success": True, "game": _serialise(game, user_id, bot_steps)}


@router.post("/play")
async def play_card(payload: PlayRequest, request: Request) -> Dict[str, Any]:
    user_id = await _user_id(request)
    game = _MATCHES.get(user_id)
    if not game:
        raise HTTPException(status_code=404, detail="No active Hearts match")
    if game.phase != "playing":
        raise HTTPException(status_code=400, detail="Not in playing phase")
    if game.turn != game.user_position:
        raise HTTPException(status_code=400, detail="Not your turn")
    try:
        result = game.play_card(game.user_position, payload.card)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    sequence: List[Dict[str, Any]] = [{
        "player": game.user_position,
        "card": payload.card,
        "trick_winner": result.get("trick_winner"),
        "trick_complete": result.get("trick_complete", False),
        "round_complete": result.get("round_complete", False),
    }]
    if not result.get("round_complete"):
        sequence.extend(game.play_bot_turns())
    return {"success": True, "game": _serialise(game, user_id, sequence)}


@router.post("/new-hand")
async def new_hand(request: Request) -> Dict[str, Any]:
    user_id = await _user_id(request)
    game = _MATCHES.get(user_id)
    if not game:
        raise HTTPException(status_code=404, detail="No active Hearts match")
    if game.phase != "scoring":
        raise HTTPException(status_code=400, detail="Round not finished")
    try:
        game.begin_next_hand()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    bot_steps: List[Dict[str, Any]] = []
    if game.phase == "playing" and game.turn != game.user_position:
        bot_steps = game.play_bot_turns()
    return {"success": True, "game": _serialise(game, user_id, bot_steps)}
