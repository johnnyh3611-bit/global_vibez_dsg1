from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from utils.group_planner import (
    select_compatible_group,
    analyze_group_preferences,
    generate_activity_suggestions_ai
)
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/group-planner", tags=["group_planner"])

# ==================== MODELS ====================

class GroupSuggestion(BaseModel):
    group_size: Optional[int] = None
    location: Optional[str] = None

# ==================== ENDPOINTS ====================

@router.post("/generate-suggestion")
async def generate_group_suggestion(suggestion: GroupSuggestion, request: Request) -> Dict[str, Any]:
    """
    Generate AI-powered group outing suggestion
    Automatically selects compatible friends and suggests activities
    """
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
            detail="Please complete the Friend Compatibility Quiz first to get personalized suggestions!"
        )
    
    # Get user's friend matches
    friend_matches = await db.friend_matches.find(
        {"both_ids": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    if len(friend_matches) < 2:
        raise HTTPException(
            status_code=400,
            detail="You need at least 2 friend matches to generate group outing suggestions. Keep swiping!"
        )
    
    # Get detailed friend data
    detailed_friends = []
    for match in friend_matches:
        other_user_id = match["user_id_1"] if match["user_id_2"] == current_user.user_id else match["user_id_2"]
        
        other_user = await db.users.find_one(
            {"user_id": other_user_id},
            {"_id": 0}
        )
        
        if other_user:
            detailed_friends.append({
                "match_id": match["match_id"],
                "compatibility_score": match.get("compatibility_score", 0),
                "user": other_user
            })
    
    # Select compatible group
    min_size = suggestion.group_size or 3
    max_size = suggestion.group_size or 6
    
    group_data = select_compatible_group(
        current_user.user_id,
        detailed_friends,
        min_size=min_size,
        max_size=max_size
    )
    
    if not group_data:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough friend matches to form a group of {min_size}. Keep making friends!"
        )
    
    # Analyze group preferences
    user_quiz_answers = user_doc.get("quiz_friends_answers", {})
    preferences = analyze_group_preferences(group_data["members"], user_quiz_answers)
    
    # Generate AI-powered activity suggestions
    location = suggestion.location or user_doc.get("location", "your city")
    ai_suggestions = generate_activity_suggestions_ai(group_data, preferences, location)
    
    # Create suggestion record
    suggestion_record = {
        "suggestion_id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "group_members": [m["user"]["user_id"] for m in group_data["members"]],
        "group_size": group_data["group_size"],
        "avg_compatibility": group_data["avg_compatibility"],
        "common_interests": group_data.get("common_interests", []),
        "activity_suggestions": ai_suggestions["suggestions"],
        "generated_by": ai_suggestions["generated_by"],
        "location": location,
        "status": "pending",  # pending, accepted, declined
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Store in database
    await db.group_suggestions.insert_one(suggestion_record)
    
    # Prepare response with user details
    group_members_info = []
    for member in group_data["members"]:
        user = member["user"]
        group_members_info.append({
            "user_id": user["user_id"],
            "name": user.get("name", "Friend"),
            "photo": user.get("photos", [None])[0],
            "compatibility_score": member["compatibility_score"]
        })
    
    return {
        "suggestion_id": suggestion_record["suggestion_id"],
        "group": {
            "members": group_members_info,
            "size": group_data["group_size"],
            "avg_compatibility": group_data["avg_compatibility"],
            "common_interests": group_data.get("common_interests", [])
        },
        "activity_suggestions": ai_suggestions["suggestions"],
        "preferences_analysis": preferences,
        "generated_by": ai_suggestions["generated_by"]
    }


@router.get("/my-suggestions")
async def get_my_suggestions(request: Request, limit: int = 10) -> Dict[str, Any]:
    """Get user's group outing suggestions"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get suggestions
    suggestions = await db.group_suggestions.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enhance with user details
    for suggestion in suggestions:
        members_info = []
        for member_id in suggestion.get("group_members", []):
            user = await db.users.find_one(
                {"user_id": member_id},
                {"_id": 0, "user_id": 1, "name": 1, "photos": 1}
            )
            if user:
                members_info.append({
                    "user_id": user["user_id"],
                    "name": user.get("name", "Friend"),
                    "photo": user.get("photos", [None])[0]
                })
        
        suggestion["members_info"] = members_info
    
    return suggestions


@router.post("/accept-suggestion/{suggestion_id}")
async def accept_suggestion(suggestion_id: str, activity_index: int, request: Request) -> Dict[str, Any]:
    """
    Accept a suggestion and create a group event
    activity_index: which activity from the suggestions to use (0, 1, or 2)
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get suggestion
    suggestion = await db.group_suggestions.find_one(
        {"suggestion_id": suggestion_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    if suggestion["status"] == "accepted":
        raise HTTPException(status_code=400, detail="Suggestion already accepted")
    
    # Get selected activity
    activities = suggestion.get("activity_suggestions", [])
    if activity_index < 0 or activity_index >= len(activities):
        raise HTTPException(status_code=400, detail="Invalid activity index")
    
    selected_activity = activities[activity_index]
    
    # Create group event
    event = {
        "event_id": str(uuid.uuid4()),
        "creator_id": current_user.user_id,
        "title": selected_activity["name"],
        "description": f"{selected_activity['description']}\n\nWhy this is perfect: {selected_activity.get('why_perfect', 'Great for your group!')}",
        "event_type": "group_outing",
        "venue_type": selected_activity.get("venue_type", "TBD"),
        "best_time": selected_activity.get("best_time", "TBD"),
        "duration": selected_activity.get("duration", "2-3 hours"),
        "cost_per_person": selected_activity.get("cost_per_person", "TBD"),
        "vibe": selected_activity.get("vibe", "social"),
        "location": suggestion.get("location", "TBD"),
        "date": None,  # To be set by organizer
        "invited_users": suggestion["group_members"],
        "confirmed_users": [current_user.user_id],
        "status": "pending",
        "ai_generated": True,
        "suggestion_id": suggestion_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert event
    await db.group_events.insert_one(event)
    
    # Update suggestion status
    await db.group_suggestions.update_one(
        {"suggestion_id": suggestion_id},
        {"$set": {
            "status": "accepted",
            "selected_activity_index": activity_index,
            "event_id": event["event_id"],
            "accepted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Send invitations to group members
    for member_id in suggestion["group_members"]:
        invitation = {
            "invitation_id": str(uuid.uuid4()),
            "event_id": event["event_id"],
            "from_user_id": current_user.user_id,
            "to_user_id": member_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.event_invitations.insert_one(invitation)
    
    return {
        "message": "Group event created successfully!",
        "event_id": event["event_id"],
        "activity": selected_activity,
        "invited_count": len(suggestion["group_members"])
    }


@router.get("/suggestion/{suggestion_id}")
async def get_suggestion_details(suggestion_id: str, request: Request) -> Dict[str, Any]:
    """Get detailed information about a specific suggestion"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    suggestion = await db.group_suggestions.find_one(
        {"suggestion_id": suggestion_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    # Get member details
    members_info = []
    for member_id in suggestion.get("group_members", []):
        user = await db.users.find_one(
            {"user_id": member_id},
            {"_id": 0}
        )
        if user:
            members_info.append(user)
    
    suggestion["members_details"] = members_info
    
    return suggestion
