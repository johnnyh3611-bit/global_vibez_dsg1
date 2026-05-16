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

2026-05-17 refactor: pulled each rollup section into its own helper so
the route handler stays a thin orchestrator. Same JSON shape, same
regression-pinned keys — just easier to test/extend section-by-section.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

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


# ─── Section helpers ────────────────────────────────────────────────


async def _section_signups(db, cutoff_7d: str, cutoff_24h: str) -> Tuple[Dict[str, int], int]:
    """Lifetime / 7d / 24h signups. Returns (section_dict, total_users)."""
    total_users = await db.users.count_documents({})
    signups_7d = await db.users.count_documents({"created_at": {"$gte": cutoff_7d}})
    signups_24h = await db.users.count_documents({"created_at": {"$gte": cutoff_24h}})
    return (
        {"lifetime": total_users, "last_7d": signups_7d, "last_24h": signups_24h},
        total_users,
    )


async def _section_roles(db) -> Dict[str, Any]:
    """Activation counts per role pill (driver / host / merchant / streamer).

    Some users tap a role pill without finishing onboarding, so we count
    against the role-activation collections instead of `gv_active_role`.
    """
    collections = await db.list_collection_names()
    host_ids = await db.vibe_venues_listings.distinct("host_user_id")
    streamer_ids = (
        await db.streams.distinct("streamer_id") if "streams" in collections else []
    )
    role_active_count = {
        "driver": await db.vibe_drivers.count_documents({}),
        "host": len(host_ids),
        "merchant": await db.hv_merchants.count_documents({}),
        "streamer": len(streamer_ids),
    }
    return {"active_role_pill": role_active_count}


async def _aggregate_spend(db) -> List[Dict[str, Any]]:
    """Aggregate paid coin-top-up transactions by user_id."""
    pipeline = [
        {"$match": {"status": "paid"}},
        {"$group": {
            "_id": "$user_id",
            "total_paid_usd": {"$sum": {"$ifNull": ["$amount_paid_usd", 0]}},
            "first_paid_at": {"$min": "$created_at"},
            "transactions": {"$sum": 1},
        }},
    ]
    return await db.coin_top_up_transactions.aggregate(pipeline).to_list(length=1000)


async def _median_time_to_first_spend(db, spend_rows: List[Dict[str, Any]]) -> Optional[float]:
    """Median minutes from signup → first Stripe top-up. None when no data."""
    if not spend_rows:
        return None
    user_ids = [r["_id"] for r in spend_rows if r.get("_id")]
    if not user_ids:
        return None
    user_docs = await db.users.find(
        {"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "created_at": 1}
    ).to_list(length=1000)
    signups_by_uid = {u["user_id"]: u.get("created_at") for u in user_docs}

    minutes: List[float] = []
    for r in spend_rows:
        signup = signups_by_uid.get(r.get("_id"))
        first_paid = r.get("first_paid_at")
        if not (signup and first_paid):
            continue
        try:
            dt_signup = datetime.fromisoformat(signup.replace("Z", "+00:00"))
            dt_paid = datetime.fromisoformat(first_paid.replace("Z", "+00:00"))
            delta_min = (dt_paid - dt_signup).total_seconds() / 60.0
            if delta_min >= 0:
                minutes.append(delta_min)
        except Exception:
            continue
    if not minutes:
        return None
    minutes.sort()
    return round(minutes[len(minutes) // 2], 1)


async def _section_revenue(
    db, total_users: int
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Paying users · total_paid_usd · conversion · median_time_to_first_spend_min ·
    jftn_season_passes_active. Returns (section, spend_rows) so engagement reuses spend_rows."""
    spend_rows = await _aggregate_spend(db)
    payers = len(spend_rows)
    total_revenue_usd = round(sum(r.get("total_paid_usd", 0) for r in spend_rows), 2)
    median_ttfs_min = await _median_time_to_first_spend(db, spend_rows)

    jftn_pass_count = 0
    if "jftn_season_passes" in await db.list_collection_names():
        jftn_pass_count = await db.jftn_season_passes.count_documents({"status": "active"})

    return (
        {
            "paying_users": payers,
            "total_revenue_usd": total_revenue_usd,
            "conversion_rate_pct": round(payers / total_users * 100, 1) if total_users else 0,
            "median_time_to_first_spend_min": median_ttfs_min,
            "jftn_season_passes_active": jftn_pass_count,
        },
        spend_rows,
    )


async def _section_engagement(
    db,
    total_users: int,
    cutoff_7d: str,
    spend_rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """7d active users + weakest_rooms_by_7d_visits (proxy for drop-off pages)."""
    has_room_visits = "room_visits" in await db.list_collection_names()

    active_visitors: List[str] = []
    weakest_rooms: List[Dict[str, Any]] = []
    if has_room_visits:
        active_visitors = await db.room_visits.distinct(
            "user_id", {"created_at": {"$gte": cutoff_7d}}
        )
        weakest_pipeline = [
            {"$group": {
                "_id": "$room_id",
                "visits_7d": {"$sum": {"$cond": [{"$gte": ["$created_at", cutoff_7d]}, 1, 0]}},
                "visits_total": {"$sum": 1},
            }},
            {"$match": {"visits_total": {"$gte": 1}}},
            {"$sort": {"visits_7d": 1}},
            {"$limit": 5},
        ]
        weakest_rooms = await db.room_visits.aggregate(weakest_pipeline).to_list(length=5)

    active_payers = [r["_id"] for r in spend_rows if r.get("first_paid_at", "") >= cutoff_7d]
    active_7d_count = len(set(active_visitors) | set(active_payers))

    return {
        "active_users_7d": active_7d_count,
        "activation_rate_pct": round(active_7d_count / total_users * 100, 1) if total_users else 0,
        "weakest_rooms_by_7d_visits": [
            {
                "room_id": r["_id"],
                "visits_7d": r.get("visits_7d", 0),
                "visits_total": r.get("visits_total", 0),
            }
            for r in weakest_rooms
        ],
    }


# ─── Route handler ──────────────────────────────────────────────────


@router.get("/beta-cohort")
async def beta_cohort(request: Request) -> Dict[str, Any]:
    """Returns the full beta-cohort rollup. Single endpoint hit by the
    God Mode card so we don't fan out 6 separate calls on mount."""
    await _require_admin(request)
    db = get_database()

    now = datetime.now(timezone.utc)
    cutoff_7d = _iso_minus(7)
    cutoff_24h = _iso_minus(1)

    signups, total_users = await _section_signups(db, cutoff_7d, cutoff_24h)
    roles = await _section_roles(db)
    revenue, spend_rows = await _section_revenue(db, total_users)
    engagement = await _section_engagement(db, total_users, cutoff_7d, spend_rows)

    return {
        "success": True,
        "generated_at": now.isoformat(),
        "signups": signups,
        "roles": roles,
        "revenue": revenue,
        "engagement": engagement,
    }
