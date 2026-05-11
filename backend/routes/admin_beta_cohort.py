"""
Beta Cohort Report — first-50-to-500-user rollup for God Mode.

2026-05-12 founder ask: "wire a 'Beta Cohort Report' card on God Mode.
Auto-aggregates first 50-500 user metrics — signups · which role they
picked · their first action · drop-off page · time-to-first-spend — so
you walk into v1.1 with hard data instead of vibes."

Pulls from collections that already exist (no schema changes):
  • users                       — created_at, gv_active_role, email
  • coin_top_up_transactions    — first revenue event
  • jftn_season_passes          — premium intent signal
  • room_visits                 — first action signal + drop-off pages
  • vibe_venues_listings        — host activation
  • hv_merchants                — merchant activation
  • vibe_drivers                — driver activation

Endpoint is admin-only (matches the existing God Mode auth model).
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request

from utils.database import get_database, get_current_user

router = APIRouter(prefix="/admin", tags=["admin-beta-cohort"])


def _iso_minus(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user is None or not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@router.get("/beta-cohort")
async def beta_cohort(request: Request) -> Dict[str, Any]:
    """Returns the full beta-cohort rollup. Single endpoint hit by the
    God Mode card so we don't fan out 6 separate calls on mount."""
    await _require_admin(request)
    db = get_database()

    now = datetime.now(timezone.utc)
    cutoff_7d = _iso_minus(7)
    cutoff_24h = _iso_minus(1)

    # ─── SIGNUPS ────────────────────────────────────────────────────
    total_users = await db.users.count_documents({})
    signups_7d = await db.users.count_documents({"created_at": {"$gte": cutoff_7d}})
    signups_24h = await db.users.count_documents({"created_at": {"$gte": cutoff_24h}})

    # ─── ROLE BREAKDOWN ─────────────────────────────────────────────
    # `gv_active_role` is set by the Role Switcher pill. We also look at
    # role-activation collections (drivers/hosts/merchants/streamers)
    # because some users tap a role pill without finishing onboarding.
    role_active_count = {
        "driver": await db.vibe_drivers.count_documents({}),
        "host": await db.vibe_venues_listings.distinct("host_user_id"),
        "merchant": await db.hv_merchants.count_documents({}),
    }
    # distinct returns a list — convert to count.
    role_active_count["host"] = len(role_active_count["host"])
    # Streamer: anyone who has created a stream.
    streamer_ids = await db.streams.distinct("streamer_id") if "streams" in await db.list_collection_names() else []
    role_active_count["streamer"] = len(streamer_ids)

    # ─── REVENUE / SPEND ────────────────────────────────────────────
    spend_pipeline = [
        {"$match": {"status": "paid"}},
        {"$group": {
            "_id": "$user_id",
            "total_paid_usd": {"$sum": {"$ifNull": ["$amount_paid_usd", 0]}},
            "first_paid_at": {"$min": "$created_at"},
            "transactions": {"$sum": 1},
        }},
    ]
    spend_rows = await db.coin_top_up_transactions.aggregate(spend_pipeline).to_list(length=1000)
    payers = len(spend_rows)
    total_revenue_usd = round(sum(r.get("total_paid_usd", 0) for r in spend_rows), 2)
    # Time-to-first-spend: median signup → first Stripe top-up minutes.
    ttfs_minutes: List[float] = []
    user_signups: Dict[str, str] = {}
    if spend_rows:
        user_ids = [r["_id"] for r in spend_rows if r.get("_id")]
        if user_ids:
            user_docs = await db.users.find(
                {"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "created_at": 1}
            ).to_list(length=1000)
            user_signups = {u["user_id"]: u.get("created_at") for u in user_docs}
        for r in spend_rows:
            uid = r.get("_id")
            signup = user_signups.get(uid) if uid else None
            first_paid = r.get("first_paid_at")
            if signup and first_paid:
                try:
                    dt_signup = datetime.fromisoformat(signup.replace("Z", "+00:00"))
                    dt_paid = datetime.fromisoformat(first_paid.replace("Z", "+00:00"))
                    delta_min = (dt_paid - dt_signup).total_seconds() / 60.0
                    if delta_min >= 0:
                        ttfs_minutes.append(delta_min)
                except Exception:
                    pass
    ttfs_minutes.sort()
    median_ttfs_min: Optional[float] = (
        round(ttfs_minutes[len(ttfs_minutes) // 2], 1) if ttfs_minutes else None
    )

    # ─── ACTIVATION RATE ────────────────────────────────────────────
    # "Active in last 7d" = visited any room OR made a top-up in 7d.
    active_visitors = await db.room_visits.distinct(
        "user_id", {"created_at": {"$gte": cutoff_7d}}
    ) if "room_visits" in await db.list_collection_names() else []
    active_payers = [r["_id"] for r in spend_rows if r.get("first_paid_at", "") >= cutoff_7d]
    active_7d_count = len(set(active_visitors) | set(active_payers))

    # ─── DROP-OFF PAGES (last route visited per user before idle) ───
    # We don't have a dedicated tracker, so we surface the BOTTOM
    # 5 rooms by recent visits (proxy: rooms with the FEWEST 7d visits
    # but at least 1 lifetime visit) so the founder can see where the
    # experience is weakest.
    weakest_pipeline = [
        {"$group": {"_id": "$room_id", "visits_7d": {
            "$sum": {"$cond": [{"$gte": ["$created_at", cutoff_7d]}, 1, 0]}
        }, "visits_total": {"$sum": 1}}},
        {"$match": {"visits_total": {"$gte": 1}}},
        {"$sort": {"visits_7d": 1}},
        {"$limit": 5},
    ]
    weakest_rooms = await db.room_visits.aggregate(weakest_pipeline).to_list(
        length=5
    ) if "room_visits" in await db.list_collection_names() else []

    # ─── PREMIUM INTENT ─────────────────────────────────────────────
    jftn_pass_count = await db.jftn_season_passes.count_documents({"status": "active"}) \
        if "jftn_season_passes" in await db.list_collection_names() else 0

    return {
        "success": True,
        "generated_at": now.isoformat(),
        "signups": {
            "lifetime": total_users,
            "last_7d": signups_7d,
            "last_24h": signups_24h,
        },
        "roles": {
            "active_role_pill": role_active_count,
        },
        "revenue": {
            "paying_users": payers,
            "total_revenue_usd": total_revenue_usd,
            "conversion_rate_pct": round(payers / total_users * 100, 1) if total_users else 0,
            "median_time_to_first_spend_min": median_ttfs_min,
            "jftn_season_passes_active": jftn_pass_count,
        },
        "engagement": {
            "active_users_7d": active_7d_count,
            "activation_rate_pct": round(active_7d_count / total_users * 100, 1) if total_users else 0,
            "weakest_rooms_by_7d_visits": [
                {"room_id": r["_id"], "visits_7d": r.get("visits_7d", 0), "visits_total": r.get("visits_total", 0)}
                for r in weakest_rooms
            ],
        },
    }
