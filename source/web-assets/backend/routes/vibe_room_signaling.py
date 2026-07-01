"""
Universal 2-20 Player Voice/Video Signaling
============================================

WebSocket signaling endpoint for the "Universal 2-20 Player Integration"
spec (artifact: Universal_2-20_Player_Integration.pdf, 2026-02-06).

Design
------
* Pure-signaling server: this endpoint never carries media. It only
  relays WebRTC SDP/ICE between peers and broadcasts voice-activity
  events so the client-side **Focus System** can decide which 4 video
  tiles to render when a room has > 4 participants.
* Audio is always-on for every joiner. Video is rendered selectively by
  the client based on `speaker_update` broadcasts.
* Rooms are namespaced by `room_id` (e.g. an AAA Spades table id, a
  Vibe 6-5-4 Coliseum table id, etc.).

Wire protocol (JSON-only)
-------------------------
client → server:
    {"type": "rtc_signal", "to": "<user_id>", "signal": {...}}
    {"type": "voice_activity", "active": true|false}
    {"type": "ping"}                       # keepalive

server → client:
    {"type": "peer_list", "peers": [{"user_id": "..."}]}     # on join
    {"type": "peer_joined", "user_id": "..."}                # broadcast
    {"type": "peer_left",   "user_id": "..."}                # broadcast
    {"type": "rtc_signal",  "from": "...", "signal": {...}}  # forwarded
    {"type": "speaker_update", "user": "...", "active": true|false}
    {"type": "pong"}

Capacity
--------
* Hard ceiling: 20 concurrent peers per room (PDF spec).
* New joiners over the cap receive a `{type: "room_full"}` close frame.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = logging.getLogger("vibe_room_signaling")

# room_id -> { user_id -> {"ws": WebSocket, "is_talking": bool} }
_ROOMS: Dict[str, Dict[str, Dict[str, Any]]] = {}
_LOCKS: Dict[str, asyncio.Lock] = {}

ROOM_CAP = 20


def _room_lock(room_id: str) -> asyncio.Lock:
    if room_id not in _LOCKS:
        _LOCKS[room_id] = asyncio.Lock()
    return _LOCKS[room_id]


async def _broadcast(room_id: str, payload: Dict[str, Any], exclude: str | None = None) -> None:
    """Fan-out a JSON payload to every peer in a room except ``exclude``."""
    peers = list((_ROOMS.get(room_id) or {}).items())
    for uid, peer in peers:
        if uid == exclude:
            continue
        try:
            await peer["ws"].send_json(payload)
        except Exception as exc:  # noqa: BLE001 — best-effort fan-out
            logger.debug("vibe_room broadcast drop uid=%s err=%s", uid, exc)


@router.websocket("/vibe-room/ws/{room_id}/{user_id}")
async def vibe_room_socket(ws: WebSocket, room_id: str, user_id: str) -> None:
    """
    Universal voice/video room signaling endpoint.

    Connection lifecycle:
      1. Accept and register the peer (or reject with `room_full`).
      2. Send `peer_list` to the new joiner.
      3. Broadcast `peer_joined` to every existing peer.
      4. Loop: forward `rtc_signal` to the targeted peer; rebroadcast
         `voice_activity` as `speaker_update`; reply to `ping` with `pong`.
      5. On disconnect: remove the peer and broadcast `peer_left`.
    """
    await ws.accept()

    async with _room_lock(room_id):
        room = _ROOMS.setdefault(room_id, {})
        if len(room) >= ROOM_CAP and user_id not in room:
            await ws.send_json({"type": "room_full", "cap": ROOM_CAP})
            await ws.close(code=1000)
            return
        # Replace any stale entry under the same user_id (browser refresh).
        existing = room.get(user_id)
        if existing and existing["ws"] is not ws:
            try:
                await existing["ws"].close(code=1000)
            except Exception:  # noqa: BLE001
                pass
        room[user_id] = {"ws": ws, "is_talking": False}

    # Send current peer list to the joiner.
    others = [uid for uid in (_ROOMS.get(room_id) or {}) if uid != user_id]
    await ws.send_json({"type": "peer_list", "peers": [{"user_id": uid} for uid in others]})
    # Notify everyone else.
    await _broadcast(room_id, {"type": "peer_joined", "user_id": user_id}, exclude=user_id)

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            kind = data.get("type")

            if kind == "rtc_signal":
                target = data.get("to")
                target_peer = (_ROOMS.get(room_id) or {}).get(target or "")
                if target_peer:
                    try:
                        await target_peer["ws"].send_json(
                            {
                                "type": "rtc_signal",
                                "from": user_id,
                                "signal": data.get("signal"),
                            }
                        )
                    except Exception as exc:  # noqa: BLE001
                        logger.debug("vibe_room rtc forward drop: %s", exc)

            elif kind == "voice_activity":
                active = bool(data.get("active", False))
                if room_id in _ROOMS and user_id in _ROOMS[room_id]:
                    _ROOMS[room_id][user_id]["is_talking"] = active
                await _broadcast(
                    room_id,
                    {"type": "speaker_update", "user": user_id, "active": active},
                    exclude=user_id,
                )

            elif kind == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.debug("vibe_room socket error uid=%s err=%s", user_id, exc)
    finally:
        async with _room_lock(room_id):
            room = _ROOMS.get(room_id) or {}
            entry = room.get(user_id)
            if entry and entry["ws"] is ws:
                room.pop(user_id, None)
            if not room:
                _ROOMS.pop(room_id, None)
        await _broadcast(room_id, {"type": "peer_left", "user_id": user_id})


@router.get("/vibe-room/{room_id}/peers")
async def list_peers(room_id: str) -> Dict[str, Any]:
    """Read-only roster for debug + lobby UI ("4 of 20 in voice")."""
    room = _ROOMS.get(room_id) or {}
    return {
        "room_id": room_id,
        "count": len(room),
        "cap": ROOM_CAP,
        "peers": [
            {"user_id": uid, "is_talking": bool(p.get("is_talking", False))}
            for uid, p in room.items()
        ],
    }
