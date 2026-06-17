"""
Privy Auth — server-side JWT verification for Privy-issued access tokens.

Privy issues ES256-signed JWTs. We fetch the public keys from Privy's
JWKS endpoint, cache them, and verify each incoming token's signature,
issuer, and audience.

Endpoints (mounted under /api):
  GET  /api/auth/privy/me        — returns {did, claims} on valid token
  POST /api/auth/privy/sync      — upsert user_identities row from Privy
                                   token + linked_accounts payload
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import jwt
from jwt import PyJWKClient, InvalidTokenError
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

from utils.database import get_database

logger = logging.getLogger(__name__)
router = APIRouter()

PRIVY_APP_ID = os.environ.get("PRIVY_APP_ID", "").strip()
PRIVY_JWKS_URL = os.environ.get("PRIVY_JWKS_URL", "").strip()
PRIVY_ISSUER = "privy.io"

_JWKS_CLIENT: Optional[PyJWKClient] = None


def _client() -> PyJWKClient:
    global _JWKS_CLIENT
    if _JWKS_CLIENT is None:
        if not PRIVY_JWKS_URL:
            raise HTTPException(status_code=503, detail="Privy not configured")
        _JWKS_CLIENT = PyJWKClient(PRIVY_JWKS_URL, cache_keys=True, lifespan=3600)
    return _JWKS_CLIENT


def verify_privy_token(token: str) -> Dict[str, Any]:
    """Verifies a Privy access token and returns its claims."""
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        signing_key = _client().get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["ES256"],
            issuer=PRIVY_ISSUER,
            audience=PRIVY_APP_ID,
        )
        return claims
    except InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Privy token: {e}")
    except Exception as e:
        logger.warning(f"[privy] verify failed: {e}")
        raise HTTPException(status_code=401, detail="Privy token verification failed")


def _bearer(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    return authorization.split(" ", 1)[1].strip()


# ───────────────────────────────────────── Endpoints ──

@router.get("/auth/privy/me")
async def privy_me(authorization: Optional[str] = Header(default=None)):
    token = _bearer(authorization)
    claims = verify_privy_token(token)
    return {
        "did": claims.get("sub"),
        "session_id": claims.get("sid"),
        "issued_at": claims.get("iat"),
        "expires_at": claims.get("exp"),
        "audience": claims.get("aud"),
    }


class LinkedAccountIn(BaseModel):
    type: str
    address: str


class PrivySyncPayload(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None
    linked_accounts: List[LinkedAccountIn] = Field(default_factory=list)


@router.post("/auth/privy/sync")
async def privy_sync(
    payload: PrivySyncPayload,
    authorization: Optional[str] = Header(default=None),
):
    """Upsert the Privy user into our hybrid `user_identities` collection."""
    token = _bearer(authorization)
    claims = verify_privy_token(token)
    did = claims.get("sub")
    if not did:
        raise HTTPException(status_code=401, detail="Token missing 'sub'")

    db = get_database()
    now = datetime.now(timezone.utc)
    update = {
        "$set": {
            "did": did,
            "display_name": payload.display_name or "Privy Player",
            "email": (payload.email or "").lower() or None,
            "linked_accounts": [
                {"type": a.type, "address": a.address, "verified_at": now}
                for a in payload.linked_accounts
            ],
            "auth_provider": "privy",
            "session_id": claims.get("sid"),
            "updated_at": now,
        },
        "$setOnInsert": {
            "created_at": now,
            "total_vibez_earned": 0.0,
        },
    }
    await db.user_identities.update_one({"did": did}, update, upsert=True)
    doc = await db.user_identities.find_one({"did": did}, {"_id": 0})
    if doc and isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    if doc and isinstance(doc.get("updated_at"), datetime):
        doc["updated_at"] = doc["updated_at"].isoformat()
    return {"status": "Synced", "did": did, "profile": doc}
