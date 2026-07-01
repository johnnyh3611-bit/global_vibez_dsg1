"""
Avatar System Backend
Manages user avatars with MongoDB persistence
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from utils.database import get_database, get_current_user
from datetime import datetime, timezone

router = APIRouter(prefix="/avatars", tags=["avatars"])


# ==================== MODELS ====================

class AvatarData(BaseModel):
    emoji: str
    name: str
    background: Optional[str] = "purple"
    border_color: Optional[str] = "purple"


class AvatarResponse(BaseModel):
    success: bool
    avatar: Optional[AvatarData] = None
    message: str


# ==================== ENDPOINTS ====================

@router.get("/me")
async def get_my_avatar(request: Request) -> Dict[str, Any]:
    """Get current user's avatar"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Fetch user from database
    user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "avatar": 1}
    )
    
    if not user or "avatar" not in user:
        # Return default avatar if none set
        return {
            "success": True,
            "avatar": {
                "emoji": "🎮",
                "name": "Player",
                "background": "purple",
                "border_color": "purple"
            },
            "message": "Default avatar"
        }
    
    return {
        "success": True,
        "avatar": user["avatar"],
        "message": "Avatar retrieved"
    }


@router.post("/save")
async def save_avatar(request: Request, avatar_data: AvatarData) -> Dict[str, Any]:
    """Save user's avatar to database"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Prepare avatar document
    avatar_doc = {
        "emoji": avatar_data.emoji,
        "name": avatar_data.name,
        "background": avatar_data.background or "purple",
        "border_color": avatar_data.border_color or "purple",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update user's avatar
    result = await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$set": {
                "avatar": avatar_doc,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0 and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "success": True,
        "avatar": avatar_doc,
        "message": "Avatar saved successfully"
    }


@router.post("/migrate")
async def migrate_from_localstorage(request: Request, avatar_data: AvatarData) -> Dict[str, Any]:
    """
    Migrate avatar from localStorage to database
    This is called automatically when user first logs in with localStorage data
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if user already has avatar in DB
    existing_user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "avatar": 1}
    )
    
    if existing_user and "avatar" in existing_user:
        # Already has avatar in DB, don't overwrite
        return {
            "success": True,
            "avatar": existing_user["avatar"],
            "message": "Avatar already exists in database"
        }
    
    # Migrate localStorage data to DB
    avatar_doc = {
        "emoji": avatar_data.emoji,
        "name": avatar_data.name,
        "background": avatar_data.background or "purple",
        "border_color": avatar_data.border_color or "purple",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "migrated_from_localstorage": True
    }
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$set": {
                "avatar": avatar_doc,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "avatar": avatar_doc,
        "message": "Avatar migrated from localStorage successfully"
    }


@router.delete("/delete")
async def delete_avatar(request: Request) -> Dict[str, Any]:
    """Reset avatar to default"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Remove avatar from user document
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$unset": {"avatar": ""},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {
        "success": True,
        "message": "Avatar reset to default"
    }


@router.get("/user/{user_id}")
async def get_user_avatar(user_id: str) -> Dict[str, Any]:
    """Get any user's avatar (public endpoint)"""
    db = get_database()
    
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "avatar": 1, "name": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if "avatar" not in user:
        # Return default
        return {
            "success": True,
            "avatar": {
                "emoji": "🎮",
                "name": user.get("name", "Anonymous"),
                "background": "purple",
                "border_color": "purple"
            },
            "message": "Default avatar"
        }
    
    return {
        "success": True,
        "avatar": user["avatar"],
        "message": "Avatar retrieved"
    }
