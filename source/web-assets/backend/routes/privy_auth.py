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
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

import jwt
from jwt import PyJWKClient, InvalidTokenError
from fastapi import APIRouter, HTTPException, Header, Response
from pydantic import BaseModel, Field

from utils.database import get_database

logger = logging.getLogger(__name__)
router = APIRouter()

PRIVY_APP_ID = os.environ.get("PRIVY_APP_ID", "").strip()
PRIVY_JWKS_URL = os.environ.get("PRIVY_JWKS_URL", "").strip()
PRIVY_ISSUER = "privy.io"

_JWKS_CLIENT: Optional[PyJWKClient] = None


def privy_configured() -> bool:
    """True when we can verify Privy JWTs (app id + JWKS URL)."""
    return bool(PRIVY_APP_ID and _resolved_jwks_url())


def _resolved_jwks_url() -> str:
    """Prefer PRIVY_JWKS_URL; otherwise derive the standard Privy JWKS path."""
    if PRIVY_JWKS_URL:
        return PRIVY_JWKS_URL
    if PRIVY_APP_ID:
        return f"https://auth.privy.io/api/v1/apps/{PRIVY_APP_ID}/jwks.json"
    return ""


def _require_privy_config() -> None:
    if not PRIVY_APP_ID:
        raise HTTPException(
            status_code=503,
            detail=(
                "Privy not configured. Set PRIVY_APP_ID (and optionally "
                "PRIVY_JWKS_URL) on the backend."
            ),
        )
    if not _resolved_jwks_url():
        raise HTTPException(status_code=503, detail="Privy JWKS URL not configured")


def _client() -> PyJWKClient:
    global _JWKS_CLIENT
    _require_privy_config()
    if _JWKS_CLIENT is None:
        _JWKS_CLIENT = PyJWKClient(
            _resolved_jwks_url(), cache_keys=True, lifespan=3600
        )
    return _JWKS_CLIENT


def verify_privy_token(token: str) -> Dict[str, Any]:
    """Verifies a Privy access token and returns its claims."""
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    _require_privy_config()
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
    except HTTPException:
        raise
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


@router.post("/auth/privy/session")
async def privy_session(
    payload: PrivySyncPayload,
    response: Response,
    authorization: Optional[str] = Header(default=None),
):
    """Exchange a verified Privy access token for a platform session.

    Upserts `user_identities` + a `users` row (keyed by Privy DID / email),
    then returns the same `{token, user_id, user}` shape as email/demo login
    so the SPA can call setBearerToken() and continue into the app shell.
    """
    token = _bearer(authorization)
    claims = verify_privy_token(token)
    did = claims.get("sub")
    if not did:
        raise HTTPException(status_code=401, detail="Token missing 'sub'")

    db = get_database()
    now = datetime.now(timezone.utc)
    email = (payload.email or "").strip().lower() or None
    display_name = (payload.display_name or "Social Player").strip() or "Social Player"

    # Hybrid identity ledger (web2 + web3).
    await db.user_identities.update_one(
        {"did": did},
        {
            "$set": {
                "did": did,
                "display_name": display_name,
                "email": email,
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
        },
        upsert=True,
    )

    # Resolve / create the canonical users row used by /api/auth/me.
    # DID-first (unique index on privy_did) prevents duplicate Privy accounts.
    # Email is only used to *merge* into an existing email user that has no DID.
    user = await db.users.find_one({"privy_did": did}, {"_id": 0})
    if not user and email:
        # Attach this DID to an existing email account only when that account
        # is not already bound to a different Privy DID.
        candidate = await db.users.find_one({"email": email}, {"_id": 0})
        if candidate and not candidate.get("privy_did"):
            try:
                await db.users.update_one(
                    {"user_id": candidate["user_id"], "privy_did": {"$exists": False}},
                    {
                        "$set": {
                            "privy_did": did,
                            "auth_provider": "privy",
                            "name": candidate.get("name") or display_name,
                            "updated_at": now.isoformat(),
                        }
                    },
                )
                user = await db.users.find_one({"privy_did": did}, {"_id": 0})
            except Exception as exc:
                # Unique index race — fall through to DID lookup
                logger.info("[privy] email merge race for %s: %s", email, type(exc).__name__)
                user = await db.users.find_one({"privy_did": did}, {"_id": 0})
        elif candidate and candidate.get("privy_did") == did:
            user = candidate

    if not user:
        user_id = f"privy_{uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email or f"{user_id}@privy.globalvibez.local",
            "name": display_name,
            "auth_provider": "privy",
            "privy_did": did,
            "profile_completed": bool(email),
            "membership_type": "free",
            "subscription_tier": "free",
            "credits_balance": 50,
            "age_verified": False,
            "verification_status": "pending",
            "swipes_today": 0,
            "swipes_limit": 20,
            "interests": [],
            "photos": [],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        try:
            await db.users.insert_one(user)
        except Exception as exc:
            # Concurrent first-login for same DID — reuse the winner.
            logger.info("[privy] insert race for did=%s: %s", did[:24], type(exc).__name__)
            user = await db.users.find_one({"privy_did": did}, {"_id": 0})
            if not user:
                raise HTTPException(500, "Could not create Privy user") from exc
            user_id = user["user_id"]
    else:
        user_id = user["user_id"]
        patch: Dict[str, Any] = {
            "auth_provider": "privy",
            "updated_at": now.isoformat(),
        }
        if display_name and not user.get("name"):
            patch["name"] = display_name
        # Never overwrite a real email with empty; only set when provided.
        if email and not user.get("email"):
            patch["email"] = email
        await db.users.update_one({"user_id": user_id}, {"$set": patch})
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0}) or user
        user_id = user["user_id"]

    session_token = str(uuid4())
    expires_at = now + timedelta(days=30)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": now,
        "auth_provider": "privy",
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        samesite="lax",
        max_age=30 * 24 * 3600,
    )

    safe_user = {k: v for k, v in (user or {}).items() if k != "password_hash"}
    return {
        "token": session_token,
        "user_id": user_id,
        "profile_completed": bool(safe_user.get("profile_completed")),
        "user": safe_user,
    }
