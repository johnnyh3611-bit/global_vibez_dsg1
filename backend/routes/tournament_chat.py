"""
Tournament Chat / Heckle Lane — real-time per-tournament chat.

REST API (this module):
  GET  /api/card-royale/chat/{tournament_id}?limit=50  → recent messages
  POST /api/card-royale/chat/{tournament_id}           → send message
  POST /api/card-royale/chat/{tournament_id}/react     → add emoji reaction
  GET  /api/card-royale/chat/{tournament_id}/pinned    → pinned messages

Socket.IO:
  rooms are named `tournament:{tournament_id}`.
  Clients join via services.tournament_chat_socketio.
  After each successful REST mutation, we emit the new doc to the room so
  connected clients update instantly — no polling.

Rate limiting: a given user_id may post at most 12 msgs / 60s per tournament.
"""
from __future__ import annotations

import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Deque, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database

router = APIRouter(prefix="/card-royale/chat", tags=["card-royale-chat"])

# ============================================================================
# Rate limiting (in-memory, per-process). 12 msgs / 60s per user per tournament.
# ============================================================================
_POST_BUDGET = 12
_POST_WINDOW_SEC = 60
_user_history: Dict[str, Deque[float]] = defaultdict(deque)


def _rate_ok(user_id: str, tournament_id: str) -> bool:
    key = f"{user_id}::{tournament_id}"
    now = datetime.now(timezone.utc).timestamp()
    dq = _user_history[key]
    while dq and dq[0] < now - _POST_WINDOW_SEC:
        dq.popleft()
    if len(dq) >= _POST_BUDGET:
        return False
    dq.append(now)
    return True


# ============================================================================
# Auth helper (same pattern as routes/card_royale.py)
# ============================================================================

async def _resolve_user(request: Request) -> Dict[str, str]:
    db = get_database()
    session_token = request.cookies.get("session_token")
    if session_token:
        sess = await db.user_sessions.find_one(
            {"session_token": session_token}, {"user_id": 1, "_id": 0}
        )
        if sess:
            user = await db.users.find_one(
                {"user_id": sess["user_id"]},
                {"user_id": 1, "username": 1, "_id": 0},
            )
            if user:
                return {
                    "user_id": user["user_id"],
                    "username": user.get("username") or user["user_id"],
                }
    uid = request.headers.get("x-user-id") or request.headers.get("X-User-Id")
    if uid:
        user = await db.users.find_one(
            {"user_id": uid}, {"user_id": 1, "username": 1, "_id": 0}
        )
        if user:
            return {
                "user_id": user["user_id"],
                "username": user.get("username") or user["user_id"],
            }
        return {"user_id": uid, "username": uid}
    raise HTTPException(401, "Not authenticated")


# ============================================================================
# Content filter — keeps the heckle lane merely spicy, not toxic.
# ============================================================================
_BANNED_WORDS = {
    # Focus on slurs and explicit harassment. Not exhaustive by design — this
    # is a sweepstakes platform, not a moderation product.
    "n1gger", "f4gg0t", "k1ke", "retard", "k*ll yourself",
}


def _clean_text(txt: str) -> str:
    t = (txt or "").strip()
    if len(t) > 500:
        t = t[:500] + "…"
    lowered = t.lower()
    for w in _BANNED_WORDS:
        if w in lowered:
            return ""
    return t


async def _broadcast(event: str, payload: Dict[str, Any], tournament_id: str) -> None:
    """Emit to all clients in the tournament's Socket.IO room."""
    try:
        from services.multiplayer import sio
        await sio.emit(event, payload, room=f"tournament:{tournament_id}", namespace="/tournament-chat")
    except Exception:
        # Sockets are best-effort; REST still returns the truth of record.
        pass


# ============================================================================
# Models
# ============================================================================

class SendMessageIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


class ReactIn(BaseModel):
    message_id: str
    emoji: str = Field(..., min_length=1, max_length=8)


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/{tournament_id}")
async def list_messages(tournament_id: str, limit: int = 50) -> Dict[str, Any]:
    limit = max(1, min(200, int(limit)))
    db = get_database()
    cursor = db.tournament_chat.find(
        {"tournament_id": tournament_id}, {"_id": 0}
    ).sort("created_at", -1).limit(limit)
    rows = await cursor.to_list(length=limit)
    rows.reverse()  # oldest first for easy rendering
    return {"tournament_id": tournament_id, "messages": rows, "count": len(rows)}


@router.get("/{tournament_id}/pinned")
async def list_pinned(tournament_id: str) -> Dict[str, Any]:
    db = get_database()
    cursor = db.tournament_chat.find(
        {"tournament_id": tournament_id, "is_pinned": True}, {"_id": 0}
    ).sort("created_at", -1).limit(20)
    rows = await cursor.to_list(length=20)
    return {"tournament_id": tournament_id, "pinned": rows, "count": len(rows)}


@router.post("/{tournament_id}")
async def send_message(tournament_id: str, body: SendMessageIn, request: Request) -> Dict[str, Any]:
    user = await _resolve_user(request)
    if not _rate_ok(user["user_id"], tournament_id):
        raise HTTPException(429, "Slow down — 12 messages per minute max.")

    text = _clean_text(body.text)
    if not text:
        raise HTTPException(400, "Message rejected (empty or blocked)")

    db = get_database()
    # Tournament must exist
    t = await db.tournaments.find_one({"tournament_id": tournament_id}, {"tournament_id": 1, "_id": 0})
    if not t:
        raise HTTPException(404, "Tournament not found")

    doc = {
        "message_id": f"tcm_{uuid.uuid4().hex[:12]}",
        "tournament_id": tournament_id,
        "user_id": user["user_id"],
        "username": user["username"],
        "text": text,
        "reactions": {},
        "is_pinned": False,
        "is_system": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tournament_chat.insert_one(doc)
    out = {k: v for k, v in doc.items() if k != "_id"}
    await _broadcast("chat:new", out, tournament_id)
    return {"ok": True, "message": out}


@router.post("/{tournament_id}/react")
async def react(tournament_id: str, body: ReactIn, request: Request) -> Dict[str, Any]:
    user = await _resolve_user(request)
    db = get_database()
    msg = await db.tournament_chat.find_one(
        {"message_id": body.message_id, "tournament_id": tournament_id}, {"_id": 0}
    )
    if not msg:
        raise HTTPException(404, "Message not found")

    emoji = body.emoji.strip()[:8]
    reactors_key = f"reactors.{emoji}"
    count_key = f"reactions.{emoji}"
    # Toggle: if user already reacted with this emoji, remove; otherwise add.
    reactors = (msg.get("reactors") or {}).get(emoji) or []
    if user["user_id"] in reactors:
        await db.tournament_chat.update_one(
            {"message_id": body.message_id},
            {"$pull": {reactors_key: user["user_id"]}, "$inc": {count_key: -1}},
        )
        action = "removed"
    else:
        await db.tournament_chat.update_one(
            {"message_id": body.message_id},
            {"$addToSet": {reactors_key: user["user_id"]}, "$inc": {count_key: 1}},
        )
        action = "added"

    # Fetch fresh count for broadcast
    fresh = await db.tournament_chat.find_one(
        {"message_id": body.message_id}, {"_id": 0, "reactors": 0}
    )
    await _broadcast("chat:react", {"message_id": body.message_id, "reactions": fresh.get("reactions", {}), "action": action}, tournament_id)
    return {"ok": True, "action": action, "reactions": fresh.get("reactions", {})}


async def post_system_message(tournament_id: str, text: str, pinned: bool = True) -> Dict[str, Any]:
    """
    Public helper: used by utils.tournament_engine.finalize_tournament to
    auto-pin the rank-1 celebration. Also usable from the scheduler loop.
    """
    db = get_database()
    doc = {
        "message_id": f"tcm_sys_{uuid.uuid4().hex[:10]}",
        "tournament_id": tournament_id,
        "user_id": "system",
        "username": "Card Royale",
        "text": text[:500],
        "reactions": {},
        "is_pinned": pinned,
        "is_system": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tournament_chat.insert_one(doc)
    out = {k: v for k, v in doc.items() if k != "_id"}
    await _broadcast("chat:new", out, tournament_id)
    return out
