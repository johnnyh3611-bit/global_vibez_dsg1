"""
Unity Game Rooms — generic WebSocket broadcast for multi-instance Unity
WebGL builds. Each room broadcasts moves/state to every connected
instance so two players watching the same Cyber-Casino table see the
same dice roll, card flip, etc.

Connection URL: /api/ws/game/{room_id}

Protocol: JSON-only. Server adds `from_id` (assigned per connection) on
every broadcast so Unity clients can ignore their own echoes. Server
responds to `{"action": "ping"}` with `{"action": "pong"}` to keep
proxies alive.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()

_ROOMS: Dict[str, List[WebSocket]] = {}
_LOCK = asyncio.Lock()


async def _connect(ws: WebSocket, room_id: str) -> str:
    await ws.accept()
    conn_id = uuid.uuid4().hex[:8]
    async with _LOCK:
        _ROOMS.setdefault(room_id, []).append(ws)
    logger.info(f"[unity-ws] {conn_id} joined {room_id} (total={len(_ROOMS[room_id])})")
    return conn_id


async def _disconnect(ws: WebSocket, room_id: str) -> None:
    async with _LOCK:
        if room_id in _ROOMS and ws in _ROOMS[room_id]:
            _ROOMS[room_id].remove(ws)
            if not _ROOMS[room_id]:
                _ROOMS.pop(room_id, None)


async def _broadcast(room_id: str, message: dict) -> None:
    dead: List[WebSocket] = []
    for ws in list(_ROOMS.get(room_id, [])):
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    if dead:
        async with _LOCK:
            for ws in dead:
                if ws in _ROOMS.get(room_id, []):
                    _ROOMS[room_id].remove(ws)


@router.websocket("/ws/game/{room_id}")
async def game_room_socket(websocket: WebSocket, room_id: str):
    conn_id = await _connect(websocket, room_id)
    # Notify peers that someone joined
    await _broadcast(room_id, {
        "action": "peer_joined",
        "from_id": conn_id,
        "peers": len(_ROOMS.get(room_id, [])),
    })
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("action") == "ping":
                await websocket.send_json({"action": "pong"})
                continue
            data["from_id"] = conn_id
            await _broadcast(room_id, data)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"[unity-ws] error in {room_id}/{conn_id}: {e}")
    finally:
        await _disconnect(websocket, room_id)
        await _broadcast(room_id, {
            "action": "peer_left",
            "from_id": conn_id,
            "peers": len(_ROOMS.get(room_id, [])),
        })


@router.get("/ws/game/{room_id}/peers")
async def list_peers(room_id: str):
    """Quick health-check: how many sockets are currently in a room."""
    return {"room_id": room_id, "peer_count": len(_ROOMS.get(room_id, []))}
