"""
Agora Vibe Call — server-side RTC token minting.

Endpoint:
  POST /api/agora/rtc-token
  Body: {"channel": "<channel_name>", "role": "publisher"|"subscriber"}
  Auth: required (uses get_current_user)

  → {app_id, channel, uid, token, expires_at}

The frontend VibeCallRoom component calls this once per channel-join.
The token is short-lived (1h) and scoped to (channel, uid). App Certificate
never leaves the backend.

Deterministic uid mapping:
  Agora requires a 32-bit unsigned integer for the user id. We map our
  string `user_id` to a stable 31-bit hash so the same user always lands
  on the same Agora uid (lets the client correlate volume-indicator
  callbacks with our own user_id table).
"""
from __future__ import annotations

import logging
import os
import re
import time
import zlib

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from agora_token_builder import RtcTokenBuilder

from utils.database import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# RTC roles per agora_token_builder
ROLE_PUBLISHER = 1
ROLE_SUBSCRIBER = 2

TOKEN_TTL_SECONDS = 3600  # 1h — long enough for a JFTN session, short enough to limit abuse

CHANNEL_RE = re.compile(r"^[A-Za-z0-9._\-]{1,64}$")


def _agora_creds() -> tuple[str, str]:
    """Read Agora env on every call so Railway variable updates apply after restart."""
    return (
        os.environ.get("AGORA_APP_ID", "").strip(),
        os.environ.get("AGORA_APP_CERTIFICATE", "").strip(),
    )


def stable_uid(user_id: str) -> int:
    """Deterministic 31-bit unsigned uid from our string user_id."""
    return zlib.crc32(user_id.encode("utf-8")) & 0x7FFFFFFF


class TokenRequest(BaseModel):
    channel: str = Field(..., description="Channel name (e.g. 'jftn-room-abc')")
    role: str = Field(default="publisher", pattern="^(publisher|subscriber)$")


@router.post("/agora/rtc-token")
async def mint_rtc_token(payload: TokenRequest, http_request: Request):
    """
    Mint a short-lived Agora RTC token for the authenticated caller.
    """
    app_id, app_cert = _agora_creds()
    if not app_id or not app_cert:
        missing = []
        if not app_id:
            missing.append("AGORA_APP_ID")
        if not app_cert:
            missing.append("AGORA_APP_CERTIFICATE")
        raise HTTPException(
            status_code=503,
            detail=(
                "Agora is not configured on this deployment. "
                f"Set {', '.join(missing)} on the Railway backend service, then redeploy."
            ),
        )

    if not CHANNEL_RE.match(payload.channel):
        raise HTTPException(
            status_code=400,
            detail="Channel name must be 1-64 chars of [A-Za-z0-9._-].",
        )

    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    role = ROLE_PUBLISHER if payload.role == "publisher" else ROLE_SUBSCRIBER
    uid = stable_uid(user.user_id)
    expires_at = int(time.time()) + TOKEN_TTL_SECONDS

    try:
        token = RtcTokenBuilder.buildTokenWithUid(
            app_id,
            app_cert,
            payload.channel,
            uid,
            role,
            expires_at,
        )
    except Exception as e:
        logger.error(f"[agora] token mint failed for user={user.user_id} ch={payload.channel}: {e}")
        raise HTTPException(500, detail="Token mint failed")

    return {
        "app_id": app_id,
        "channel": payload.channel,
        "uid": uid,
        "token": token,
        "role": payload.role,
        "expires_at": expires_at,
        "ttl_seconds": TOKEN_TTL_SECONDS,
    }


@router.get("/agora/health")
async def agora_health():
    """Public health-check (no secrets leaked) — surfaces whether Agora is configured."""
    app_id, app_cert = _agora_creds()
    return {
        "configured": bool(app_id and app_cert),
        "app_id_present": bool(app_id),
        "certificate_present": bool(app_cert),
        "ttl_seconds": TOKEN_TTL_SECONDS,
        "hint": (
            None
            if (app_id and app_cert)
            else "Add AGORA_APP_ID + AGORA_APP_CERTIFICATE to Railway backend Variables, then redeploy."
        ),
    }
