"""
Dating System Backend - Profiles, Matching, Chemistry Scoring
Connects gaming to dating experience
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import secrets
secure_random = secrets.SystemRandom()

router = APIRouter(prefix="/dating", tags=["dating"])


# ==================== MODELS ====================

class DatingProfile(BaseModel):
    bio: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    looking_for: Optional[str] = None
    interests: List[str] = []
    favorite_games: List[str] = []
    location: Optional[str] = None
    photos: List[str] = []
    # NEW: Detailed profile fields (1b requirement)
    personality_traits: List[str] = []
    gaming_style: Optional[str] = None  # "Competitive", "Casual", "Strategic", "Social"
    relationship_goals: Optional[str] = None  # "Casual Dating", "Serious Relationship", "Marriage", "Just Friends"


class GameInvite(BaseModel):
    to_user_id: str
    game_type: str
    message: Optional[str] = "Let's play together!"


class ChemistryScore(BaseModel):
    user1_id: str
    user2_id: str
    game_type: str
    score: float
    insights: List[str] = []


# ==================== PROFILE ENDPOINTS ====================

@router.get("/profile/me")
async def get_my_dating_profile(request: Request) -> Dict[str, Any]:
    """Get current user's dating profile"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "dating_profile": 1, "name": 1, "email": 1}
    )
    
    if not user or "dating_profile" not in user:
        # Return empty profile
        return {
            "success": True,
            "profile": None,
            "is_complete": False
        }
    
    return {
        "success": True,
        "profile": user["dating_profile"],
        "is_complete": True
    }


@router.post("/profile/update")
async def update_dating_profile(request: Request, profile: DatingProfile) -> Dict[str, Any]:
    """Update dating profile"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    profile_data = profile.dict()
    profile_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    profile_data["is_active"] = True
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$set": {
                "dating_profile": profile_data,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "message": "Dating profile updated successfully",
        "profile": profile_data
    }


# ==================== DISCOVERY / MATCHING ====================

@router.get("/discover")
async def discover_profiles(request: Request, limit: int = 20) -> Dict[str, Any]:
    """Discover potential matches"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get current user's profile for matching preferences
    user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "dating_profile": 1}
    )
    
    # Get users who are not current user and have dating profiles
    query = {
        "user_id": {"$ne": current_user.user_id},
        "dating_profile.is_active": True
    }
    
    # Apply preferences if user has them
    if user and "dating_profile" in user:
        profile = user["dating_profile"]
        if profile.get("looking_for"):
            query["dating_profile.gender"] = profile["looking_for"]
    
    potential_matches = await db.users.find(
        query,
        {"_id": 0, "user_id": 1, "name": 1, "dating_profile": 1, "avatar": 1}
    ).to_list(limit)
    
    # Shuffle for variety
    secure_random.shuffle(potential_matches)
    
    return {
        "success": True,
        "profiles": potential_matches,
        "count": len(potential_matches)
    }


@router.post("/like/{user_id}")
async def like_profile(request: Request, user_id: str) -> Dict[str, Any]:
    """Like a profile (potential match)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if other user already liked current user (mutual match)
    existing_like = await db.dating_likes.find_one({
        "from_user_id": user_id,
        "to_user_id": current_user.user_id
    })
    
    # Record the like
    await db.dating_likes.insert_one({
        "from_user_id": current_user.user_id,
        "to_user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_mutual": existing_like is not None
    })
    
    is_match = existing_like is not None
    
    if is_match:
        # Create match record
        await db.dating_matches.insert_one({
            "user1_id": current_user.user_id,
            "user2_id": user_id,
            "matched_at": datetime.now(timezone.utc).isoformat(),
            "games_played": 0,
            "chemistry_score": 0,
            "status": "active"
        })
    
    return {
        "success": True,
        "is_match": is_match,
        "message": "It's a match! 🎉" if is_match else "Like sent"
    }


@router.get("/matches")
async def get_matches(request: Request) -> Dict[str, Any]:
    """Get user's matches"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Find all matches
    matches = await db.dating_matches.find({
        "$or": [
            {"user1_id": current_user.user_id},
            {"user2_id": current_user.user_id}
        ],
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    # Get user details for all matches (optimized - single query instead of N+1)
    other_user_ids = [
        match["user2_id"] if match["user1_id"] == current_user.user_id else match["user1_id"]
        for match in matches
    ]
    
    # Batch fetch all users in a single query
    users = await db.users.find(
        {"user_id": {"$in": other_user_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "dating_profile": 1, "avatar": 1}
    ).to_list(len(other_user_ids))
    
    # Create user lookup dictionary for O(1) access
    users_dict = {u["user_id"]: u for u in users}
    
    # Build match list using the dictionary
    match_list = []
    for match in matches:
        other_user_id = match["user2_id"] if match["user1_id"] == current_user.user_id else match["user1_id"]
        other_user = users_dict.get(other_user_id)
        
        if other_user:
            match_list.append({
                "match_id": f"{match['user1_id']}_{match['user2_id']}",
                "user": other_user,
                "matched_at": match["matched_at"],
                "games_played": match.get("games_played", 0),
                "chemistry_score": match.get("chemistry_score", 0)
            })
    
    return {
        "success": True,
        "matches": match_list,
        "count": len(match_list)
    }


# ==================== GAME INVITES ====================

@router.post("/invite/game")
async def send_game_invite(request: Request, invite: GameInvite) -> Dict[str, Any]:
    """Send game invitation to match"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Create game invite
    invite_doc = {
        "from_user_id": current_user.user_id,
        "to_user_id": invite.to_user_id,
        "game_type": invite.game_type,
        "message": invite.message,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.game_invites.insert_one(invite_doc)
    
    # Create response without MongoDB _id
    response_invite = {
        "invite_id": str(result.inserted_id),
        "from_user_id": invite_doc["from_user_id"],
        "to_user_id": invite_doc["to_user_id"],
        "game_type": invite_doc["game_type"],
        "message": invite_doc["message"],
        "status": invite_doc["status"],
        "created_at": invite_doc["created_at"]
    }
    
    return {
        "success": True,
        "message": "Game invite sent!",
        "invite": response_invite
    }


@router.get("/invites")
async def get_game_invites(request: Request) -> Dict[str, Any]:
    """Get pending game invites"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    invites = await db.game_invites.find({
        "to_user_id": current_user.user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(50)
    
    # Get sender details
    for invite in invites:
        sender = await db.users.find_one(
            {"user_id": invite["from_user_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "avatar": 1}
        )
        invite["from_user"] = sender
    
    return {
        "success": True,
        "invites": invites,
        "count": len(invites)
    }


@router.post("/invite/{invite_id}/accept")
async def accept_game_invite(request: Request, invite_id: str) -> Dict[str, Any]:
    """Accept game invitation"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Update invite status
    await db.game_invites.update_one(
        {"invite_id": invite_id, "to_user_id": current_user.user_id},
        {
            "$set": {
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Get invite details to create game room
    invite = await db.game_invites.find_one({"invite_id": invite_id})
    
    return {
        "success": True,
        "message": "Invite accepted!",
        "game_type": invite["game_type"],
        "redirect_to": f"/multiplayer/{invite['game_type']}?dating_mode=true&partner={invite['from_user_id']}"
    }


# ==================== CHEMISTRY SCORING ====================

@router.post("/chemistry/calculate")
async def calculate_chemistry(request: Request, data: dict) -> Dict[str, Any]:
    """Calculate chemistry score after game"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    game_type = data.get("game_type")
    partner_id = data.get("partner_id")
    game_data = data.get("game_data", {})
    
    # Simple chemistry algorithm
    base_score = 50
    
    # Factors that increase chemistry
    if game_data.get("finished_game"):
        base_score += 10
    
    if game_data.get("close_game"):  # Game was close in score
        base_score += 15
    
    if game_data.get("positive_interaction"):  # Chat messages, emojis
        base_score += 10
    
    if game_data.get("good_sportsmanship"):
        base_score += 10
    
    # Game-specific bonuses
    if game_type in ["chess", "checkers", "reversi"]:
        base_score += 5  # Strategy games show intelligence
    
    chemistry_score = min(base_score, 100)
    
    # Generate insights
    insights = []
    if chemistry_score >= 80:
        insights.append("Strong connection detected! 💕")
        insights.append("You two play well together")
    elif chemistry_score >= 60:
        insights.append("Good chemistry! 😊")
        insights.append("Potential for a great match")
    else:
        insights.append("Keep playing to build chemistry")
    
    # Update match record
    db = get_database()
    await db.dating_matches.update_one(
        {
            "$or": [
                {"user1_id": current_user.user_id, "user2_id": partner_id},
                {"user1_id": partner_id, "user2_id": current_user.user_id}
            ]
        },
        {
            "$set": {"chemistry_score": chemistry_score},
            "$inc": {"games_played": 1}
        }
    )
    
    return {
        "success": True,
        "chemistry_score": chemistry_score,
        "insights": insights
    }


@router.get("/icebreakers/{game_type}")
async def get_ice_breakers(game_type: str) -> Dict[str, Any]:
    """Get ice-breaker conversation starters for a game"""
    icebreakers = {
        "uno": [
            "That was intense! Do you always play this competitively? 😄",
            "Wild cards aside, what's your idea of a wild night out?",
            "If we weren't playing UNO, what game would you want to play on a date?"
        ],
        "chess": [
            "Impressive strategy! Are you a planner in life too?",
            "That opening move was bold. Do you take risks in real life?",
            "Chess and coffee - would that make a good first date?"
        ],
        "poker": [
            "Great poker face! What else are you good at hiding? 😉",
            "Bluffing aside, what's something genuine about you?",
            "High stakes - would you take a chance on dinner with me?"
        ],
        "hearts": [
            "You avoided hearts well - but would you take a chance on mine? 💕",
            "That was fun! Want to grab coffee and play another round?",
            "Queen of Spades aside, what's your idea of the perfect date?"
        ],
        "tictactoe": [
            "Simple but fun! What's your favorite simple pleasure?",
            "X marks the spot - where would you want to go on a date?",
            "Three in a row - breakfast, lunch, and dinner dates? 😊"
        ]
    }
    
    return {
        "success": True,
        "icebreakers": icebreakers.get(game_type, [
            "That was fun! Want to play again sometime?",
            "Great game! What else do you enjoy doing?",
            "You're pretty good at this! Coffee to celebrate?"
        ])
    }
