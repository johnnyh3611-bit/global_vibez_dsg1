from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import uuid
import os

router = APIRouter(prefix="/insurance-verification", tags=["insurance_verification"])

# Upload directory
UPLOAD_DIR = "/app/backend/uploads/insurance"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ==================== MODELS ====================

class InsuranceSubmission(BaseModel):
    insurance_provider: str
    policy_number: str
    expiry_date: str  # ISO format
    vehicle_make: str
    vehicle_model: str
    vehicle_year: int
    vehicle_color: str
    license_plate: str


class InsuranceReview(BaseModel):
    user_id: str
    status: str  # 'approved' or 'rejected'
    admin_notes: Optional[str] = None


# ==================== ENDPOINTS ====================

@router.post("/submit")
async def submit_insurance(
    insurance_data: InsuranceSubmission,
    insurance_document: UploadFile = File(...),
    request: Request = None
):
    """Submit vehicle insurance for verification"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if driver license is verified first
    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not user_doc.get("is_driver_verified"):
        raise HTTPException(
            status_code=400,
            detail="Please verify your driver's license first before submitting insurance"
        )
    
    # Save insurance document
    file_ext = insurance_document.filename.split('.')[-1]
    filename = f"{current_user.user_id}_insurance_{uuid.uuid4().hex[:8]}.{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    with open(filepath, "wb") as f:
        content = await insurance_document.read()
        f.write(content)
    
    # Create insurance submission record
    submission = {
        "submission_id": f"ins_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "insurance_provider": insurance_data.insurance_provider,
        "policy_number": insurance_data.policy_number,
        "expiry_date": insurance_data.expiry_date,
        "vehicle_make": insurance_data.vehicle_make,
        "vehicle_model": insurance_data.vehicle_model,
        "vehicle_year": insurance_data.vehicle_year,
        "vehicle_color": insurance_data.vehicle_color,
        "license_plate": insurance_data.license_plate,
        "document_url": f"/uploads/insurance/{filename}",
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "admin_notes": None
    }
    
    await db.insurance_submissions.insert_one(submission)
    
    # Update user status
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "insurance_verification_status": "pending",
            "insurance_document_url": submission["document_url"],
            "insurance_provider": insurance_data.insurance_provider,
            "insurance_policy_number": insurance_data.policy_number,
            "insurance_expiry_date": insurance_data.expiry_date,
            "vehicle_make": insurance_data.vehicle_make,
            "vehicle_model": insurance_data.vehicle_model,
            "vehicle_year": insurance_data.vehicle_year,
            "vehicle_color": insurance_data.vehicle_color,
            "license_plate": insurance_data.license_plate
        }}
    )
    
    return {
        "message": "Insurance submitted successfully! Awaiting admin review.",
        "submission_id": submission["submission_id"],
        "status": "pending"
    }


@router.get("/status")
async def get_insurance_status(request: Request) -> Dict[str, Any]:
    """Get current user's insurance verification status"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    return {
        "has_insurance": user_doc.get("has_insurance", False),
        "status": user_doc.get("insurance_verification_status", "unverified"),
        "insurance_provider": user_doc.get("insurance_provider"),
        "policy_number": user_doc.get("insurance_policy_number"),
        "expiry_date": user_doc.get("insurance_expiry_date"),
        "vehicle": {
            "make": user_doc.get("vehicle_make"),
            "model": user_doc.get("vehicle_model"),
            "year": user_doc.get("vehicle_year"),
            "color": user_doc.get("vehicle_color"),
            "license_plate": user_doc.get("license_plate")
        },
        "verified_at": user_doc.get("insurance_verified_at"),
        "driver_license_verified": user_doc.get("is_driver_verified", False)
    }


@router.get("/admin/pending")
async def get_pending_insurance_submissions(request: Request) -> Dict[str, Any]:
    """Get all pending insurance submissions (Admin only)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    
    db = get_database()
    
    submissions = await db.insurance_submissions.find(
        {"status": "pending"},
        {"_id": 0}
    ).to_list(1000)
    
    # Get user details for each submission
    for submission in submissions:
        user = await db.users.find_one(
            {"user_id": submission["user_id"]},
            {"_id": 0, "name": 1, "email": 1, "user_id": 1}
        )
        submission["user"] = user
    
    return {"submissions": submissions, "count": len(submissions)}


@router.post("/admin/review")
async def review_insurance(review: InsuranceReview, request: Request) -> Dict[str, Any]:
    """Approve or reject insurance submission (Admin only)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    
    if review.status not in ["approved", "denied"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'denied'")
    
    db = get_database()
    
    # Update submission
    await db.insurance_submissions.update_one(
        {"user_id": review.user_id, "status": "pending"},
        {"$set": {
            "status": review.status,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "admin_notes": review.admin_notes
        }}
    )
    
    # Update user
    update_data = {
        "insurance_verification_status": review.status,
        "has_insurance": review.status == "approved"
    }
    
    if review.status == "approved":
        update_data["insurance_verified_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"user_id": review.user_id},
        {"$set": update_data}
    )
    
    return {
        "message": f"Insurance {review.status}",
        "user_id": review.user_id,
        "status": review.status
    }


@router.get("/check-eligibility")
async def check_ride_eligibility(request: Request) -> Dict[str, Any]:
    """Check if user is eligible to offer rides (both verifications required)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    driver_verified = user_doc.get("is_driver_verified", False)
    insurance_verified = user_doc.get("has_insurance", False)
    
    eligible = driver_verified and insurance_verified
    
    missing = []
    if not driver_verified:
        missing.append("driver_license")
    if not insurance_verified:
        missing.append("vehicle_insurance")
    
    return {
        "eligible": eligible,
        "driver_license_verified": driver_verified,
        "insurance_verified": insurance_verified,
        "missing_verifications": missing,
        "message": "You can offer rides!" if eligible else f"Please complete: {', '.join(missing)}"
    }
