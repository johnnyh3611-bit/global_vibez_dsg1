"""
Leaderboards System
Global and weekly rankings for all games
Feature #7 of 35
"""
from fastapi import APIRouter
from typing import Dict, Any
from datetime import datetime, timezone, timedelta
from config import get_database

router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])

@router.get("/global/{game_type}")
async def get_global_leaderboard(game_type: str, limit: int = 100) -> Dict[str, Any]:
    """Get all-time global leaderboard for a game"""
    db = get_database()
    
    leaderboard = await db.game_stats.aggregate([
        {"$match": {"game_type": game_type}},
        {
            "$group": {
                "_id": "$user_id",
                "total_wins": {"$sum": "$wins"},
                "total_games": {"$sum": "$games_played"},
                "total_earnings": {"$sum": "$total_winnings"}
            }
        },
        {"$sort": {"total_wins": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "users",
                "localField": "_id",
                "foreignField": "user_id",
                "as": "user"
            }
        },
        {"$unwind": "$user"},
        {
            "$project": {
                "_id": 0,
                "user_id": "$_id",
                "username": "$user.username",
                "total_wins": 1,
                "total_games": 1,
                "total_earnings": 1,
                "win_rate": {
                    "$multiply": [
                        {"$divide": ["$total_wins", "$total_games"]},
                        100
                    ]
                }
            }
        }
    ]).to_list(limit)
    
    return {
        "success": True,
        "game_type": game_type,
        "period": "all_time",
        "leaderboard": leaderboard
    }

@router.get("/weekly/{game_type}")
async def get_weekly_leaderboard(game_type: str, limit: int = 100) -> Dict[str, Any]:
    """Get weekly leaderboard"""
    db = get_database()
    
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    leaderboard = await db.game_results.aggregate([
        {
            "$match": {
                "game_type": game_type,
                "completed_at": {"$gte": week_ago}
            }
        },
        {
            "$group": {
                "_id": "$winner_id",
                "wins": {"$sum": 1},
                "total_winnings": {"$sum": "$prize"}
            }
        },
        {"$sort": {"wins": -1}},
        {"$limit": limit}
    ]).to_list(limit)
    
    return {
        "success": True,
        "game_type": game_type,
        "period": "weekly",
        "leaderboard": leaderboard
    }

@router.get("/user-rank/{user_id}/{game_type}")
async def get_user_rank(user_id: str, game_type: str) -> Dict[str, Any]:
    """Get user's current rank in leaderboard"""
    db = get_database()
    
    # Count users with more wins
    user_stats = await db.game_stats.find_one(
        {"user_id": user_id, "game_type": game_type},
        {"_id": 0}
    )
    
    if not user_stats:
        return {
            "success": True,
            "rank": None,
            "message": "User has not played this game"
        }
    
    higher_ranked = await db.game_stats.count_documents({
        "game_type": game_type,
        "wins": {"$gt": user_stats.get("wins", 0)}
    })
    
    return {
        "success": True,
        "user_id": user_id,
        "game_type": game_type,
        "rank": higher_ranked + 1,
        "stats": user_stats
    }
