"""
Power Hour + Sponsor Achievement Bonus
======================================

Implements two NEW v4 Master Plan features (uploaded
`Global_Vibez_DSG_Master_Plan_v4.pdf`, 2026-02-06):

  1) **Power Hour** — chair purchases get a 1.10× weight multiplier
     when bought between 5:00pm and 9:00pm America/New_York time.
     Time check is server-side ONLY (`is_power_hour_active()`). Exposed:
       GET /api/power-hour/status

  2) **Sponsor Achievement Bonus** — Vibe Vault ambassadors link
     verified businesses; once they reach 5 verified sponsors, they
     unlock 1 free chair (idempotent, lifetime cap of 3 free chairs
     per ambassador). Verified sponsors also pay a 0.5%-1.0%
     commission to the ambassador on every paid lead. Exposed:
       POST /api/sponsors/link
       POST /api/sponsors/{sponsor_id}/verify    (admin)
       GET  /api/sponsors/me
       GET  /api/sponsors/leaderboard

Both features stamp every payout into MongoDB with idempotency keys so
re-runs of the cron / webhook never double-credit.
"""
from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin_dashboard import verify_admin_cookie

logger = logging.getLogger(__name__)
router = APIRouter()

# ────────────────────────────────────────────── Power Hour
#
# 5:00pm ≤ now < 9:00pm America/New_York. Chairs purchased in this
# window get a +10% weight multiplier locked at purchase time.
#
# Why server-side only? Client clocks lie, and the v4 PDF spec
# explicitly required `isPowerHourActive()` to be authoritative on the
# server. The chair purchase grant pipeline reads
# `is_power_hour_active()` and stamps `power_hour_bonus=True` on the
# `chair_purchases` row + multiplies `weight` by `POWER_HOUR_MULT`.
POWER_HOUR_TZ = ZoneInfo("America/New_York")
POWER_HOUR_START_HOUR = 17  # 5:00pm
POWER_HOUR_END_HOUR = 21    # 9:00pm exclusive
POWER_HOUR_MULT = 1.10


def is_power_hour_active(now: Optional[datetime] = None) -> bool:
    """True iff right-now (or the supplied `now`) falls inside the
    Power Hour window (5pm-9pm America/New_York)."""
    if now is None:
        now = datetime.now(timezone.utc)
    local = now.astimezone(POWER_HOUR_TZ)
    return POWER_HOUR_START_HOUR <= local.hour < POWER_HOUR_END_HOUR


def _power_hour_window_today() -> Dict[str, str]:
    """Return today's window in ISO 8601 (start + end), in the
    America/New_York zone — handy for UI countdowns."""
    now_local = datetime.now(timezone.utc).astimezone(POWER_HOUR_TZ)
    start = now_local.replace(hour=POWER_HOUR_START_HOUR, minute=0, second=0, microsecond=0)
    end = now_local.replace(hour=POWER_HOUR_END_HOUR, minute=0, second=0, microsecond=0)
    return {
        "start_iso": start.isoformat(),
        "end_iso": end.isoformat(),
        "tz": "America/New_York",
    }


@router.get("/power-hour/status")
async def power_hour_status() -> Dict[str, Any]:
    """Public endpoint — frontend reads this to render the countdown +
    "x1.10 boost active" badge."""
    active = is_power_hour_active()
    window = _power_hour_window_today()
    now = datetime.now(timezone.utc).astimezone(POWER_HOUR_TZ)
    if active:
        # Seconds until the window closes today.
        end = now.replace(
            hour=POWER_HOUR_END_HOUR, minute=0, second=0, microsecond=0,
        )
        remaining = max(0, int((end - now).total_seconds()))
        next_label = "ends_in_seconds"
    else:
        # Seconds until the window opens (today if not yet 5pm, else
        # tomorrow).
        start_today = now.replace(
            hour=POWER_HOUR_START_HOUR, minute=0, second=0, microsecond=0,
        )
        if now.hour < POWER_HOUR_START_HOUR:
            target = start_today
        else:
            from datetime import timedelta
            target = start_today + timedelta(days=1)
        remaining = max(0, int((target - now).total_seconds()))
        next_label = "starts_in_seconds"

    return {
        "active": active,
        "multiplier": POWER_HOUR_MULT,
        "window": window,
        next_label: remaining,
    }


# ────────────────────────────────────────────── Sponsor Achievement
#
# Per the v4 PDF: Vibe Vault Ambassadors recruit local businesses to
# become "Vibe Sponsors". Once 5 sponsors are verified by a Vault Admin,
# the ambassador unlocks **1 free chair** (idempotent on the
# `sponsor_achievement_chair_grants` collection — re-running this is
# a no-op).
#
# Lifetime cap of 3 free chairs per ambassador → 15 verified sponsors.
# Past that, additional verified sponsors still pay commission, but no
# more free chairs.

SPONSORS_PER_FREE_CHAIR = 5
MAX_FREE_CHAIRS_PER_AMBASSADOR = 3


class LinkSponsorPayload(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=200)
    business_type: str = Field(..., min_length=2, max_length=80)
    contact_email: Optional[str] = Field(default=None, max_length=200)
    contact_phone: Optional[str] = Field(default=None, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=1000)


@router.post("/sponsors/link")
async def link_sponsor(payload: LinkSponsorPayload, http_request: Request) -> Dict[str, Any]:
    """Ambassador links a business as a candidate sponsor. Status starts
    as `pending` and must be moved to `verified` by an admin via
    `/api/sponsors/{sponsor_id}/verify` before it counts toward the free-
    chair achievement."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    sponsor_id = f"spon_{secrets.token_hex(5)}"
    doc = {
        "sponsor_id": sponsor_id,
        "ambassador_id": user.user_id,
        "business_name": payload.business_name.strip(),
        "business_type": payload.business_type.strip(),
        "contact_email": (payload.contact_email or "").strip() or None,
        "contact_phone": (payload.contact_phone or "").strip() or None,
        "notes": (payload.notes or "").strip() or None,
        "status": "pending",
        "commission_bps": 50,  # default 0.5%; admin can bump on verify
        "linked_at": datetime.now(timezone.utc).isoformat(),
        "verified_at": None,
    }
    await db.vibe_sponsors.insert_one(doc)
    return {
        "success": True,
        "sponsor_id": sponsor_id,
        "status": "pending",
    }


class VerifyPayload(BaseModel):
    commission_bps: int = Field(default=50, ge=10, le=200)


@router.post("/sponsors/{sponsor_id}/verify", dependencies=[Depends(verify_admin_cookie)])
async def verify_sponsor(sponsor_id: str, payload: VerifyPayload) -> Dict[str, Any]:
    """Admin-only — promote a pending sponsor to verified. Triggers
    the free-chair grant if the ambassador has now hit 5 / 10 / 15
    verified sponsors (idempotent grants tracked in
    `sponsor_achievement_chair_grants`)."""
    db = get_database()
    sponsor = await db.vibe_sponsors.find_one({"sponsor_id": sponsor_id}, {"_id": 0})
    if not sponsor:
        raise HTTPException(404, "Sponsor not found")
    if sponsor.get("status") == "verified":
        return {"success": True, "already_verified": True}
    await db.vibe_sponsors.update_one(
        {"sponsor_id": sponsor_id},
        {"$set": {
            "status": "verified",
            "commission_bps": int(payload.commission_bps),
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    grant = await _maybe_grant_free_chair(db, sponsor["ambassador_id"])
    return {"success": True, "free_chair_granted": grant is not None, "grant": grant}


async def _maybe_grant_free_chair(db, ambassador_id: str) -> Optional[Dict[str, Any]]:
    """Grant a free chair to the ambassador if they've hit a new
    `SPONSORS_PER_FREE_CHAIR` boundary AND haven't already received
    `MAX_FREE_CHAIRS_PER_AMBASSADOR` chairs from this program. Idempotent
    via a unique key on `sponsor_achievement_chair_grants.idem_key`.
    """
    verified = await db.vibe_sponsors.count_documents(
        {"ambassador_id": ambassador_id, "status": "verified"}
    )
    earned_chairs = verified // SPONSORS_PER_FREE_CHAIR
    earned_chairs = min(earned_chairs, MAX_FREE_CHAIRS_PER_AMBASSADOR)
    if earned_chairs == 0:
        return None
    # How many have we already granted to this user from this program?
    granted_count = await db.sponsor_achievement_chair_grants.count_documents(
        {"ambassador_id": ambassador_id}
    )
    if granted_count >= earned_chairs:
        return None  # already up-to-date
    new_grants_to_make = earned_chairs - granted_count
    last_grant_doc: Optional[Dict[str, Any]] = None
    for n in range(granted_count + 1, granted_count + 1 + new_grants_to_make):
        idem_key = f"sponsor_ach::{ambassador_id}::{n}"
        grant = {
            "grant_id": f"grant_{uuid.uuid4().hex[:10]}",
            "ambassador_id": ambassador_id,
            "ordinal": n,  # 1st, 2nd, or 3rd free chair
            "idem_key": idem_key,
            "phase_at_grant": "Sponsor Achievement",
            "weight": 1.0,
            "granted_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            await db.sponsor_achievement_chair_grants.insert_one(grant)
        except Exception as exc:  # noqa: BLE001 — duplicate idem_key
            logger.info("sponsor grant skipped (idempotent): %s", exc)
            continue
        # Mirror onto chair_purchases so the regular distribution job
        # picks it up (weight 1.0, no $ paid).
        await db.chair_purchases.insert_one({
            "purchase_id": grant["grant_id"],
            "user_id": ambassador_id,
            "user_id_lookup": (ambassador_id or "")[:8],
            "quantity": 1,
            "weight": 1.0,
            "phase_at_purchase": "Sponsor Achievement",
            "amount_usd": 0.0,
            "purchased_at": grant["granted_at"],
            "source": "sponsor_achievement",
            "source_ordinal": n,
        })
        await db.profit_share_counters.update_one(
            {"_id": "global_chairs"},
            {"$inc": {"count": 1}},
            upsert=True,
        )
        last_grant_doc = grant
    return last_grant_doc


@router.get("/sponsors/me")
async def my_sponsors(http_request: Request) -> Dict[str, Any]:
    """Ambassador's own sponsor roster + achievement progress."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    rows: List[Dict[str, Any]] = await db.vibe_sponsors.find(
        {"ambassador_id": user.user_id}, {"_id": 0}
    ).to_list(length=200)
    verified = sum(1 for r in rows if r.get("status") == "verified")
    pending = sum(1 for r in rows if r.get("status") == "pending")
    earned_chairs = min(verified // SPONSORS_PER_FREE_CHAIR, MAX_FREE_CHAIRS_PER_AMBASSADOR)
    granted = await db.sponsor_achievement_chair_grants.count_documents(
        {"ambassador_id": user.user_id}
    )
    return {
        "ambassador_id": user.user_id,
        "verified_count": verified,
        "pending_count": pending,
        "earned_chairs": earned_chairs,
        "granted_chairs": granted,
        "next_chair_at": (
            (verified // SPONSORS_PER_FREE_CHAIR + 1) * SPONSORS_PER_FREE_CHAIR
            if earned_chairs < MAX_FREE_CHAIRS_PER_AMBASSADOR
            else None
        ),
        "max_chairs": MAX_FREE_CHAIRS_PER_AMBASSADOR,
        "sponsors": rows,
    }


@router.get("/sponsors/leaderboard")
async def sponsors_leaderboard(limit: int = 25) -> Dict[str, Any]:
    """Public top-N ambassadors by verified sponsor count. Used on the
    Vibe Vault landing page to gamify recruitment."""
    db = get_database()
    pipeline = [
        {"$match": {"status": "verified"}},
        {"$group": {"_id": "$ambassador_id", "verified": {"$sum": 1}}},
        {"$sort": {"verified": -1}},
        {"$limit": max(1, min(limit, 100))},
    ]
    cursor = db.vibe_sponsors.aggregate(pipeline)
    rows: List[Dict[str, Any]] = []
    async for r in cursor:
        rows.append({
            "ambassador_id": r["_id"],
            "verified": r["verified"],
            "earned_chairs": min(
                r["verified"] // SPONSORS_PER_FREE_CHAIR,
                MAX_FREE_CHAIRS_PER_AMBASSADOR,
            ),
        })
    return {"leaderboard": rows, "count": len(rows)}


# ────────────────────────────── Admin (Sponsor Admin UI consumption)

@router.get("/admin/sponsors", dependencies=[Depends(verify_admin_cookie)])
async def admin_list_sponsors(
    status: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """Admin-only: list every linked sponsor (`pending` + `verified`).
    Powers the Sponsor Admin UI tab inside God Mode dashboard so the
    Founder can flip pending → verified without curl."""
    db = get_database()
    q: Dict[str, Any] = {}
    if status in {"pending", "verified", "rejected"}:
        q["status"] = status
    cursor = db.vibe_sponsors.find(q, {"_id": 0}).sort("linked_at", -1).limit(max(1, min(limit, 500)))
    rows: List[Dict[str, Any]] = await cursor.to_list(length=limit)
    counts = {
        "pending": await db.vibe_sponsors.count_documents({"status": "pending"}),
        "verified": await db.vibe_sponsors.count_documents({"status": "verified"}),
        "total": await db.vibe_sponsors.count_documents({}),
    }
    return {"rows": rows, "counts": counts}


class AdminRejectPayload(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


@router.post("/admin/sponsors/{sponsor_id}/reject", dependencies=[Depends(verify_admin_cookie)])
async def admin_reject_sponsor(
    sponsor_id: str, payload: AdminRejectPayload
) -> Dict[str, Any]:
    """Admin-only: mark a pending sponsor as rejected."""
    db = get_database()
    sponsor = await db.vibe_sponsors.find_one({"sponsor_id": sponsor_id}, {"_id": 0})
    if not sponsor:
        raise HTTPException(404, "Sponsor not found")
    await db.vibe_sponsors.update_one(
        {"sponsor_id": sponsor_id},
        {"$set": {
            "status": "rejected",
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "reject_reason": (payload.reason or "").strip() or None,
        }},
    )
    return {"success": True, "sponsor_id": sponsor_id, "status": "rejected"}
