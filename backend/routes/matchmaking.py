from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import secrets
from utils.database import get_database

router = APIRouter(prefix="/matchmaking", tags=["Skill-Based Dating Matchmaking"])

# Database collections (replaces in-memory storage)
# - matchmaking_profiles: User dating/gaming profiles
# - match_requests: Active match requests
# - matchmaking_queue: Users actively searching for matches

# Models
class UserPreferences(BaseModel):
    age_min: int = 18
    age_max: int = 99
    preferred_games: List[str] = []  # blackjack, poker, bid_whist, etc.
    skill_level_min: int = 1  # 1-10
    skill_level_max: int = 10
    distance_max: int = 50  # miles
    looking_for: str = "friendship"  # friendship, dating, gaming_partner

class MatchmakingProfile(BaseModel):
    user_id: str
    name: str
    age: int
    bio: Optional[str] = ""
    favorite_games: List[str] = []
    skill_scores: Dict[str, int] = {}  # game_name: elo_rating
    total_games_played: int = 0
    win_rate: float = 0.0
    preferences: UserPreferences
    location: Optional[Dict[str, float]] = None  # lat, lng

class MatchScore(BaseModel):
    user1_id: str
    user2_id: str
    compatibility_score: float  # 0-100
    game_compatibility: float
    skill_compatibility: float
    preference_match: float
    shared_interests: List[str]

# Create/Update Matchmaking Profile
@router.post("/profile")
async def create_matchmaking_profile(profile: MatchmakingProfile) -> Dict[str, Any]:
    """
    Create or update user's matchmaking profile.
    Persisted to MongoDB for data durability.
    """
    db = get_database()
    
    profile_data = profile.dict()
    profile_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Upsert profile (update if exists, insert if new)
    await db.matchmaking_profiles.update_one(
        {"user_id": profile.user_id},
        {"$set": profile_data},
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Matchmaking profile created successfully",
        "profile": profile
    }

# Get User Profile
@router.get("/profile/{user_id}")
async def get_matchmaking_profile(user_id: str) -> Dict[str, Any]:
    """
    Get user's matchmaking profile from MongoDB.
    """
    db = get_database()
    
    profile = await db.matchmaking_profiles.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {
        "success": True,
        "profile": profile
    }

# Calculate Compatibility
def calculate_compatibility(user1: dict, user2: dict) -> MatchScore:
    """
    Advanced compatibility algorithm based on:
    - Game preferences overlap
    - Skill level proximity
    - User preferences match
    - Win rates similarity
    """
    
    # Game Compatibility (40%)
    user1_games = set(user1.get('favorite_games', []))
    user2_games = set(user2.get('favorite_games', []))
    shared_games = user1_games.intersection(user2_games)
    
    if user1_games and user2_games:
        game_compatibility = (len(shared_games) / max(len(user1_games), len(user2_games))) * 100
    else:
        game_compatibility = 0
    
    # Skill Compatibility (30%) - closer skill = better match
    user1_avg_skill = sum(user1.get('skill_scores', {}).values()) / max(len(user1.get('skill_scores', {})), 1)
    user2_avg_skill = sum(user2.get('skill_scores', {}).values()) / max(len(user2.get('skill_scores', {})), 1)
    
    skill_diff = abs(user1_avg_skill - user2_avg_skill)
    skill_compatibility = max(0, 100 - (skill_diff * 5))  # 5 points penalty per skill difference
    
    # Preference Match (30%)
    user1_prefs = user1.get('preferences', {})
    user2_prefs = user2.get('preferences', {})
    
    # Age compatibility
    user1_age = user1.get('age', 25)
    user2_age = user2.get('age', 25)
    
    age_match = (
        user1_prefs.get('age_min', 18) <= user2_age <= user1_prefs.get('age_max', 99) and
        user2_prefs.get('age_min', 18) <= user1_age <= user2_prefs.get('age_max', 99)
    )
    
    # Looking for same thing
    looking_for_match = user1_prefs.get('looking_for') == user2_prefs.get('looking_for')
    
    preference_match = (
        (50 if age_match else 0) +
        (50 if looking_for_match else 0)
    )
    
    # Overall Compatibility
    compatibility_score = (
        game_compatibility * 0.4 +
        skill_compatibility * 0.3 +
        preference_match * 0.3
    )
    
    return MatchScore(
        user1_id=user1['user_id'],
        user2_id=user2['user_id'],
        compatibility_score=round(compatibility_score, 2),
        game_compatibility=round(game_compatibility, 2),
        skill_compatibility=round(skill_compatibility, 2),
        preference_match=round(preference_match, 2),
        shared_interests=list(shared_games)
    )

# Find Matches
@router.get("/find-matches/{user_id}")
async def find_matches(user_id: str, limit: int = 10) -> Dict[str, Any]:
    """
    Find compatible matches for a user based on gaming preferences and skills.
    Queries all profiles from MongoDB and calculates compatibility.
    """
    db = get_database()
    
    user_profile = await db.matchmaking_profiles.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not user_profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    matches = []
    
    # Get all other profiles from database
    other_profiles = await db.matchmaking_profiles.find(
        {"user_id": {"$ne": user_id}},
        {"_id": 0}
    ).to_list(1000)
    
    # Calculate compatibility with all other users
    for other_profile in other_profiles:
        match_score = calculate_compatibility(user_profile, other_profile)
        
        # Only show matches above 30% compatibility
        if match_score.compatibility_score >= 30:
            matches.append({
                "user": other_profile,
                "match_score": match_score.dict()
            })
    
    # Sort by compatibility score
    matches.sort(key=lambda x: x['match_score']['compatibility_score'], reverse=True)
    
    # Return top matches
    return {
        "success": True,
        "matches": matches[:limit],
        "total_found": len(matches)
    }

# Send Match Request
@router.post("/send-request")
async def send_match_request(from_user_id: str, to_user_id: str, message: Optional[str] = None) -> Dict[str, Any]:
    """
    Send a match/connection request to another user.
    Stored in MongoDB for persistence.
    """
    db = get_database()
    
    # Verify both users exist
    from_user = await db.matchmaking_profiles.find_one({"user_id": from_user_id}, {"_id": 0})
    to_user = await db.matchmaking_profiles.find_one({"user_id": to_user_id}, {"_id": 0})
    
    if not from_user or not to_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    request_id = f"req_{secrets.randbelow(90000) + 10000}"
    
    request_data = {
        "request_id": request_id,
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "message": message or "Hey! Want to play together?",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Store in database
    await db.match_requests.insert_one(request_data)
    
    return {
        "success": True,
        "request_id": request_id,
        "message": "Match request sent successfully!"
    }

# Accept/Reject Match Request
@router.post("/respond-request/{request_id}")
async def respond_to_request(request_id: str, accept: bool) -> Dict[str, Any]:
    """
    Accept or reject a match request.
    Updates status in MongoDB.
    """
    db = get_database()
    
    request = await db.match_requests.find_one(
        {"request_id": request_id},
        {"_id": 0}
    )
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if accept:
        # Update to accepted status
        await db.match_requests.update_one(
            {"request_id": request_id},
            {
                "$set": {
                    "status": "accepted",
                    "accepted_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "matched": True,
            "message": "Match accepted! Start playing together!",
            "match": {**request, "status": "accepted"}
        }
    else:
        # Update to declined status
        await db.match_requests.update_one(
            {"request_id": request_id},
            {"$set": {"status": "declined"}}
        )
        
        return {
            "success": True,
            "matched": False,
            "message": "Match declined"
        }

# Get Match Suggestions Based on Recent Game
@router.post("/suggest-from-game")
async def suggest_matches_from_game(user_id: str, game_type: str, performance_score: int) -> Dict[str, Any]:
    """
    Suggest matches based on recent game performance.
    Higher performance = matched with higher skilled players.
    Updates skill scores in MongoDB.
    """
    db = get_database()
    
    user_profile = await db.matchmaking_profiles.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not user_profile:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update user's skill score for this game
    current_skill = user_profile.get('skill_scores', {}).get(game_type, 1000)
    new_skill = current_skill + (performance_score - 50)  # ELO-like adjustment
    new_skill = max(1, new_skill)  # Ensure positive
    
    # Update in database
    await db.matchmaking_profiles.update_one(
        {"user_id": user_id},
        {
            "$set": {
                f"skill_scores.{game_type}": new_skill
            }
        }
    )
    
    # Find players with similar skill in this game
    suggestions = []
    
    # Get all other profiles
    other_profiles = await db.matchmaking_profiles.find(
        {"user_id": {"$ne": user_id}},
        {"_id": 0}
    ).to_list(1000)
    
    for other_profile in other_profiles:
        other_skill = other_profile.get('skill_scores', {}).get(game_type, 1000)
        skill_diff = abs(new_skill - other_skill)
        
        # Match within ±200 skill points
        if skill_diff <= 200:
            # Get updated user profile
            updated_user = await db.matchmaking_profiles.find_one(
                {"user_id": user_id},
                {"_id": 0}
            )
            match_score = calculate_compatibility(updated_user, other_profile)
            suggestions.append({
                "user": other_profile,
                "match_score": match_score.dict(),
                "skill_difference": skill_diff
            })
    
    suggestions.sort(key=lambda x: x['match_score']['compatibility_score'], reverse=True)
    
    return {
        "success": True,
        "suggestions": suggestions[:5],
        "your_new_skill": new_skill,
        "game_type": game_type
    }

# Get Active Matches
@router.get("/matches/{user_id}")
async def get_user_matches(user_id: str) -> Dict[str, Any]:
    """
    Get all accepted matches for a user from MongoDB.
    """
    db = get_database()
    
    matches = await db.match_requests.find(
        {
            "$or": [
                {"from_user_id": user_id},
                {"to_user_id": user_id}
            ],
            "status": "accepted"
        },
        {"_id": 0}
    ).to_list(100)
    
    return {
        "success": True,
        "matches": matches,
        "count": len(matches)
    }

# Get Pending Requests
@router.get("/requests/{user_id}")
async def get_pending_requests(user_id: str) -> Dict[str, Any]:
    """
    Get all pending match requests for a user from MongoDB.
    """
    db = get_database()
    
    requests = await db.match_requests.find(
        {
            "to_user_id": user_id,
            "status": "pending"
        },
        {"_id": 0}
    ).to_list(100)
    
    return {
        "success": True,
        "requests": requests,
        "count": len(requests)
    }

# Update Skill After Game
@router.post("/update-skill")
async def update_skill_after_game(
    user_id: str, 
    game_type: str, 
    won: bool, 
    opponent_skill: Optional[int] = None
) -> Dict[str, Any]:
    """
    Update user's skill rating after a game using ELO-like system.
    Persists to MongoDB for permanent skill tracking.
    """
    db = get_database()
    
    user_profile = await db.matchmaking_profiles.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not user_profile:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_skill = user_profile.get('skill_scores', {}).get(game_type, 1000)
    
    # ELO calculation
    k_factor = 32  # How much ratings change
    expected_score = 0.5  # Default if no opponent skill
    
    if opponent_skill:
        expected_score = 1 / (1 + 10 ** ((opponent_skill - current_skill) / 400))
    
    actual_score = 1 if won else 0
    new_skill = current_skill + k_factor * (actual_score - expected_score)
    
    # Update in database
    await db.matchmaking_profiles.update_one(
        {"user_id": user_id},
        {
            "$set": {
                f"skill_scores.{game_type}": round(new_skill)
            },
            "$inc": {"total_games_played": 1}
        }
    )
    
    return {
        "success": True,
        "old_skill": current_skill,
        "new_skill": round(new_skill),
        "change": round(new_skill - current_skill),
        "game_type": game_type
    }
