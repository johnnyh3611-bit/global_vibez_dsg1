from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
from pathlib import Path
import uuid
import os

router = APIRouter(prefix="/insurance-verification", tags=["insurance_verification"])

# Upload directory (env override; never hardcode a home path)
UPLOAD_DIR = os.environ.get(
    "UPLOADS_DIR",
    str(Path(__file__).resolve().parent.parent / "data" / "uploads"),
)
UPLOAD_DIR = os.path.join(UPLOAD_DIR, "insurance")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class InsuranceReview(BaseModel):
    user_id: str
    status: str  # 'approved' or 'denied'
    admin_notes: Optional[str] = None


@router.post("/submit")
async def submit_insurance(
    request: Request,
    insurance_provider: str = Form(...),
    policy_number: str = Form(...),
    expiry_date: str = Form(...),
    vehicle_make: str = Form(...),
    vehicle_model: str = Form(...),
    vehicle_year: int = Form(...),
    vehicle_color: str = Form(...),
    license_plate: str = Form(...),
    insurance_document: UploadFile = File(...),
):
    """Submit vehicle insurance for verification (multipart form)."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()

    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not user_doc or not user_doc.get("is_driver_verified"):
        raise HTTPException(
            status_code=400,
            detail="Please verify your driver's license first before submitting insurance",
        )

    pending = await db.insurance_submissions.find_one(
        {"user_id": current_user.user_id, "status": "pending"},
        {"_id": 0},
    )
    if pending:
        raise HTTPException(
            status_code=400,
            detail="You already have a pending insurance submission",
        )

    original = insurance_document.filename or "insurance.bin"
    file_ext = original.rsplit(".", 1)[-1] if "." in original else "bin"
    filename = f"{current_user.user_id}_insurance_{uuid.uuid4().hex[:8]}.{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await insurance_document.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 15MB.")

    with open(filepath, "wb") as f:
        f.write(content)

    submission = {
        "submission_id": f"ins_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "insurance_provider": insurance_provider,
        "policy_number": policy_number,
        "expiry_date": expiry_date,
        "vehicle_make": vehicle_make,
        "vehicle_model": vehicle_model,
        "vehicle_year": vehicle_year,
        "vehicle_color": vehicle_color,
        "license_plate": license_plate,
        "document_url": f"/uploads/insurance/{filename}",
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "admin_notes": None,
    }

    await db.insurance_submissions.insert_one(submission)

    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "insurance_verification_status": "pending",
            "insurance_document_url": submission["document_url"],
            "insurance_provider": insurance_provider,
            "insurance_policy_number": policy_number,
            "insurance_expiry_date": expiry_date,
            "vehicle_make": vehicle_make,
            "vehicle_model": vehicle_model,
            "vehicle_year": vehicle_year,
            "vehicle_color": vehicle_color,
            "license_plate": license_plate,
        }},
    )

    return {
        "message": "Insurance submitted successfully! Awaiting admin review.",
        "submission_id": submission["submission_id"],
        "status": "pending",
    }


@router.get("/status")
async def get_insurance_status(request: Request) -> Dict[str, Any]:
    """Get current user's insurance verification status"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0}) or {}

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
            "license_plate": user_doc.get("license_plate"),
        },
        "verified_at": user_doc.get("insurance_verified_at"),
        "driver_license_verified": user_doc.get("is_driver_verified", False),
    }


@router.get("/admin/pending")
async def get_pending_insurance_submissions(request: Request) -> Dict[str, Any]:
    """Get all pending insurance submissions (Admin only)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from utils.admin_guard import is_admin
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")

    db = get_database()
    submissions = await db.insurance_submissions.find(
        {"status": "pending"},
        {"_id": 0},
    ).to_list(1000)

    for submission in submissions:
        user = await db.users.find_one(
            {"user_id": submission["user_id"]},
            {"_id": 0, "name": 1, "email": 1, "user_id": 1},
        )
        submission["user"] = user

    return {"submissions": submissions, "count": len(submissions)}


@router.post("/admin/review")
async def review_insurance(review: InsuranceReview, request: Request) -> Dict[str, Any]:
    """Approve or reject insurance submission (Admin only)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from utils.admin_guard import is_admin
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")

    if review.status not in ["approved", "denied"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'denied'")

    db = get_database()

    await db.insurance_submissions.update_one(
        {"user_id": review.user_id, "status": "pending"},
        {"$set": {
            "status": review.status,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "admin_notes": review.admin_notes,
        }},
    )

    update_data = {
        "insurance_verification_status": review.status,
        "has_insurance": review.status == "approved",
    }
    if review.status == "approved":
        update_data["insurance_verified_at"] = datetime.now(timezone.utc).isoformat()

    await db.users.update_one(
        {"user_id": review.user_id},
        {"$set": update_data},
    )

    return {
        "message": f"Insurance {review.status}",
        "user_id": review.user_id,
        "status": review.status,
    }


@router.get("/check-eligibility")
async def check_ride_eligibility(request: Request) -> Dict[str, Any]:
    """Check if user is eligible to offer rides (both verifications required)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0}) or {}

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
        "message": "You can offer rides!" if eligible else f"Please complete: {', '.join(missing)}",
    }
