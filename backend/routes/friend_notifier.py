"""
Friend Action Notifier — push-only WebSocket so other users see things like
"FRIEND BEAT YOUR HIGH SCORE" or "FRIEND ENTERED THE GLASSHOUSE" in real time.

Endpoints:
  WS  /api/ws/friend-events/{user_id}
  GET /api/friend-events/recent       — last 50 broadcast events for the user

The system is fire-and-forget: callers anywhere in the codebase do
    await emit_friend_event(user_id, "VIBEZ_654_SCORE", {...})
and we fan-out to every friend that's currently socket-connected.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request, HTTPException

from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# {user_id: WebSocket} — last writer wins for multi-tab.
_FRIEND_SOCKETS: Dict[str, WebSocket] = {}
_LOCK = asyncio.Lock()


async def _friends_of(user_id: str) -> List[str]:
    """Return the user_ids of accepted friends. Best-effort across the schema."""
    db = get_database()
    friend_ids: set[str] = set()
    try:
        # `friendships` schema: {user_a, user_b, status:'accepted'}
        cursor = db.friendships.find(
            {"$or": [{"user_a": user_id}, {"user_b": user_id}], "status": "accepted"},
            {"_id": 0, "user_a": 1, "user_b": 1},
        )
        async for row in cursor:
            other = row.get("user_b") if row.get("user_a") == user_id else row.get("user_a")
            if other:
                friend_ids.add(other)
    except Exception:
        pass
    try:
        # Fallback shape used elsewhere: users.friends array
        u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "friends": 1})
        if u and isinstance(u.get("friends"), list):
            friend_ids.update(str(f) for f in u["friends"])
    except Exception:
        pass
    friend_ids.discard(user_id)
    return list(friend_ids)


async def emit_friend_event(user_id: str, event: str, payload: Dict[str, Any]) -> int:
    """
    Public helper — fan out a friend event. Returns the number of sockets
    that actually received the push (the rest will see it next time they
    open /api/friend-events/recent).
    """
    record = {
        "event": event,
        "from_user_id": user_id,
        "payload": payload,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    # Persist for catch-up (cap last 200 per user).
    db = get_database()
    try:
        await db.friend_events.insert_one(record)
    except Exception:
        pass

    friends = await _friends_of(user_id)
    delivered = 0
    for fid in friends:
        sock = _FRIEND_SOCKETS.get(fid)
        if not sock:
            continue
        try:
            await sock.send_json(record)
            delivered += 1
        except Exception:
            async with _LOCK:
                _FRIEND_SOCKETS.pop(fid, None)
    return delivered


@router.websocket("/ws/friend-events/{user_id}")
async def ws_friend_events(ws: WebSocket, user_id: str):
    await ws.accept()
    async with _LOCK:
        prior = _FRIEND_SOCKETS.get(user_id)
        if prior:
            try:
                await prior.close(code=4000)
            except Exception:
                pass
        _FRIEND_SOCKETS[user_id] = ws
    try:
        while True:
            await ws.receive_text()  # keepalive only
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"[friend-events] ws err {user_id}: {e}")
    finally:
        async with _LOCK:
            if _FRIEND_SOCKETS.get(user_id) is ws:
                _FRIEND_SOCKETS.pop(user_id, None)


@router.get("/friend-events/recent")
async def recent_friend_events(http_request: Request, limit: int = 50):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    friends = await _friends_of(user.user_id)
    db = get_database()
    cursor = db.friend_events.find(
        {"from_user_id": {"$in": friends}}, {"_id": 0}
    ).sort("at", -1).limit(min(max(1, limit), 100))
    rows = await cursor.to_list(length=limit)
    return {"count": len(rows), "events": rows}
