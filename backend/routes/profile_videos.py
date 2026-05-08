from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from pathlib import Path
import uuid
from utils.database import get_database, get_current_user

router = APIRouter(prefix="/profile", tags=["profile_videos"])

# Video upload directory
UPLOAD_DIR = Path("/app/backend/uploads/profile_videos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed video formats
ALLOWED_EXTENSIONS = {".mp4", ".webm", ".mov"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def get_file_extension(filename: str) -> str:
    """Extract file extension from filename"""
    return Path(filename).suffix.lower()

@router.post("/upload-video/{video_type}")
async def upload_profile_video(
    video_type: str,
    request: Request,
    file: UploadFile = File(...)
):
    """
    Upload a profile video (friends or dating)
    video_type: 'friends' or 'dating'
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate video type
    if video_type not in ["friends", "dating"]:
        raise HTTPException(status_code=400, detail="Invalid video type. Must be 'friends' or 'dating'")
    
    # Validate file extension
    file_ext = get_file_extension(file.filename)
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file format. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Validate file size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE / (1024 * 1024):.0f}MB"
        )
    
    # Generate unique filename
    unique_filename = f"{current_user.user_id}_{video_type}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Delete old video if exists
    db = get_database()
    user_doc = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if user_doc:
        field_name = f"looking_for_video_{video_type}"
        old_video_url = user_doc.get(field_name)
        
        if old_video_url:
            # Extract filename from URL
            old_filename = old_video_url.split("/")[-1]
            old_file_path = UPLOAD_DIR / old_filename
            
            # Delete old file if it exists
            if old_file_path.exists():
                try:
                    old_file_path.unlink()
                except Exception as e:
                    print(f"Error deleting old video: {e}")
    
    # Save new file
    try:
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Generate video URL
    video_url = f"/api/profile/videos/{unique_filename}"
    
    # Update user profile in database
    field_name = f"looking_for_video_{video_type}"
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {field_name: video_url}}
    )
    
    return {
        "message": "Video uploaded successfully",
        "video_url": video_url,
        "video_type": video_type,
        "file_size_mb": round(file_size / (1024 * 1024), 2)
    }


@router.get("/videos/{filename}")
async def get_profile_video(filename: str) -> Dict[str, Any]:
    """Serve a profile video file"""
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Determine media type based on extension
    ext = get_file_extension(filename)
    media_types = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime"
    }
    
    media_type = media_types.get(ext, "video/mp4")
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename
    )


@router.delete("/video/{video_type}")
async def delete_profile_video(video_type: str, request: Request) -> Dict[str, Any]:
    """Delete a profile video (friends or dating)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if video_type not in ["friends", "dating"]:
        raise HTTPException(status_code=400, detail="Invalid video type")
    
    db = get_database()
    field_name = f"looking_for_video_{video_type}"
    
    # Get current video URL
    user_doc = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, field_name: 1}
    )
    
    if not user_doc or not user_doc.get(field_name):
        raise HTTPException(status_code=404, detail="Video not found")
    
    video_url = user_doc[field_name]
    filename = video_url.split("/")[-1]
    file_path = UPLOAD_DIR / filename
    
    # Delete file
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception as e:
            print(f"Error deleting file: {e}")
    
    # Update database
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {field_name: None}}
    )
    
    return {
        "message": "Video deleted successfully",
        "video_type": video_type
    }
