from fastapi import APIRouter, HTTPException, Request
from typing import List, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from utils.compatibility import calculate_friends_compatibility, calculate_dating_compatibility
from datetime import datetime, timezone

router = APIRouter(prefix="/matching", tags=["matching"])

# ==================== MODELS ====================

class SwipeAction(BaseModel):
    target_user_id: str
    action: str  # "like" or "dislike"

class FriendMatch(BaseModel):
    match_id: str
    user_id_1: str
    user_id_2: str
    both_ids: List[str]
    compatibility_score: float
    created_at: str

# ==================== FRIEND MATCHING ====================

@router.get("/friends/discover")
async def get_friend_matches(request: Request, limit: int = 20) -> Dict[str, Any]:
    """Get potential friend matches with compatibility scores"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if user has completed friends quiz
    user_doc = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not user_doc or not user_doc.get("quiz_friends_completed"):
        raise HTTPException(
            status_code=400,
            detail="Please complete the Friend Compatibility Quiz first!"
        )
    
    user_answers = user_doc.get("quiz_friends_answers", {})
    
    # Get users already swiped on (for friends) - paginated for performance
    friend_swipes = await db.friend_swipes.find(
        {"user_id": current_user.user_id},
        {"target_user_id": 1, "_id": 0}
    ).to_list(1000)  # Reasonable limit instead of 10000
    swiped_ids = [s["target_user_id"] for s in friend_swipes]
    
    # Get existing friend matches - paginated for performance
    friend_matches = await db.friend_matches.find(
        {"both_ids": current_user.user_id},
        {"_id": 0}
    ).to_list(500)  # Reasonable limit instead of 1000
    matched_ids = []
    for match in friend_matches:
        other_id = match["user_id_1"] if match["user_id_2"] == current_user.user_id else match["user_id_2"]
        matched_ids.append(other_id)
    
    # Build query to find potential friends
    exclude_ids = list(set(swiped_ids + matched_ids + [current_user.user_id]))
    
    query = {
        "user_id": {"$nin": exclude_ids},
        "quiz_friends_completed": True,
        "profile_completed": True
    }
    
    # Get potential matches
    potential_matches = await db.users.find(query, {"_id": 0}).to_list(limit * 3)
    
    # Calculate compatibility scores
    matches_with_scores = []
    for other_user in potential_matches:
        other_answers = other_user.get("quiz_friends_answers", {})
        
        if not other_answers:
            continue
        
        compatibility = calculate_friends_compatibility(user_answers, other_answers)
        
        # Only show matches with >30% compatibility
        if compatibility["score"] >= 30:
            other_user["compatibility_score"] = compatibility["score"]
            other_user["compatibility_breakdown"] = compatibility["breakdown"]
            other_user["compatibility_matches"] = compatibility["matches"]
            matches_with_scores.append(other_user)
    
    # Sort by compatibility score (highest first)
    matches_with_scores.sort(key=lambda x: x["compatibility_score"], reverse=True)
    
    # Return top matches
    return matches_with_scores[:limit]


@router.post("/friends/swipe")
async def swipe_friend(swipe_data: SwipeAction, request: Request) -> Dict[str, Any]:
    """Swipe on a potential friend"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get user data for swipe limit check
    user_doc = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "subscription_tier": 1, "swipes_today": 1, "last_swipe_reset": 1, "swipes_limit": 1}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check swipe limits for free users
    subscription_tier = user_doc.get("subscription_tier", "free")
    
    if subscription_tier == "free":
        # Reset swipe count if it's a new day
        today_date = datetime.now(timezone.utc).date().isoformat()
        last_reset = user_doc.get("last_swipe_reset")
        swipes_today = user_doc.get("swipes_today", 0)
        swipes_limit = user_doc.get("swipes_limit", 20)
        
        if last_reset != today_date:
            # Reset swipes for new day
            swipes_today = 0
            await db.users.update_one(
                {"user_id": current_user.user_id},
                {"$set": {
                    "swipes_today": 0,
                    "last_swipe_reset": today_date
                }}
            )
        
        # Check if limit reached
        if swipes_today >= swipes_limit:
            raise HTTPException(
                status_code=429,
                detail=f"You've reached your daily swipe limit of {swipes_limit} swipes. Upgrade to Premium for unlimited swipes!"
            )
        
        # Increment swipe count
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {"$inc": {"swipes_today": 1}}
        )
        swipes_today += 1
        swipes_remaining = swipes_limit - swipes_today
    else:
        # Premium/Plus users have unlimited swipes
        swipes_remaining = None
    
    # Check if already swiped
    existing_swipe = await db.friend_swipes.find_one({
        "user_id": current_user.user_id,
        "target_user_id": swipe_data.target_user_id
    })
    
    if existing_swipe:
        raise HTTPException(status_code=400, detail="Already swiped on this user")
    
    # Create swipe record
    swipe = {
        "swipe_id": f"fswipe_{datetime.now(timezone.utc).timestamp()}",
        "user_id": current_user.user_id,
        "target_user_id": swipe_data.target_user_id,
        "action": swipe_data.action,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.friend_swipes.insert_one(swipe)
    
    # Check for mutual match (if action == "like")
    is_match = False
    match_data = None
    
    if swipe_data.action == "like":
        # Check if target user also liked current user
        mutual_like = await db.friend_swipes.find_one({
            "user_id": swipe_data.target_user_id,
            "target_user_id": current_user.user_id,
            "action": "like"
        })
        
        if mutual_like:
            # It's a friend match!
            is_match = True
            
            # Calculate compatibility score
            user1_doc = await db.users.find_one(
                {"user_id": current_user.user_id},
                {"_id": 0, "quiz_friends_answers": 1}
            )
            user2_doc = await db.users.find_one(
                {"user_id": swipe_data.target_user_id},
                {"_id": 0, "quiz_friends_answers": 1}
            )
            
            compatibility = calculate_friends_compatibility(
                user1_doc.get("quiz_friends_answers", {}),
                user2_doc.get("quiz_friends_answers", {})
            )
            
            # Create friend match
            match = {
                "match_id": f"fmatch_{datetime.now(timezone.utc).timestamp()}",
                "user_id_1": current_user.user_id,
                "user_id_2": swipe_data.target_user_id,
                "both_ids": [current_user.user_id, swipe_data.target_user_id],
                "compatibility_score": compatibility["score"],
                "compatibility_breakdown": compatibility["breakdown"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.friend_matches.insert_one(match)
            
            match_data = {
                "match_id": match["match_id"],
                "compatibility_score": compatibility["score"],
                "other_user": user2_doc
            }
    
    return {
        "is_match": is_match,
        "match_data": match_data,
        "swipes_remaining": swipes_remaining
    }


@router.get("/friends/my-matches")
async def get_my_friend_matches(request: Request) -> Dict[str, Any]:
    """Get user's friend matches"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get all friend matches
    matches = await db.friend_matches.find(
        {"both_ids": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Get other user details (optimized - batch query instead of N+1)
    other_user_ids = [
        match["user_id_1"] if match["user_id_2"] == current_user.user_id else match["user_id_2"]
        for match in matches
    ]
    
    # Batch fetch all users in a single query
    users = await db.users.find(
        {"user_id": {"$in": other_user_ids}},
        {"_id": 0}
    ).to_list(len(other_user_ids))
    
    # Create user lookup dictionary
    users_dict = {u["user_id"]: u for u in users}
    
    # Build result using dictionary
    result = []
    for match in matches:
        other_user_id = match["user_id_1"] if match["user_id_2"] == current_user.user_id else match["user_id_2"]
        other_user = users_dict.get(other_user_id)
        
        if other_user:
            result.append({
                "match_id": match["match_id"],
                "compatibility_score": match.get("compatibility_score", 0),
                "created_at": match["created_at"],
                "user": other_user
            })
    
    # Sort by compatibility score
    result.sort(key=lambda x: x["compatibility_score"], reverse=True)
    
    return result


# ==================== DATING MATCHING ====================

@router.get("/dating/discover")
async def get_dating_matches(request: Request, limit: int = 10) -> Dict[str, Any]:
    """Get potential dating matches with compatibility scores"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if user has completed dating quiz
    user_doc = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not user_doc or not user_doc.get("quiz_dating_completed"):
        # Return matches without compatibility scores
        return await get_basic_matches(current_user, db, limit)
    
    user_answers = user_doc.get("quiz_dating_answers", {})
    prefs = user_doc.get("preferences", {})
    
    # Get users already swiped on
    swipes = await db.swipes.find(
        {"user_id": current_user.user_id},
        {"target_user_id": 1, "_id": 0}
    ).to_list(10000)
    swiped_ids = [s["target_user_id"] for s in swipes]
    
    # Build query
    query = {
        "user_id": {"$ne": current_user.user_id, "$nin": swiped_ids},
        "profile_completed": True,
    }
    
    # Apply preferences
    if prefs.get("min_age") and prefs.get("max_age"):
        query["age"] = {"$gte": prefs["min_age"], "$lte": prefs["max_age"]}
    
    if prefs.get("interested_in") != "everyone":
        if prefs["interested_in"] == "men":
            query["gender"] = "male"
        elif prefs["interested_in"] == "women":
            query["gender"] = "female"
    
    # Get potential matches
    potential_matches = await db.users.find(query, {"_id": 0}).to_list(limit * 3)
    
    # Calculate compatibility scores for those who completed quiz
    matches_with_scores = []
    for other_user in potential_matches:
        other_answers = other_user.get("quiz_dating_answers", {})
        
        if other_answers:
            compatibility = calculate_dating_compatibility(user_answers, other_answers)
            other_user["compatibility_score"] = compatibility["score"]
            other_user["compatibility_breakdown"] = compatibility["breakdown"]
            other_user["compatibility_matches"] = compatibility["matches"]
        else:
            other_user["compatibility_score"] = None
        
        matches_with_scores.append(other_user)
    
    # Sort by compatibility score (highest first), nulls last
    matches_with_scores.sort(
        key=lambda x: (x["compatibility_score"] is None, -(x["compatibility_score"] or 0))
    )
    
    return matches_with_scores[:limit]


async def get_basic_matches(current_user, db, limit) -> Dict[str, Any]:
    """Get basic matches without compatibility scores"""
    prefs = current_user.preferences
    
    # Get already swiped users
    swipes = await db.swipes.find(
        {"user_id": current_user.user_id},
        {"target_user_id": 1, "_id": 0}
    ).to_list(10000)
    swiped_ids = [s["target_user_id"] for s in swipes]
    
    # Build query
    query = {
        "user_id": {"$ne": current_user.user_id, "$nin": swiped_ids},
        "profile_completed": True,
    }
    
    # Apply age filter
    if prefs.min_age and prefs.max_age:
        query["age"] = {"$gte": prefs.min_age, "$lte": prefs.max_age}
    
    # Apply gender preference
    if prefs.interested_in != "everyone":
        if prefs.interested_in == "men":
            query["gender"] = "male"
        elif prefs.interested_in == "women":
            query["gender"] = "female"
    
    # Get potential matches
    potential_matches = await db.users.find(query, {"_id": 0}).to_list(limit)
    
    # Add null compatibility score
    for match in potential_matches:
        match["compatibility_score"] = None
    
    return potential_matches
