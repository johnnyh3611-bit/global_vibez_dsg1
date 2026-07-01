"""
Hybrid Identity (Web2 + Web3) — links social logins (Privy DIDs, Google,
Discord, Apple) to Solana wallets on a single user profile.

Endpoints (mounted under /api):
  POST /v1/users/sync         — upsert user identity + linked accounts
  GET  /v1/users/me/identity  — return the current user's hybrid profile

The Privy frontend calls /v1/users/sync after each login or wallet link;
backend stores the canonical record under `users` keyed by `did` (Privy
decentralized ID) — falling back to `user_id` for legacy non-Privy users.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_ACCOUNT_TYPES = {"google", "discord", "apple", "twitter", "wallet", "email"}


class LinkedAccount(BaseModel):
    type: str = Field(..., description="google | discord | apple | twitter | wallet | email")
    address: str = Field(..., min_length=1, max_length=128)
    verified_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserSyncPayload(BaseModel):
    did: str  # Privy DID (or any stable external id)
    display_name: Optional[str] = "New Player"
    email: Optional[EmailStr] = None
    linked_accounts: List[LinkedAccount] = Field(default_factory=list)


def _scrub(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = {k: v for k, v in (doc or {}).items() if k != "_id"}
    for k in ("created_at", "updated_at"):
        v = out.get(k)
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    if isinstance(out.get("linked_accounts"), list):
        for la in out["linked_accounts"]:
            if isinstance(la.get("verified_at"), datetime):
                la["verified_at"] = la["verified_at"].isoformat()
    return out


@router.post("/v1/users/sync")
async def sync_user_identity(payload: UserSyncPayload, request: Request):
    """Called after a user logs in or links a new wallet via Privy.

    Maps the social DID → Solana wallet on a single Mongo doc.
    """
    db = get_database()
    # Validate account types
    for acc in payload.linked_accounts:
        if acc.type not in ALLOWED_ACCOUNT_TYPES:
            raise HTTPException(status_code=400, detail=f"Unsupported account type: {acc.type}")

    now = datetime.now(timezone.utc)
    update = {
        "$set": {
            "did": payload.did,
            "display_name": payload.display_name or "New Player",
            "email": (payload.email or "").lower() or None,
            "linked_accounts": [a.dict() for a in payload.linked_accounts],
            "updated_at": now,
        },
        "$setOnInsert": {
            "created_at": now,
            "total_vibez_earned": 0.0,
        },
    }
    await db.user_identities.update_one({"did": payload.did}, update, upsert=True)
    doc = await db.user_identities.find_one({"did": payload.did}, {"_id": 0})
    return {"status": "Identity Synced", "profile": _scrub(doc)}


@router.get("/v1/users/me/identity")
async def get_my_identity(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_database()
    # Look up by user_id OR email, in case a legacy account hasn't been Privy-synced yet.
    doc = await db.user_identities.find_one(
        {"$or": [{"did": user.user_id}, {"email": (user.email or "").lower()}]},
        {"_id": 0},
    )
    if not doc:
        return {"status": "No hybrid identity yet", "profile": None}
    return {"status": "OK", "profile": _scrub(doc)}
