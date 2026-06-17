from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any
from utils.database import get_database, get_current_user
from models.verification import VerificationUpload, VerificationReview
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/verification", tags=["verification"])

# ==================== USER ENDPOINTS ====================

@router.post("/upload")
async def upload_verification(verification: VerificationUpload, request: Request) -> Dict[str, Any]:
    """Submit verification documents for review"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if user already has a pending or approved verification
    existing = await db.verification_requests.find_one({
        "user_id": current_user.user_id,
        "status": {"$in": ["pending", "approved"]}
    }, {"_id": 0})
    
    if existing:
        if existing["status"] == "approved":
            raise HTTPException(status_code=400, detail="You are already verified")
        elif existing["status"] == "pending":
            raise HTTPException(status_code=400, detail="You already have a pending verification request")
    
    # Create verification request
    verification_id = f"ver_{uuid.uuid4().hex[:12]}"
    verification_request = {
        "verification_id": verification_id,
        "user_id": current_user.user_id,
        "document_type": verification.document_type,
        "document_url": verification.document_url,
        "selfie_url": verification.selfie_url,
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
        "extracted_dob": None,
        "verification_notes": None,
        "rejection_reason": None
    }
    
    await db.verification_requests.insert_one(verification_request)
    
    # Update user status to pending
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "verification_status": "pending",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Verification request submitted successfully",
        "verification_id": verification_id,
        "status": "pending"
    }


@router.get("/status")
async def get_verification_status(request: Request) -> Dict[str, Any]:
    """Get current verification status for the logged-in user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get latest verification request
    verification = await db.verification_requests.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0},
        sort=[("submitted_at", -1)]
    )
    
    if not verification:
        return {
            "status": "unverified",
            "message": "No verification request found. Please upload your ID document."
        }
    
    response = {
        "status": verification["status"],
        "verification_id": verification["verification_id"],
        "document_type": verification["document_type"],
        "submitted_at": verification["submitted_at"]
    }
    
    if verification["status"] == "approved":
        response["message"] = "Your identity has been verified!"
        response["verified_at"] = verification["reviewed_at"]
    elif verification["status"] == "pending":
        response["message"] = "Your verification is under review. This usually takes 24-48 hours."
    elif verification["status"] == "denied":
        response["message"] = "Your verification was denied. Please resubmit with a clear photo."
        response["rejection_reason"] = verification.get("rejection_reason")
    
    return response


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/pending")
async def get_pending_verifications(request: Request, limit: int = 50) -> Dict[str, Any]:
    """Get all pending verification requests (ADMIN ONLY)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    # For now, we'll allow any authenticated user to access (should be restricted in production)
    
    db = get_database()
    
    pending_verifications = await db.verification_requests.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("submitted_at", 1).limit(limit).to_list(limit)
    
    # Enrich with user data
    for verification in pending_verifications:
        user = await db.users.find_one(
            {"user_id": verification["user_id"]},
            {"_id": 0, "name": 1, "email": 1, "age": 1, "created_at": 1}
        )
        if user:
            verification["user_info"] = user
    
    return {
        "pending_count": len(pending_verifications),
        "verifications": pending_verifications
    }


@router.post("/admin/review")
async def review_verification(review: VerificationReview, request: Request) -> Dict[str, Any]:
    """Approve or deny a verification request (ADMIN ONLY)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    
    db = get_database()
    
    # Get verification request
    verification = await db.verification_requests.find_one(
        {"verification_id": review.verification_id},
        {"_id": 0}
    )
    
    if not verification:
        raise HTTPException(status_code=404, detail="Verification request not found")
    
    if verification["status"] != "pending":
        raise HTTPException(status_code=400, detail="This verification has already been reviewed")
    
    # Update verification request
    update_data = {
        "status": review.status,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": current_user.user_id,
        "verification_notes": review.verification_notes
    }
    
    if review.status == "approved":
        update_data["extracted_dob"] = review.extracted_dob
    elif review.status == "denied":
        update_data["rejection_reason"] = review.rejection_reason
    
    await db.verification_requests.update_one(
        {"verification_id": review.verification_id},
        {"$set": update_data}
    )
    
    # Update user status
    user_update = {
        "verification_status": review.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if review.status == "approved":
        user_update["age_verified"] = True
        user_update["date_of_birth"] = review.extracted_dob
        
        # Calculate age from DOB if provided
        if review.extracted_dob:
            try:
                dob = datetime.fromisoformat(review.extracted_dob)
                today = datetime.now(timezone.utc)
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                user_update["age"] = age
            except ValueError:
                pass
    
    await db.users.update_one(
        {"user_id": verification["user_id"]},
        {"$set": user_update}
    )
    
    return {
        "message": f"Verification {review.status}",
        "verification_id": review.verification_id,
        "user_id": verification["user_id"]
    }


@router.get("/admin/stats")
async def get_verification_stats(request: Request) -> Dict[str, Any]:
    """Get verification statistics (ADMIN ONLY)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    
    db = get_database()
    
    total_users = await db.users.count_documents({})
    verified_users = await db.users.count_documents({"age_verified": True})
    pending_verifications = await db.verification_requests.count_documents({"status": "pending"})
    approved_verifications = await db.verification_requests.count_documents({"status": "approved"})
    denied_verifications = await db.verification_requests.count_documents({"status": "denied"})
    
    return {
        "total_users": total_users,
        "verified_users": verified_users,
        "pending_verifications": pending_verifications,
        "approved_verifications": approved_verifications,
        "denied_verifications": denied_verifications,
        "verification_rate": round((verified_users / total_users * 100) if total_users > 0 else 0, 1)
    }
