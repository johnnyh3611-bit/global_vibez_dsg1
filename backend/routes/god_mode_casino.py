"""
God Mode Casino Admin Dashboard
Enhanced admin panel for casino platform oversight
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from utils.database import get_database, get_current_user
import os

router = APIRouter(prefix="/god-mode", tags=["God Mode Casino Admin"])

# Admin authentication
ADMIN_EMAILS = os.getenv("ADMIN_EMAILS", "admin@globalvibez.com,founder@globalvibez.com,demo@globalvibez.com").split(",")

async def verify_god_mode_access(request: Request) -> Dict[str, Any]:
    """Verify user has god mode access"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user is admin
    user_email = getattr(current_user, 'email', '')
    user_id = getattr(current_user, 'user_id', '')
    
    # Allow: admin emails, is_admin flag, or demo users
    is_admin = (
        user_email in ADMIN_EMAILS or 
        getattr(current_user, 'is_admin', False) or
        user_id.startswith('demo_')  # Allow all demo users for testing
    )
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="God Mode access required")
    
    return current_user


# ==================== MODELS ====================

class BanUserRequest(BaseModel):
    user_id: str
    reason: str
    duration_hours: Optional[int] = None  # None = permanent


class SuspendUserRequest(BaseModel):
    user_id: str
    reason: str
    duration_hours: int = 24


# ==================== CASINO ANALYTICS ====================

@router.get("/casino-analytics")
async def get_casino_analytics(request: Request) -> Dict[str, Any]:
    """
    Comprehensive casino platform analytics
    - DAU, MAU, new users
    - Game statistics (most played, revenue by game)
    - Top players and whales
    - Revenue metrics
    """
    await verify_god_mode_access(request)
    db = get_database()
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Active users
    total_users = await db.users.count_documents({})
    dau = await db.users.count_documents({
        "last_seen": {"$gte": today_start.isoformat()}
    })
    mau = await db.users.count_documents({
        "last_seen": {"$gte": month_start.isoformat()}
    })
    
    # New users today
    new_today = await db.users.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    # Game statistics
    games_played_today = {}
    for game_type in ['baccarat', 'bid_whist', 'dice_sessions', 'blackjack']:
        collection_name = f"{game_type}_games" if game_type != 'dice_sessions' else 'dice_sessions'
        count = await db[collection_name].count_documents({
            "created_at": {"$gte": today_start.isoformat()}
        })
        games_played_today[game_type] = count
    
    # Revenue metrics
    total_wagered_today = 0
    total_profit_today = 0
    
    # Baccarat revenue
    baccarat_games = await db.baccarat_games.find({
        "created_at": {"$gte": today_start.isoformat()}
    }, {"_id": 0, "bet_amount": 1, "profit": 1}).to_list(10000)
    
    for game in baccarat_games:
        total_wagered_today += game.get('bet_amount', 0)
        total_profit_today += game.get('profit', 0)
    
    # Top players by profit
    top_players_pipeline = [
        {"$match": {"created_at": {"$gte": month_start.isoformat()}}},
        {"$group": {
            "_id": "$user_id",
            "total_profit": {"$sum": "$profit"},
            "games_played": {"$sum": 1},
            "total_wagered": {"$sum": "$bet_amount"}
        }},
        {"$sort": {"total_profit": -1}},
        {"$limit": 10}
    ]
    
    top_players_data = await db.baccarat_games.aggregate(top_players_pipeline).to_list(10)
    
    # Get usernames for top players
    top_players = []
    for player in top_players_data:
        user = await db.users.find_one({"user_id": player["_id"]}, {"_id": 0, "username": 1})
        top_players.append({
            "user_id": player["_id"],
            "username": user.get("username", "Unknown") if user else "Unknown",
            "profit": player["total_profit"],
            "games_played": player["games_played"],
            "total_wagered": player["total_wagered"]
        })
    
    # Platform revenue (house edge)
    platform_revenue = abs(min(0, total_profit_today))  # House wins = negative player profit
    
    return {
        "users": {
            "total": total_users,
            "dau": dau,
            "mau": mau,
            "new_today": new_today,
            "dau_mau_ratio": round((dau / mau * 100) if mau > 0 else 0, 2)
        },
        "games": {
            "today": games_played_today,
            "total_today": sum(games_played_today.values())
        },
        "revenue": {
            "total_wagered_today": total_wagered_today,
            "player_profit_today": total_profit_today,
            "platform_revenue_today": platform_revenue
        },
        "top_players": top_players
    }


@router.get("/active-games")
async def get_active_games(request: Request) -> Dict[str, Any]:
    """Get currently active game sessions"""
    await verify_god_mode_access(request)
    db = get_database()
    
    # Active Bid Whist games
    bid_whist_games = await db.bid_whist_games.find(
        {"status": {"$ne": "completed"}},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Active Vibe Suites
    vibe_suites = await db.vibe_suites.find(
        {"status": "active"},
        {"_id": 0}
    ).to_list(50)
    
    # Active Just For The Night rooms
    jftn_rooms = await db.jftn_rooms.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(50)
    
    # Recent Baccarat games (last hour)
    hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_baccarat = await db.baccarat_games.find(
        {"created_at": {"$gte": hour_ago.isoformat()}},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {
        "bid_whist": {
            "count": len(bid_whist_games),
            "games": bid_whist_games
        },
        "vibe_suites": {
            "count": len(vibe_suites),
            "suites": vibe_suites
        },
        "jftn_rooms": {
            "count": len(jftn_rooms),
            "rooms": jftn_rooms
        },
        "baccarat": {
            "count": len(recent_baccarat),
            "recent_games": recent_baccarat[:10]  # Top 10 most recent
        }
    }


@router.get("/transaction-logs")
async def get_transaction_logs(
    request: Request,
    limit: int = 50,
    transaction_type: Optional[str] = None
) -> Dict[str, Any]:
    """Get all platform transactions"""
    await verify_god_mode_access(request)
    db = get_database()
    
    query = {}
    if transaction_type:
        query["type"] = transaction_type
    
    # Credit transactions
    transactions = await db.credit_transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate totals
    total_credits_issued = sum(t['amount'] for t in transactions if t.get('amount', 0) > 0)
    total_credits_spent = abs(sum(t['amount'] for t in transactions if t.get('amount', 0) < 0))
    
    return {
        "transactions": transactions,
        "summary": {
            "total_credits_issued": total_credits_issued,
            "total_credits_spent": total_credits_spent,
            "net": total_credits_issued - total_credits_spent,
            "count": len(transactions)
        }
    }


# ==================== USER MANAGEMENT ====================

@router.get("/users/search")
async def search_users(
    request: Request,
    query: str,
    limit: int = 20
) -> Dict[str, Any]:
    """Search users by username, email, or user_id"""
    await verify_god_mode_access(request)
    db = get_database()
    
    users = await db.users.find(
        {
            "$or": [
                {"username": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}},
                {"user_id": {"$regex": query, "$options": "i"}}
            ]
        },
        {"_id": 0, "password": 0}
    ).limit(limit).to_list(limit)
    
    return {
        "users": users,
        "count": len(users)
    }


@router.get("/users/{user_id}/activity")
async def get_user_activity(user_id: str, request: Request) -> Dict[str, Any]:
    """Get detailed user activity and statistics"""
    await verify_god_mode_access(request)
    db = get_database()
    
    # User info
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Game statistics
    baccarat_stats = await db.baccarat_games.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(1000)
    
    bid_whist_stats = await db.bid_whist_games.count_documents(
        {"$or": [
            {"players.north": user_id},
            {"players.south": user_id},
            {"players.east": user_id},
            {"players.west": user_id}
        ]}
    )
    
    # Vibe Suites created
    suites_created = await db.vibe_suites.count_documents({"owner_id": user_id})
    
    # Transaction history
    transactions = await db.credit_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "user": user,
        "stats": {
            "baccarat": {
                "games_played": len(baccarat_stats),
                "total_wagered": sum(g.get('bet_amount', 0) for g in baccarat_stats),
                "total_profit": sum(g.get('profit', 0) for g in baccarat_stats)
            },
            "bid_whist": {
                "games_played": bid_whist_stats
            },
            "vibe_suites": {
                "created": suites_created
            }
        },
        "recent_transactions": transactions
    }


@router.post("/users/ban")
async def ban_user(data: BanUserRequest, request: Request) -> Dict[str, Any]:
    """Ban a user from the platform"""
    await verify_god_mode_access(request)
    admin = await get_current_user(request)
    db = get_database()
    
    # Calculate ban expiry if duration specified
    ban_expires_at = None
    if data.duration_hours:
        ban_expires_at = (datetime.now(timezone.utc) + timedelta(hours=data.duration_hours)).isoformat()
    
    result = await db.users.update_one(
        {"user_id": data.user_id},
        {"$set": {
            "account_status": "banned",
            "ban_reason": data.reason,
            "banned_at": datetime.now(timezone.utc).isoformat(),
            "banned_by": admin.user_id,
            "ban_expires_at": ban_expires_at
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log admin action
    await db.admin_actions.insert_one({
        "action": "ban_user",
        "target_user_id": data.user_id,
        "admin_user_id": admin.user_id,
        "reason": data.reason,
        "duration_hours": data.duration_hours,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    ban_type = "temporary" if data.duration_hours else "permanent"
    return {
        "success": True,
        "message": f"User {ban_type} banned for: {data.reason}"
    }


@router.post("/users/suspend")
async def suspend_user(data: SuspendUserRequest, request: Request) -> Dict[str, Any]:
    """Suspend a user temporarily"""
    await verify_god_mode_access(request)
    admin = await get_current_user(request)
    db = get_database()
    
    suspend_until = (datetime.now(timezone.utc) + timedelta(hours=data.duration_hours)).isoformat()
    
    result = await db.users.update_one(
        {"user_id": data.user_id},
        {"$set": {
            "account_status": "suspended",
            "suspend_reason": data.reason,
            "suspended_at": datetime.now(timezone.utc).isoformat(),
            "suspended_by": admin.user_id,
            "suspend_until": suspend_until
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log admin action
    await db.admin_actions.insert_one({
        "action": "suspend_user",
        "target_user_id": data.user_id,
        "admin_user_id": admin.user_id,
        "reason": data.reason,
        "duration_hours": data.duration_hours,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": f"User suspended for {data.duration_hours} hours: {data.reason}"
    }


@router.post("/users/{user_id}/unban")
async def unban_user(user_id: str, request: Request) -> Dict[str, Any]:
    """Remove ban from user"""
    await verify_god_mode_access(request)
    admin = await get_current_user(request)
    db = get_database()
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "account_status": "active",
            "ban_reason": None,
            "banned_at": None,
            "banned_by": None,
            "ban_expires_at": None
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log admin action
    await db.admin_actions.insert_one({
        "action": "unban_user",
        "target_user_id": user_id,
        "admin_user_id": admin.user_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": "User unbanned"
    }


@router.get("/admin-actions")
async def get_admin_actions(request: Request, limit: int = 50) -> Dict[str, Any]:
    """Get recent admin actions log"""
    await verify_god_mode_access(request)
    db = get_database()
    
    actions = await db.admin_actions.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {
        "actions": actions,
        "count": len(actions)
    }
