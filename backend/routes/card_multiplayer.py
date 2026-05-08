"""
Card Multiplayer Rooms — 4-player live Euchre + Pinochle.

Wraps the existing ``utils.euchre_game.EuchreGame`` and
``utils.pinochle_game.PinochleGame`` state machines inside an HTTP-polling
room registry, using the same room+poll pattern as the Vibe 654 tournaments.

Currency: no wager. These are trick-taking games; the host sets an optional
buy-in that's split between the winning team on round completion.

Seats map to fixed engine positions: ``north``, ``east``, ``south``, ``west``.
``south`` is the host by convention. A room locks once all 4 seats fill.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from utils.database import get_database
from utils.euchre_game import EuchreGame
from utils.pinochle_game import PinochleGame

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/card-multiplayer", tags=["Card Multiplayer"])


def _db():
    return get_database()


# In-memory engine cache — indexed by room_id. Mongo persists only the
# ``to_view()`` snapshot + seats + meta; engines are rebuilt on demand from
# saved state where necessary. This is a reasonable MVP for single-instance
# deployments; Redis-backed shared state is a future enhancement.
_ENGINES: Dict[str, Any] = {}


SEATS: List[str] = ["south", "west", "north", "east"]
GAME_TYPES = {"euchre", "pinochle"}


# ----- Models ----------------------------------------------------------------
class CreateRoomRequest(BaseModel):
    game_type: Literal["euchre", "pinochle"]
    host_user_id: str
    host_user_name: str
    buy_in: int = Field(0, ge=0, le=500_000)
    room_name: Optional[str] = None


class JoinRoomRequest(BaseModel):
    user_id: str
    user_name: str


class PlayCardRequest(BaseModel):
    user_id: str
    card: Dict[str, Any]


class BidActionRequest(BaseModel):
    user_id: str
    action: Literal["order_up", "name_trump", "pass", "place_bid", "discard"]
    suit: Optional[str] = None      # for name_trump / order_up (euchre)
    amount: Optional[int] = None    # for pinochle place_bid
    card: Optional[Dict[str, Any]] = None  # for dealer discard_after_order


# ----- Helpers ---------------------------------------------------------------
async def _load_room(room_id: str) -> Dict[str, Any]:
    r = await _db().card_mp_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Room not found")
    return r


def _new_engine(game_type: str) -> Any:
    if game_type == "euchre":
        eng = EuchreGame(user_position="south")
    elif game_type == "pinochle":
        eng = PinochleGame(user_position="south", mode="single")
    else:
        raise HTTPException(400, f"Unknown game_type {game_type!r}")
    eng.start_new_hand()
    return eng


def _engine_for(room_id: str, game_type: str) -> Any:
    eng = _ENGINES.get(room_id)
    if eng is None:
        eng = _new_engine(game_type)
        _ENGINES[room_id] = eng
    return eng


def _seat_for(room: Dict[str, Any], user_id: str) -> Optional[str]:
    for seat, occupant in (room.get("seats") or {}).items():
        if occupant and occupant.get("user_id") == user_id:
            return seat
    return None


def _room_view(room: Dict[str, Any], engine: Optional[Any]) -> Dict[str, Any]:
    data: Dict[str, Any] = {
        "room_id": room["room_id"],
        "room_name": room["room_name"],
        "game_type": room["game_type"],
        "status": room["status"],
        "buy_in": room["buy_in"],
        "host_user_id": room["host_user_id"],
        "seats": room.get("seats") or {},
        "created_at": room.get("created_at"),
    }
    if engine is not None and hasattr(engine, "to_view"):
        data["engine"] = engine.to_view()
    return data


async def _auto_run_bots(room_id: str, engine: Any) -> None:
    """
    If an unfilled seat is up next, let the engine's bot ping-pong a few steps
    so play doesn't halt. For fully-seated rooms this is a no-op.
    """
    try:
        if hasattr(engine, "run_bots"):
            engine.run_bots(max_steps=8)
    except Exception as exc:  # pragma: no cover
        logger.warning("bot run failed for room %s: %s", room_id, exc)


# ----- Endpoints -------------------------------------------------------------
@router.post("/create-room")
async def create_room(req: CreateRoomRequest) -> Dict[str, Any]:
    room_id = str(uuid.uuid4())
    room_code = uuid.uuid4().hex[:6].upper()
    seats: Dict[str, Optional[Dict[str, Any]]] = {s: None for s in SEATS}
    seats["south"] = {"user_id": req.host_user_id, "user_name": req.host_user_name, "is_host": True, "is_bot": False}
    room = {
        "room_id": room_id,
        "room_code": room_code,
        "room_name": req.room_name or f"{req.game_type.title()} · {req.host_user_name}",
        "game_type": req.game_type,
        "host_user_id": req.host_user_id,
        "buy_in": req.buy_in,
        "seats": seats,
        "status": "WAITING",  # WAITING | PLAYING | COMPLETED
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db().card_mp_rooms.insert_one(dict(room))
    return {"success": True, "room": room}


@router.get("/room/{room_id}")
async def get_room(room_id: str) -> Dict[str, Any]:
    room = await _load_room(room_id)
    engine = _ENGINES.get(room_id) if room["status"] == "PLAYING" else None
    return {"success": True, "room": _room_view(room, engine)}


@router.get("/rooms")
async def list_rooms(game_type: Optional[str] = None) -> Dict[str, Any]:
    q: Dict[str, Any] = {"status": {"$in": ["WAITING", "PLAYING"]}}
    if game_type:
        q["game_type"] = game_type
    cursor = _db().card_mp_rooms.find(q, {"_id": 0}).sort("created_at", -1).limit(30)
    rows = await cursor.to_list(length=30)
    summaries = []
    for r in rows:
        occupied = sum(1 for s in (r.get("seats") or {}).values() if s)
        summaries.append({
            "room_id": r["room_id"],
            "room_code": r.get("room_code"),
            "room_name": r["room_name"],
            "game_type": r["game_type"],
            "status": r["status"],
            "buy_in": r.get("buy_in", 0),
            "occupied": occupied,
            "max_seats": 4,
            "host_user_id": r["host_user_id"],
        })
    return {"success": True, "rooms": summaries}


@router.post("/room/{room_id}/join")
async def join_room(room_id: str, req: JoinRoomRequest) -> Dict[str, Any]:
    room = await _load_room(room_id)
    if room["status"] != "WAITING":
        raise HTTPException(400, "Room already started")
    seats = room.get("seats") or {s: None for s in SEATS}
    # Already joined?
    existing = _seat_for(room, req.user_id)
    if existing:
        return {"success": True, "seat": existing, "room": _room_view(room, None)}
    # Find first open seat
    open_seat = next((s for s in SEATS if not seats.get(s)), None)
    if not open_seat:
        raise HTTPException(400, "Room is full")
    seats[open_seat] = {
        "user_id": req.user_id,
        "user_name": req.user_name,
        "is_host": False,
        "is_bot": False,
    }
    await _db().card_mp_rooms.update_one({"room_id": room_id}, {"$set": {"seats": seats}})
    room["seats"] = seats
    return {"success": True, "seat": open_seat, "room": _room_view(room, None)}


@router.post("/room/{room_id}/leave")
async def leave_room(room_id: str, req: JoinRoomRequest) -> Dict[str, Any]:
    room = await _load_room(room_id)
    seat = _seat_for(room, req.user_id)
    if not seat:
        return {"success": True, "message": "not seated"}
    seats = room["seats"]
    seats[seat] = None
    await _db().card_mp_rooms.update_one({"room_id": room_id}, {"$set": {"seats": seats}})
    return {"success": True}


@router.post("/room/{room_id}/fill-bots")
async def fill_with_bots(room_id: str) -> Dict[str, Any]:
    """Quality-of-life — host fills remaining seats with bots so they can play solo."""
    room = await _load_room(room_id)
    if room["status"] != "WAITING":
        raise HTTPException(400, "Can only fill bots before start")
    seats = room["seats"]
    bot_names = ["Hustler", "Phoenix", "Viper", "Nova"]
    bi = 0
    for s in SEATS:
        if not seats.get(s):
            seats[s] = {
                "user_id": f"bot_{room_id[:6]}_{s}",
                "user_name": bot_names[bi % len(bot_names)],
                "is_host": False,
                "is_bot": True,
            }
            bi += 1
    await _db().card_mp_rooms.update_one({"room_id": room_id}, {"$set": {"seats": seats}})
    return {"success": True, "seats": seats}


@router.post("/room/{room_id}/start")
async def start_room(room_id: str) -> Dict[str, Any]:
    room = await _load_room(room_id)
    if room["status"] != "WAITING":
        raise HTTPException(400, "Already started")
    seats = room["seats"]
    filled = [s for s in SEATS if seats.get(s)]
    if len(filled) < 4:
        raise HTTPException(400, f"Need 4 seats, have {len(filled)}")
    engine = _new_engine(room["game_type"])
    _ENGINES[room_id] = engine
    await _db().card_mp_rooms.update_one(
        {"room_id": room_id},
        {"$set": {"status": "PLAYING", "started_at": datetime.now(timezone.utc).isoformat()}},
    )
    room["status"] = "PLAYING"
    await _auto_run_bots(room_id, engine)
    return {"success": True, "room": _room_view(room, engine)}


@router.post("/room/{room_id}/bid")
async def bid_action(room_id: str, req: BidActionRequest) -> Dict[str, Any]:
    room = await _load_room(room_id)
    if room["status"] != "PLAYING":
        raise HTTPException(400, "Room not in play")
    seat = _seat_for(room, req.user_id)
    if not seat:
        raise HTTPException(403, "You are not seated in this room")
    engine = _engine_for(room_id, room["game_type"])

    try:
        if room["game_type"] == "euchre":
            if req.action == "order_up":
                engine.order_up(seat)
            elif req.action == "name_trump":
                if not req.suit:
                    raise HTTPException(400, "suit required for name_trump")
                engine.name_trump(seat, req.suit)
            elif req.action == "pass":
                engine.pass_bid(seat)
            elif req.action == "discard":
                if not req.card:
                    raise HTTPException(400, "card required for discard")
                engine.discard_after_order(seat, req.card)
            else:
                raise HTTPException(400, f"action {req.action!r} not supported in euchre")
        elif room["game_type"] == "pinochle":
            if req.action == "place_bid":
                if req.amount is None:
                    raise HTTPException(400, "amount required for place_bid")
                engine.place_bid(seat, int(req.amount))
            elif req.action == "pass":
                engine.pass_bid(seat)
            elif req.action == "name_trump":
                if not req.suit:
                    raise HTTPException(400, "suit required for name_trump")
                engine.name_trump(seat, req.suit)
            else:
                raise HTTPException(400, f"action {req.action!r} not supported in pinochle")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, str(exc))

    await _auto_run_bots(room_id, engine)
    return {"success": True, "view": engine.to_view()}


@router.post("/room/{room_id}/play-card")
async def play_card(room_id: str, req: PlayCardRequest) -> Dict[str, Any]:
    room = await _load_room(room_id)
    if room["status"] != "PLAYING":
        raise HTTPException(400, "Room not in play")
    seat = _seat_for(room, req.user_id)
    if not seat:
        raise HTTPException(403, "You are not seated in this room")
    engine = _engine_for(room_id, room["game_type"])

    try:
        result = engine.play(seat, req.card)
    except Exception as exc:
        raise HTTPException(400, str(exc))

    await _auto_run_bots(room_id, engine)
    view = engine.to_view()
    # If the engine flagged hand-over, we remain in PLAYING — next hand starts
    # automatically via begin_next_hand() called by run_bots or client prompt.
    return {"success": True, "result": result, "view": view}


@router.post("/room/{room_id}/next-hand")
async def next_hand(room_id: str) -> Dict[str, Any]:
    room = await _load_room(room_id)
    if room["status"] != "PLAYING":
        raise HTTPException(400, "Room not in play")
    engine = _engine_for(room_id, room["game_type"])
    try:
        engine.begin_next_hand()
    except Exception as exc:
        raise HTTPException(400, str(exc))
    await _auto_run_bots(room_id, engine)
    return {"success": True, "view": engine.to_view()}
