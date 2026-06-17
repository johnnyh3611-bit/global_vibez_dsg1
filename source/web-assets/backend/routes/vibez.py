"""
My Vibez Content Feed - Backend Routes
TikTok-style content sharing with videos, images, and text posts
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
from uuid import uuid4
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/vibez", tags=["My Vibez Content"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.environ.get("DB_NAME", "global_vibez_dsg")]

# Models
class VibezContent(BaseModel):
    content_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    content_type: str  # "video", "image", "text"
    media_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    caption: str = ""
    hashtags: List[str] = []
    location: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    views_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class VibezComment(BaseModel):
    comment_id: str = Field(default_factory=lambda: str(uuid4()))
    content_id: str
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    comment_text: str
    likes_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VibezLike(BaseModel):
    like_id: str = Field(default_factory=lambda: str(uuid4()))
    content_id: str
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FollowRelation(BaseModel):
    follow_id: str = Field(default_factory=lambda: str(uuid4()))
    follower_user_id: str  # User who follows
    following_user_id: str  # User being followed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== CONTENT ENDPOINTS ====================

@router.post("/content/upload")
async def upload_content(
    user_id: str = Form(...),
    username: str = Form(...),
    content_type: str = Form(...),
    caption: str = Form(""),
    hashtags: str = Form(""),
    location: str = Form(None),
    media_file: Optional[UploadFile] = File(None)
):
    """
    Upload new content (video, image, or text)
    """
    try:
        media_url = None
        thumbnail_url = None
        
        # Handle media upload
        if media_file and content_type in ["video", "image"]:
            # In production, upload to S3/CDN
            # For now, save locally or use placeholder
            file_extension = media_file.filename.split('.')[-1]
            filename = f"{uuid4()}.{file_extension}"
            
            # Mock media URL (replace with actual upload)
            media_url = f"/media/vibez/{filename}"
            
            if content_type == "video":
                thumbnail_url = f"/media/vibez/thumbnails/{filename}.jpg"
        
        # Parse hashtags
        hashtag_list = [tag.strip().replace('#', '') for tag in hashtags.split(',') if tag.strip()]
        
        # Create content document
        content = {
            "content_id": str(uuid4()),
            "user_id": user_id,
            "username": username,
            "user_avatar": None,
            "content_type": content_type,
            "media_url": media_url,
            "thumbnail_url": thumbnail_url,
            "caption": caption,
            "hashtags": hashtag_list,
            "location": location,
            "likes_count": 0,
            "comments_count": 0,
            "shares_count": 0,
            "views_count": 0,
            "created_at": datetime.now(timezone.utc),
            "is_active": True
        }
        
        await db.vibez_content.insert_one(content)
        
        return {
            "success": True,
            "content_id": content["content_id"],
            "message": "Content uploaded successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feed/trending")
async def get_trending_feed(limit: int = 20, skip: int = 0) -> Dict[str, Any]:
    """
    Get trending content based on engagement (likes, comments, shares)
    """
    try:
        # Calculate engagement score and sort
        pipeline = [
            {"$match": {"is_active": True}},
            {
                "$addFields": {
                    "engagement_score": {
                        "$add": [
                            {"$multiply": ["$likes_count", 2]},
                            {"$multiply": ["$comments_count", 3]},
                            {"$multiply": ["$shares_count", 5]},
                            "$views_count"
                        ]
                    }
                }
            },
            {"$sort": {"engagement_score": -1, "created_at": -1}},
            {"$skip": skip},
            {"$limit": limit},
            {"$project": {"_id": 0}}
        ]
        
        content_list = await db.vibez_content.aggregate(pipeline).to_list(length=limit)
        
        return {
            "success": True,
            "content": content_list,
            "count": len(content_list)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feed/for-you")
async def get_for_you_feed(user_id: str, limit: int = 20, skip: int = 0) -> Dict[str, Any]:
    """
    Personalized feed based on user's interests and interactions
    """
    try:
        # Get user's liked content to understand preferences
        user_likes = await db.vibez_likes.find(
            {"user_id": user_id},
            {"content_id": 1, "_id": 0}
        ).to_list(length=100)
        
        liked_content_ids = [like["content_id"] for like in user_likes]
        
        # Get hashtags from liked content
        if liked_content_ids:
            liked_content = await db.vibez_content.find(
                {"content_id": {"$in": liked_content_ids}},
                {"hashtags": 1, "_id": 0}
            ).to_list(length=100)
            
            user_hashtags = set()
            for content in liked_content:
                user_hashtags.update(content.get("hashtags", []))
        else:
            user_hashtags = set()
        
        # Build recommendation query
        if user_hashtags:
            query = {
                "is_active": True,
                "user_id": {"$ne": user_id},  # Don't show own content
                "content_id": {"$nin": liked_content_ids},  # Don't show already liked
                "hashtags": {"$in": list(user_hashtags)}
            }
        else:
            # New user - show trending
            query = {
                "is_active": True,
                "user_id": {"$ne": user_id}
            }
        
        # Get content sorted by recency and engagement
        content_list = await db.vibez_content.find(
            query,
            {"_id": 0}
        ).sort([("created_at", -1), ("likes_count", -1)]).skip(skip).limit(limit).to_list(length=limit)
        
        return {
            "success": True,
            "content": content_list,
            "count": len(content_list)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feed/following")
async def get_following_feed(user_id: str, limit: int = 20, skip: int = 0) -> Dict[str, Any]:
    """
    Feed from users you follow
    """
    try:
        # Get list of users being followed
        following = await db.vibez_follows.find(
            {"follower_user_id": user_id},
            {"following_user_id": 1, "_id": 0}
        ).to_list(length=1000)
        
        following_user_ids = [f["following_user_id"] for f in following]
        
        if not following_user_ids:
            return {"success": True, "content": [], "count": 0}
        
        # Get content from followed users
        content_list = await db.vibez_content.find(
            {
                "user_id": {"$in": following_user_ids},
                "is_active": True
            },
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        return {
            "success": True,
            "content": content_list,
            "count": len(content_list)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/content/{content_id}")
async def get_content(content_id: str) -> Dict[str, Any]:
    """
    Get single content by ID and increment view count
    """
    try:
        # Increment view count
        await db.vibez_content.update_one(
            {"content_id": content_id},
            {"$inc": {"views_count": 1}}
        )
        
        content = await db.vibez_content.find_one(
            {"content_id": content_id},
            {"_id": 0}
        )
        
        if not content:
            raise HTTPException(status_code=404, detail="Content not found")
        
        return {"success": True, "content": content}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== INTERACTION ENDPOINTS ====================

@router.post("/like")
async def like_content(content_id: str, user_id: str) -> Dict[str, Any]:
    """
    Like a content
    """
    try:
        # Check if already liked
        existing = await db.vibez_likes.find_one({
            "content_id": content_id,
            "user_id": user_id
        })
        
        if existing:
            # Unlike
            await db.vibez_likes.delete_one({
                "content_id": content_id,
                "user_id": user_id
            })
            await db.vibez_content.update_one(
                {"content_id": content_id},
                {"$inc": {"likes_count": -1}}
            )
            return {"success": True, "action": "unliked"}
        else:
            # Like
            like = {
                "like_id": str(uuid4()),
                "content_id": content_id,
                "user_id": user_id,
                "created_at": datetime.now(timezone.utc)
            }
            await db.vibez_likes.insert_one(like)
            await db.vibez_content.update_one(
                {"content_id": content_id},
                {"$inc": {"likes_count": 1}}
            )
            return {"success": True, "action": "liked"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/comment")
async def add_comment(
    content_id: str,
    user_id: str,
    username: str,
    comment_text: str
) -> Dict[str, Any]:
    """
    Add comment to content
    """
    try:
        comment = {
            "comment_id": str(uuid4()),
            "content_id": content_id,
            "user_id": user_id,
            "username": username,
            "user_avatar": None,
            "comment_text": comment_text,
            "likes_count": 0,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.vibez_comments.insert_one(comment)
        await db.vibez_content.update_one(
            {"content_id": content_id},
            {"$inc": {"comments_count": 1}}
        )
        
        return {"success": True, "comment": comment}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/comments/{content_id}")
async def get_comments(content_id: str, limit: int = 50) -> Dict[str, Any]:
    """
    Get comments for content
    """
    try:
        comments = await db.vibez_comments.find(
            {"content_id": content_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        
        return {"success": True, "comments": comments}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/share")
async def share_content(content_id: str) -> Dict[str, Any]:
    """
    Track content share
    """
    try:
        await db.vibez_content.update_one(
            {"content_id": content_id},
            {"$inc": {"shares_count": 1}}
        )
        
        return {"success": True}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== FOLLOW ENDPOINTS ====================

@router.post("/follow")
async def follow_user(follower_user_id: str, following_user_id: str) -> Dict[str, Any]:
    """
    Follow/unfollow a user
    """
    try:
        if follower_user_id == following_user_id:
            raise HTTPException(status_code=400, detail="Cannot follow yourself")
        
        # Check if already following
        existing = await db.vibez_follows.find_one({
            "follower_user_id": follower_user_id,
            "following_user_id": following_user_id
        })
        
        if existing:
            # Unfollow
            await db.vibez_follows.delete_one({
                "follower_user_id": follower_user_id,
                "following_user_id": following_user_id
            })
            return {"success": True, "action": "unfollowed"}
        else:
            # Follow
            follow = {
                "follow_id": str(uuid4()),
                "follower_user_id": follower_user_id,
                "following_user_id": following_user_id,
                "created_at": datetime.now(timezone.utc)
            }
            await db.vibez_follows.insert_one(follow)
            return {"success": True, "action": "followed"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}/content")
async def get_user_content(user_id: str, limit: int = 20, skip: int = 0) -> Dict[str, Any]:
    """
    Get all content from a user
    """
    try:
        content_list = await db.vibez_content.find(
            {"user_id": user_id, "is_active": True},
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
        
        return {"success": True, "content": content_list}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}/stats")
async def get_user_stats(user_id: str) -> Dict[str, Any]:
    """
    Get user's content statistics
    """
    try:
        # Count content
        content_count = await db.vibez_content.count_documents({
            "user_id": user_id,
            "is_active": True
        })
        
        # Count followers
        followers_count = await db.vibez_follows.count_documents({
            "following_user_id": user_id
        })
        
        # Count following
        following_count = await db.vibez_follows.count_documents({
            "follower_user_id": user_id
        })
        
        # Total likes received
        pipeline = [
            {"$match": {"user_id": user_id, "is_active": True}},
            {"$group": {"_id": None, "total_likes": {"$sum": "$likes_count"}}}
        ]
        likes_result = await db.vibez_content.aggregate(pipeline).to_list(length=1)
        total_likes = likes_result[0]["total_likes"] if likes_result else 0
        
        return {
            "success": True,
            "stats": {
                "content_count": content_count,
                "followers_count": followers_count,
                "following_count": following_count,
                "total_likes": total_likes
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
