from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any
from utils.database import get_database, get_current_user
from models.verification import DriverLicenseUpload, DriverLicenseReview
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/driver-verification", tags=["driver_verification"])

# ==================== USER ENDPOINTS ====================

@router.post("/upload")
async def upload_driver_license(license_data: DriverLicenseUpload, request: Request) -> Dict[str, Any]:
    """Submit driver's license for verification"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if user is age verified (18+)
    if not current_user.age_verified:
        raise HTTPException(
            status_code=403, 
            detail="You must complete age verification (18+) before applying for driver verification"
        )
    
    # Check if user already has a pending or approved driver license verification
    existing = await db.driver_license_verifications.find_one({
        "user_id": current_user.user_id,
        "status": {"$in": ["pending", "approved"]}
    }, {"_id": 0})
    
    if existing:
        if existing["status"] == "approved":
            raise HTTPException(status_code=400, detail="Your driver's license is already verified")
        elif existing["status"] == "pending":
            raise HTTPException(status_code=400, detail="You already have a pending driver license verification request")
    
    # Create driver license verification request
    verification_id = f"dlv_{uuid.uuid4().hex[:12]}"
    verification_request = {
        "verification_id": verification_id,
        "user_id": current_user.user_id,
        "license_url": license_data.license_url,
        "selfie_url": license_data.selfie_url,
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
        "license_number_last4": None,
        "license_expiry_date": None,
        "license_state": None,
        "verification_notes": None,
        "rejection_reason": None
    }
    
    await db.driver_license_verifications.insert_one(verification_request)
    
    # Update user status to pending
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "driver_license_status": "pending",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Driver license verification request submitted successfully",
        "verification_id": verification_id,
        "status": "pending"
    }


@router.get("/status")
async def get_driver_license_status(request: Request) -> Dict[str, Any]:
    """Get current driver license verification status for the logged-in user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get latest driver license verification request
    verification = await db.driver_license_verifications.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0},
        sort=[("submitted_at", -1)]
    )
    
    if not verification:
        return {
            "status": "unverified",
            "message": "No driver license verification request found. Please upload your driver's license to get verified for Vibes Rides.",
            "age_verified": current_user.age_verified
        }
    
    response = {
        "status": verification["status"],
        "verification_id": verification["verification_id"],
        "submitted_at": verification["submitted_at"],
        "age_verified": current_user.age_verified
    }
    
    if verification["status"] == "approved":
        response["message"] = "Your driver's license has been verified! You can now register as a driver for Vibes Rides."
        response["verified_at"] = verification["reviewed_at"]
        response["license_expiry_date"] = verification.get("license_expiry_date")
    elif verification["status"] == "pending":
        response["message"] = "Your driver license verification is under review. This usually takes 24-48 hours."
    elif verification["status"] == "denied":
        response["message"] = "Your driver license verification was denied. Please resubmit with a clear photo."
        response["rejection_reason"] = verification.get("rejection_reason")
    
    return response


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/pending")
async def get_pending_driver_verifications(request: Request, limit: int = 50) -> Dict[str, Any]:
    """Get all pending driver license verification requests (ADMIN ONLY)"""
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
    
    pending_verifications = await db.driver_license_verifications.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("submitted_at", 1).limit(limit).to_list(limit)
    
    # Enrich with user data
    for verification in pending_verifications:
        user = await db.users.find_one(
            {"user_id": verification["user_id"]},
            {"_id": 0, "name": 1, "email": 1, "age": 1, "age_verified": 1, "created_at": 1}
        )
        if user:
            verification["user_info"] = user
    
    return {
        "pending_count": len(pending_verifications),
        "verifications": pending_verifications
    }


@router.post("/admin/review")
async def review_driver_license(review: DriverLicenseReview, request: Request) -> Dict[str, Any]:
    """Approve or deny a driver license verification request (ADMIN ONLY)"""
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
    verification = await db.driver_license_verifications.find_one(
        {"verification_id": review.verification_id},
        {"_id": 0}
    )
    
    if not verification:
        raise HTTPException(status_code=404, detail="Driver license verification request not found")
    
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
        update_data["license_number_last4"] = review.license_number_last4
        update_data["license_expiry_date"] = review.license_expiry_date
        update_data["license_state"] = review.license_state
    elif review.status == "denied":
        update_data["rejection_reason"] = review.rejection_reason
    
    await db.driver_license_verifications.update_one(
        {"verification_id": review.verification_id},
        {"$set": update_data}
    )
    
    # Update user status
    user_update = {
        "driver_license_status": review.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if review.status == "approved":
        user_update["is_driver_verified"] = True
        user_update["driver_license_number"] = review.license_number_last4
        user_update["license_expiry_date"] = review.license_expiry_date
        user_update["driver_license_state"] = review.license_state
    
    await db.users.update_one(
        {"user_id": verification["user_id"]},
        {"$set": user_update}
    )
    
    return {
        "message": f"Driver license verification {review.status}",
        "verification_id": review.verification_id,
        "user_id": verification["user_id"]
    }


@router.get("/admin/stats")
async def get_driver_verification_stats(request: Request) -> Dict[str, Any]:
    """Get driver license verification statistics (ADMIN ONLY)"""
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
    age_verified_users = await db.users.count_documents({"age_verified": True})
    driver_verified_users = await db.users.count_documents({"is_driver_verified": True})
    pending_verifications = await db.driver_license_verifications.count_documents({"status": "pending"})
    approved_verifications = await db.driver_license_verifications.count_documents({"status": "approved"})
    denied_verifications = await db.driver_license_verifications.count_documents({"status": "denied"})
    
    return {
        "total_users": total_users,
        "age_verified_users": age_verified_users,
        "driver_verified_users": driver_verified_users,
        "pending_verifications": pending_verifications,
        "approved_verifications": approved_verifications,
        "denied_verifications": denied_verifications,
        "driver_verification_rate": round((driver_verified_users / age_verified_users * 100) if age_verified_users > 0 else 0, 1)
    }
