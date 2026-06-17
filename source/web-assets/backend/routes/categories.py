from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any
from utils.database import get_database, get_current_user

router = APIRouter(prefix="/categories", tags=["categories"])

# Category definitions
RELATIONSHIP_INTENTS = [
    {"id": "serious", "label": "Serious Relationship", "emoji": "💕", "description": "Looking for a long-term partner"},
    {"id": "casual", "label": "Casual Dating", "emoji": "🎉", "description": "Keep things light and fun"},
    {"id": "friendship", "label": "Friendship", "emoji": "🤝", "description": "Looking to make new friends"},
    {"id": "chatting", "label": "Just Chatting", "emoji": "💬", "description": "Open to conversation"},
    {"id": "open", "label": "Open to Anything", "emoji": "🌟", "description": "See where things go"},
]

INTEREST_CATEGORIES = [
    {"id": "fitness", "label": "Fitness & Sports", "emoji": "🏃", "description": "Active lifestyle enthusiasts"},
    {"id": "foodie", "label": "Foodies", "emoji": "🍕", "description": "Love trying new restaurants"},
    {"id": "travel", "label": "Travel Lovers", "emoji": "✈️", "description": "Adventure seekers and explorers"},
    {"id": "gaming", "label": "Gamers", "emoji": "🎮", "description": "Video game enthusiasts"},
    {"id": "books", "label": "Book Worms", "emoji": "📚", "description": "Avid readers and literary fans"},
    {"id": "arts", "label": "Creative Arts", "emoji": "🎨", "description": "Artists, designers, and creatives"},
    {"id": "music", "label": "Music Fans", "emoji": "🎵", "description": "Concert goers and music lovers"},
    {"id": "movies", "label": "Movie Buffs", "emoji": "🎬", "description": "Film enthusiasts and cinema lovers"},
]


@router.get("/all")
async def get_all_categories() -> Dict[str, Any]:
    """Get all available categories"""
    return {
        "relationship_intents": RELATIONSHIP_INTENTS,
        "interest_categories": INTEREST_CATEGORIES
    }


@router.get("/discover/{category_type}/{category_id}")
async def discover_by_category(
    category_type: str,
    category_id: str,
    request: Request,
    limit: int = 20
) -> Dict[str, Any]:
    """
    Discover users by category
    category_type: 'intent' or 'interest'
    category_id: the category identifier
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Build query based on category type
    if category_type == "intent":
        query = {"relationship_intent": category_id}
    elif category_type == "interest":
        query = {"interest_categories": category_id}
    else:
        raise HTTPException(status_code=400, detail="Invalid category_type. Use 'intent' or 'interest'")
    
    # Exclude current user and users already swiped on
    query["user_id"] = {"$ne": current_user.user_id}
    
    # Get users current user has already swiped on
    swiped_users = await db.swipes.find(
        {"user_id": current_user.user_id},
        {"_id": 0, "target_user_id": 1}
    ).to_list(10000)
    swiped_user_ids = [s["target_user_id"] for s in swiped_users]
    
    if swiped_user_ids:
        query["user_id"]["$nin"] = swiped_user_ids
    
    # Fetch users
    users = await db.users.find(query, {"_id": 0}).to_list(limit)
    
    return {
        "category_type": category_type,
        "category_id": category_id,
        "users": users,
        "count": len(users)
    }


@router.get("/stats")
async def get_category_stats(request: Request) -> Dict[str, Any]:
    """Get user count statistics for each category"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get relationship intent stats
    intent_stats = {}
    for intent in RELATIONSHIP_INTENTS:
        count = await db.users.count_documents({
            "relationship_intent": intent["id"],
            "profile_completed": True
        })
        intent_stats[intent["id"]] = {
            "label": intent["label"],
            "emoji": intent["emoji"],
            "count": count
        }
    
    # Get interest category stats
    interest_stats = {}
    for interest in INTEREST_CATEGORIES:
        count = await db.users.count_documents({
            "interest_categories": interest["id"],
            "profile_completed": True
        })
        interest_stats[interest["id"]] = {
            "label": interest["label"],
            "emoji": interest["emoji"],
            "count": count
        }
    
    return {
        "relationship_intents": intent_stats,
        "interest_categories": interest_stats
    }
