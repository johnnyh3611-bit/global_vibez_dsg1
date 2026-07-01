from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import json as _json
import uuid
import os
import base64

router = APIRouter(prefix="/my-vibez", tags=["my_vibez_content"])


# ==================== MODELS ====================

class VideoMetadata(BaseModel):
    video_id: str
    creator_id: str
    creator_name: str
    creator_avatar: Optional[str] = None
    title: str
    description: Optional[str] = None
    hashtags: List[str] = []
    thumbnail_url: Optional[str] = None
    video_url: str
    duration: float  # seconds
    views_count: int = 0
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    created_at: str
    
class CreateVideoRequest(BaseModel):
    title: str
    description: Optional[str] = None
    hashtags: List[str] = []
    video_data: str  # Base64 encoded video blob
    thumbnail_data: Optional[str] = None  # Base64 encoded thumbnail
    duration: float

class CommentRequest(BaseModel):
    video_id: str
    text: str

class Comment(BaseModel):
    comment_id: str
    video_id: str
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    text: str
    created_at: str


# ==================== VIDEO UPLOAD ====================
# 2026-02-16: dual-mode endpoint.
#   • multipart/form-data → streaming binary (preferred — fixes the
#     mobile "I don't have the memory to post it" bug).
#   • application/json    → legacy base64 data-URI (kept for backward
#     compat with older callers).

VIDEO_DIR = "/home/johnnie/master-project/static/videos"
MAX_VIDEO_BYTES = 100 * 1024 * 1024  # 100 MB hard cap (parity with /uploads/media)
ALLOWED_VIDEO_TYPES = {
    "video/mp4", "video/quicktime", "video/webm", "video/ogg",
}


async def _save_streaming_upload(
    *, current_user, db,
    title: str,
    description: Optional[str],
    hashtags: List[str],
    duration: float,
    video: UploadFile,
    thumbnail: Optional[UploadFile],
) -> Dict[str, Any]:
    """Stream the video file to disk in 1MB chunks — never holds the
    whole file in RAM at once."""
    if duration > 300:
        raise HTTPException(status_code=400, detail="Video exceeds 5 minute limit")

    ctype = (video.content_type or "").lower()
    if ctype and ctype not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type {ctype}. Allowed: mp4, mov, webm, ogg.",
        )

    os.makedirs(VIDEO_DIR, exist_ok=True)
    video_id = f"vibez_{uuid.uuid4().hex[:12]}"
    ext = (video.filename or "").rsplit(".", 1)[-1].lower() or "webm"
    if ext not in {"mp4", "mov", "webm", "ogg"}:
        ext = "webm"
    video_filename = f"{video_id}.{ext}"
    video_path = os.path.join(VIDEO_DIR, video_filename)

    written = 0
    with open(video_path, "wb") as f:
        while True:
            chunk = await video.read(1024 * 1024)  # 1MB chunks
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_VIDEO_BYTES:
                f.close()
                try:
                    os.remove(video_path)
                except Exception:
                    pass
                raise HTTPException(
                    status_code=413,
                    detail=(
                        "Video too large. Maximum is "
                        f"{MAX_VIDEO_BYTES // (1024 * 1024)}MB. "
                        "Try recording a shorter clip."
                    ),
                )
            f.write(chunk)

    video_url = f"/static/videos/{video_filename}"

    thumbnail_url: Optional[str] = None
    if thumbnail is not None:
        thumb_filename = f"{video_id}_thumb.jpg"
        thumb_path = os.path.join(VIDEO_DIR, thumb_filename)
        thumb_written = 0
        with open(thumb_path, "wb") as tf:
            while True:
                tchunk = await thumbnail.read(256 * 1024)
                if not tchunk:
                    break
                thumb_written += len(tchunk)
                if thumb_written > 5 * 1024 * 1024:  # 5MB cap on thumb
                    break
                tf.write(tchunk)
        thumbnail_url = f"/static/videos/{thumb_filename}"

    text_content = f"{title} {description or ''}"
    auto_hashtags = [w[1:] for w in text_content.split() if w.startswith("#")]
    all_hashtags = list({*(hashtags or []), *auto_hashtags})

    video_doc = {
        "video_id": video_id,
        "creator_id": current_user.user_id,
        "creator_name": current_user.name,
        "creator_avatar": current_user.picture,
        "title": title,
        "description": description,
        "hashtags": all_hashtags,
        "thumbnail_url": thumbnail_url,
        "video_url": video_url,
        "duration": duration,
        "views_count": 0,
        "likes_count": 0,
        "comments_count": 0,
        "shares_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.my_vibez_videos.insert_one(video_doc)
    video_doc.pop("_id", None)
    return video_doc


@router.post("/upload")
async def upload_video(
    request: Request,
    # multipart fields (preferred path)
    title: Optional[str] = Form(default=None),
    description: Optional[str] = Form(default=None),
    hashtags: Optional[str] = Form(default=None),  # JSON string
    duration: Optional[float] = Form(default=None),
    video: Optional[UploadFile] = File(default=None),
    thumbnail: Optional[UploadFile] = File(default=None),
) -> Dict[str, Any]:
    """Upload a new video to MY VIBEZ.

    Two transport modes:
      A. multipart/form-data with `video` file part — streaming, mobile-safe.
      B. application/json with `video_data` base64 — legacy compat.
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    ctype = (request.headers.get("content-type") or "").lower()

    # ─── Mode A: streaming multipart ──────────────────────────────────
    if "multipart/form-data" in ctype:
        if not video or not title:
            raise HTTPException(
                status_code=400,
                detail="multipart upload requires `video` file part and `title` field",
            )
        try:
            tags: List[str] = []
            if hashtags:
                try:
                    parsed = _json.loads(hashtags)
                    if isinstance(parsed, list):
                        tags = [str(t) for t in parsed]
                except Exception:
                    tags = [t.strip() for t in hashtags.split(",") if t.strip()]
            return await _save_streaming_upload(
                current_user=current_user,
                db=db,
                title=title,
                description=description,
                hashtags=tags,
                duration=float(duration or 0),
                video=video,
                thumbnail=thumbnail,
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save video: {e!s}")

    # ─── Mode B: legacy base64 JSON ───────────────────────────────────
    try:
        body = await request.json()
        request_data = CreateVideoRequest(**body)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Send multipart/form-data with `video` file part, or JSON matching CreateVideoRequest. ({e!s})",
        )

    # Validate duration
    if request_data.duration > 300:  # 5 minutes = 300 seconds
        raise HTTPException(status_code=400, detail="Video exceeds 5 minute limit")

    # Create video directory if not exists
    video_dir = VIDEO_DIR
    os.makedirs(video_dir, exist_ok=True)

    # Generate video ID
    video_id = f"vibez_{uuid.uuid4().hex[:12]}"

    # Save video file (decode base64)
    try:
        video_bytes = base64.b64decode(request_data.video_data.split(',')[1] if ',' in request_data.video_data else request_data.video_data)
        video_filename = f"{video_id}.webm"
        video_path = os.path.join(video_dir, video_filename)

        with open(video_path, 'wb') as f:
            f.write(video_bytes)

        video_url = f"/static/videos/{video_filename}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {str(e)}")
    
    # Save thumbnail if provided
    thumbnail_url = None
    if request_data.thumbnail_data:
        try:
            thumb_bytes = base64.b64decode(request_data.thumbnail_data.split(',')[1] if ',' in request_data.thumbnail_data else request_data.thumbnail_data)
            thumb_filename = f"{video_id}_thumb.jpg"
            thumb_path = os.path.join(video_dir, thumb_filename)
            
            with open(thumb_path, 'wb') as f:
                f.write(thumb_bytes)
            
            thumbnail_url = f"/static/videos/{thumb_filename}"
        except Exception:
            pass  # Thumbnail is optional
    
    # Extract hashtags from title and description
    text_content = f"{request_data.title} {request_data.description or ''}"
    auto_hashtags = [word[1:] for word in text_content.split() if word.startswith('#')]
    all_hashtags = list(set(request_data.hashtags + auto_hashtags))
    
    # Create video metadata
    video_data = {
        "video_id": video_id,
        "creator_id": current_user.user_id,
        "creator_name": current_user.name,
        "creator_avatar": current_user.picture,
        "title": request_data.title,
        "description": request_data.description,
        "hashtags": all_hashtags,
        "thumbnail_url": thumbnail_url,
        "video_url": video_url,
        "duration": request_data.duration,
        "views_count": 0,
        "likes_count": 0,
        "comments_count": 0,
        "shares_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.my_vibez_videos.insert_one(video_data)
    
    return {
        "video_id": video_id,
        "video_url": video_url,
        "thumbnail_url": thumbnail_url,
        "message": "Video uploaded successfully! 🎬"
    }


# ==================== FEED ENDPOINTS ====================

@router.get("/feed/for-you")
async def get_for_you_feed(limit: int = 20, skip: int = 0, request: Request = None) -> Dict[str, Any]:
    """Get personalized For You feed (algorithmic)"""
    current_user = await get_current_user(request) if request else None
    db = get_database()
    
    # Simple algorithm: most liked + recent videos, excluding user's own
    query = {}
    if current_user:
        query["creator_id"] = {"$ne": current_user.user_id}
    
    videos = await db.my_vibez_videos.find(
        query,
        {"_id": 0}
    ).sort([
        ("likes_count", -1),
        ("created_at", -1)
    ]).skip(skip).limit(limit).to_list(limit)
    
    return {"videos": videos, "total": len(videos)}


@router.get("/feed/following")
async def get_following_feed(limit: int = 20, skip: int = 0, request: Request = None) -> Dict[str, Any]:
    """Get feed from followed creators only"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get user's following list
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    following_ids = user.get("following", [])
    
    if not following_ids:
        return {"videos": [], "total": 0}
    
    # Get videos from followed creators
    videos = await db.my_vibez_videos.find(
        {"creator_id": {"$in": following_ids}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"videos": videos, "total": len(videos)}


@router.get("/video/{video_id}")
async def get_video(video_id: str) -> Dict[str, Any]:
    """Get single video details"""
    db = get_database()
    
    video = await db.my_vibez_videos.find_one({"video_id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Increment view count
    await db.my_vibez_videos.update_one(
        {"video_id": video_id},
        {"$inc": {"views_count": 1}}
    )
    
    video["views_count"] += 1
    return video


# ==================== LIKES ====================

@router.post("/video/{video_id}/like")
async def like_video(video_id: str, request: Request) -> Dict[str, Any]:
    """Like a video"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if already liked
    existing_like = await db.my_vibez_likes.find_one({
        "video_id": video_id,
        "user_id": current_user.user_id
    })
    
    if existing_like:
        raise HTTPException(status_code=400, detail="Already liked")
    
    # Add like
    await db.my_vibez_likes.insert_one({
        "like_id": str(uuid.uuid4()),
        "video_id": video_id,
        "user_id": current_user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Increment like count
    await db.my_vibez_videos.update_one(
        {"video_id": video_id},
        {"$inc": {"likes_count": 1}}
    )
    
    return {"message": "Liked! ❤️"}


@router.delete("/video/{video_id}/like")
async def unlike_video(video_id: str, request: Request) -> Dict[str, Any]:
    """Unlike a video"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Remove like
    result = await db.my_vibez_likes.delete_one({
        "video_id": video_id,
        "user_id": current_user.user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not liked")
    
    # Decrement like count
    await db.my_vibez_videos.update_one(
        {"video_id": video_id},
        {"$inc": {"likes_count": -1}}
    )
    
    return {"message": "Unliked"}


@router.get("/video/{video_id}/liked")
async def check_if_liked(video_id: str, request: Request) -> Dict[str, Any]:
    """Check if current user liked this video"""
    current_user = await get_current_user(request)
    if not current_user:
        return {"liked": False}
    
    db = get_database()
    
    like = await db.my_vibez_likes.find_one({
        "video_id": video_id,
        "user_id": current_user.user_id
    })
    
    return {"liked": like is not None}


# ==================== COMMENTS ====================

@router.post("/comments")
async def add_comment(comment_data: CommentRequest, request: Request) -> Dict[str, Any]:
    """Add a comment to a video"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    comment = {
        "comment_id": str(uuid.uuid4()),
        "video_id": comment_data.video_id,
        "user_id": current_user.user_id,
        "username": current_user.name,
        "user_avatar": current_user.picture,
        "text": comment_data.text,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.my_vibez_comments.insert_one(comment)
    
    # Increment comment count
    await db.my_vibez_videos.update_one(
        {"video_id": comment_data.video_id},
        {"$inc": {"comments_count": 1}}
    )
    
    return comment


@router.get("/video/{video_id}/comments")
async def get_comments(video_id: str, limit: int = 50, skip: int = 0) -> Dict[str, Any]:
    """Get comments for a video"""
    db = get_database()
    
    comments = await db.my_vibez_comments.find(
        {"video_id": video_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"comments": comments, "total": len(comments)}


# ==================== FOLLOW SYSTEM ====================

@router.post("/follow/{creator_id}")
async def follow_creator(creator_id: str, request: Request) -> Dict[str, Any]:
    """Follow a creator"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if creator_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    db = get_database()
    
    # Add to following list
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$addToSet": {"following": creator_id}}
    )
    
    # Add to creator's followers list
    await db.users.update_one(
        {"user_id": creator_id},
        {"$addToSet": {"followers": current_user.user_id}}
    )
    
    return {"message": "Following! 👤"}


@router.delete("/follow/{creator_id}")
async def unfollow_creator(creator_id: str, request: Request) -> Dict[str, Any]:
    """Unfollow a creator"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Remove from following list
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$pull": {"following": creator_id}}
    )
    
    # Remove from creator's followers list
    await db.users.update_one(
        {"user_id": creator_id},
        {"$pull": {"followers": current_user.user_id}}
    )
    
    return {"message": "Unfollowed"}


@router.get("/following/{creator_id}")
async def check_if_following(creator_id: str, request: Request) -> Dict[str, Any]:
    """Check if current user follows this creator"""
    current_user = await get_current_user(request)
    if not current_user:
        return {"following": False}
    
    db = get_database()
    
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    following_list = user.get("following", [])
    
    return {"following": creator_id in following_list}


# ==================== SHARE ====================

@router.post("/video/{video_id}/share")
async def share_video(video_id: str, request: Request) -> Dict[str, Any]:
    """Track video share"""
    db = get_database()
    
    # Increment share count
    await db.my_vibez_videos.update_one(
        {"video_id": video_id},
        {"$inc": {"shares_count": 1}}
    )
    
    return {"message": "Shared! 🔗", "share_url": f"/my-vibez/{video_id}"}


# ==================== USER STATS ====================

@router.get("/creator/{creator_id}/stats")
async def get_creator_stats(creator_id: str) -> Dict[str, Any]:
    """Get creator statistics"""
    db = get_database()
    
    # Get video count
    video_count = await db.my_vibez_videos.count_documents({"creator_id": creator_id})
    
    # Get total views
    pipeline = [
        {"$match": {"creator_id": creator_id}},
        {"$group": {
            "_id": None,
            "total_views": {"$sum": "$views_count"},
            "total_likes": {"$sum": "$likes_count"}
        }}
    ]
    stats = await db.my_vibez_videos.aggregate(pipeline).to_list(1)
    
    total_views = stats[0]["total_views"] if stats else 0
    total_likes = stats[0]["total_likes"] if stats else 0
    
    # Get follower count
    user = await db.users.find_one({"user_id": creator_id}, {"_id": 0})
    followers_count = len(user.get("followers", [])) if user else 0
    
    return {
        "creator_id": creator_id,
        "videos_count": video_count,
        "total_views": total_views,
        "total_likes": total_likes,
        "followers_count": followers_count
    }
