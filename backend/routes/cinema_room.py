"""
The Cinema Room — synchronized public viewing of free, legal content.

Distinct from `/dsg/memory-bank/*` which hosts FOUNDER user-content
(Memory Bank Cinema). This route is for ANY user to drop into a room
and watch a shared YouTube / Archive.org / public-domain title with
their friends in real time.

Design:
  • Catalog = curated list of free titles (YouTube IDs + Archive.org
    .mp4 URLs). No content uploads from end users.
  • Rooms = {room_id, host_id, content_id, created_at, last_state}.
  • Sync = WebSocket-broadcast `{action, time}` events to every
    connected client in the same room (play / pause / seek / pick).
  • Hungry-VIBEZ CTA = the room exposes a "Order Food" button that
    fires a `food.order` event for analytics + deep-links the
    HungryVIBEZ ordering flow.
"""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

router = APIRouter(prefix="/cinema-room", tags=["cinema_room"])


# ── Mongo ──────────────────────────────────────────────────────────
def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


# ── Curated free catalog ───────────────────────────────────────────
# Curated free catalog. ALL Archive.org direct MP4s (avoids YouTube
# embedding/region/DMCA flakiness). Add more by editing this list and
# redeploying — no admin UI needed for beta.
CATALOG: List[Dict[str, Any]] = [
    {
        "id": "ar-night-of-the-living-dead-1968",
        "title": "Night of the Living Dead (1968)",
        "year": 1968,
        "duration_min": 96,
        "source": "archive_org",
        "url": "https://archive.org/download/night_of_the_living_dead/night_of_the_living_dead.mp4",
        "youtube_id": None,
        "thumbnail": "https://archive.org/services/img/night_of_the_living_dead",
        "genre": ["Horror", "Classic"],
        "rating": "PG-13",
        "license": "Public Domain",
    },
    {
        "id": "ar-house-on-haunted-hill-1959",
        "title": "House on Haunted Hill (1959)",
        "year": 1959,
        "duration_min": 75,
        "source": "archive_org",
        "url": "https://archive.org/download/house_on_haunted_hill_ipod/house_on_haunted_hill.mp4",
        "youtube_id": None,
        "thumbnail": "https://archive.org/services/img/house_on_haunted_hill_ipod",
        "genre": ["Horror", "Classic"],
        "rating": "PG",
        "license": "Public Domain",
    },
    {
        "id": "ar-his-girl-friday-1940",
        "title": "His Girl Friday (1940)",
        "year": 1940,
        "duration_min": 92,
        "source": "archive_org",
        "url": "https://archive.org/download/HisGirlFriday1940_201907/His%20Girl%20Friday%20%281940%29.mp4",
        "youtube_id": None,
        "thumbnail": "https://archive.org/services/img/HisGirlFriday1940_201907",
        "genre": ["Comedy", "Classic"],
        "rating": "G",
        "license": "Public Domain",
    },
    {
        "id": "ar-detour-1945",
        "title": "Detour (1945)",
        "year": 1945,
        "duration_min": 67,
        "source": "archive_org",
        "url": "https://archive.org/download/Detour_201406/Detour.mp4",
        "youtube_id": None,
        "thumbnail": "https://archive.org/services/img/Detour_201406",
        "genre": ["Film Noir", "Classic"],
        "rating": "PG",
        "license": "Public Domain",
    },
    {
        "id": "ar-charade-1963",
        "title": "Charade (1963)",
        "year": 1963,
        "duration_min": 113,
        "source": "archive_org",
        "url": "https://archive.org/download/charade_1963/charade_1963_512kb.mp4",
        "youtube_id": None,
        "thumbnail": "https://archive.org/services/img/charade_1963",
        "genre": ["Romance", "Mystery"],
        "rating": "PG",
        "license": "Public Domain",
    },
    {
        "id": "ar-popeye-1936",
        "title": "Popeye Cartoons Collection",
        "year": 1936,
        "duration_min": 60,
        "source": "archive_org",
        "url": "https://archive.org/download/Popeye_Classic_Cartoons/Popeye_Classic_Cartoons.mp4",
        "youtube_id": None,
        "thumbnail": "https://archive.org/services/img/Popeye_Classic_Cartoons",
        "genre": ["Animation", "Family"],
        "rating": "G",
        "license": "Public Domain",
    },
    {
        "id": "yt-big-buck-bunny",
        "title": "Big Buck Bunny",
        "year": 2008,
        "duration_min": 10,
        "source": "youtube",
        "url": "https://www.youtube.com/watch?v=YE7VzlLtp-4",
        "youtube_id": "YE7VzlLtp-4",
        "thumbnail": "https://img.youtube.com/vi/YE7VzlLtp-4/hqdefault.jpg",
        "genre": ["Animation", "Family"],
        "rating": "G",
        "license": "Creative Commons",
    },
]


# ── Pydantic models ────────────────────────────────────────────────
class CinemaRoom(BaseModel):
    room_id: str
    host_id: str
    name: str
    content_id: Optional[str] = None
    is_private: bool = False
    is_date_night: bool = False  # 2-person private link · warm theme · audience hidden
    audience_count: int = 0
    created_at: float
    last_state: Dict[str, Any] = Field(default_factory=lambda: {"action": "pause", "time": 0.0})


class CreateRoomBody(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    content_id: Optional[str] = None
    is_private: bool = False
    is_date_night: bool = False
    host_id: str = Field(..., min_length=1, max_length=80)


class FoodOrderEvent(BaseModel):
    room_id: str
    user_id: str
    item_hint: Optional[str] = None


# ── Catalog endpoints ──────────────────────────────────────────────
@router.get("/catalog")
async def list_catalog() -> Dict[str, Any]:
    return {"count": len(CATALOG), "items": CATALOG}


@router.get("/catalog/{content_id}")
async def get_content(content_id: str) -> Dict[str, Any]:
    for item in CATALOG:
        if item["id"] == content_id:
            return item
    raise HTTPException(status_code=404, detail="content_not_found")


# ── Room CRUD ──────────────────────────────────────────────────────
@router.get("/rooms")
async def list_rooms() -> Dict[str, Any]:
    """Public list of joinable rooms (private rooms hidden)."""
    coll = _db().cinema_rooms
    rows = []
    async for doc in coll.find({"is_private": False}, {"_id": 0}).sort("created_at", -1).limit(50):
        rows.append(doc)
    return {"count": len(rows), "rows": rows}


@router.post("/rooms")
async def create_room(body: CreateRoomBody) -> CinemaRoom:
    if body.content_id:
        if not any(c["id"] == body.content_id for c in CATALOG):
            raise HTTPException(status_code=400, detail="invalid_content_id")
    room = CinemaRoom(
        room_id=f"cr_{uuid.uuid4().hex[:10]}",
        host_id=body.host_id,
        name=body.name.strip(),
        content_id=body.content_id,
        is_private=body.is_private or body.is_date_night,  # date night IS private
        is_date_night=body.is_date_night,
        audience_count=0,
        created_at=time.time(),
    )
    await _db().cinema_rooms.insert_one(room.model_dump())
    return room


@router.get("/rooms/{room_id}")
async def get_room(room_id: str) -> Dict[str, Any]:
    doc = await _db().cinema_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="room_not_found")
    return doc


@router.post("/rooms/{room_id}/food-order")
async def log_food_order(room_id: str, body: FoodOrderEvent) -> Dict[str, Any]:
    """Audit event for the in-room HungryVIBEZ CTA. Doesn't actually
    place the order — just logs the intent so we can track conversion
    and notify the room. The frontend deep-links to /hungryvibes
    after receiving 200 OK."""
    if body.room_id != room_id:
        raise HTTPException(status_code=400, detail="room_id_mismatch")
    payload = {
        "room_id": room_id,
        "user_id": body.user_id,
        "item_hint": body.item_hint,
        "ts": time.time(),
    }
    await _db().cinema_food_orders.insert_one(payload)
    # Broadcast to room sockets so other watchers see "X is ordering food".
    await _MANAGER.broadcast(
        {"action": "food_order", "user_id": body.user_id, "item_hint": body.item_hint},
        room_id,
    )
    return {"ok": True, "deep_link": "/hungryvibes"}


# ── WebSocket sync engine ──────────────────────────────────────────
class CinemaManager:
    """Tracks active WebSocket connections per room and broadcasts
    play/pause/seek/chat/food events. In-memory state only — that's
    fine for beta because Mongo is the durable copy of the room +
    last_state, and reconnects sync from Mongo on join."""

    def __init__(self) -> None:
        self.active_rooms: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, room_id: str) -> None:
        await ws.accept()
        async with self._lock:
            self.active_rooms.setdefault(room_id, set()).add(ws)
        await self._refresh_audience(room_id)

    async def disconnect(self, ws: WebSocket, room_id: str) -> None:
        async with self._lock:
            conns = self.active_rooms.get(room_id)
            if conns and ws in conns:
                conns.discard(ws)
            if conns is not None and not conns:
                self.active_rooms.pop(room_id, None)
        await self._refresh_audience(room_id)

    async def broadcast(self, message: Dict[str, Any], room_id: str) -> None:
        async with self._lock:
            conns = list(self.active_rooms.get(room_id, set()))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                # Best-effort — don't crash the broadcast on one bad socket.
                pass

    async def _refresh_audience(self, room_id: str) -> None:
        async with self._lock:
            count = len(self.active_rooms.get(room_id, set()))
        # Persist + broadcast the current live audience so the lobby
        # list shows accurate counts for everyone.
        await _db().cinema_rooms.update_one(
            {"room_id": room_id}, {"$set": {"audience_count": count}}
        )
        await self.broadcast({"action": "audience", "count": count}, room_id)


_MANAGER = CinemaManager()


@router.websocket("/ws/{room_id}")
async def cinema_ws(ws: WebSocket, room_id: str) -> None:
    # Validate room exists before accepting the connection.
    room = await _db().cinema_rooms.find_one({"room_id": room_id}, {"_id": 0})
    if not room:
        await ws.close(code=4404)
        return

    await _MANAGER.connect(ws, room_id)
    # On join, send the current last_state + content so the client can
    # re-sync without waiting for the next host action.
    try:
        await ws.send_json({
            "action": "snapshot",
            "last_state": room.get("last_state", {}),
            "content_id": room.get("content_id"),
            "host_id": room.get("host_id"),
        })

        while True:
            msg = await ws.receive_json()
            action = msg.get("action")
            if action in ("play", "pause", "seek"):
                # Persist last_state so late-joiners catch up.
                await _db().cinema_rooms.update_one(
                    {"room_id": room_id},
                    {"$set": {"last_state": {
                        "action": action,
                        "time": float(msg.get("time") or 0.0),
                        "ts": time.time(),
                    }}},
                )
                await _MANAGER.broadcast(msg, room_id)
            elif action == "pick":
                # Host changes the content for the whole room.
                content_id = msg.get("content_id")
                if content_id and any(c["id"] == content_id for c in CATALOG):
                    await _db().cinema_rooms.update_one(
                        {"room_id": room_id},
                        {"$set": {
                            "content_id": content_id,
                            "last_state": {"action": "pause", "time": 0.0, "ts": time.time()},
                        }},
                    )
                    await _MANAGER.broadcast(
                        {"action": "pick", "content_id": content_id}, room_id
                    )
            elif action == "chat":
                text = (msg.get("text") or "").strip()[:300]
                user_id = msg.get("user_id") or "anon"
                if text:
                    await _MANAGER.broadcast(
                        {"action": "chat", "user_id": user_id, "text": text, "ts": time.time()},
                        room_id,
                    )
            elif action == "ping":
                await ws.send_json({"action": "pong", "ts": time.time()})
            # Unknown actions silently dropped.
    except WebSocketDisconnect:
        pass
    finally:
        await _MANAGER.disconnect(ws, room_id)
