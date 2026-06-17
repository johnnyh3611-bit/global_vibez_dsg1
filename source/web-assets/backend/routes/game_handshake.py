"""
Game Handshake — issues 60-second one-time-use session tokens that are
pinned to the authed user. Unity WebGL builds call this on load to bind
their in-engine session to the platform identity (so multi-tab cheating
and replay attacks are blocked).

Endpoints (mounted under /api):
  GET  /api/game/handshake             — issue token (auth required)
  POST /api/game/handshake/consume     — server-to-server: validates and
                                         marks token as consumed
"""
from __future__ import annotations

import os
import uuid
import time
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from utils.database import get_current_user

router = APIRouter()

TOKEN_TTL_SECONDS = int(os.environ.get("GAME_HANDSHAKE_TTL", "60"))

# In-memory store keyed by token. Acceptable here because tokens are
# 60s ephemeral and a process restart legitimately invalidates them.
_TOKENS: Dict[str, Dict[str, Any]] = {}


def _purge_expired() -> None:
    now = time.time()
    expired = [t for t, m in _TOKENS.items() if m["expires_at"] < now]
    for t in expired:
        _TOKENS.pop(t, None)


@router.get("/game/handshake")
async def issue_handshake(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    _purge_expired()
    token = uuid.uuid4().hex
    _TOKENS[token] = {
        "user_id": user.user_id,
        "user_email": user.email,
        "issued_at": time.time(),
        "expires_at": time.time() + TOKEN_TTL_SECONDS,
        "consumed": False,
    }
    return {
        "token": token,
        "ttl_seconds": TOKEN_TTL_SECONDS,
        "entry_point": "/cyber-casino/cyber_casino_main",
    }


class ConsumePayload(BaseModel):
    token: str


@router.post("/game/handshake/consume")
async def consume_handshake(payload: ConsumePayload):
    """
    One-time-use validation. Returns the user context bound to the token,
    or 410/404 if expired/missing/already-consumed. Designed to be called
    by Unity-side game services that need to verify the handshake.
    """
    _purge_expired()
    meta = _TOKENS.get(payload.token)
    if not meta:
        raise HTTPException(status_code=404, detail="Token not found or expired")
    if meta["consumed"]:
        raise HTTPException(status_code=410, detail="Token already consumed")
    if meta["expires_at"] < time.time():
        _TOKENS.pop(payload.token, None)
        raise HTTPException(status_code=410, detail="Token expired")
    meta["consumed"] = True
    return {
        "valid": True,
        "user_id": meta["user_id"],
        "user_email": meta["user_email"],
        "issued_at": meta["issued_at"],
    }


def peek_token(token: str) -> Optional[Dict[str, Any]]:
    """Internal helper — used by other backend modules if needed."""
    _purge_expired()
    return _TOKENS.get(token)
