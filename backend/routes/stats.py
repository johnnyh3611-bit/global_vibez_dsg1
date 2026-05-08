"""
Enhanced Game Statistics Module
Tracks detailed per-game stats, achievements, and leaderboards
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime
from collections import defaultdict

router = APIRouter(prefix="/stats", tags=["statistics"])


# ==================== MODELS ====================

class GameStatsDetail(BaseModel):
    game_type: str
    total_games: int
    wins: int
    losses: int
    draws: int
    win_rate: float
    average_score: float = 0
    best_score: float = 0
    fastest_win_seconds: Optional[int] = None
    longest_game_seconds: Optional[int] = None
    current_streak: int = 0
    best_streak: int = 0


class Achievement(BaseModel):
    achievement_id: str
    name: str
    description: str
    icon: str
    unlocked: bool
    unlocked_at: Optional[str] = None


class LeaderboardEntry(BaseModel):
    user_id: str
    name: str
    wins: int
    win_rate: float
    total_games: int
    rank: int


# ==================== ENDPOINTS ====================

@router.get("/detailed")
async def get_detailed_stats(request: Request, game_type: Optional[str] = None) -> Dict[str, Any]:
    """Get detailed statistics for all games or specific game"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Fetch all completed practice games
    query = {"user_id": current_user.user_id, "status": "completed"}
    if game_type:
        query["game_type"] = game_type
    
    games = await db.practice_games.find(query, {"_id": 0}).to_list(10000)
    
    if not games:
        return {"message": "No games found", "stats": []}
    
    # Group by game type
    stats_by_game = defaultdict(lambda: {
        "total_games": 0,
        "wins": 0,
        "losses": 0,
        "draws": 0,
        "total_duration": 0,
        "scores": [],
        "durations": [],
        "streak": 0,
        "best_streak": 0,
        "current_streak": 0
    })
    
    for game in games:
        gt = game["game_type"]
        stats = stats_by_game[gt]
        
        stats["total_games"] += 1
        
        winner = game.get("winner")
        if winner == "player":
            stats["wins"] += 1
            stats["current_streak"] += 1
            stats["best_streak"] = max(stats["best_streak"], stats["current_streak"])
        elif winner == "ai":
            stats["losses"] += 1
            stats["current_streak"] = 0
        else:
            stats["draws"] += 1
        
        # Track duration if available
        if "created_at" in game and "completed_at" in game:
            try:
                start = datetime.fromisoformat(game["created_at"].replace('Z', '+00:00'))
                end = datetime.fromisoformat(game["completed_at"].replace('Z', '+00:00'))
                duration = int((end - start).total_seconds())
                stats["durations"].append(duration)
            except (ValueError, AttributeError):
                pass
        
        # Track scores if available
        game_state = game.get("game_state", {})
        if "player_score" in game_state:
            stats["scores"].append(game_state["player_score"])
    
    # Calculate aggregated stats
    result_stats = []
    for gt, data in stats_by_game.items():
        win_rate = (data["wins"] / data["total_games"] * 100) if data["total_games"] > 0 else 0
        avg_score = sum(data["scores"]) / len(data["scores"]) if data["scores"] else 0
        best_score = max(data["scores"]) if data["scores"] else 0
        fastest_win = min(data["durations"]) if data["durations"] else None
        longest_game = max(data["durations"]) if data["durations"] else None
        
        result_stats.append({
            "game_type": gt,
            "total_games": data["total_games"],
            "wins": data["wins"],
            "losses": data["losses"],
            "draws": data["draws"],
            "win_rate": round(win_rate, 1),
            "average_score": round(avg_score, 1),
            "best_score": round(best_score, 1),
            "fastest_win_seconds": fastest_win,
            "longest_game_seconds": longest_game,
            "current_streak": data["current_streak"],
            "best_streak": data["best_streak"]
        })
    
    return {"stats": result_stats}


@router.get("/achievements")
async def get_achievements(request: Request) -> Dict[str, Any]:
    """Get user achievements"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Fetch user's games
    games = await db.practice_games.find(
        {"user_id": current_user.user_id, "status": "completed"},
        {"_id": 0}
    ).to_list(10000)
    
    total_wins = sum(1 for g in games if g.get("winner") == "player")
    total_games = len(games)
    game_types_played = len(set(g["game_type"] for g in games))
    
    # Define achievements
    achievements = [
        {
            "achievement_id": "first_win",
            "name": "First Victory",
            "description": "Win your first game",
            "icon": "🏆",
            "unlocked": total_wins >= 1
        },
        {
            "achievement_id": "winning_streak_5",
            "name": "Hot Streak",
            "description": "Win 5 games in a row",
            "icon": "🔥",
            "unlocked": _check_win_streak(games, 5)
        },
        {
            "achievement_id": "winning_streak_10",
            "name": "Unstoppable",
            "description": "Win 10 games in a row",
            "icon": "⚡",
            "unlocked": _check_win_streak(games, 10)
        },
        {
            "achievement_id": "games_master",
            "name": "Games Master",
            "description": "Play all 11 game types",
            "icon": "🎮",
            "unlocked": game_types_played >= 11
        },
        {
            "achievement_id": "century_club",
            "name": "Century Club",
            "description": "Play 100 games",
            "icon": "💯",
            "unlocked": total_games >= 100
        },
        {
            "achievement_id": "perfectionist",
            "name": "Perfectionist",
            "description": "Win 50 games",
            "icon": "✨",
            "unlocked": total_wins >= 50
        },
        {
            "achievement_id": "chess_grandmaster",
            "name": "Chess Grandmaster",
            "description": "Win 10 chess games on hard difficulty",
            "icon": "♟️",
            "unlocked": _check_specific_wins(games, "chess", "hard", 10)
        },
        {
            "achievement_id": "card_shark",
            "name": "Card Shark",
            "description": "Win 25 card games",
            "icon": "🃏",
            "unlocked": _check_card_game_wins(games, 25)
        }
    ]
    
    return {"achievements": achievements}


@router.get("/leaderboard/{game_type}")
async def get_leaderboard(game_type: str, limit: int = 100) -> Dict[str, Any]:
    """Get leaderboard for specific game type"""
    db = get_database()
    
    # Aggregate stats across all users for this game type
    pipeline = [
        {"$match": {"game_type": game_type, "status": "completed"}},
        {"$group": {
            "_id": "$user_id",
            "total_games": {"$sum": 1},
            "wins": {
                "$sum": {
                    "$cond": [{"$eq": ["$winner", "player"]}, 1, 0]
                }
            }
        }},
        {"$match": {"total_games": {"$gte": 5}}},  # Min 5 games played
        {"$project": {
            "user_id": "$_id",
            "total_games": 1,
            "wins": 1,
            "win_rate": {
                "$multiply": [
                    {"$divide": ["$wins", "$total_games"]},
                    100
                ]
            }
        }},
        {"$sort": {"win_rate": -1, "wins": -1}},
        {"$limit": limit}
    ]
    
    results = await db.practice_games.aggregate(pipeline).to_list(limit)
    
    # Fetch user names
    user_ids = [r["user_id"] for r in results]
    users = await db.users.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "name": 1}
    ).to_list(len(user_ids))
    
    user_map = {u["user_id"]: u["name"] for u in users}
    
    # Build leaderboard
    leaderboard = []
    for idx, entry in enumerate(results, 1):
        leaderboard.append({
            "rank": idx,
            "user_id": entry["user_id"],
            "name": user_map.get(entry["user_id"], "Anonymous"),
            "wins": entry["wins"],
            "total_games": entry["total_games"],
            "win_rate": round(entry["win_rate"], 1)
        })
    
    return {"leaderboard": leaderboard, "game_type": game_type}


@router.get("/global")
async def get_global_stats() -> Dict[str, Any]:
    """Get global platform statistics"""
    db = get_database()
    
    total_games = await db.practice_games.count_documents({"status": "completed"})
    total_users = await db.users.count_documents({})
    
    # Most popular games
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": "$game_type",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    
    popular_games = await db.practice_games.aggregate(pipeline).to_list(5)
    
    return {
        "total_games_played": total_games,
        "total_players": total_users,
        "most_popular_games": [
            {"game_type": g["_id"], "games_played": g["count"]}
            for g in popular_games
        ]
    }


# ==================== HELPER FUNCTIONS ====================

def _check_win_streak(games: List[Dict], required_streak: int) -> bool:
    """Check if user achieved a win streak"""
    games_sorted = sorted(games, key=lambda x: x.get("created_at", ""))
    current_streak = 0
    max_streak = 0
    
    for game in games_sorted:
        if game.get("winner") == "player":
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 0
    
    return max_streak >= required_streak


def _check_specific_wins(games: List[Dict], game_type: str, difficulty: str, required: int) -> bool:
    """Check wins for specific game type and difficulty"""
    wins = sum(
        1 for g in games
        if g.get("game_type") == game_type
        and g.get("difficulty") == difficulty
        and g.get("winner") == "player"
    )
    return wins >= required


def _check_card_game_wins(games: List[Dict], required: int) -> bool:
    """Check total wins in card games"""
    card_games = ["uno", "poker", "blackjack", "crazy_eights", "go_fish", "hearts", "spades", "rummy"]
    wins = sum(
        1 for g in games
        if g.get("game_type") in card_games
        and g.get("winner") == "player"
    )
    return wins >= required
