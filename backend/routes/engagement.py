"""
Engagement & Retention System - The Addiction Engine
Real-time notifications, activity feeds, gamification, and social loops
"""
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/engagement", tags=["engagement"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'global_vibez_dsg')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Active WebSocket connections for real-time updates
active_connections: Dict[str, WebSocket] = {}

# Pydantic Models
class NotificationCreate(BaseModel):
    user_id: str
    type: str  # friend_request, like, comment, game_invite, match, achievement
    title: str
    message: str
    action_url: Optional[str] = None
    from_user_id: Optional[str] = None
    metadata: Optional[dict] = {}

class Achievement(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    xp_reward: int
    rarity: str  # common, rare, epic, legendary
    category: str  # gaming, dating, social, content

# ==================== REAL-TIME NOTIFICATIONS ====================

@router.post("/notification/send")
async def send_notification(notif: NotificationCreate) -> Dict[str, Any]:
    """Send a notification to a user (triggers real-time push)"""
    try:
        notification = {
            "id": f"notif_{datetime.now(timezone.utc).timestamp()}",
            "user_id": notif.user_id,
            "type": notif.type,
            "title": notif.title,
            "message": notif.message,
            "action_url": notif.action_url,
            "from_user_id": notif.from_user_id,
            "metadata": notif.metadata,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.notifications.insert_one(notification)
        
        # Remove MongoDB _id before returning
        notification.pop("_id", None)
        
        # Send real-time push via WebSocket
        if notif.user_id in active_connections:
            try:
                await active_connections[notif.user_id].send_json({
                    "type": "notification",
                    "data": notification
                })
            except Exception:
                pass  # Connection might be dead
        
        return {
            "success": True,
            "notification": notification
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notifications/{user_id}")
async def get_notifications(user_id: str, limit: int = 50, unread_only: bool = False) -> Dict[str, Any]:
    """Get user's notifications"""
    try:
        query = {"user_id": user_id}
        if unread_only:
            query["is_read"] = False
        
        notifications = await db.notifications.find(query, {"_id": 0}) \
            .sort("created_at", -1) \
            .limit(limit) \
            .to_list(limit)
        
        unread_count = await db.notifications.count_documents({
            "user_id": user_id,
            "is_read": False
        })
        
        return {
            "success": True,
            "notifications": notifications,
            "unread_count": unread_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MarkReadRequest(BaseModel):
    user_id: str
    notification_ids: Optional[List[str]] = None

class DailyRewardClaimRequest(BaseModel):
    user_id: str

@router.post("/notifications/mark-read")
async def mark_notifications_read(request: MarkReadRequest) -> Dict[str, Any]:
    """Mark notifications as read"""
    try:
        query = {"user_id": request.user_id}
        if request.notification_ids:
            query["id"] = {"$in": request.notification_ids}
        
        result = await db.notifications.update_many(
            query,
            {"$set": {"is_read": True}}
        )
        
        return {
            "success": True,
            "marked_read": result.modified_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ACTIVITY FEED ====================

@router.get("/activity-feed/{user_id}")
async def get_activity_feed(user_id: str, skip: int = 0, limit: int = 20) -> Dict[str, Any]:
    """Get personalized activity feed (friends' activities)"""
    try:
        # Get user's friends
        friendships = await db.friendships.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
        friend_ids = [f["friend_id"] for f in friendships]
        friend_ids.append(user_id)  # Include own activities
        
        # Get activities from friends
        activities = []
        
        # Recent posts
        posts = await db.vibe_posts.find({
            "user_id": {"$in": friend_ids}
        }, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
        
        for post in posts:
            activities.append({
                "type": "post",
                "user_id": post["user_id"],
                "username": post["username"],
                "user_avatar": post.get("user_avatar"),
                "content": {
                    "title": post.get("title"),
                    "thumbnail": post.get("thumbnail_url"),
                    "post_id": post["id"]
                },
                "timestamp": post["created_at"],
                "action": "posted a vibe"
            })
        
        # Recent game wins
        recent_games = await db.http_games.find({
            "$or": [
                {"player1_id": {"$in": friend_ids}},
                {"player2_id": {"$in": friend_ids}}
            ],
            "status": "completed"
        }, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
        
        for game in recent_games:
            winner_id = game.get("winner")
            if winner_id in friend_ids:
                user = await db.users.find_one({"id": winner_id}, {"_id": 0})
                activities.append({
                    "type": "game_win",
                    "user_id": winner_id,
                    "username": user.get("name", "Player"),
                    "user_avatar": user.get("avatar"),
                    "content": {
                        "game_type": game.get("game_type"),
                        "opponent": game.get("player2_id") if winner_id == game.get("player1_id") else game.get("player1_id")
                    },
                    "timestamp": game.get("created_at"),
                    "action": f"won a {game.get('game_type', 'game')} match"
                })
        
        # New friendships
        new_friends = await db.friendships.find({
            "user_id": {"$in": friend_ids}
        }, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
        
        for friendship in new_friends:
            activities.append({
                "type": "new_friend",
                "user_id": friendship["user_id"],
                "username": friendship.get("friend_name"),
                "content": {
                    "friend_name": friendship.get("friend_name")
                },
                "timestamp": friendship["created_at"],
                "action": "made a new connection"
            })
        
        # Sort all activities by timestamp
        activities.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return {
            "success": True,
            "activities": activities[skip:skip+limit],
            "has_more": len(activities) > skip + limit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== GAMIFICATION & LEVELS ====================

@router.get("/profile/stats/{user_id}")
async def get_user_stats(user_id: str) -> Dict[str, Any]:
    """Get comprehensive user stats for gamification"""
    try:
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Calculate level from XP (100 XP per level, exponential scaling)
        xp = user.get("xp", 0)
        level = int((xp / 100) ** 0.5) + 1
        next_level_xp = ((level) ** 2) * 100
        current_level_xp = ((level - 1) ** 2) * 100
        progress = ((xp - current_level_xp) / (next_level_xp - current_level_xp)) * 100
        
        # Get achievements
        user_achievements = await db.user_achievements.find({
            "user_id": user_id
        }, {"_id": 0}).to_list(1000)
        
        # Get stats
        stats = {
            "user_id": user_id,
            "username": user.get("name"),
            "avatar": user.get("avatar"),
            "level": level,
            "xp": xp,
            "next_level_xp": next_level_xp,
            "progress_to_next_level": round(progress, 1),
            
            # Gaming stats
            "total_games": user.get("total_games", 0),
            "games_won": user.get("games_won", 0),
            "win_rate": user.get("win_rate", 0),
            "favorite_game": user.get("favorite_game", "None"),
            
            # Social stats
            "friends_count": await db.friendships.count_documents({"user_id": user_id}),
            "posts_count": user.get("posts_count", 0),
            "total_likes": user.get("total_likes", 0),
            
            # Achievements
            "achievements_unlocked": len(user_achievements),
            "achievements": user_achievements[:10],  # Top 10
            
            # Streaks
            "login_streak": user.get("login_streak", 0),
            "daily_challenge_streak": user.get("daily_challenge_streak", 0),
            
            # Titles/Badges
            "titles": user.get("titles", []),
            "active_title": user.get("active_title", "Newbie"),
            
            # Last active
            "last_active": user.get("last_active"),
            "created_at": user.get("created_at")
        }
        
        return {
            "success": True,
            "stats": stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/achievement/unlock")
async def unlock_achievement(user_id: str, achievement_id: str) -> Dict[str, Any]:
    """Unlock an achievement for a user"""
    try:
        # Check if already unlocked
        existing = await db.user_achievements.find_one({
            "user_id": user_id,
            "achievement_id": achievement_id
        }, {"_id": 0})
        
        if existing:
            return {
                "success": False,
                "message": "Achievement already unlocked"
            }
        
        # Get achievement details
        achievement = ACHIEVEMENTS.get(achievement_id)
        if not achievement:
            raise HTTPException(status_code=404, detail="Achievement not found")
        
        # Unlock achievement
        user_achievement = {
            "user_id": user_id,
            "achievement_id": achievement_id,
            "name": achievement["name"],
            "description": achievement["description"],
            "icon": achievement["icon"],
            "rarity": achievement["rarity"],
            "xp_reward": achievement["xp_reward"],
            "unlocked_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.user_achievements.insert_one(user_achievement)
        
        # Remove MongoDB _id before returning
        user_achievement.pop("_id", None)
        
        # Award XP
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"xp": achievement["xp_reward"]}}
        )
        
        # Send notification
        await send_notification(NotificationCreate(
            user_id=user_id,
            type="achievement",
            title="Achievement Unlocked! 🏆",
            message=f"You earned '{achievement['name']}'! +{achievement['xp_reward']} XP",
            metadata={"achievement": achievement}
        ))
        
        return {
            "success": True,
            "achievement": user_achievement,
            "xp_earned": achievement["xp_reward"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== DAILY REWARDS & STREAKS ====================

@router.post("/daily-reward/claim")
async def claim_daily_reward(request: DailyRewardClaimRequest) -> Dict[str, Any]:
    """Claim daily login reward"""
    try:
        user_id = request.user_id
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        last_claim = user.get("last_daily_claim")
        now = datetime.now(timezone.utc)
        
        # Check if already claimed today
        if last_claim:
            last_claim_dt = datetime.fromisoformat(last_claim)
            if (now - last_claim_dt).days < 1:
                time_until_next = timedelta(days=1) - (now - last_claim_dt)
                hours = int(time_until_next.total_seconds() / 3600)
                return {
                    "success": False,
                    "message": f"Already claimed today! Next reward in {hours}h"
                }
            
            # Check if streak continues (claimed yesterday)
            if (now - last_claim_dt).days == 1:
                new_streak = user.get("login_streak", 0) + 1
            else:
                new_streak = 1  # Streak broken
        else:
            new_streak = 1
        
        # Calculate reward based on streak
        base_xp = 50
        streak_bonus = min(new_streak * 10, 200)  # Max 200 bonus
        total_xp = base_xp + streak_bonus
        
        # Update user
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "last_daily_claim": now.isoformat(),
                    "login_streak": new_streak
                },
                "$inc": {"xp": total_xp}
            }
        )
        
        # Check for streak achievements
        if new_streak == 7:
            await unlock_achievement(user_id, "week_warrior")
        elif new_streak == 30:
            await unlock_achievement(user_id, "monthly_master")
        
        return {
            "success": True,
            "message": "Daily reward claimed! 🎁",
            "xp_earned": total_xp,
            "base_xp": base_xp,
            "streak_bonus": streak_bonus,
            "current_streak": new_streak
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== WEBSOCKET FOR REAL-TIME UPDATES ====================

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str) -> Dict[str, Any]:
    """WebSocket connection for real-time updates"""
    await websocket.accept()
    active_connections[user_id] = websocket
    
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "Real-time updates enabled"
        })
        
        # Keep connection alive
        while True:
            data = await websocket.receive_text()
            
            # Handle ping/pong
            if data == "ping":
                await websocket.send_json({"type": "pong"})
            
            # Handle other real-time events
            # (friend online status, new messages, etc.)
            
    except WebSocketDisconnect:
        if user_id in active_connections:
            del active_connections[user_id]

# ==================== ONLINE STATUS ====================

@router.post("/status/online")
async def set_online_status(user_id: str, status: str = "online") -> Dict[str, Any]:
    """Update user online status"""
    try:
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "online_status": status,  # online, away, busy, offline
                    "last_active": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Notify friends of status change
        friends = await db.friendships.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
        
        for friend in friends:
            if friend["friend_id"] in active_connections:
                try:
                    await active_connections[friend["friend_id"]].send_json({
                        "type": "friend_status",
                        "friend_id": user_id,
                        "status": status
                    })
                except Exception:
                    pass
        
        return {
            "success": True,
            "status": status
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ACHIEVEMENTS DATABASE ====================

ACHIEVEMENTS = {
    # Gaming Achievements
    "first_win": {
        "name": "First Victory",
        "description": "Win your first game",
        "icon": "🏆",
        "xp_reward": 100,
        "rarity": "common",
        "category": "gaming"
    },
    "win_streak_5": {
        "name": "On Fire!",
        "description": "Win 5 games in a row",
        "icon": "🔥",
        "xp_reward": 500,
        "rarity": "rare",
        "category": "gaming"
    },
    "game_master": {
        "name": "Game Master",
        "description": "Play all 27+ games",
        "icon": "🎮",
        "xp_reward": 1000,
        "rarity": "epic",
        "category": "gaming"
    },
    
    # Social Achievements
    "social_butterfly": {
        "name": "Social Butterfly",
        "description": "Add 10 friends",
        "icon": "🦋",
        "xp_reward": 300,
        "rarity": "common",
        "category": "social"
    },
    "popular": {
        "name": "Popular",
        "description": "Get 100 friends",
        "icon": "⭐",
        "xp_reward": 2000,
        "rarity": "legendary",
        "category": "social"
    },
    
    # Content Achievements
    "content_creator": {
        "name": "Content Creator",
        "description": "Post 10 vibes",
        "icon": "📹",
        "xp_reward": 250,
        "rarity": "common",
        "category": "content"
    },
    "viral_viber": {
        "name": "Viral Viber",
        "description": "Get 10,000 total likes",
        "icon": "💫",
        "xp_reward": 5000,
        "rarity": "legendary",
        "category": "content"
    },
    
    # Dating Achievements
    "first_match": {
        "name": "First Connection",
        "description": "Make your first match",
        "icon": "💕",
        "xp_reward": 150,
        "rarity": "common",
        "category": "dating"
    },
    "date_vlogger": {
        "name": "Date Vlogger",
        "description": "Complete Date Vlog challenge",
        "icon": "🎬",
        "xp_reward": 500,
        "rarity": "rare",
        "category": "dating"
    },
    
    # Streak Achievements
    "week_warrior": {
        "name": "Week Warrior",
        "description": "7-day login streak",
        "icon": "📅",
        "xp_reward": 350,
        "rarity": "rare",
        "category": "engagement"
    },
    "monthly_master": {
        "name": "Monthly Master",
        "description": "30-day login streak",
        "icon": "🗓️",
        "xp_reward": 1500,
        "rarity": "epic",
        "category": "engagement"
    }
}
