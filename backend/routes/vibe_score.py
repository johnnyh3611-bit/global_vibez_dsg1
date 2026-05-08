from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/vibe-score", tags=["vibe_score"])


# ==================== MODELS ====================

class VibeScoreResponse(BaseModel):
    user_id: str
    username: str
    avatar: Optional[str] = None
    vibe_score: int
    game_elo: int
    vibe_rank: Optional[int] = None
    elo_rank: Optional[int] = None
    breakdown: dict


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    avatar: Optional[str] = None
    score: int


# ==================== VIBE SCORE CALCULATION ====================

async def calculate_vibe_score(user_id: str, db) -> dict:
    """
    Calculate Vibe Score based on social engagement
    
    Vibe Score = Sum of:
    - Profile completeness: 50 points
    - Games played: 5 points each
    - Dating games: 15 points each (bonus)
    - Table for Two invites accepted: 20 points each
    - Streams created: 10 points each
    - Matches made: 25 points each
    - Messages sent: 2 points each
    - Profile views: 1 point each
    """
    
    breakdown = {
        "profile_completeness": 0,
        "games_played": 0,
        "dating_games": 0,
        "table_for_two": 0,
        "streams": 0,
        "matches": 0,
        "messages": 0,
        "profile_views": 0
    }
    
    # Get user profile
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return {"total": 0, "breakdown": breakdown}
    
    # Profile completeness (50 points max)
    profile_fields = ["bio", "interests", "favorite_games", "photos"]
    completed_fields = sum(1 for field in profile_fields if user.get(field))
    breakdown["profile_completeness"] = (completed_fields / len(profile_fields)) * 50
    
    # Games played (5 points each)
    games_count = await db.practice_games.count_documents({"user_id": user_id, "status": "completed"})
    breakdown["games_played"] = games_count * 5
    
    # Dating games (15 points each - bonus)
    dating_games_count = await db.dating_game_sessions.count_documents({
        "$or": [{"player_1_id": user_id}, {"player_2_id": user_id}],
        "mode": "dating"
    })
    breakdown["dating_games"] = dating_games_count * 15
    
    # Table for Two invites accepted (20 points each)
    t4t_accepted = await db.table_for_two_invites.count_documents({
        "$or": [{"from_user_id": user_id}, {"to_user_id": user_id}],
        "status": "accepted"
    })
    breakdown["table_for_two"] = t4t_accepted * 20
    
    # Streams created (10 points each)
    streams_count = await db.streams.count_documents({"user_id": user_id}) if "streams" in await db.list_collection_names() else 0
    breakdown["streams"] = streams_count * 10
    
    # Matches made (25 points each)
    matches_count = await db.matches.count_documents({"both_ids": user_id})
    breakdown["matches"] = matches_count * 25
    
    # Messages sent (2 points each)
    messages_count = await db.messages.count_documents({"sender_id": user_id}) if "messages" in await db.list_collection_names() else 0
    breakdown["messages"] = messages_count * 2
    
    # Profile views (1 point each)
    views_count = user.get("profile_views", 0)
    breakdown["profile_views"] = views_count * 1
    
    # Total Vibe Score
    total = sum(breakdown.values())
    
    return {
        "total": int(total),
        "breakdown": {k: int(v) for k, v in breakdown.items()}
    }


async def calculate_game_elo(user_id: str, db) -> int:
    """
    Calculate Game Elo based on competitive game performance
    Uses standard Elo rating system
    Starting rating: 1200
    """
    
    # Get user's current Elo (default 1200 for new players)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    current_elo = user.get("game_elo", 1200) if user else 1200
    
    # Get recent game results (last 100 games)
    games = await db.practice_games.find({
        "user_id": user_id,
        "status": "completed",
        "winner": {"$exists": True}
    }, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    
    # If no games, return starting Elo
    if not games:
        return 1200
    
    # Calculate Elo based on win/loss record
    wins = sum(1 for game in games if game.get("winner") == "player")
    total_games = len(games)
    win_rate = wins / total_games if total_games > 0 else 0.5
    
    # Adjust Elo based on win rate
    # K-factor: 32 for new players (<30 games), 16 for experienced
    k_factor = 32 if total_games < 30 else 16
    
    # Simple Elo calculation
    # Expected score = 0.5 (50% win rate expected)
    expected_score = 0.5
    actual_score = win_rate
    
    # Elo change = K * (actual - expected)
    elo_change = k_factor * (actual_score - expected_score) * total_games
    
    final_elo = current_elo + elo_change
    
    # Clamp Elo between 100 and 3000
    final_elo = max(100, min(3000, final_elo))
    
    return int(final_elo)


# ==================== ENDPOINTS ====================

@router.get("/me")
async def get_my_vibe_score(request: Request) -> Dict[str, Any]:
    """Get current user's Vibe Score and Game Elo"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Calculate scores
    vibe_data = await calculate_vibe_score(current_user.user_id, db)
    game_elo = await calculate_game_elo(current_user.user_id, db)
    
    # Update user record
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "vibe_score": vibe_data["total"],
            "game_elo": game_elo,
            "scores_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Get rankings
    vibe_rank = await db.users.count_documents({"vibe_score": {"$gt": vibe_data["total"]}}) + 1
    elo_rank = await db.users.count_documents({"game_elo": {"$gt": game_elo}}) + 1
    
    return {
        "user_id": current_user.user_id,
        "username": current_user.name,
        "avatar": current_user.picture,
        "vibe_score": vibe_data["total"],
        "game_elo": game_elo,
        "vibe_rank": vibe_rank,
        "elo_rank": elo_rank,
        "breakdown": vibe_data["breakdown"],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/{user_id}")
async def get_user_vibe_score(user_id: str, request: Request) -> Dict[str, Any]:
    """Get any user's Vibe Score and Game Elo"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get target user
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Calculate scores
    vibe_data = await calculate_vibe_score(user_id, db)
    game_elo = await calculate_game_elo(user_id, db)
    
    # Get rankings
    vibe_rank = await db.users.count_documents({"vibe_score": {"$gt": vibe_data["total"]}}) + 1
    elo_rank = await db.users.count_documents({"game_elo": {"$gt": game_elo}}) + 1
    
    return {
        "user_id": user_id,
        "username": target_user.get("username", "Unknown"),
        "avatar": target_user.get("avatar"),
        "vibe_score": vibe_data["total"],
        "game_elo": game_elo,
        "vibe_rank": vibe_rank,
        "elo_rank": elo_rank,
        "breakdown": vibe_data["breakdown"]
    }


@router.get("/leaderboard/vibe")
async def get_vibe_leaderboard(limit: int = 50, request: Request = None) -> Dict[str, Any]:
    """Get top users by Vibe Score"""
    db = get_database()
    
    # Get top users
    users = await db.users.find(
        {"vibe_score": {"$exists": True, "$gt": 0}},
        {"_id": 0, "user_id": 1, "username": 1, "avatar": 1, "vibe_score": 1}
    ).sort("vibe_score", -1).limit(limit).to_list(limit)
    
    leaderboard = [
        {
            "rank": idx + 1,
            "user_id": user["user_id"],
            "username": user.get("username", "Unknown"),
            "avatar": user.get("avatar"),
            "score": user.get("vibe_score", 0)
        }
        for idx, user in enumerate(users)
    ]
    
    return {"leaderboard": leaderboard, "total_users": len(leaderboard)}


@router.get("/leaderboard/elo")
async def get_elo_leaderboard(limit: int = 50, request: Request = None) -> Dict[str, Any]:
    """Get top users by Game Elo"""
    db = get_database()
    
    # Get top users
    users = await db.users.find(
        {"game_elo": {"$exists": True, "$gt": 1000}},
        {"_id": 0, "user_id": 1, "username": 1, "avatar": 1, "game_elo": 1}
    ).sort("game_elo", -1).limit(limit).to_list(limit)
    
    leaderboard = [
        {
            "rank": idx + 1,
            "user_id": user["user_id"],
            "username": user.get("username", "Unknown"),
            "avatar": user.get("avatar"),
            "score": user.get("game_elo", 1200)
        }
        for idx, user in enumerate(users)
    ]
    
    return {"leaderboard": leaderboard, "total_users": len(leaderboard)}


@router.post("/recalculate")
async def recalculate_all_scores(request: Request) -> Dict[str, Any]:
    """Recalculate scores for all users (Admin only or cron job)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Admin only")
    
    db = get_database()
    
    # Get all users
    users = await db.users.find({}, {"_id": 0, "user_id": 1}).to_list(10000)
    
    updated_count = 0
    for user in users:
        vibe_data = await calculate_vibe_score(user["user_id"], db)
        game_elo = await calculate_game_elo(user["user_id"], db)
        
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "vibe_score": vibe_data["total"],
                "game_elo": game_elo,
                "scores_updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        updated_count += 1
    
    return {
        "message": f"Recalculated scores for {updated_count} users",
        "updated_count": updated_count
    }
