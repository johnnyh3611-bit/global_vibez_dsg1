"""
Enhanced Dating Profile System with Advanced Features
"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
from utils.cache import cache
import base64

router = APIRouter(prefix="/dating/profile", tags=["dating-profile"])


# Enhanced Profile Models
class InterestTag(BaseModel):
    category: str  # 'hobby', 'music', 'food', 'sport', etc.
    name: str
    
class PersonalityTrait(BaseModel):
    trait: str  # 'adventurous', 'introverted', 'creative', etc.
    score: float  # 0-1

class ProfileMediaItem(BaseModel):
    type: str  # 'photo', 'video'
    url: str
    caption: Optional[str] = None
    order: int = 0

class EnhancedProfileUpdate(BaseModel):
    bio: Optional[str] = None
    interests: Optional[List[InterestTag]] = None
    personality_traits: Optional[List[PersonalityTrait]] = None
    looking_for: Optional[str] = None
    relationship_goals: Optional[str] = None  # 'casual', 'serious', 'friendship', 'unsure'
    life_stage: Optional[str] = None  # 'student', 'professional', 'entrepreneur', etc.
    values: Optional[List[str]] = None  # 'family', 'career', 'adventure', etc.
    ideal_date: Optional[str] = None
    conversation_starters: Optional[List[str]] = None
    deal_breakers: Optional[List[str]] = None


@router.get("/enhanced")
async def get_enhanced_profile(request: Request) -> Dict[str, Any]:
    """Get user's enhanced dating profile"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check cache first
    cache_key = f"profile:{user.user_id}"
    cached_profile = cache.get(cache_key)
    if cached_profile:
        return cached_profile
    
    profile = await db.dating_profiles.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    
    if not profile:
        # Create default enhanced profile
        profile = {
            "user_id": user.user_id,
            "bio": "",
            "interests": [],
            "personality_traits": [],
            "looking_for": "everyone",
            "relationship_goals": "unsure",
            "life_stage": "professional",
            "values": [],
            "ideal_date": "",
            "conversation_starters": [],
            "deal_breakers": [],
            "media": [],
            "profile_completion": 0,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        await db.dating_profiles.insert_one({**profile, "_id": user.user_id})
    
    # Calculate profile completion
    completion = calculate_profile_completion(profile)
    profile["profile_completion"] = completion
    
    # Cache for 5 minutes
    cache.set(cache_key, profile, ttl=300)
    
    return profile


@router.put("/enhanced")
async def update_enhanced_profile(request: Request, update: EnhancedProfileUpdate) -> Dict[str, Any]:
    """Update enhanced dating profile"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["last_updated"] = datetime.now(timezone.utc).isoformat()
    
    await db.dating_profiles.update_one(
        {"user_id": user.user_id},
        {"$set": update_data},
        upsert=True
    )
    
    # Invalidate cache
    cache.delete(f"profile:{user.user_id}")
    
    # Recalculate compatibility scores with all matches
    await recalculate_compatibility_scores(user.user_id, db)
    
    return {"message": "Profile updated successfully", "profile_completion": calculate_profile_completion(update_data)}


@router.post("/media/upload")
async def upload_profile_media(
    request: Request,
    file: UploadFile = File(...),
    caption: Optional[str] = None,
    media_type: str = "photo"
):
    """Upload profile photo or video"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate file type
    allowed_types = {
        "photo": ["image/jpeg", "image/png", "image/webp"],
        "video": ["video/mp4", "video/quicktime", "video/webm"]
    }
    
    if file.content_type not in allowed_types.get(media_type, []):
        raise HTTPException(status_code=400, detail=f"Invalid file type for {media_type}")
    
    # Read file and encode
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    
    # Store in database (in production, use cloud storage)
    db = get_database()
    media_id = f"media_{user.user_id}_{datetime.now().timestamp()}"
    
    media_doc = {
        "media_id": media_id,
        "user_id": user.user_id,
        "type": media_type,
        "data": base64.b64encode(content).decode(),
        "content_type": file.content_type,
        "caption": caption,
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.profile_media.insert_one(media_doc)
    
    # Update profile media list
    await db.dating_profiles.update_one(
        {"user_id": user.user_id},
        {"$push": {"media": {
            "media_id": media_id,
            "type": media_type,
            "caption": caption
        }}}
    )
    
    # Invalidate cache
    cache.delete(f"profile:{user.user_id}")
    
    return {"message": "Media uploaded", "media_id": media_id}


@router.get("/suggestions")
async def get_profile_suggestions(request: Request) -> Dict[str, Any]:
    """Get AI-powered suggestions to improve profile"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    profile = await db.dating_profiles.find_one({"user_id": user.user_id}, {"_id": 0})
    
    if not profile:
        return {"suggestions": ["Complete your bio", "Add interests", "Upload photos"]}
    
    suggestions = []
    
    # Check what's missing
    if not profile.get("bio") or len(profile.get("bio", "")) < 50:
        suggestions.append("Add a detailed bio (at least 50 characters)")
    
    if not profile.get("interests") or len(profile.get("interests", [])) < 3:
        suggestions.append("Add at least 3 interests to help with matching")
    
    if not profile.get("media") or len(profile.get("media", [])) < 2:
        suggestions.append("Upload at least 2 photos or videos")
    
    if not profile.get("conversation_starters"):
        suggestions.append("Add conversation starters to break the ice")
    
    if not profile.get("ideal_date"):
        suggestions.append("Describe your ideal date")
    
    if not profile.get("values") or len(profile.get("values", [])) == 0:
        suggestions.append("Add your core values")
    
    return {"suggestions": suggestions, "profile_completion": calculate_profile_completion(profile)}


def calculate_profile_completion(profile: dict) -> int:
    """Calculate profile completion percentage"""
    total_fields = 10
    completed = 0
    
    if profile.get("bio") and len(profile.get("bio")) >= 50:
        completed += 1
    if profile.get("interests") and len(profile.get("interests")) >= 3:
        completed += 1
    if profile.get("personality_traits") and len(profile.get("personality_traits")) >= 3:
        completed += 1
    if profile.get("relationship_goals"):
        completed += 1
    if profile.get("life_stage"):
        completed += 1
    if profile.get("values") and len(profile.get("values")) >= 2:
        completed += 1
    if profile.get("ideal_date"):
        completed += 1
    if profile.get("conversation_starters") and len(profile.get("conversation_starters")) >= 2:
        completed += 1
    if profile.get("media") and len(profile.get("media")) >= 2:
        completed += 1
    if profile.get("deal_breakers"):
        completed += 1
    
    return int((completed / total_fields) * 100)


async def recalculate_compatibility_scores(user_id: str, db) -> Dict[str, Any]:
    """Recalculate compatibility scores with all matches"""
    # Get all matches
    matches = await db.matches.find(
        {"$or": [{"user_id_1": user_id}, {"user_id_2": user_id}]},
        {"_id": 0}
    ).to_list(1000)
    
    for match in matches:
        partner_id = match["user_id_2"] if match["user_id_1"] == user_id else match["user_id_1"]
        
        # Calculate new compatibility score
        score = await calculate_enhanced_compatibility(user_id, partner_id, db)
        
        # Update match
        await db.matches.update_one(
            {"match_id": match["match_id"]},
            {"$set": {"compatibility_score": score, "last_score_update": datetime.now(timezone.utc).isoformat()}}
        )


async def calculate_enhanced_compatibility(user1_id: str, user2_id: str, db) -> float:
    """Calculate enhanced compatibility score between two users"""
    profile1 = await db.dating_profiles.find_one({"user_id": user1_id}, {"_id": 0})
    profile2 = await db.dating_profiles.find_one({"user_id": user2_id}, {"_id": 0})
    
    if not profile1 or not profile2:
        return 50.0  # Default score
    
    score = 0.0
    max_score = 0.0
    
    # Interest overlap (30% weight)
    interests1 = set([i.get("name", i) if isinstance(i, dict) else i for i in profile1.get("interests", [])])
    interests2 = set([i.get("name", i) if isinstance(i, dict) else i for i in profile2.get("interests", [])])
    if interests1 and interests2:
        overlap = len(interests1 & interests2) / len(interests1 | interests2)
        score += overlap * 30
    max_score += 30
    
    # Values alignment (25% weight)
    values1 = set(profile1.get("values", []))
    values2 = set(profile2.get("values", []))
    if values1 and values2:
        overlap = len(values1 & values2) / len(values1 | values2)
        score += overlap * 25
    max_score += 25
    
    # Relationship goals (20% weight)
    if profile1.get("relationship_goals") == profile2.get("relationship_goals"):
        score += 20
    max_score += 20
    
    # Life stage compatibility (15% weight)
    compatible_stages = {
        "student": ["student", "young_professional"],
        "young_professional": ["student", "young_professional", "professional"],
        "professional": ["young_professional", "professional", "entrepreneur"],
        "entrepreneur": ["professional", "entrepreneur"]
    }
    stage1 = profile1.get("life_stage", "")
    stage2 = profile2.get("life_stage", "")
    if stage2 in compatible_stages.get(stage1, []):
        score += 15
    max_score += 15
    
    # Personality trait compatibility (10% weight)
    # Complementary traits work well
    score += 10  # Default for now
    max_score += 10
    
    # Normalize to 0-100
    if max_score > 0:
        return (score / max_score) * 100
    return 50.0
