"""
Streamer Referral Program (P3) — viral acquisition loop for the Live
Now Wall.

The deal: every existing streamer gets a unique referral code/link they
can share. When a new user signs up using that code AND goes live for
the first time, the original streamer earns:

  • 1,000 ₵ (credit_balance via $inc)
  • 5 days of Featured status (extends `featured_streamers.featured_until`)

The reward only fires once the referred streamer actually goes live —
this filters out drive-by signups and rewards real audience growth.

Lifecycle of a referral row:

  PENDING       (code created but not redeemed yet)
    ↓ POST /redeem (called by signup flow with `?ref=CODE`)
  SIGNED_UP     (referred_id set, referrer + referred recorded)
    ↓ Cloudflare webhook flips referred user's stream to is_live=True
    ↓ qualify_on_live() (called internally from cloudflare_stream.webhook)
  PAID          (immutable, idempotent: $inc + featured_until extend)

Idempotency:
  • A user can only redeem ONE code (server enforces).
  • A code can be redeemed by N different referred users (unlimited fanout).
  • `qualify_on_live` is a no-op for already-PAID rows.

Mounts at /api/streamer-referral.
"""
from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/streamer-referral", tags=["streamer-referral"])

_client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
_db = _client[os.environ.get("DB_NAME", "global_vibez_dsg")]

# ─────────────────────────────── Reward constants ──
REWARD_COINS = 1000
REWARD_FEATURED_DAYS = 5
CODE_LEN = 8


def _new_code() -> str:
    """Short, URL-safe, ambiguity-free referral code (verbal-friendly)."""
    raw = secrets.token_urlsafe(6)
    cleaned = (
        raw.replace("0", "X").replace("O", "Y")
        .replace("1", "Z").replace("l", "w").replace("I", "M")
    )
    return f"VIBE-{cleaned[:CODE_LEN].upper()}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _extend_feature_window(
    streamer_id: str, days: int, source: str,
) -> Dict[str, Any]:
    """Extend `featured_streamers.featured_until` by N days. Reuses the
    same collection the paid Stripe tier writes to so the Live Now Wall
    renders both grant kinds identically."""
    existing = await _db.featured_streamers.find_one(
        {"streamer_id": streamer_id}, {"_id": 0},
    )
    now = datetime.now(timezone.utc)
    base = now
    if existing and existing.get("featured_until"):
        try:
            current = datetime.fromisoformat(existing["featured_until"])
            if current > now:
                base = current
        except ValueError:
            base = now
    new_until = base + timedelta(days=days)

    doc = {
        "streamer_id": streamer_id,
        "featured_until": new_until.isoformat(),
        "last_grant_session_id": f"{source}:{now.timestamp():.0f}",
        "last_granted_at": now.isoformat(),
        "grant_count": (existing.get("grant_count", 0) if existing else 0) + 1,
        "last_grant_source": source,
    }
    await _db.featured_streamers.update_one(
        {"streamer_id": streamer_id}, {"$set": doc}, upsert=True,
    )
    return doc


class RedeemRequest(BaseModel):
    code: str
    new_user_id: str


# ─────────────────────────────── Endpoints ──
@router.get("/my-code/{user_id}")
async def get_or_create_code(user_id: str) -> Dict[str, Any]:
    """Idempotently return the referral code for a streamer."""
    existing = await _db.streamer_referral_codes.find_one(
        {"referrer_id": user_id}, {"_id": 0},
    )
    if existing:
        return {
            "code": existing["code"],
            "referrer_id": user_id,
            "share_url": f"https://globalvibezdsg.com/signup?ref={existing['code']}",
            "reward_coins": REWARD_COINS,
            "reward_featured_days": REWARD_FEATURED_DAYS,
        }

    for _ in range(8):
        code = _new_code()
        clash = await _db.streamer_referral_codes.find_one({"code": code})
        if not clash:
            break
    else:
        raise HTTPException(500, detail="Could not allocate a unique referral code")

    await _db.streamer_referral_codes.insert_one({
        "code": code,
        "referrer_id": user_id,
        "created_at": _now_iso(),
    })
    return {
        "code": code,
        "referrer_id": user_id,
        "share_url": f"https://globalvibezdsg.com/signup?ref={code}",
        "reward_coins": REWARD_COINS,
        "reward_featured_days": REWARD_FEATURED_DAYS,
    }


@router.post("/redeem")
async def redeem_code(req: RedeemRequest) -> Dict[str, Any]:
    """Called by the signup flow when `?ref=CODE` is present."""
    code_doc = await _db.streamer_referral_codes.find_one(
        {"code": req.code.upper().strip()}, {"_id": 0},
    )
    if not code_doc:
        raise HTTPException(404, detail="Unknown referral code")
    if code_doc["referrer_id"] == req.new_user_id:
        raise HTTPException(400, detail="Cannot redeem your own referral code")

    # Idempotency on (code, referred_id)
    existing = await _db.streamer_referrals.find_one(
        {"code": code_doc["code"], "referred_id": req.new_user_id}, {"_id": 0},
    )
    if existing:
        return {"status": existing["status"], "already_redeemed": True}

    # One redemption per user.
    already_redeemed_anything = await _db.streamer_referrals.find_one(
        {"referred_id": req.new_user_id}, {"_id": 0},
    )
    if already_redeemed_anything:
        raise HTTPException(409, detail="This account has already redeemed a referral code")

    await _db.streamer_referrals.insert_one({
        "code": code_doc["code"],
        "referrer_id": code_doc["referrer_id"],
        "referred_id": req.new_user_id,
        "status": "SIGNED_UP",
        "created_at": _now_iso(),
        "signed_up_at": _now_iso(),
        "qualified_at": None,
        "paid_at": None,
    })
    return {
        "status": "SIGNED_UP",
        "referrer_id": code_doc["referrer_id"],
        "code": code_doc["code"],
    }


async def qualify_on_live(user_id: str) -> Dict[str, Any]:
    """Pay out the referrer the FIRST time `user_id` goes live. Called
    from `routes/cloudflare_stream.cloudflare_webhook` when a stream
    transitions to `is_live=True`. Idempotent — re-calling for an
    already-PAID referral row is a no-op."""
    row = await _db.streamer_referrals.find_one(
        {"referred_id": user_id, "status": "SIGNED_UP"}, {"_id": 0},
    )
    if not row:
        return {"paid": False, "reason": "no_pending_referral"}

    referrer_id = row["referrer_id"]

    # Atomic state transition: only flip SIGNED_UP → PAID. If a parallel
    # webhook tries to double-fire, the second matched_count will be 0.
    update = await _db.streamer_referrals.update_one(
        {
            "code": row["code"],
            "referred_id": row["referred_id"],
            "status": "SIGNED_UP",
        },
        {"$set": {
            "status": "PAID",
            "qualified_at": _now_iso(),
            "paid_at": _now_iso(),
            "paid_coins": REWARD_COINS,
            "paid_featured_days": REWARD_FEATURED_DAYS,
        }},
    )
    if update.modified_count == 0:
        return {"paid": False, "reason": "already_paid_by_concurrent_call"}

    # 1k ₵ to referrer wallet
    await _db.users.update_one(
        {"user_id": referrer_id},
        {"$inc": {"credit_balance": REWARD_COINS}},
    )
    # 5 days Featured
    feature_grant = await _extend_feature_window(
        streamer_id=referrer_id,
        days=REWARD_FEATURED_DAYS,
        source="referral_payout",
    )

    logger.info(
        "Streamer referral PAID — referrer=%s referred=%s code=%s coins=%d featured_days=%d",
        referrer_id, user_id, row["code"], REWARD_COINS, REWARD_FEATURED_DAYS,
    )
    return {
        "paid": True,
        "referrer_id": referrer_id,
        "code": row["code"],
        "reward_coins": REWARD_COINS,
        "reward_featured_days": REWARD_FEATURED_DAYS,
        "featured_until": feature_grant.get("featured_until"),
    }


@router.post("/qualify-on-live/{user_id}")
async def qualify_on_live_endpoint(user_id: str) -> Dict[str, Any]:
    """HTTP-callable wrapper for `qualify_on_live`. Mostly for ops /
    admin one-shot payouts; the real trigger is the CF webhook hook."""
    return await qualify_on_live(user_id)


@router.get("/stats/{user_id}")
async def get_stats(user_id: str) -> Dict[str, Any]:
    """Power the Streamer Studio "Your Viral Loop" card."""
    code_doc = await _db.streamer_referral_codes.find_one(
        {"referrer_id": user_id}, {"_id": 0},
    )
    code = code_doc["code"] if code_doc else None

    cursor = _db.streamer_referrals.find({"referrer_id": user_id}, {"_id": 0})
    rows = await cursor.to_list(500)

    signed_up = sum(1 for r in rows if r.get("status") in {"SIGNED_UP", "PAID"})
    paid = sum(1 for r in rows if r.get("status") == "PAID")
    coins_earned = sum(int(r.get("paid_coins") or 0) for r in rows)
    featured_days_earned = sum(int(r.get("paid_featured_days") or 0) for r in rows)

    return {
        "user_id": user_id,
        "code": code,
        "share_url": f"https://globalvibezdsg.com/signup?ref={code}" if code else None,
        "invites_signed_up": signed_up,
        "invites_paid": paid,
        "coins_earned_lifetime": coins_earned,
        "featured_days_earned_lifetime": featured_days_earned,
        "reward_per_qualified": {
            "coins": REWARD_COINS,
            "featured_days": REWARD_FEATURED_DAYS,
        },
    }


@router.get("/lookup/{code}")
async def lookup_code(code: str) -> Dict[str, Any]:
    """Public — used by the signup page to confirm a referral code is
    valid + display the referrer's name on the banner."""
    doc = await _db.streamer_referral_codes.find_one(
        {"code": code.upper().strip()}, {"_id": 0},
    )
    if not doc:
        raise HTTPException(404, detail="Unknown referral code")
    referrer = await _db.users.find_one(
        {"user_id": doc["referrer_id"]},
        {"_id": 0, "name": 1, "display_name": 1, "username": 1},
    )
    name = (
        (referrer or {}).get("display_name")
        or (referrer or {}).get("name")
        or (referrer or {}).get("username")
        or "a Vibez streamer"
    )
    return {
        "code": doc["code"],
        "referrer_display_name": name,
        "reward_coins": REWARD_COINS,
        "reward_featured_days": REWARD_FEATURED_DAYS,
    }
