"""
Unified Earnings — single rollup across every role a user can wear.

2026-05-12 founder ask: "would you like a 'unified earnings widget' on
the main dashboard that rolls up income across every role you wear? E.g.
'This week: $124 driver · $89 host · $35 streamer · $248 total.' One
number to know how the platform's paying you across all your hats."

Aggregates 4 income streams the platform supports today:

  • Driver   — `vibe_drivers.total_earnings` (USD, post-platform-fee net)
  • Host     — sum of `vibe_venues_bookings.pricing.host_payout` for
               bookings in {completed, paid_out, in_progress} state.
               Filtered to venues this user owns.
  • Merchant — `hv_merchants.vibe_account_balance` (USD, net of 2% Vibe
               Tax). Lifetime balance held on the account.
  • Streamer — sum of `stream_gift_log.price_paid` * 0.70 (the 70% gift
               share that goes to the streamer per the StreamerDashboard
               commission line). In ₵ Vibez Coins, NOT USD — we surface
               both currencies separately so the founder can see real-money
               flows distinct from in-app credit flows.

The endpoint also returns a `by_week` rollup for the trailing 7 days so
the widget can show "This week" + "All time". 7-day windows derive from
collection-specific timestamps:
  - vibe_rides.completed_at       (driver)
  - vibe_venues_bookings.created_at (host)
  - hv_vibe_ledger.created_at     (merchant)
  - stream_gift_log.created_at    (streamer)

All ObjectIds are excluded from the response; we never spread Mongo docs
into the JSON payload — only the specific numbers + counts.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request, HTTPException

from utils.database import get_database, get_current_user
from models.user import User

router = APIRouter(prefix="/me", tags=["unified-earnings"])

# Streamer commission share — must match StreamerDashboard.tsx "70% of gifts received".
STREAMER_GIFT_SHARE = 0.70


def _iso_now_minus(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


async def _driver_totals(db, user_id: str) -> Dict[str, float]:
    """Lifetime + last-7d driver earnings in USD."""
    driver = await db.vibe_drivers.find_one(
        {"user_id": user_id},
        {"_id": 0, "total_earnings": 1},
    )
    lifetime = float((driver or {}).get("total_earnings", 0) or 0)

    # 7d: sum settled rides — completed_at within last 7 days, driver_payout field.
    cutoff = _iso_now_minus(7)
    pipeline = [
        {"$match": {"driver_id": user_id, "completed_at": {"$gte": cutoff}}},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$driver_payout", 0]}}}},
    ]
    rows = await db.vibe_rides.aggregate(pipeline).to_list(length=1)
    last_7d = round(float(rows[0]["total"] if rows else 0), 2)

    return {"lifetime_usd": round(lifetime, 2), "last_7d_usd": last_7d}


async def _host_totals(db, user_id: str) -> Dict[str, float]:
    """Lifetime + last-7d host earnings in USD (Vibe Venues host_payout)."""
    venue_ids = [
        v["venue_id"]
        for v in await db.vibe_venues_listings.find(
            {"host_user_id": user_id}, {"_id": 0, "venue_id": 1}
        ).to_list(length=200)
    ]
    if not venue_ids:
        return {"lifetime_usd": 0.0, "last_7d_usd": 0.0, "venue_count": 0}

    # Lifetime — sum host_payout across all credited-state bookings.
    pipeline_all = [
        {
            "$match": {
                "venue_id": {"$in": venue_ids},
                "lifecycle_state": {"$in": ["completed", "paid_out", "in_progress"]},
            }
        },
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$pricing.host_payout_usd", 0]}}}},
    ]
    all_rows = await db.vibe_venues_bookings.aggregate(pipeline_all).to_list(length=1)
    lifetime = round(float(all_rows[0]["total"] if all_rows else 0), 2)

    # Last 7d
    cutoff = _iso_now_minus(7)
    pipeline_7d = [
        {
            "$match": {
                "venue_id": {"$in": venue_ids},
                "lifecycle_state": {"$in": ["completed", "paid_out", "in_progress"]},
                "created_at": {"$gte": cutoff},
            }
        },
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$pricing.host_payout_usd", 0]}}}},
    ]
    week_rows = await db.vibe_venues_bookings.aggregate(pipeline_7d).to_list(length=1)
    last_7d = round(float(week_rows[0]["total"] if week_rows else 0), 2)

    return {"lifetime_usd": lifetime, "last_7d_usd": last_7d, "venue_count": len(venue_ids)}


async def _merchant_totals(db, user_id: str) -> Dict[str, float]:
    """Lifetime balance + last-7d ledger credits in USD."""
    merchant = await db.hv_merchants.find_one(
        {"owner_user_id": user_id},
        {"_id": 0, "merchant_id": 1, "vibe_account_balance": 1},
    )
    if not merchant:
        return {"lifetime_usd": 0.0, "last_7d_usd": 0.0}

    lifetime = round(float(merchant.get("vibe_account_balance", 0) or 0), 2)

    cutoff = _iso_now_minus(7)
    pipeline = [
        {
            "$match": {
                "merchant_id": merchant["merchant_id"],
                "created_at": {"$gte": cutoff},
            }
        },
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$net_credit", 0]}}}},
    ]
    rows = await db.hv_vibe_ledger.aggregate(pipeline).to_list(length=1)
    last_7d = round(float(rows[0]["total"] if rows else 0), 2)

    return {"lifetime_usd": lifetime, "last_7d_usd": last_7d}


async def _streamer_totals(db, user_id: str) -> Dict[str, Any]:
    """Lifetime + last-7d streamer earnings in ₵ coins (70% of gifts received).
    Returns ZERO if the user has never streamed."""
    # First resolve which stream_ids this user owns. The `streams` collection
    # is the authoritative streamer-side record. Some legacy code wrote to
    # `live_streams` instead — we check both to be future-proof.
    stream_ids_a = [
        s["stream_id"]
        for s in await db.streams.find(
            {"streamer_id": user_id}, {"_id": 0, "stream_id": 1}
        ).to_list(length=200)
        if s.get("stream_id")
    ]
    stream_ids_b = [
        s["stream_id"]
        for s in await db.live_streams.find(
            {"streamer_id": user_id}, {"_id": 0, "stream_id": 1}
        ).to_list(length=200)
        if s.get("stream_id")
    ]
    stream_ids = list(set(stream_ids_a + stream_ids_b))
    if not stream_ids:
        return {"lifetime_coins": 0, "last_7d_coins": 0, "stream_count": 0}

    pipeline_all = [
        {"$match": {"stream_id": {"$in": stream_ids}}},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$price_paid", 0]}}}},
    ]
    rows_all = await db.stream_gift_log.aggregate(pipeline_all).to_list(length=1)
    gross_coins = int(rows_all[0]["total"] if rows_all else 0)
    lifetime = int(round(gross_coins * STREAMER_GIFT_SHARE))

    cutoff = _iso_now_minus(7)
    pipeline_7d = [
        {"$match": {"stream_id": {"$in": stream_ids}, "created_at": {"$gte": cutoff}}},
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$price_paid", 0]}}}},
    ]
    rows_7d = await db.stream_gift_log.aggregate(pipeline_7d).to_list(length=1)
    week_gross_coins = int(rows_7d[0]["total"] if rows_7d else 0)
    last_7d = int(round(week_gross_coins * STREAMER_GIFT_SHARE))

    return {"lifetime_coins": lifetime, "last_7d_coins": last_7d, "stream_count": len(stream_ids)}


@router.get("/unified-earnings")
async def unified_earnings(request: Request) -> Dict[str, Any]:
    """One-shot rollup of every role's earnings. Powers the unified widget
    on the main dashboard. Anonymous callers get 401."""
    user: Optional[User] = await get_current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_database()
    driver = await _driver_totals(db, user.user_id)
    host = await _host_totals(db, user.user_id)
    merchant = await _merchant_totals(db, user.user_id)
    streamer = await _streamer_totals(db, user.user_id)

    total_usd_lifetime = round(
        driver["lifetime_usd"] + host["lifetime_usd"] + merchant["lifetime_usd"], 2
    )
    total_usd_7d = round(
        driver["last_7d_usd"] + host["last_7d_usd"] + merchant["last_7d_usd"], 2
    )

    return {
        "success": True,
        "user_id": user.user_id,
        "total_usd_lifetime": total_usd_lifetime,
        "total_usd_7d": total_usd_7d,
        "by_role": {
            "driver": driver,
            "host": host,
            "merchant": merchant,
            "streamer": streamer,
        },
    }
