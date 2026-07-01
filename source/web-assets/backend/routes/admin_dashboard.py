"""
Admin Dashboard - God Mode
High-level oversight dashboard for platform monitoring and control
"""
from fastapi import APIRouter, HTTPException, Depends, Response, Cookie
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from utils.database import get_database
import os
import secrets
import hashlib
import asyncio

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])

# Admin credentials (in production, use environment variables)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")
FOUNDER_2FA_SECRET = os.getenv("FOUNDER_2FA_SECRET", "JBSWY3DPEHPK3PXP")

# Session management
ADMIN_SESSION_SECRET = os.getenv("ADMIN_SESSION_SECRET", secrets.token_hex(32))
ADMIN_SESSIONS = {}  # In production, use Redis or database

def create_admin_session() -> str:
    """Create a secure admin session token"""
    session_token = secrets.token_urlsafe(32)
    session_id = hashlib.sha256(session_token.encode()).hexdigest()
    
    ADMIN_SESSIONS[session_id] = {
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=4)
    }
    
    return session_token

def verify_admin_session(session_token: Optional[str]) -> bool:
    """Verify admin session is valid"""
    if not session_token:
        return False
    
    session_id = hashlib.sha256(session_token.encode()).hexdigest()
    session = ADMIN_SESSIONS.get(session_id)
    
    if not session:
        return False
    
    # Check expiration
    if datetime.now(timezone.utc) > session["expires_at"]:
        # Clean up expired session
        ADMIN_SESSIONS.pop(session_id, None)
        return False
    
    return True

def clear_admin_session(session_token: str) -> None:
    """Clear admin session on logout"""
    if session_token:
        session_id = hashlib.sha256(session_token.encode()).hexdigest()
        ADMIN_SESSIONS.pop(session_id, None)

# Models
class VaultAuthRequest(BaseModel):
    password: str
    code: str

class KickUserRequest(BaseModel):
    user_id: str
    reason: str

# ==================== AUTHENTICATION ====================

@router.post("/vault-auth")
async def vault_auth(request: VaultAuthRequest, response: Response) -> Dict[str, Any]:
    """
    God Mode authentication - Secure cookie-based session
    """
    # Verify Password
    if request.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Access Denied - Invalid Password")

    # Create secure session
    session_token = create_admin_session()
    
    # Set HttpOnly cookie — secure=True + SameSite=None lets the cookie
    # work on the production domain (globalvibezdsg.com) where the
    # frontend talks to the preview backend via cross-site POSTs.
    # HTTPS is required by the preview/prod edge (CloudFront + Cloudflare),
    # so Secure=True is the correct setting for all environments.
    response.set_cookie(
        key="admin_session",
        value=session_token,
        httponly=True,   # Prevents JavaScript access (XSS protection)
        secure=True,     # HTTPS-only (prod + preview both serve HTTPS)
        samesite="none", # Allow cross-site so the custom domain can auth
        max_age=14400,   # 4 hours
        path="/",
    )

    # Success - grant access
    return {
        "success": True,
        "message": "Welcome to the Vibe Vault, Founder",
        "expires_in": 14400  # 4 hours in seconds
    }


@router.post("/vault-logout")
async def vault_logout(response: Response, admin_session: Optional[str] = Cookie(None)):
    """
    Logout from God Mode - Clear session
    """
    # Clear server-side session
    if admin_session:
        clear_admin_session(admin_session)
    
    # Clear cookie
    response.delete_cookie(key="admin_session", path="/")
    
    return {
        "success": True,
        "message": "Logged out successfully"
    }

async def verify_admin_cookie(admin_session: Optional[str] = Cookie(None)):
    """
    Dependency to verify admin authentication via cookie
    """
    if not verify_admin_session(admin_session):
        raise HTTPException(
            status_code=401, 
            detail="Not authenticated or session expired"
        )
    return True

# ==================== MASTER STATS ====================

async def _sum_aggregate(coll, match: Dict[str, Any], field: str) -> float:
    """Sum a numeric field across matching docs. Returns 0 when empty."""
    rows = await coll.aggregate([
        {"$match": match},
        {"$group": {"_id": None, "total": {"$sum": f"${field}"}}},
    ]).to_list(1)
    return rows[0]["total"] if rows else 0


async def _count_active_users_24h(db) -> int:
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    return await db.users.count_documents({"last_active": {"$gte": yesterday.isoformat()}})


async def _count_jftn_transactions_7d(db) -> int:
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    return await db.jftn_transactions.count_documents({"timestamp": {"$gte": week_ago.isoformat()}})


async def _count_pending_cashouts(db) -> int:
    return await db.platform_treasury.count_documents({"status": "pending"})


async def _count_active_jftn_rooms(db) -> int:
    rooms = await db.jftn_rooms.find({"is_active": True}, {"_id": 0}).to_list(100)
    return len(rooms)


async def _count_pending_matches(db) -> int:
    return await db.match_requests.count_documents({"status": "pending"})


def _vr_dating_active_count() -> int:
    """Best-effort hook into the in-process VR dating room map."""
    try:
        from routes.vr_dating_websocket import room_users  # noqa: PLC0415
        return sum(len(users) for users in room_users.values())
    except Exception:
        return 0


@router.get("/master-stats")
async def get_god_mode_stats(_: bool = Depends(verify_admin_cookie)):
    """Master dashboard statistics — every metric in a single call.

    All independent queries fan out via :func:`asyncio.gather` so the
    response time is dominated by the slowest single query, not the sum.
    """
    db = get_database()
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    (
        active_users,
        token_purchases_7d,
        jftn_transactions_7d,
        pending_cashouts,
        active_rooms,
        pending_matches,
        platform_revenue,
    ) = await asyncio.gather(
        _count_active_users_24h(db),
        _sum_aggregate(
            db.coin_transactions,
            {"type": "purchase", "created_at": {"$gte": week_ago.isoformat()}},
            "amount",
        ),
        _count_jftn_transactions_7d(db),
        _count_pending_cashouts(db),
        _count_active_jftn_rooms(db),
        _count_pending_matches(db),
        _sum_aggregate(db.platform_treasury, {}, "amount"),
    )

    return {
        "success": True,
        "stats": {
            "active_players": active_users,
            "token_purchases_7d": token_purchases_7d,
            "jftn_transactions_7d": jftn_transactions_7d,
            "pending_cashouts": pending_cashouts,
            "active_premium_rooms": active_rooms,
            "vr_dating_active": _vr_dating_active_count(),
            "pending_matches": pending_matches,
            "platform_revenue": platform_revenue,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

# ==================== TOKEN VELOCITY (TIME-SERIES) ====================

async def _day_purchases(db, day_start: datetime, day_end: datetime) -> float:
    return await _sum_aggregate(
        db.coin_transactions,
        {
            "type": "purchase",
            "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()},
        },
        "amount",
    )


async def _day_cashouts(db, day_start: datetime, day_end: datetime) -> float:
    return await _sum_aggregate(
        db.jftn_transactions,
        {"timestamp": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}},
        "amount",
    )


@router.get("/token-velocity")
async def get_token_velocity(days: int = 7, _: bool = Depends(verify_admin_cookie)):
    """Daily token circulation graph: purchases vs. cash-outs over ``days``.

    Each day's two queries run concurrently, and all days run concurrently
    too — total round-trips drop from ``2*days`` sequential calls to one
    parallel batch.
    """
    db = get_database()

    # Build ``[(day_start, day_end), …]`` window list.
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    windows: list[tuple[datetime, datetime]] = []
    for i in range(days):
        day_start = today - timedelta(days=i)
        windows.append((day_start, day_start + timedelta(days=1)))

    # Fan out 2*days queries.
    purchase_tasks = [_day_purchases(db, s, e) for s, e in windows]
    cashout_tasks = [_day_cashouts(db, s, e) for s, e in windows]
    purchases, cashouts = await asyncio.gather(
        asyncio.gather(*purchase_tasks),
        asyncio.gather(*cashout_tasks),
    )

    data = [
        {
            "date": s.strftime("%Y-%m-%d"),
            "Purchases": p,
            "Payouts": c,
            "Active_Players": 0,  # reserved for future DAU integration
        }
        for (s, _e), p, c in zip(windows, purchases, cashouts)
    ]
    data.reverse()  # oldest → newest for chart axes
    return {"success": True, "data": data}

# ==================== LIVE ACTIVITY FEED ====================

@router.get("/live-activity")
async def get_live_activity(limit: int = 50, _: bool = Depends(verify_admin_cookie)):
    """
    Real-time activity feed.
    Shows recent user actions across the platform.
    """
    db = get_database()
    
    activities = []
    
    # Recent JFTN room joins
    jftn_txns = await db.jftn_transactions.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for txn in jftn_txns:
        activities.append({
            "type": "jftn_join",
            "user_id": txn["visitor_id"],
            "activity": "Joined 'Just For The Night' room",
            "value": txn["amount"],
            "status": "live",
            "timestamp": txn["timestamp"]
        })
    
    # Recent matches
    matches = await db.match_requests.find(
        {"status": "accepted"},
        {"_id": 0}
    ).sort("accepted_at", -1).limit(limit).to_list(limit)
    
    for match in matches:
        activities.append({
            "type": "match_accepted",
            "user_id": match["from_user_id"],
            "activity": f"Matched with {match['to_user_id'][:8]}...",
            "value": 0,
            "status": "success",
            "timestamp": match.get("accepted_at", match["created_at"])
        })
    
    # Sort by timestamp
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    return {
        "success": True,
        "activities": activities[:limit],
        "total": len(activities)
    }

# ==================== HIGH-VALUE ALERTS ====================

@router.get("/high-value-alerts")
async def get_high_value_alerts(threshold: int = 1000) -> Dict[str, Any]:
    """
    Get transactions above a certain threshold for review.
    Used for fraud detection and high-roller monitoring.
    """
    db = get_database()
    
    alerts = await db.jftn_transactions.find(
        {"amount": {"$gte": threshold}},
        {"_id": 0}
    ).sort("timestamp", -1).limit(20).to_list(20)
    
    return {
        "success": True,
        "alerts": [
            {
                "transaction_id": alert["transaction_id"],
                "user_id": alert["visitor_id"],
                "amount": alert["amount"],
                "room_id": alert["room_id"],
                "timestamp": alert["timestamp"],
                "flagged": alert.get("flagged", False)
            }
            for alert in alerts
        ],
        "total": len(alerts)
    }

# ==================== USER MANAGEMENT ====================

@router.post("/ban-user")
async def ban_user(user_id: str, reason: str, duration_hours: Optional[int] = None) -> Dict[str, Any]:
    """
    Ban a user from the platform.
    duration_hours: None = permanent, int = temporary
    """
    db = get_database()
    
    ban_data = {
        "banned": True,
        "ban_reason": reason,
        "banned_at": datetime.now(timezone.utc).isoformat()
    }
    
    if duration_hours:
        ban_data["ban_expires"] = (datetime.now(timezone.utc) + timedelta(hours=duration_hours)).isoformat()
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": ban_data}
    )
    
    return {
        "success": True,
        "message": f"User {user_id} banned",
        "permanent": duration_hours is None
    }

@router.post("/unban-user")
async def unban_user(user_id: str) -> Dict[str, Any]:
    """Remove ban from user"""
    db = get_database()
    
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {"banned": False},
            "$unset": {"ban_reason": "", "banned_at": "", "ban_expires": ""}
        }
    )
    
    return {
        "success": True,
        "message": f"User {user_id} unbanned"
    }

# ==================== PLATFORM CONTROLS ====================

@router.post("/maintenance-mode")
async def toggle_maintenance_mode(enabled: bool) -> Dict[str, Any]:
    """
    Enable/disable maintenance mode.
    When enabled, only admins can access the platform.
    """
    # Store in database or cache
    db = get_database()
    
    await db.platform_settings.update_one(
        {"key": "maintenance_mode"},
        {"$set": {"value": enabled, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {
        "success": True,
        "maintenance_mode": enabled,
        "message": "Maintenance mode " + ("enabled" if enabled else "disabled")
    }

@router.get("/system-health")
async def get_system_health() -> Dict[str, Any]:
    """
    System health check.
    Returns status of all critical services.
    """
    db = get_database()
    
    # Check database connection
    try:
        await db.users.count_documents({}, limit=1)
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
    
    # Check VR rooms
    from routes.vr_dating_websocket import vr_dating_rooms
    vr_rooms_active = len(vr_dating_rooms)
    
    return {
        "success": True,
        "health": {
            "database": db_status,
            "vr_dating_rooms": vr_rooms_active,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }


# ==================== COMPREHENSIVE USER DIRECTORY ====================

async def _enrich_user_financials(db, user: Dict[str, Any]) -> Dict[str, Any]:
    """Decorate a single user record with spend/earn/match counts.

    All three sub-queries run concurrently — saves ~2 round-trips/user.
    Mutates ``user`` in place AND returns it (fluent).
    """
    user_id = user.get("user_id", "")
    spent, earned, matches = await asyncio.gather(
        _sum_aggregate(
            db.coin_transactions,
            {"user_id": user_id, "type": {"$in": ["purchase", "game_bet", "gift_sent"]}},
            "amount",
        ),
        _sum_aggregate(
            db.jftn_transactions,
            {"streamer_id": user_id},
            "streamer_share",
        ),
        db.match_requests.count_documents(
            {
                "$or": [{"from_user_id": user_id}, {"to_user_id": user_id}],
                "status": "accepted",
            }
        ),
    )
    user["total_spent"] = spent
    user["total_earned"] = earned
    user["matches"] = matches
    user["balance"] = user.get("balance", 0)
    return user


def _build_user_search_query(search: Optional[str]) -> Dict[str, Any]:
    """Translate the search box into a Mongo filter (regex over email / username / id)."""
    if not search:
        return {}
    return {
        "$or": [
            {"email": {"$regex": search, "$options": "i"}},
            {"username": {"$regex": search, "$options": "i"}},
            {"user_id": {"$regex": search, "$options": "i"}},
        ]
    }


@router.get("/all-users")
async def get_all_users(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """User directory with activity + financial enrichment.

    Pagination + search + financial enrichment in a single API hit. Each
    page's per-user enrichment runs in parallel via :func:`asyncio.gather`,
    so a 50-user page does ~3 concurrent queries (not 150 sequential).
    """
    db = get_database()
    query = _build_user_search_query(search)

    total, raw_users = await asyncio.gather(
        db.users.count_documents(query),
        db.users.find(query, {"_id": 0, "password": 0})
        .sort(sort_by, -1)
        .skip((page - 1) * limit)
        .limit(limit)
        .to_list(limit),
    )

    users = await asyncio.gather(*(_enrich_user_financials(db, u) for u in raw_users))

    return {
        "success": True,
        "users": users,
        "total": total,
        "page": page,
        "pages": (total // limit) + (1 if total % limit > 0 else 0),
    }

@router.get("/user-detail/{user_id}")
async def get_user_detail(user_id: str, _: bool = Depends(verify_admin_cookie)):
    """Complete activity log + financial history for a single user.

    All five collection queries (transactions / streaming / matches / rooms /
    session count) run concurrently — the response time is now bounded by the
    slowest single query, not their sum.
    """
    db = get_database()

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    transactions, streaming_revenue, matches, active_rooms, total_streams = await asyncio.gather(
        db.coin_transactions.find({"user_id": user_id}, {"_id": 0})
            .sort("created_at", -1).limit(100).to_list(100),
        db.jftn_transactions.find({"streamer_id": user_id}, {"_id": 0})
            .sort("timestamp", -1).limit(50).to_list(50),
        db.match_requests.find(
            {"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]}, {"_id": 0}
        ).sort("created_at", -1).limit(50).to_list(50),
        db.jftn_rooms.find(
            {"streamer_id": user_id, "is_active": True}, {"_id": 0}
        ).to_list(10),
        db.jftn_rooms.count_documents({"streamer_id": user_id}),
    )

    return {
        "success": True,
        "user": user,
        "transactions": transactions,
        "streaming_revenue": streaming_revenue,
        "matches": matches,
        "active_rooms": active_rooms,
        "stats": {
            "total_transactions": len(transactions),
            "total_streaming_sessions": total_streams,
            "total_matches": len(matches),
            "lifetime_spent": sum(t.get("amount", 0) for t in transactions if t.get("type") in ["purchase", "game_bet"]),
            "lifetime_earned": sum(r.get("streamer_share", 0) for r in streaming_revenue),
        },
    }

# ==================== FINANCIAL ANALYTICS ====================


async def _top_n_aggregate(coll, match: Dict[str, Any], group_key: str,
                           sum_field: str, limit: int) -> list:
    """Top-N $sum aggregation: returns ``[{'_id': key, 'total': N}, …]``."""
    return await coll.aggregate([
        {"$match": match},
        {"$group": {"_id": f"${group_key}", "total": {"$sum": f"${sum_field}"}}},
        {"$sort": {"total": -1}},
        {"$limit": limit},
    ]).to_list(limit)


@router.get("/financial-overview")
async def get_financial_overview(days: int = 30) -> Dict[str, Any]:
    """Complete financial overview: revenue, payouts, transactions.

    Six independent queries run in parallel via :func:`asyncio.gather`.
    """
    db = get_database()
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    purchase_match = {"type": "purchase", "created_at": {"$gte": start_date.isoformat()}}
    jftn_match = {"timestamp": {"$gte": start_date.isoformat()}}

    (
        platform_revenue,
        total_purchases,
        total_payouts,
        pending,
        top_streamers,
        top_spenders,
    ) = await asyncio.gather(
        _sum_aggregate(db.platform_treasury,
                       {"created_at": {"$gte": start_date.isoformat()}}, "amount"),
        _sum_aggregate(db.coin_transactions, purchase_match, "amount"),
        _sum_aggregate(db.jftn_transactions, jftn_match, "streamer_share"),
        db.platform_treasury.find({"status": "pending"}, {"_id": 0}).to_list(100),
        _top_n_aggregate(db.jftn_transactions, jftn_match,
                         "streamer_id", "streamer_share", 10),
        _top_n_aggregate(db.coin_transactions, purchase_match,
                         "user_id", "amount", 10),
    )

    return {
        "success": True,
        "period_days": days,
        "revenue": {
            "platform_revenue": platform_revenue,
            "total_purchases": total_purchases,
            "total_payouts": total_payouts,
            "net_revenue": platform_revenue - total_payouts,
        },
        "pending_withdrawals": {
            "count": len(pending),
            "total_amount": sum(p.get("amount", 0) for p in pending),
            "items": pending,
        },
        "top_streamers": top_streamers,
        "top_spenders": top_spenders,
    }

# ==================== ACTIVITY LOGS ====================


async def _purchase_activities(db, limit: int) -> list:
    purchases = await db.coin_transactions.find(
        {"type": "purchase"}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return [
        {
            "type": "purchase",
            "user_id": p["user_id"],
            "amount": p["amount"],
            "timestamp": p["created_at"],
            "details": f"Purchased {p['amount']} tokens",
        }
        for p in purchases
    ]


async def _streaming_activities(db, limit: int) -> list:
    streams = await db.jftn_transactions.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return [
        {
            "type": "streaming_revenue",
            "user_id": s["streamer_id"],
            "amount": s["streamer_share"],
            "timestamp": s["timestamp"],
            "details": f"Earned ${s['streamer_share']} from stream",
        }
        for s in streams
    ]


async def _match_activities(db, limit: int) -> list:
    matches = await db.match_requests.find(
        {"status": "accepted"}, {"_id": 0}
    ).sort("accepted_at", -1).limit(limit).to_list(limit)
    return [
        {
            "type": "match",
            "user_id": m["from_user_id"],
            "partner_id": m["to_user_id"],
            "timestamp": m.get("accepted_at", m["created_at"]),
            "details": f"Matched with {m['to_user_id'][:8]}...",
        }
        for m in matches
    ]


_ACTIVITY_BUILDERS = {
    "purchase": _purchase_activities,
    "streaming": _streaming_activities,
    "match": _match_activities,
}


@router.get("/activity-feed")
async def get_activity_feed(limit: int = 100, activity_type: Optional[str] = None) -> Dict[str, Any]:
    """Real-time activity feed showing EVERYTHING happening on the platform.

    Types: ``purchase``, ``streaming``, ``match``. When ``activity_type`` is
    omitted, all categories are fetched in parallel and merged.
    """
    db = get_database()

    if activity_type and activity_type in _ACTIVITY_BUILDERS:
        builders = [_ACTIVITY_BUILDERS[activity_type]]
    else:
        builders = list(_ACTIVITY_BUILDERS.values())

    bucketed = await asyncio.gather(*(builder(db, limit) for builder in builders))
    activities: list = [item for bucket in bucketed for item in bucket]
    activities.sort(key=lambda x: x["timestamp"], reverse=True)

    return {
        "success": True,
        "activities": activities[:limit],
        "total": len(activities),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

# ==================== STREAMER ANALYTICS ====================

@router.get("/streamer-leaderboard")
async def get_streamer_leaderboard(period: str = "week", limit: int = 20) -> Dict[str, Any]:
    """
    Streamer revenue leaderboard.
    period: 'day', 'week', 'month', 'all'
    """
    db = get_database()
    
    # Calculate time range
    now = datetime.now(timezone.utc)
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    # Get top streamers
    leaderboard = await db.jftn_transactions.aggregate([
        {"$match": {"timestamp": {"$gte": start_date.isoformat()}}},
        {
            "$group": {
                "_id": "$streamer_id",
                "total_earned": {"$sum": "$streamer_share"},
                "total_tips": {"$sum": "$amount"},
                "session_count": {"$sum": 1},
                "avg_per_session": {"$avg": "$streamer_share"}
            }
        },
        {"$sort": {"total_earned": -1}},
        {"$limit": limit}
    ]).to_list(limit)
    
    # Enrich with user data
    for entry in leaderboard:
        user = await db.users.find_one({"user_id": entry["_id"]}, {"_id": 0, "username": 1, "email": 1})
        if user:
            entry["username"] = user.get("username", "Unknown")
            entry["email"] = user.get("email", "")
    
    return {
        "success": True,
        "period": period,
        "leaderboard": leaderboard,
        "timestamp": now.isoformat()
    }

# ==================== PAYOUT MANAGEMENT ====================

@router.get("/pending-payouts")
async def get_pending_payouts(limit: int = 100) -> Dict[str, Any]:
    """
    Get all pending payout requests for manual approval.
    """
    db = get_database()
    
    payouts = await db.platform_treasury.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with user data
    for payout in payouts:
        user = await db.users.find_one(
            {"user_id": payout.get("user_id", "")},
            {"_id": 0, "username": 1, "email": 1}
        )
        if user:
            payout["username"] = user.get("username", "Unknown")
            payout["email"] = user.get("email", "")
    
    return {
        "success": True,
        "payouts": payouts,
        "total": len(payouts),
        "total_amount": sum(p.get("amount", 0) for p in payouts)
    }

class PayoutActionRequest(BaseModel):
    payout_id: str
    action: str  # "approve" or "reject"
    notes: Optional[str] = None

@router.post("/payout-action")
async def payout_action(request: PayoutActionRequest) -> Dict[str, Any]:
    """
    Approve or reject a payout request.
    """
    db = get_database()
    
    if request.action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    # Find payout
    payout = await db.platform_treasury.find_one({"payout_id": request.payout_id})
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    # Update status
    update_data = {
        "status": "approved" if request.action == "approve" else "rejected",
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "admin_notes": request.notes or ""
    }
    
    await db.platform_treasury.update_one(
        {"payout_id": request.payout_id},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "message": f"Payout {request.action}d successfully",
        "payout_id": request.payout_id
    }

# ==================== PLATFORM ANNOUNCEMENTS ====================

class AnnouncementRequest(BaseModel):
    title: str
    message: str
    type: str  # "info", "warning", "success", "error"
    expires_at: Optional[str] = None

@router.get("/announcements")
async def get_announcements(active_only: bool = True) -> Dict[str, Any]:
    """
    Get all platform announcements.
    """
    db = get_database()
    
    query = {}
    if active_only:
        now = datetime.now(timezone.utc).isoformat()
        query["$or"] = [
            {"expires_at": {"$gte": now}},
            {"expires_at": None}
        ]
    
    announcements = await db.announcements.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "success": True,
        "announcements": announcements
    }

@router.post("/create-announcement")
async def create_announcement(request: AnnouncementRequest) -> Dict[str, Any]:
    """
    Create a new platform-wide announcement.
    """
    db = get_database()
    
    from uuid import uuid4
    announcement = {
        "announcement_id": str(uuid4()),
        "title": request.title,
        "message": request.message,
        "type": request.type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": request.expires_at,
        "active": True
    }
    
    await db.announcements.insert_one(announcement)
    
    return {
        "success": True,
        "message": "Announcement created",
        "announcement_id": announcement["announcement_id"]
    }

@router.delete("/delete-announcement/{announcement_id}")
async def delete_announcement(announcement_id: str) -> Dict[str, Any]:
    """
    Delete an announcement.
    """
    db = get_database()
    
    await db.announcements.delete_one({"announcement_id": announcement_id})
    
    return {
        "success": True,
        "message": "Announcement deleted"
    }

# ==================== USER ACTIONS ====================

class BanUserRequest(BaseModel):
    user_id: str
    reason: str
    duration_hours: Optional[int] = None

@router.post("/ban-user-action")
async def ban_user_action(request: BanUserRequest) -> Dict[str, Any]:
    """
    Ban a user with reason.
    """
    db = get_database()
    
    ban_data = {
        "banned": True,
        "ban_reason": request.reason,
        "banned_at": datetime.now(timezone.utc).isoformat()
    }
    
    if request.duration_hours:
        ban_data["ban_expires"] = (
            datetime.now(timezone.utc) + timedelta(hours=request.duration_hours)
        ).isoformat()
    
    result = await db.users.update_one(
        {"user_id": request.user_id},
        {"$set": ban_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "success": True,
        "message": f"User banned for {request.duration_hours or 'permanent'} hours",
        "user_id": request.user_id
    }

@router.post("/unban-user-action/{user_id}")
async def unban_user_action(user_id: str) -> Dict[str, Any]:
    """
    Unban a user.
    """
    db = get_database()
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {"banned": False},
            "$unset": {"ban_reason": "", "banned_at": "", "ban_expires": ""}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "success": True,
        "message": "User unbanned",
        "user_id": user_id
    }



# ==================== PERFORMANCE TELEMETRY ====================

@router.get("/perf-snapshot")
async def get_perf_snapshot(_: bool = Depends(verify_admin_cookie)) -> Dict[str, Any]:
    """Live p50/p95/p99 latency snapshot per route.

    Powered by the in-process ``services.perf_telemetry`` middleware —
    bounded 1024-sample rolling window per route, lock-protected, no DB.
    Pairs nicely with the Quality Gates pipeline as a "is the dashboard
    slowing down?" tripwire.
    """
    from services.perf_telemetry import snapshot  # noqa: PLC0415
    return snapshot()


@router.post("/perf-snapshot/reset")
async def reset_perf_snapshot(_: bool = Depends(verify_admin_cookie)) -> Dict[str, Any]:
    """Reset the latency buckets — useful before kicking off a load test
    so the snapshot reflects the new baseline only."""
    from services.perf_telemetry import reset  # noqa: PLC0415
    reset()
    return {"success": True, "reset": True}
