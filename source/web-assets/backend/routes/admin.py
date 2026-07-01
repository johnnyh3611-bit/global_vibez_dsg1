"""
Admin Dashboard Backend Routes
Comprehensive admin panel for platform management
"""
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from utils.database import get_database, get_current_user
import os

router = APIRouter(prefix="/admin", tags=["admin"])

# Admin email whitelist (configurable via .env). Includes platform owners by
# default so the admin pages work out-of-the-box without forcing every install
# to set an env var.
DEFAULT_ADMINS = [
    "admin@globalvibez.com",
    "demo@globalvibez.com",
    "johnnyh3611@gmail.com",  # platform owner
]
ADMIN_EMAILS = [
    e.strip().lower()
    for e in os.getenv("ADMIN_EMAILS", ",".join(DEFAULT_ADMINS)).split(",")
    if e.strip()
]

# ==================== ADMIN AUTH MIDDLEWARE ====================

async def verify_admin(request: Request) -> Dict[str, Any]:
    """Verify user is admin"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user email is in admin whitelist OR is a demo user
    user_id = getattr(current_user, 'user_id', '')
    is_demo = user_id.startswith('demo_')
    user_email = (current_user.email or '').strip().lower()
    
    if user_email not in ADMIN_EMAILS and not is_demo:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return current_user


# ==================== DASHBOARD OVERVIEW ====================

@router.get("/dashboard")
async def get_dashboard_stats(request: Request) -> Dict[str, Any]:
    """Get dashboard overview statistics"""
    await verify_admin(request)
    db = get_database()
    
    # User stats
    total_users = await db.users.count_documents({})
    active_today = await db.users.count_documents({
        "last_seen": {"$gte": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}
    })
    
    # Match stats
    total_matches = await db.matches.count_documents({})
    
    # Message stats
    total_messages = await db.messages.count_documents({})
    messages_today = await db.messages.count_documents({
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}
    })
    
    # Ride stats
    total_rides = await db.rides.count_documents({})
    active_rides = await db.rides.count_documents({"status": "active"})
    
    # SOS alerts
    pending_sos = await db.sos_alerts.count_documents({"status": "pending"})
    
    # Pending verifications
    pending_drivers = await db.driver_verifications.count_documents({"status": "pending"})
    
    # Revenue (mock data for now since Stripe is mocked)
    revenue_stats = {
        "today": 0,
        "this_month": 0,
        "total": 0
    }
    
    return {
        "users": {
            "total": total_users,
            "active_today": active_today
        },
        "matches": {
            "total": total_matches
        },
        "messages": {
            "total": total_messages,
            "today": messages_today
        },
        "rides": {
            "total": total_rides,
            "active": active_rides
        },
        "alerts": {
            "pending_sos": pending_sos,
            "pending_drivers": pending_drivers
        },
        "revenue": revenue_stats
    }


# ==================== USER MANAGEMENT ====================

@router.get("/users")
async def get_all_users(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None
):
    """Get all users with pagination and filters"""
    await verify_admin(request)
    db = get_database()
    
    # Build query
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"user_id": {"$regex": search, "$options": "i"}}
        ]
    if status:
        query["account_status"] = status
    
    # Get total count
    total = await db.users.count_documents(query)
    
    # Get paginated users
    skip = (page - 1) * limit
    users = await db.users.find(query, {"_id": 0, "password": 0}).skip(skip).limit(limit).to_list(limit)
    
    return {
        "users": users,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get("/users/{user_id}")
async def get_user_details(user_id: str, request: Request) -> Dict[str, Any]:
    """Get detailed user information"""
    await verify_admin(request)
    db = get_database()
    
    # Get user
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user activity stats
    match_count = await db.matches.count_documents({"both_ids": user_id})
    message_count = await db.messages.count_documents({
        "$or": [{"sender_id": user_id}, {"receiver_id": user_id}]
    })
    ride_count = await db.rides.count_documents({
        "$or": [{"rider_id": user_id}, {"driver_id": user_id}]
    })
    
    # Get recent activity
    recent_messages = await db.messages.find(
        {"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "user": user,
        "stats": {
            "matches": match_count,
            "messages": message_count,
            "rides": ride_count
        },
        "recent_activity": {
            "messages": recent_messages
        }
    }


class UserUpdateRequest(BaseModel):
    account_status: Optional[str] = None
    subscription_tier: Optional[str] = None
    notes: Optional[str] = None

@router.patch("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdateRequest, request: Request) -> Dict[str, Any]:
    """Update user information (admin only)"""
    await verify_admin(request)
    db = get_database()
    
    update_data = data.dict(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "User updated"}


@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, request: Request, reason: str = "") -> Dict[str, Any]:
    """Ban a user"""
    await verify_admin(request)
    db = get_database()
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "account_status": "banned",
            "ban_reason": reason,
            "banned_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "User banned"}


@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, request: Request) -> Dict[str, Any]:
    """Unban a user"""
    await verify_admin(request)
    db = get_database()
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "account_status": "active",
            "ban_reason": None,
            "banned_at": None
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "User unbanned"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request) -> Dict[str, Any]:
    """Delete a user account (permanent)"""
    await verify_admin(request)
    db = get_database()
    
    # Delete user
    result = await db.users.delete_one({"user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete associated data
    await db.matches.delete_many({"both_ids": user_id})
    await db.messages.delete_many({
        "$or": [{"sender_id": user_id}, {"receiver_id": user_id}]
    })
    await db.rides.delete_many({
        "$or": [{"rider_id": user_id}, {"driver_id": user_id}]
    })
    
    return {"success": True, "message": "User deleted"}


# ==================== CONTENT MODERATION ====================

@router.get("/moderation/queue")
async def get_moderation_queue(request: Request, page: int = 1, limit: int = 50) -> Dict[str, Any]:
    """Get content moderation queue"""
    await verify_admin(request)
    db = get_database()
    
    # Get reported content
    skip = (page - 1) * limit
    reports = await db.content_reports.find(
        {"status": "pending"},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    total = await db.content_reports.count_documents({"status": "pending"})
    
    return {
        "reports": reports,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.post("/moderation/{report_id}/approve")
async def approve_content(report_id: str, request: Request) -> Dict[str, Any]:
    """Approve reported content (no action)"""
    await verify_admin(request)
    db = get_database()
    
    result = await db.content_reports.update_one(
        {"report_id": report_id},
        {"$set": {
            "status": "approved",
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {"success": True, "message": "Content approved"}


@router.post("/moderation/{report_id}/remove")
async def remove_content(report_id: str, request: Request) -> Dict[str, Any]:
    """Remove reported content"""
    await verify_admin(request)
    db = get_database()
    
    # Get report
    report = await db.content_reports.find_one({"report_id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Remove content based on type
    if report.get("content_type") == "photo":
        # Remove photo from user profile
        await db.users.update_one(
            {"user_id": report["user_id"]},
            {"$pull": {"photos": report["content_url"]}}
        )
    elif report.get("content_type") == "message":
        # Delete message
        await db.messages.delete_one({"message_id": report["content_id"]})
    
    # Mark report as resolved
    await db.content_reports.update_one(
        {"report_id": report_id},
        {"$set": {
            "status": "removed",
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Content removed"}


# ==================== SOS ALERT MONITORING ====================

@router.get("/sos/alerts")
async def get_sos_alerts(request: Request, status: str = "all") -> Dict[str, Any]:
    """Get SOS alerts"""
    await verify_admin(request)
    db = get_database()
    
    query = {} if status == "all" else {"status": status}
    alerts = await db.sos_alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"alerts": alerts}


@router.get("/sos/alerts/{alert_id}")
async def get_sos_alert_details(alert_id: str, request: Request) -> Dict[str, Any]:
    """Get SOS alert details"""
    await verify_admin(request)
    db = get_database()
    
    alert = await db.sos_alerts.find_one({"alert_id": alert_id}, {"_id": 0})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Get ride details if alert is ride-related
    ride = None
    if alert.get("ride_id"):
        ride = await db.rides.find_one({"ride_id": alert["ride_id"]}, {"_id": 0})
    
    # Get user details
    user = await db.users.find_one({"user_id": alert["user_id"]}, {"_id": 0, "password": 0})
    
    return {
        "alert": alert,
        "ride": ride,
        "user": user
    }


@router.post("/sos/alerts/{alert_id}/resolve")
async def resolve_sos_alert(alert_id: str, request: Request, notes: str = "") -> Dict[str, Any]:
    """Mark SOS alert as resolved"""
    await verify_admin(request)
    db = get_database()
    
    result = await db.sos_alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolution_notes": notes
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"success": True, "message": "Alert resolved"}


# ==================== DRIVER VERIFICATION ====================

@router.get("/drivers/pending")
async def get_pending_drivers(request: Request) -> Dict[str, Any]:
    """Get pending driver verifications"""
    await verify_admin(request)
    db = get_database()
    
    pending = await db.driver_verifications.find(
        {"status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    return {"pending_verifications": pending}


@router.post("/drivers/{user_id}/approve")
async def approve_driver(user_id: str, request: Request) -> Dict[str, Any]:
    """Approve driver verification"""
    await verify_admin(request)
    db = get_database()
    
    # Update verification status
    await db.driver_verifications.update_one(
        {"user_id": user_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update user to driver role
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_driver": True}}
    )
    
    return {"success": True, "message": "Driver approved"}


@router.post("/drivers/{user_id}/reject")
async def reject_driver(user_id: str, request: Request, reason: str = "") -> Dict[str, Any]:
    """Reject driver verification"""
    await verify_admin(request)
    db = get_database()
    
    await db.driver_verifications.update_one(
        {"user_id": user_id},
        {"$set": {
            "status": "rejected",
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": reason
        }}
    )
    
    return {"success": True, "message": "Driver rejected"}


# ==================== ANALYTICS ====================

@router.get("/analytics/users")
async def get_user_analytics(request: Request, days: int = 30) -> Dict[str, Any]:
    """Get user growth analytics"""
    await verify_admin(request)
    db = get_database()
    
    # Get user signups over time (simplified for now)
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({
        "last_seen": {"$gte": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}
    })
    
    return {
        "total_users": total_users,
        "active_users_7d": active_users,
        "growth_rate": 0  # TODO: Calculate actual growth
    }


@router.get("/analytics/engagement")
async def get_engagement_analytics(request: Request) -> Dict[str, Any]:
    """Get engagement analytics"""
    await verify_admin(request)
    db = get_database()
    
    # Message stats
    total_messages = await db.messages.count_documents({})
    messages_today = await db.messages.count_documents({
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}
    })
    
    # Match stats
    total_matches = await db.matches.count_documents({})
    matches_today = await db.matches.count_documents({
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}
    })
    
    return {
        "messages": {
            "total": total_messages,
            "today": messages_today
        },
        "matches": {
            "total": total_matches,
            "today": matches_today
        }
    }


# ==================== TRANSACTIONS ====================

@router.get("/transactions")
async def get_transactions(request: Request, page: int = 1, limit: int = 50) -> Dict[str, Any]:
    """Get all transactions"""
    await verify_admin(request)
    db = get_database()
    
    skip = (page - 1) * limit
    transactions = await db.transactions.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.transactions.count_documents({})
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

# ==================== GAME ANALYTICS ====================

@router.get("/analytics/games")
async def get_game_analytics(request: Request) -> Dict[str, Any]:
    """Get comprehensive game analytics"""
    await verify_admin(request)
    db = get_database()
    
    # Total games by type
    games_pipeline = [
        {"$group": {
            "_id": "$game_type",
            "count": {"$sum": 1},
            "total_wagers": {"$sum": "$wager_amount"}
        }},
        {"$sort": {"count": -1}}
    ]
    
    games_by_type = await db.game_sessions.aggregate(games_pipeline).to_list(100)
    
    # Games today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    games_today = await db.game_sessions.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    # Active games right now
    active_games = await db.game_sessions.count_documents({
        "status": {"$in": ["in_progress", "waiting"]}
    })
    
    # Most popular games (last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    popular_games = await db.game_sessions.aggregate([
        {"$match": {"created_at": {"$gte": week_ago.isoformat()}}},
        {"$group": {
            "_id": "$game_type",
            "plays": {"$sum": 1},
            "unique_players": {"$addToSet": "$player_ids"}
        }},
        {"$project": {
            "game_type": "$_id",
            "plays": 1,
            "unique_players": {"$size": "$unique_players"}
        }},
        {"$sort": {"plays": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    # Player engagement
    total_players = await db.users.count_documents({})
    players_with_games = await db.game_sessions.distinct("player_ids")
    
    # Multiplayer vs Practice
    multiplayer_games = await db.game_sessions.count_documents({"is_multiplayer": True})
    practice_games = await db.game_sessions.count_documents({"is_multiplayer": False})
    
    return {
        "overview": {
            "total_games": await db.game_sessions.count_documents({}),
            "games_today": games_today,
            "active_games": active_games,
            "player_engagement": f"{(len(players_with_games) / total_players * 100) if total_players > 0 else 0:.1f}%"
        },
        "by_type": games_by_type,
        "popular_games": popular_games,
        "multiplayer_split": {
            "multiplayer": multiplayer_games,
            "practice": practice_games
        }
    }


@router.get("/analytics/revenue")
async def get_revenue_analytics(request: Request) -> Dict[str, Any]:
    """Get comprehensive revenue analytics"""
    await verify_admin(request)
    db = get_database()
    
    # Today's revenue
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_revenue = await db.transactions.aggregate([
        {"$match": {
            "created_at": {"$gte": today_start.isoformat()},
            "status": "completed"
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # This month's revenue
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_revenue = await db.transactions.aggregate([
        {"$match": {
            "created_at": {"$gte": month_start.isoformat()},
            "status": "completed"
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Total revenue
    total_revenue = await db.transactions.aggregate([
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Revenue by category
    revenue_by_category = await db.transactions.aggregate([
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": "$category",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]).to_list(100)
    
    # Elite subscribers
    elite_count = await db.users.count_documents({"elite_subscription_active": True})
    
    return {
        "overview": {
            "today": today_revenue[0]["total"] if today_revenue else 0,
            "this_month": month_revenue[0]["total"] if month_revenue else 0,
            "total": total_revenue[0]["total"] if total_revenue else 0
        },
        "by_category": revenue_by_category,
        "subscriptions": {
            "active_elite": elite_count
        }
    }


@router.get("/analytics/dating")
async def get_dating_analytics(request: Request) -> Dict[str, Any]:
    """Get dating feature analytics"""
    await verify_admin(request)
    db = get_database()
    
    # Total matches
    total_matches = await db.matches.count_documents({})
    
    # Matches today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    matches_today = await db.matches.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    return {
        "overview": {
            "total_matches": total_matches,
            "matches_today": matches_today
        }
    }
