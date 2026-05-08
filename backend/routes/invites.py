"""
Invite-only Chair acquisition.

Existing chair holders (and Founders Pass owners as a legacy bridge) can
generate one-time codes that new members redeem to unlock the ability to
buy a Founder Chair. When the invite is consumed AND the new member buys
their first chair, the original inviter is rewarded with bonus loyalty
stakes (NOT cash, NOT chairs — purely a soft loyalty bonus).

Endpoints (all under /api):
  POST /api/invites/generate           (auth) — chair-holder issues a code
  GET  /api/invites/validate/{code}    (public) — landing-page check
  POST /api/invites/redeem             (auth) — caller marks a code as 'used'
                                                 (consumed atomically during
                                                 chair checkout)
  GET  /api/invites/mine               (auth) — list codes I've issued
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ────────────────────────────────────────────── Helpers


def _new_code() -> str:
    """8-char human-friendly invite code: 'VIBE-A2B3C4'-style."""
    return "VIBE-" + secrets.token_hex(3).upper()


async def _user_chair_count(db, user_id: str) -> int:
    rec = await db.profit_share_balances.find_one(
        {"user_id": user_id}, {"_id": 0, "locked_chairs": 1}
    ) or {}
    return int(rec.get("locked_chairs") or 0)


async def _user_has_founders_pass(db, user_id: str) -> bool:
    rec = await db.founders_passes.find_one(
        {"user_id": user_id, "status": "active"}, {"_id": 0, "tier_id": 1}
    )
    return rec is not None


# ────────────────────────────────────────────── Endpoints


@router.post("/invites/generate")
async def generate_invite(http_request: Request) -> Dict[str, Any]:
    """
    Issues a one-time invite code. Caller must already hold ≥1 chair OR
    own a Founders Pass (legacy bridge so existing OG members can invite).
    Each call mints a NEW code; chair holders can issue many.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()

    chairs = await _user_chair_count(db, user.user_id)
    has_pass = await _user_has_founders_pass(db, user.user_id)
    if chairs < 1 and not has_pass:
        raise HTTPException(
            403,
            "You must own at least 1 Founder Chair (or a Founders Pass) to "
            "invite new members to the table."
        )

    code = _new_code()
    # Cheap retry loop to avoid the *vanishingly* unlikely collision.
    for _ in range(3):
        if not await db.invites.find_one({"code": code}):
            break
        code = _new_code()

    now = datetime.now(timezone.utc).isoformat()
    await db.invites.insert_one({
        "code": code,
        "owner_user_id": user.user_id,
        "owner_chairs_at_creation": chairs,
        "status": "pending",        # pending → used
        "used_by_user_id": None,
        "used_at": None,
        "created_at": now,
    })
    return {
        "code": code,
        "share_link": f"/join/{code}",
        "created_at": now,
    }


@router.get("/invites/validate/{code}")
async def validate_invite(code: str) -> Dict[str, Any]:
    """Public — landing page reads this before letting a visitor sign up."""
    db = get_database()
    rec = await db.invites.find_one({"code": code.upper()}, {"_id": 0})
    if not rec:
        return {"valid": False, "reason": "unknown_code"}
    if rec.get("status") == "used":
        return {"valid": False, "reason": "already_used"}
    return {
        "valid": True,
        "code": rec["code"],
        "issued_by_chair_count": rec.get("owner_chairs_at_creation", 0),
    }


class RedeemPayload(BaseModel):
    code: str = Field(..., min_length=4, max_length=40)


@router.post("/invites/redeem")
async def redeem_invite(payload: RedeemPayload, http_request: Request) -> Dict[str, Any]:
    """
    Atomically marks a code 'used' by the caller. Idempotent if the SAME
    user redeems the same code twice — but rejects different users hitting
    a code that's already locked to someone else.

    Loyalty reward to the inviter (+10 loyalty stakes) is granted via the
    chair purchase webhook ONLY, not on redemption — so we don't reward
    invites that never convert into a real purchase.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    code = payload.code.upper()
    db = get_database()

    rec = await db.invites.find_one({"code": code}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Invite code not found.")
    if rec.get("status") == "used" and rec.get("used_by_user_id") != user.user_id:
        raise HTTPException(409, "This invite has already been used.")
    if rec.get("owner_user_id") == user.user_id:
        raise HTTPException(400, "You can't redeem your own invite code.")

    now = datetime.now(timezone.utc).isoformat()
    await db.invites.update_one(
        {"code": code, "status": "pending"},
        {"$set": {"status": "used", "used_by_user_id": user.user_id, "used_at": now}},
    )
    # Mark the user's profile as 'invite_accepted' so chair checkout passes.
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"invite_accepted": True, "invite_code_used": code}},
        upsert=False,
    )
    return {"ok": True, "code": code, "owner_user_id": rec["owner_user_id"]}


@router.get("/invites/mine")
async def my_invites(http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    cursor = db.invites.find(
        {"owner_user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(100)
    rows = await cursor.to_list(length=100)
    used = sum(1 for r in rows if r.get("status") == "used")
    return {
        "count": len(rows),
        "successful_redemptions": used,
        "rows": rows,
    }
