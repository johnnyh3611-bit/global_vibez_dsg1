from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import secrets
secure_random = secrets.SystemRandom()
from uuid import uuid4

router = APIRouter()

# Pydantic Models
class VibeRequest(BaseModel):
    from_user_id: str
    to_user_id: str
    vibe_type: str = "drink"  # drink, invite, match
    message: Optional[str] = None

class SwipeAction(BaseModel):
    user_id: str
    target_user_id: str
    action: str  # accept, reject

class NearbyPlayersRequest(BaseModel):
    user_id: str
    game_id: Optional[str] = None
    table_id: Optional[str] = None
    radius_km: int = 10

class MatchResponse(BaseModel):
    id: str
    name: str
    age: int
    image: str
    location: str
    compatibility: int
    status: str
    online: bool
    bio: Optional[str] = None
    interests: List[str] = []

# Mock Database (replace with MongoDB)
mock_users = {
    "user1": {
        "id": "user1",
        "name": "Alex",
        "age": 26,
        "image": "👩",
        "location": "2.3 km away",
        "status": "Playing Poker",
        "online": True,
        "bio": "Love high-stakes games and good vibes. Looking for someone to match my energy at the tables! 🎰✨",
        "interests": ["Poker", "Blackjack", "EDM", "Travel"],
        "current_game": "poker",
        "current_table": "table_vip_1"
    },
    "user2": {
        "id": "user2",
        "name": "Jordan",
        "age": 28,
        "image": "🧑",
        "location": "4.1 km away",
        "status": "Winning at Craps",
        "online": True,
        "bio": "Professional poker player & stream enthusiast. Let's vibe and see where the chips fall! 🎲",
        "interests": ["Craps", "Streaming", "Music", "Fitness"],
        "current_game": "craps",
        "current_table": "table_main_2"
    },
    "user3": {
        "id": "user3",
        "name": "Sam",
        "age": 25,
        "image": "👨",
        "location": "1.7 km away",
        "status": "In the Lounge",
        "online": True,
        "bio": "Here for the social scene and epic wins. Always down for a friendly match! 🏆",
        "interests": ["Roulette", "Dating", "Coffee", "Gaming"],
        "current_game": None,
        "current_table": None
    }
}

mock_vibes = []  # Store sent vibes
mock_matches = []  # Store matched users

# Helper Functions
def calculate_compatibility(user1_id: str, user2_id: str) -> int:
    """Calculate compatibility score between two users (0-100)"""
    # Simple mock algorithm (replace with ML model)
    user1 = mock_users.get(user1_id)
    user2 = mock_users.get(user2_id)
    
    if not user1 or not user2:
        return 0
    
    # Compare interests
    common_interests = set(user1.get("interests", [])) & set(user2.get("interests", []))
    interest_score = len(common_interests) * 15
    
    # Age proximity
    age_diff = abs(user1.get("age", 25) - user2.get("age", 25))
    age_score = max(0, 30 - age_diff * 3)
    
    # Random factor for variety
    random_score = 20 + secrets.randbelow(21)
    
    return min(100, interest_score + age_score + random_score)

# API Endpoints

@router.get("/social/matches")
async def get_matches(user_id: str, limit: int = 10) -> Dict[str, Any]:
    """Get potential matches for a user"""
    try:
        matches = []
        
        for uid, user in mock_users.items():
            if uid != user_id:
                compatibility = calculate_compatibility(user_id, uid)
                matches.append({
                    "id": uid,
                    "name": user["name"],
                    "age": user["age"],
                    "image": user["image"],
                    "location": user["location"],
                    "compatibility": compatibility,
                    "status": user["status"],
                    "online": user["online"],
                    "bio": user.get("bio"),
                    "interests": user.get("interests", [])
                })
        
        # Sort by compatibility
        matches.sort(key=lambda x: x["compatibility"], reverse=True)
        
        return {"matches": matches[:limit], "total": len(matches)}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/social/swipe")
async def swipe_action(swipe: SwipeAction) -> Dict[str, Any]:
    """Handle swipe actions (accept/reject)"""
    try:
        target_user = mock_users.get(swipe.target_user_id)
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if swipe.action == "accept":
            # Check if target user also swiped right (mock check)
            is_match = secure_random.random() > 0.5  # 50% match rate for demo
            
            if is_match:
                match_data = {
                    "match_id": str(uuid4()),
                    "user1_id": swipe.user_id,
                    "user2_id": swipe.target_user_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "compatibility": calculate_compatibility(swipe.user_id, swipe.target_user_id)
                }
                mock_matches.append(match_data)
                
                return {
                    "status": "matched",
                    "message": f"It's a match with {target_user['name']}!",
                    "match": match_data
                }
            else:
                return {
                    "status": "liked",
                    "message": f"You liked {target_user['name']}. Waiting for response."
                }
        
        elif swipe.action == "reject":
            return {
                "status": "rejected",
                "message": "Moved to next profile"
            }
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/social/send-vibe")
async def send_vibe(vibe: VibeRequest) -> Dict[str, Any]:
    """Send a vibe (virtual drink, invite, etc.) to another user"""
    try:
        target_user = mock_users.get(vibe.to_user_id)
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        vibe_data = {
            "vibe_id": str(uuid4()),
            "from_user_id": vibe.from_user_id,
            "to_user_id": vibe.to_user_id,
            "vibe_type": vibe.vibe_type,
            "message": vibe.message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "sent"
        }
        
        mock_vibes.append(vibe_data)
        
        vibe_messages = {
            "drink": f"🍹 Virtual drink sent to {target_user['name']}!",
            "invite": f"📨 Table invite sent to {target_user['name']}!",
            "match": f"💕 Match request sent to {target_user['name']}!"
        }
        
        return {
            "status": "success",
            "message": vibe_messages.get(vibe.vibe_type, "Vibe sent!"),
            "vibe": vibe_data
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/social/nearby-players")
async def get_nearby_players(request: NearbyPlayersRequest) -> Dict[str, Any]:
    """Get players near the user (at same table or game)"""
    try:
        nearby = []
        
        for uid, user in mock_users.items():
            if uid == request.user_id:
                continue
            
            # Filter by game/table if specified
            if request.game_id and user.get("current_game") != request.game_id:
                continue
            
            if request.table_id and user.get("current_table") != request.table_id:
                continue
            
            compatibility = calculate_compatibility(request.user_id, uid)
            
            nearby.append({
                "id": uid,
                "name": user["name"],
                "image": user["image"],
                "compatibility": compatibility,
                "status": user["status"],
                "online": user["online"],
                "current_game": user.get("current_game"),
                "current_table": user.get("current_table")
            })
        
        return {"players": nearby, "total": len(nearby)}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/social/my-matches")
async def get_my_matches(user_id: str) -> Dict[str, Any]:
    """Get list of users I've matched with"""
    try:
        user_matches = [
            match for match in mock_matches 
            if match["user1_id"] == user_id or match["user2_id"] == user_id
        ]
        
        return {"matches": user_matches, "total": len(user_matches)}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/social/received-vibes")
async def get_received_vibes(user_id: str) -> Dict[str, Any]:
    """Get vibes sent to this user"""
    try:
        received = [
            vibe for vibe in mock_vibes 
            if vibe["to_user_id"] == user_id
        ]
        
        return {"vibes": received, "total": len(received)}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
