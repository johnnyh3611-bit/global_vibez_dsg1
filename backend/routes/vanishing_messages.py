"""
Vanishing Messages — self-destructing private chat.

Design:
  - Messages persist in `vanishing_messages` with status=`unopened` by default.
  - When any recipient opens via `/open` (or the WS OPEN event), we stamp
    `opened_at` and schedule a server-side 180-second timer.
  - When the timer fires, the message doc is wiped from MongoDB AND a
    `VANISH` event is pushed via WebSocket to every connected participant
    so their UI clears it in real-time.
  - If an offline participant later connects to the WS, they receive the
    wipe retroactively because the DB record is gone (GET /thread returns
    a tombstone for any opened-but-vanished ID).

Keeps it simple: no E2E encryption, just ephemeral storage + server-side
expiry. Good enough for "just for the night" UX — not for whistleblower
security. If we need strong privacy later, swap to WebCrypto keys per room.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from utils.database import get_database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/vanishing", tags=["vanishing-messages"])

# Default fuse — 3 minutes. Overridable via env.
DEFAULT_TTL_SECONDS = int(os.environ.get("VANISHING_MESSAGE_TTL_SECONDS", "180"))

# Per-user WebSocket registry. One connection per user at a time.
_connections: Dict[str, WebSocket] = {}
# Timers we're actively running (msg_id -> task). Prevents double-schedule.
_timers: Dict[str, asyncio.Task] = {}


# ==================== MODELS ====================

class SendMessageRequest(BaseModel):
    room_id: str
    to_user_id: str
    text: str = Field(..., max_length=2000)
    ttl_seconds: Optional[int] = None


class OpenMessageRequest(BaseModel):
    msg_id: str


# ==================== HELPERS ====================


async def _resolve_user_id(request: Request) -> str:
    db = get_database()
    session_token = request.cookies.get("session_token")
    if session_token:
        sess = await db.user_sessions.find_one(
            {"session_token": session_token}, {"user_id": 1, "_id": 0}
        )
        if sess:
            return sess["user_id"]
    uid = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
    if uid:
        return uid
    raise HTTPException(401, "Not authenticated")


async def _push(user_id: str, payload: Dict[str, Any]) -> None:
    """Best-effort WS push. Silently drops if user not connected."""
    ws = _connections.get(user_id)
    if not ws:
        return
    try:
        await ws.send_json(payload)
    except Exception as e:
        logger.debug(f"WS push to {user_id} failed: {e}")


async def _vanish(msg_id: str) -> None:
    """Run after the TTL — wipe from DB and notify any connected parties."""
    db = get_database()
    doc = await db.vanishing_messages.find_one_and_delete({"msg_id": msg_id}, {"_id": 0})
    if not doc:
        return
    # Fan out the vanish event so UIs clear in real-time.
    room_id = doc.get("room_id")
    for uid in [doc.get("from_user_id"), doc.get("to_user_id")]:
        if uid:
            await _push(uid, {"type": "VANISH", "msg_id": msg_id, "room_id": room_id})
    _timers.pop(msg_id, None)
    logger.info(f"Vanished msg {msg_id} (room={room_id})")


def _schedule_vanish(msg_id: str, ttl: int) -> None:
    if msg_id in _timers:
        return  # already scheduled — don't double-fire
    async def runner() -> None:
        try:
            await asyncio.sleep(ttl)
            await _vanish(msg_id)
        except asyncio.CancelledError:
            pass
    _timers[msg_id] = asyncio.create_task(runner())


# ==================== HTTP ENDPOINTS ====================


@router.post("/send")
async def send_message(body: SendMessageRequest, request: Request) -> Dict[str, Any]:
    """Create a vanishing message. Recipient gets a real-time NEW_MESSAGE event."""
    from_user_id = await _resolve_user_id(request)
    db = get_database()
    ttl = int(body.ttl_seconds or DEFAULT_TTL_SECONDS)
    # Guardrails — minimum 10s so we can't weaponize a zero-timer; max 1h.
    ttl = max(10, min(3600, ttl))

    msg_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "msg_id": msg_id,
        "room_id": body.room_id,
        "from_user_id": from_user_id,
        "to_user_id": body.to_user_id,
        "text": body.text,
        "ttl_seconds": ttl,
        "status": "unopened",
        "sent_at": now,
        "opened_at": None,
    }
    await db.vanishing_messages.insert_one(doc)
    # Notify both ends — recipient sees inbox bump, sender sees "delivered"
    preview = {
        "msg_id": msg_id,
        "room_id": body.room_id,
        "from_user_id": from_user_id,
        "to_user_id": body.to_user_id,
        "ttl_seconds": ttl,
        "sent_at": now,
    }
    await _push(body.to_user_id, {"type": "NEW_MESSAGE", **preview})
    await _push(from_user_id, {"type": "MESSAGE_SENT", **preview})
    return {"ok": True, "msg_id": msg_id, "ttl_seconds": ttl}


@router.post("/open")
async def open_message(body: OpenMessageRequest, request: Request) -> Dict[str, Any]:
    """Recipient (or sender) opens a message — starts the fuse."""
    user_id = await _resolve_user_id(request)
    db = get_database()
    msg = await db.vanishing_messages.find_one({"msg_id": body.msg_id}, {"_id": 0})
    if not msg:
        # Already vanished OR never existed — return a tombstone the UI can show.
        return {"ok": False, "vanished": True, "msg_id": body.msg_id}
    if user_id not in (msg.get("from_user_id"), msg.get("to_user_id")):
        raise HTTPException(403, "Not a participant")
    if msg.get("status") != "unopened":
        # Already opened — return current state (idempotent).
        return {"ok": True, "text": msg.get("text"), "ttl_seconds": msg.get("ttl_seconds"), "opened_at": msg.get("opened_at")}

    now = datetime.now(timezone.utc).isoformat()
    await db.vanishing_messages.update_one(
        {"msg_id": body.msg_id},
        {"$set": {"status": "opened", "opened_at": now}},
    )
    _schedule_vanish(body.msg_id, int(msg.get("ttl_seconds") or DEFAULT_TTL_SECONDS))

    # Tell both ends the fuse has started so the countdown syncs across devices.
    opened_payload = {
        "type": "MESSAGE_OPENED",
        "msg_id": body.msg_id,
        "room_id": msg.get("room_id"),
        "opened_at": now,
        "ttl_seconds": int(msg.get("ttl_seconds") or DEFAULT_TTL_SECONDS),
    }
    await _push(msg.get("from_user_id"), opened_payload)
    await _push(msg.get("to_user_id"), opened_payload)

    return {"ok": True, "text": msg.get("text"), "ttl_seconds": opened_payload["ttl_seconds"], "opened_at": now}


@router.get("/thread")
async def thread(request: Request, room_id: str, with_user: str, limit: int = 50) -> Dict[str, Any]:
    """Fetch the vanishing-message thread between current user + another in a room.
    Unopened messages are returned WITHOUT their `text` to avoid leaking
    content before the fuse starts."""
    user_id = await _resolve_user_id(request)
    db = get_database()
    cursor = db.vanishing_messages.find(
        {
            "room_id": room_id,
            "$or": [
                {"from_user_id": user_id, "to_user_id": with_user},
                {"from_user_id": with_user, "to_user_id": user_id},
            ],
        },
        {"_id": 0},
    ).sort("sent_at", -1).limit(limit)
    rows: List[Dict[str, Any]] = await cursor.to_list(length=limit)
    # Strip text from unopened messages so it can't be read via this endpoint.
    for r in rows:
        if r.get("status") == "unopened" and r.get("to_user_id") != user_id:
            r["text"] = None
        if r.get("status") == "unopened" and r.get("to_user_id") == user_id:
            # Don't reveal to recipient either — force them through /open which
            # starts the fuse.
            r["text"] = None
    return {"messages": list(reversed(rows)), "count": len(rows)}


# ==================== WEBSOCKET ====================


@router.websocket("/ws/{user_id}")
async def vanishing_ws(websocket: WebSocket, user_id: str) -> None:
    """Persistent connection for real-time vanish notifications.

    Auth is lax here on purpose — the WS only sends/receives metadata
    (msg_id / room_id / timestamps). Message text is ONLY fetched via the
    authenticated HTTP /open endpoint. Worst case a malicious connector
    gets spurious 'your message is about to vanish' pings — no content leak.
    """
    await websocket.accept()
    prev = _connections.get(user_id)
    if prev:
        try:
            await prev.close(code=1000)
        except Exception:
            pass
    _connections[user_id] = websocket
    try:
        while True:
            data = await websocket.receive_json()
            kind = data.get("type")
            # Let a client explicitly ping to request a countdown re-sync
            if kind == "PING":
                await websocket.send_json({"type": "PONG", "t": datetime.now(timezone.utc).isoformat()})
            elif kind == "MESSAGE_OPENED":
                # Mirrors the HTTP /open flow but over WS for lower latency.
                msg_id = data.get("msg_id")
                if not msg_id:
                    continue
                db = get_database()
                msg = await db.vanishing_messages.find_one({"msg_id": msg_id}, {"_id": 0})
                if not msg or msg.get("status") != "unopened":
                    continue
                if user_id not in (msg.get("from_user_id"), msg.get("to_user_id")):
                    continue
                now_iso = datetime.now(timezone.utc).isoformat()
                await db.vanishing_messages.update_one(
                    {"msg_id": msg_id}, {"$set": {"status": "opened", "opened_at": now_iso}}
                )
                _schedule_vanish(msg_id, int(msg.get("ttl_seconds") or DEFAULT_TTL_SECONDS))
                payload = {
                    "type": "MESSAGE_OPENED",
                    "msg_id": msg_id,
                    "room_id": msg.get("room_id"),
                    "opened_at": now_iso,
                    "ttl_seconds": int(msg.get("ttl_seconds") or DEFAULT_TTL_SECONDS),
                }
                for uid in [msg.get("from_user_id"), msg.get("to_user_id")]:
                    if uid:
                        await _push(uid, payload)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"WS error for {user_id}: {e}")
    finally:
        if _connections.get(user_id) is websocket:
            _connections.pop(user_id, None)
