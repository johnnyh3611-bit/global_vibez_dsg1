"""
MY VIBEZ - TikTok-Style Content Streaming Platform
Unique dating/gaming content with AI personality matching
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import os
import json
import uuid
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/my-vibez", tags=["my_vibez"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'global_vibez_dsg')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Pydantic Models
class VibePost(BaseModel):
    user_id: str
    content_type: str  # 'video', 'image', 'game_clip', 'dual_stream'
    title: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = []
    game_id: Optional[str] = None  # If it's game-related content
    is_dual_stream: bool = False
    partner_user_id: Optional[str] = None
    challenge_id: Optional[str] = None
    is_anonymous: bool = False

class VibePostCreate(BaseModel):
    user_id: str
    type: str  # 'video', 'image'
    video_url: Optional[str] = None
    image_url: Optional[str] = None
    caption: Optional[str] = None
    duration: Optional[float] = None
    is_live: bool = False
    tags: List[str] = []

class VibeInteraction(BaseModel):
    post_id: str
    user_id: str
    interaction_type: str  # 'like', 'love', 'fire', 'play_together'

class VibeInteractionRequest(BaseModel):
    user_id: str
    action: str  # 'like', 'unlike', 'comment'
    comment_text: Optional[str] = None

class VibeComment(BaseModel):
    post_id: str
    user_id: str
    text: Optional[str] = None
    voice_note_url: Optional[str] = None

@router.post("/post/create-json")
async def create_vibe_post_json(post: VibePostCreate) -> Dict[str, Any]:
    """Create a new MY VIBEZ post (JSON version for API testing)"""
    try:
        # Validate video duration limits
        if post.type == 'video' and post.duration and not post.is_live:
            MAX_VIDEO_DURATION = 300  # 5 minutes
            if post.duration > MAX_VIDEO_DURATION:
                raise HTTPException(
                    status_code=400,
                    detail="Video too long! Max 5 minutes. Use Live Stream for longer content."
                )
        
        # Generate post ID
        post_id = f"vibe_{uuid.uuid4().hex[:12]}"
        
        # Create post document
        post_doc = {
            "id": post_id,
            "user_id": post.user_id,
            "type": post.type,
            "video_url": post.video_url,
            "image_url": post.image_url,
            "caption": post.caption or "",
            "duration": post.duration,
            "is_live": post.is_live,
            "tags": post.tags,
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.my_vibez.insert_one(post_doc)
        
        return {
            "success": True,
            "post_id": post_id,
            "message": "Post created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/post/create")
async def create_vibe_post(
    user_id: str = Form(...),
    content_type: str = Form(...),
    title: str = Form(None),
    description: str = Form(None),
    tags: str = Form("[]"),  # JSON string of tags
    game_id: str = Form(None),
    is_dual_stream: bool = Form(False),
    partner_user_id: str = Form(None),
    challenge_id: str = Form(None),
    is_anonymous: bool = Form(False),
    is_live: bool = Form(False),  # NEW: Live stream indicator
    video_duration: float = Form(None),  # NEW: Video duration in seconds
    file: UploadFile = File(None)
):
    """Create a new MY VIBEZ post with file upload"""
    try:
        # Validate video duration limits
        if content_type == 'video' and video_duration and not is_live:
            MAX_VIDEO_DURATION = 300  # 5 minutes = 300 seconds
            if video_duration > MAX_VIDEO_DURATION:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Video too long! Max duration == 5 minutes ({MAX_VIDEO_DURATION}s). Your video is {video_duration:.0f}s. For longer content, use Live Stream mode."
                )
        
        # Validate file size
        if file:
            # Get file size
            file.file.seek(0, 2)  # Seek to end
            file_size = file.file.tell()  # Get position (size)
            file.file.seek(0)  # Reset to start
            
            # Size limits based on content type
            if content_type == 'video' and not is_live:
                MAX_SIZE = 100 * 1024 * 1024  # 100MB for 5-min videos
                if file_size > MAX_SIZE:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Video file too large! Max size == 100MB. Your file is {file_size / (1024*1024):.1f}MB."
                    )
            elif content_type == 'image':
                MAX_SIZE = 10 * 1024 * 1024  # 10MB for images
                if file_size > MAX_SIZE:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Image file too large! Max size == 10MB. Your file is {file_size / (1024*1024):.1f}MB."
                    )
        
        # Generate unique post ID
        post_id = f"vibe_{uuid.uuid4().hex[:12]}"
        
        # Handle file upload (video/image)
        content_url = None
        if file:
            # Persist the upload to /home/johnnie/master-project/uploads/vibez/ — the
            # /api/uploads static mount in server.py exposes this dir
            # to the public web. In production point this at S3/Cloudinary
            # by overriding the MY_VIBEZ_UPLOAD_BUCKET env var; the rest of
            # the post pipeline only cares about the resulting content_url.
            from pathlib import Path
            file_ext = (file.filename or "bin").rsplit('.', 1)[-1].lower()
            uploads_dir = Path("/home/johnnie/master-project/uploads/vibez")
            uploads_dir.mkdir(parents=True, exist_ok=True)
            disk_path = uploads_dir / f"{post_id}.{file_ext}"
            # Rewind — we already consumed file.file above for size check.
            await file.seek(0)
            with disk_path.open("wb") as out:
                # Stream in 1 MB chunks so big videos never balloon memory.
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
            content_url = f"/api/uploads/vibez/{post_id}.{file_ext}"
        
        # Parse tags
        tags_list = json.loads(tags) if tags else []
        
        # Get user info
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Create post document
        post = {
            "id": post_id,
            "user_id": user_id,
            "username": user.get("name", "Anonymous") if not is_anonymous else "Anonymous Viber",
            "user_avatar": user.get("avatar") if not is_anonymous else None,
            "content_type": content_type,
            "content_url": content_url,
            "thumbnail_url": f"{content_url}_thumb" if content_url else None,
            "title": title,
            "description": description,
            "tags": tags_list,
            "game_id": game_id,
            "is_dual_stream": is_dual_stream,
            "partner_user_id": partner_user_id,
            "challenge_id": challenge_id,
            "is_anonymous": is_anonymous,
            "is_live": is_live,  # NEW
            "video_duration": video_duration,  # NEW: Store duration
            "likes": 0,
            "loves": 0,
            "fires": 0,
            "comments_count": 0,
            "shares": 0,
            "views": 0,
            "play_together_requests": 0,
            "vibe_score": 0,  # AI-calculated personality score
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_trending": False,
            "visibility": "public"  # public, friends_only, private
        }
        
        # If it's a game clip, add game stats
        if game_id:
            game_stats = await db.game_stats.find_one({"user_id": user_id, "game_id": game_id}, {"_id": 0})
            if game_stats:
                post["game_stats"] = {
                    "wins": game_stats.get("wins", 0),
                    "total_games": game_stats.get("total_games", 0),
                    "win_rate": game_stats.get("win_rate", 0)
                }
        
        # Save to database
        await db.vibe_posts.insert_one(post)
        
        # Award XP for posting (more XP for longer content)
        base_xp = 50
        if is_live:
            base_xp = 100  # More XP for live streams
        elif video_duration and video_duration > 180:  # 3+ minutes
            base_xp = 75
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"xp": base_xp, "posts_count": 1}}
        )
        
        return {
            "success": True,
            "message": "Vibe posted! 🎉" if not is_live else "Live stream started! 🔴",
            "post_id": post_id,
            "post": post
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feed")
async def get_vibe_feed(
    user_id: str,
    feed_type: str = "for_you",  # for_you, following, gaming, dating
    skip: int = 0,
    limit: int = 20
) -> Dict[str, Any]:
    """Get personalized feed of vibe posts"""
    try:
        query = {"visibility": "public"}
        
        # Filter based on feed type
        if feed_type == "following":
            # Get user's following list
            following = await db.friendships.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
            following_ids = [f["friend_id"] for f in following]
            query["user_id"] = {"$in": following_ids}
        
        elif feed_type == "gaming":
            query["game_id"] = {"$ne": None}
        
        elif feed_type == "dating":
            query["$or"] = [
                {"is_dual_stream": True},
                {"challenge_id": {"$ne": None}},
                {"tags": {"$in": ["date", "dating", "romance", "couple"]}}
            ]
        
        # Get posts
        posts = await db.vibe_posts.find(query, {"_id": 0}) \
            .sort("created_at", -1) \
            .skip(skip) \
            .limit(limit) \
            .to_list(limit)
        
        # Enrich posts with interaction data
        for post in posts:
            # Check if current user has liked
            user_like = await db.vibe_interactions.find_one({
                "post_id": post["id"],
                "user_id": user_id,
                "interaction_type": {"$in": ["like", "love", "fire"]}
            }, {"_id": 0})
            
            post["user_has_liked"] = user_like is not None
            post["user_interaction_type"] = user_like.get("interaction_type") if user_like else None
            
            # Get top comments
            top_comments = await db.vibe_comments.find({
                "post_id": post["id"]
            }, {"_id": 0}).sort("created_at", -1).limit(3).to_list(3)
            
            post["top_comments"] = top_comments
        
        return {
            "success": True,
            "feed_type": feed_type,
            "posts": posts,
            "has_more": len(posts) == limit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/interact")
async def interact_with_post(interaction: VibeInteraction) -> Dict[str, Any]:
    """Like, love, fire, or request to play together"""
    try:
        # Check if interaction already exists
        existing = await db.vibe_interactions.find_one({
            "post_id": interaction.post_id,
            "user_id": interaction.user_id
        }, {"_id": 0})
        
        if existing:
            # Update interaction type
            await db.vibe_interactions.update_one(
                {"post_id": interaction.post_id, "user_id": interaction.user_id},
                {"$set": {
                    "interaction_type": interaction.interaction_type,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # Create new interaction
            interaction_doc = {
                "id": f"int_{uuid.uuid4().hex[:12]}",
                "post_id": interaction.post_id,
                "user_id": interaction.user_id,
                "interaction_type": interaction.interaction_type,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.vibe_interactions.insert_one(interaction_doc)
        
        # Update post counts
        update_field = f"{interaction.interaction_type}s"
        if interaction.interaction_type == "play_together":
            update_field = "play_together_requests"
        
        await db.vibe_posts.update_one(
            {"id": interaction.post_id},
            {"$inc": {update_field: 1}}
        )
        
        # Award XP to post creator
        post = await db.vibe_posts.find_one({"id": interaction.post_id}, {"_id": 0})
        if post:
            xp_rewards = {
                "like": 1,
                "love": 2,
                "fire": 3,
                "play_together": 5
            }
            xp = xp_rewards.get(interaction.interaction_type, 1)
            await db.users.update_one(
                {"user_id": post["user_id"]},
                {"$inc": {"xp": xp}}
            )
        
        return {
            "success": True,
            "message": "Interaction recorded"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/interact/{post_id}")
async def interact_with_post_v2(post_id: str, interaction: VibeInteractionRequest) -> Dict[str, Any]:
    """Interact with a post (like, unlike, comment) - v2 with path param"""
    try:
        if interaction.action == 'like':
            # Add or update like
            existing = await db.vibe_interactions.find_one({
                "post_id": post_id,
                "user_id": interaction.user_id
            })
            
            if existing:
                await db.vibe_interactions.update_one(
                    {"post_id": post_id, "user_id": interaction.user_id},
                    {"$set": {"interaction_type": "like", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
            else:
                await db.vibe_interactions.insert_one({
                    "id": f"int_{uuid.uuid4().hex[:12]}",
                    "post_id": post_id,
                    "user_id": interaction.user_id,
                    "interaction_type": "like",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                # Increment likes count
                await db.my_vibez.update_one(
                    {"id": post_id},
                    {"$inc": {"likes": 1}}
                )
            
            return {"success": True, "message": "Post liked"}
        
        elif interaction.action == 'unlike':
            # Remove like
            result = await db.vibe_interactions.delete_one({
                "post_id": post_id,
                "user_id": interaction.user_id
            })
            
            if result.deleted_count > 0:
                # Decrement likes count
                await db.my_vibez.update_one(
                    {"id": post_id},
                    {"$inc": {"likes": -1}}
                )
            
            return {"success": True, "message": "Post unliked"}
        
        elif interaction.action == 'comment':
            if not interaction.comment_text:
                raise HTTPException(status_code=400, detail="Comment text required")
            
            # Add comment
            comment = {
                "id": f"comm_{uuid.uuid4().hex[:12]}",
                "post_id": post_id,
                "user_id": interaction.user_id,
                "text": interaction.comment_text,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.vibe_comments.insert_one(comment)
            
            # Increment comments count
            await db.my_vibez.update_one(
                {"id": post_id},
                {"$inc": {"comments": 1}}
            )
            
            return {"success": True, "message": "Comment added", "comment_id": comment["id"]}
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/comment")
async def add_comment(comment: VibeComment) -> Dict[str, Any]:
    """Add text or voice note comment"""
    try:
        comment_id = f"cmt_{uuid.uuid4().hex[:12]}"
        
        # Get user info
        user = await db.users.find_one({"user_id": comment.user_id}, {"_id": 0})
        
        comment_doc = {
            "id": comment_id,
            "post_id": comment.post_id,
            "user_id": comment.user_id,
            "username": user.get("name", "Unknown"),
            "user_avatar": user.get("avatar"),
            "text": comment.text,
            "voice_note_url": comment.voice_note_url,
            "likes": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.vibe_comments.insert_one(comment_doc)
        
        # Update comment count
        await db.vibe_posts.update_one(
            {"id": comment.post_id},
            {"$inc": {"comments_count": 1}}
        )
        
        # Award XP
        await db.users.update_one(
            {"id": comment.user_id},
            {"$inc": {"xp": 2}}
        )
        
        return {
            "success": True,
            "comment": comment_doc
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/post/{post_id}")
async def get_post_details(post_id: str, user_id: str) -> Dict[str, Any]:
    """Get full post details with comments"""
    try:
        # Get post
        post = await db.vibe_posts.find_one({"id": post_id}, {"_id": 0})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Increment view count
        await db.vibe_posts.update_one(
            {"id": post_id},
            {"$inc": {"views": 1}}
        )
        
        # Get all comments
        comments = await db.vibe_comments.find({
            "post_id": post_id
        }, {"_id": 0}).sort("created_at", -1).to_list(100)
        
        # Check user interaction
        user_interaction = await db.vibe_interactions.find_one({
            "post_id": post_id,
            "user_id": user_id
        }, {"_id": 0})
        
        post["comments"] = comments
        post["user_has_interacted"] = user_interaction is not None
        post["user_interaction_type"] = user_interaction.get("interaction_type") if user_interaction else None
        
        return {
            "success": True,
            "post": post
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/challenges")
async def get_active_challenges() -> Dict[str, Any]:
    """Get weekly dating/gaming challenges"""
    try:
        challenges = [
            {
                "id": "date_vlog_week",
                "title": "Date Vlog Week",
                "description": "Film your best date moment this week!",
                "emoji": "💕",
                "xp_reward": 500,
                "badge": "Date Vlogger",
                "ends_at": "2025-04-05T23:59:59Z"
            },
            {
                "id": "epic_game_clip",
                "title": "Epic Game Moment",
                "description": "Share your most epic game win or clutch play",
                "emoji": "🎮",
                "xp_reward": 300,
                "badge": "Gaming Legend",
                "ends_at": "2025-04-05T23:59:59Z"
            },
            {
                "id": "dual_stream_challenge",
                "title": "Couple Stream Challenge",
                "description": "Stream a game together with your match",
                "emoji": "👫",
                "xp_reward": 750,
                "badge": "Dynamic Duo",
                "ends_at": "2025-04-05T23:59:59Z"
            }
        ]
        
        return {
            "success": True,
            "challenges": challenges
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trending")
async def get_trending_posts(limit: int = 10) -> Dict[str, Any]:
    """Get trending posts based on engagement"""
    try:
        # Get posts with high engagement in last 24 hours
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        
        posts = await db.vibe_posts.find({
            "created_at": {"$gte": cutoff},
            "visibility": "public"
        }, {"_id": 0}).sort([
            ("likes", -1),
            ("loves", -1),
            ("fires", -1),
            ("comments_count", -1)
        ]).limit(limit).to_list(limit)
        
        return {
            "success": True,
            "trending": posts
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}/posts")
async def get_user_posts(user_id: str, skip: int = 0, limit: int = 20) -> Dict[str, Any]:
    """Get all posts from a specific user"""
    try:
        posts = await db.vibe_posts.find({
            "user_id": user_id
        }, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Get user stats
        user_stats = {
            "total_posts": await db.vibe_posts.count_documents({"user_id": user_id}),
            "total_likes": 0,
            "total_views": 0
        }
        
        # Calculate totals
        for post in posts:
            user_stats["total_likes"] += post.get("likes", 0) + post.get("loves", 0) + post.get("fires", 0)
            user_stats["total_views"] += post.get("views", 0)
        
        return {
            "success": True,
            "posts": posts,
            "stats": user_stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/post/{post_id}")
async def delete_post(post_id: str, user_id: str) -> Dict[str, Any]:
    """Delete a post"""
    try:
        post = await db.vibe_posts.find_one({"id": post_id}, {"_id": 0})
        
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        if post["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Delete post and all interactions/comments
        await db.vibe_posts.delete_one({"id": post_id})
        await db.vibe_interactions.delete_many({"post_id": post_id})
        await db.vibe_comments.delete_many({"post_id": post_id})
        
        return {
            "success": True,
            "message": "Post deleted"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
