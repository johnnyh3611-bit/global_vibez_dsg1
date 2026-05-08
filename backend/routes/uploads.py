from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from utils.database import get_current_user
from typing import Optional
import uuid
from pathlib import Path

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Directory for storing uploaded files
UPLOAD_DIR = Path("/app/backend/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Subdirectories for different file types
(UPLOAD_DIR / "verification_documents").mkdir(exist_ok=True)
(UPLOAD_DIR / "verification_selfies").mkdir(exist_ok=True)
(UPLOAD_DIR / "driver_licenses").mkdir(exist_ok=True)
(UPLOAD_DIR / "driver_selfies").mkdir(exist_ok=True)
(UPLOAD_DIR / "dating_photos").mkdir(exist_ok=True)

@router.post("/verification/document")
async def upload_verification_document(
    request: Request,
    file: UploadFile = File(...)
):
    """Upload verification document (ID, passport, license)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and WebP are allowed.")
    
    # Validate file size (max 10MB)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size == 10MB.")
    
    # Generate unique filename
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{current_user.user_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = UPLOAD_DIR / "verification_documents" / unique_filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Return URL path (relative to backend)
    file_url = f"/api/uploads/verification_documents/{unique_filename}"
    
    return {
        "message": "Document uploaded successfully",
        "file_url": file_url,
        "filename": unique_filename
    }


@router.post("/verification/selfie")
async def upload_verification_selfie(
    request: Request,
    file: UploadFile = File(...)
):
    """Upload verification selfie for identity matching"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and WebP are allowed.")
    
    # Validate file size (max 10MB)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size == 10MB.")
    
    # Generate unique filename
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{current_user.user_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = UPLOAD_DIR / "verification_selfies" / unique_filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Return URL path (relative to backend)
    file_url = f"/api/uploads/verification_selfies/{unique_filename}"
    
    return {
        "message": "Selfie uploaded successfully",
        "file_url": file_url,
        "filename": unique_filename
    }


@router.post("/driver-license")
async def upload_driver_license(
    request: Request,
    file: UploadFile = File(...)
):
    """Upload driver's license photo for driver verification"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and WebP are allowed.")
    
    # Validate file size (max 10MB)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size == 10MB.")
    
    # Generate unique filename
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{current_user.user_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = UPLOAD_DIR / "driver_licenses" / unique_filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Return URL path (relative to backend)
    file_url = f"/api/uploads/driver_licenses/{unique_filename}"
    
    return {
        "message": "Driver license uploaded successfully",
        "file_url": file_url,
        "filename": unique_filename
    }


@router.post("/driver-selfie")
async def upload_driver_selfie(
    request: Request,
    file: UploadFile = File(...)
):
    """Upload selfie for driver license verification"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, and WebP are allowed.")
    
    # Validate file size (max 10MB)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size == 10MB.")
    
    # Generate unique filename
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{current_user.user_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = UPLOAD_DIR / "driver_selfies" / unique_filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Return URL path (relative to backend)
    file_url = f"/api/uploads/driver_selfies/{unique_filename}"
    
    return {
        "message": "Driver selfie uploaded successfully",
        "file_url": file_url,
        "filename": unique_filename
    }


@router.post("/dating-photo")
async def upload_dating_photo(
    request: Request,
    file: UploadFile = File(...)
):
    """Upload dating profile photo with chunked upload support"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate file type (images and videos)
    allowed_types = [
        "image/jpeg", "image/jpg", "image/png", "image/webp",
        "video/mp4", "video/quicktime", "video/webm"
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Only JPEG, PNG, WebP, MP4, MOV, and WebM are allowed."
        )
    
    # Validate file size (max 50MB for videos, 10MB for images)
    max_size = 50 * 1024 * 1024 if "video" in file.content_type else 10 * 1024 * 1024
    
    # Read file in chunks to handle large files
    file_content = bytearray()
    chunk_size = 1024 * 1024  # 1MB chunks
    
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        file_content.extend(chunk)
        
        if len(file_content) > max_size:
            raise HTTPException(
                status_code=400, 
                detail=f"File too large. Maximum size is {max_size // (1024 * 1024)}MB."
            )
    
    # Generate unique filename
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{current_user.user_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = UPLOAD_DIR / "dating_photos" / unique_filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Return URL path (relative to backend)
    file_url = f"/api/uploads/dating_photos/{unique_filename}"
    
    return {
        "success": True,
        "message": "File uploaded successfully",
        "file_url": file_url,
        "filename": unique_filename
    }



# ============== GENERIC DIRECT-UPLOAD ENDPOINT ==============
# Spec: Direct_Upload_Implementation_Guide.pdf
# Replaces "paste a URL" inputs across the app (cover photos,
# walkthrough videos, commercial clips, dish sizzles, atmosphere
# loops, dish overlays, partner PDFs) with a single in-app uploader
# so people stay inside Global Vibez instead of opening external
# host links.
#
# Buckets are routed by the `kind` form field:
#   - cover            (venue / restaurant cover photo)
#   - walkthrough      (3D / 360° walkthrough video)
#   - commercial       (Vibe Artisan / restaurant commercial)
#   - dish_sizzle      (5-10s payment success clip)
#   - atmosphere_loop  (silent ambient background loop)
#   - menu_pdf         (restaurant PDF menu)
#   - generic          (catch-all)
#
# Allowed types per the PDF: .MP4, .MOV, .PDF — plus the standard
# image set for cover photos.
(UPLOAD_DIR / "media").mkdir(exist_ok=True)

ALLOWED_IMAGE = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO = {"video/mp4", "video/quicktime", "video/webm"}
ALLOWED_PDF = {"application/pdf"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024     # 10 MB
MAX_VIDEO_BYTES = 100 * 1024 * 1024    # 100 MB
MAX_PDF_BYTES = 25 * 1024 * 1024       # 25 MB

VALID_KINDS = {
    "cover",
    "walkthrough",
    "commercial",
    "dish_sizzle",
    "atmosphere_loop",
    "menu_pdf",
    "generic",
}


@router.post("/media")
async def upload_media(
    request: Request,
    kind: str = "generic",
    file: UploadFile = File(...),
):
    """Direct-upload endpoint replacing every external URL field."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if kind not in VALID_KINDS:
        raise HTTPException(400, f"kind must be one of {sorted(VALID_KINDS)}")

    ctype = (file.content_type or "").lower()
    is_image = ctype in ALLOWED_IMAGE
    is_video = ctype in ALLOWED_VIDEO
    is_pdf = ctype in ALLOWED_PDF
    if not (is_image or is_video or is_pdf):
        raise HTTPException(
            400,
            f"Unsupported type {ctype}. Allowed: images (jpg/png/webp/gif), "
            "videos (mp4/mov/webm), or PDF.",
        )

    body = await file.read()
    size = len(body)
    cap = MAX_IMAGE_BYTES if is_image else MAX_VIDEO_BYTES if is_video else MAX_PDF_BYTES
    if size > cap:
        raise HTTPException(
            400,
            f"File too large ({size // (1024 * 1024)} MB). "
            f"Max for this type is {cap // (1024 * 1024)} MB.",
        )

    ext = (file.filename or "").rsplit(".", 1)[-1].lower() or (
        "mp4" if is_video else "pdf" if is_pdf else "jpg"
    )
    unique = f"{current_user.user_id}_{uuid.uuid4().hex[:10]}.{ext}"
    bucket = UPLOAD_DIR / "media" / kind
    bucket.mkdir(parents=True, exist_ok=True)
    target = bucket / unique
    with open(target, "wb") as f:
        f.write(body)

    file_url = f"/api/uploads/media/{kind}/{unique}"

    # Auto-thumbnail: pull frame @ 2-second mark for any video upload so
    # callers can use it as a cover photo without a second upload step.
    thumb_url: Optional[str] = None
    if is_video:
        try:
            import subprocess

            thumb_name = unique.rsplit(".", 1)[0] + "_thumb.jpg"
            thumb_path = bucket / thumb_name
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-ss",
                    "00:00:02",
                    "-i",
                    str(target),
                    "-frames:v",
                    "1",
                    "-q:v",
                    "3",
                    "-vf",
                    "scale=720:-2",
                    str(thumb_path),
                ],
                check=False,
                capture_output=True,
                timeout=30,
            )
            if thumb_path.exists() and thumb_path.stat().st_size > 0:
                thumb_url = f"/api/uploads/media/{kind}/{thumb_name}"
        except Exception:
            # Non-fatal — caller can still use the video without a thumbnail.
            thumb_url = None

    return {
        "success": True,
        "kind": kind,
        "file_url": file_url,
        "thumbnail_url": thumb_url,
        "filename": unique,
        "size_bytes": size,
        "content_type": ctype,
    }
