"""
KYC/AML Compliance System
Age verification, identity verification, and anti-money laundering checks
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import base64

router = APIRouter(prefix="/kyc", tags=["KYC/AML"])


class AgeVerificationRequest(BaseModel):
    date_of_birth: str  # YYYY-MM-DD format
    country: str


class IdentityVerificationRequest(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str  # YYYY-MM-DD
    address_line1: str
    city: str
    state_province: str
    postal_code: str
    country: str
    ssn_last4: Optional[str] = None  # Last 4 digits only


class KYCStatus:
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    REQUIRES_REVIEW = "requires_review"


async def check_age_eligibility(date_of_birth: str, country: str) -> dict:
    """
    Verify user meets minimum age requirement
    """
    try:
        dob = datetime.strptime(date_of_birth, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Calculate age
    today = datetime.now()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    
    # Country-specific age requirements
    min_ages = {
        "US": 21,  # Varies by state, using most restrictive
        "GB": 18,
        "CA": 19,  # Varies by province
        "AU": 18,
        "NZ": 18,
        "default": 18
    }
    
    min_age = min_ages.get(country, min_ages["default"])
    
    if age < min_age:
        return {
            "eligible": False,
            "reason": f"Must be at least {min_age} years old in {country}",
            "min_age": min_age,
            "user_age": age
        }
    
    return {
        "eligible": True,
        "user_age": age,
        "verified_at": datetime.now(timezone.utc).isoformat()
    }


@router.post("/verify-age")
async def verify_age(request: AgeVerificationRequest, db) -> Dict[str, Any]:
    """
    Age verification endpoint
    """
    user_id = "user_from_session"  # Get from auth middleware
    
    eligibility = await check_age_eligibility(request.date_of_birth, request.country)
    
    if not eligibility["eligible"]:
        # Log failed attempt
        await db.kyc_logs.insert_one({
            "user_id": user_id,
            "action": "AGE_VERIFICATION_FAILED",
            "reason": eligibility["reason"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        raise HTTPException(
            status_code=403,
            detail=eligibility["reason"]
        )
    
    # Update user record
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "date_of_birth": request.date_of_birth,
                "age_verified": True,
                "age_verified_at": eligibility["verified_at"],
                "country": request.country
            }
        }
    )
    
    # Log successful verification
    await db.kyc_logs.insert_one({
        "user_id": user_id,
        "action": "AGE_VERIFICATION_SUCCESS",
        "age": eligibility["user_age"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Age verified successfully",
        "verified": True
    }


@router.post("/submit-identity")
async def submit_identity_verification(
    request: IdentityVerificationRequest,
    id_front: UploadFile = File(...),
    id_back: UploadFile = File(None),
    selfie: UploadFile = File(...),
    db = None
):
    """
    Submit identity documents for verification
    Required for first payout or deposits >$1000
    """
    user_id = "user_from_session"
    
    # Validate file types
    allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    
    if id_front.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type for ID front")
    
    # Read and encode files
    id_front_data = await id_front.read()
    selfie_data = await selfie.read()
    id_back_data = await id_back.read() if id_back else None
    
    # Store in database (in production, use S3/cloud storage)
    verification_doc = {
        "user_id": user_id,
        "status": KYCStatus.PENDING,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        
        # Personal information
        "first_name": request.first_name,
        "last_name": request.last_name,
        "date_of_birth": request.date_of_birth,
        "address": {
            "line1": request.address_line1,
            "city": request.city,
            "state": request.state_province,
            "postal_code": request.postal_code,
            "country": request.country
        },
        "ssn_last4": request.ssn_last4,
        
        # Documents (base64 encoded)
        "documents": {
            "id_front": base64.b64encode(id_front_data).decode(),
            "id_back": base64.b64encode(id_back_data).decode() if id_back_data else None,
            "selfie": base64.b64encode(selfie_data).decode()
        },
        
        # Metadata
        "verification_tier": "TIER_1",  # TIER_1: <$10k/year, TIER_2: >$10k/year
        "auto_verified": False,
        "reviewed_by": None,
        "reviewed_at": None
    }
    
    await db.kyc_verifications.insert_one(verification_doc)
    
    # Update user status
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "kyc_status": KYCStatus.PENDING,
                "kyc_submitted_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Log submission
    await db.kyc_logs.insert_one({
        "user_id": user_id,
        "action": "IDENTITY_VERIFICATION_SUBMITTED",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Identity verification submitted successfully",
        "status": KYCStatus.PENDING,
        "estimated_review_time": "24-48 hours",
        "next_steps": "You will be notified via email once verification is complete"
    }


@router.get("/status")
async def get_kyc_status(db) -> Dict[str, Any]:
    """
    Get user's KYC verification status
    """
    user_id = "user_from_session"
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    verification = await db.kyc_verifications.find_one(
        {"user_id": user_id},
        {"_id": 0, "documents": 0}  # Don't return document images
    )
    
    return {
        "kyc_status": user.get("kyc_status", "not_submitted"),
        "age_verified": user.get("age_verified", False),
        "verification_details": verification,
        "can_deposit": user.get("age_verified", False),
        "can_withdraw": user.get("kyc_status") == KYCStatus.VERIFIED,
        "withdrawal_limit": 50000 if user.get("kyc_status") == KYCStatus.VERIFIED else 0  # cents
    }


# AML Transaction Monitoring
class AMLMonitor:
    """
    Anti-Money Laundering transaction monitoring
    """
    
    # Suspicious activity thresholds
    THRESHOLDS = {
        "daily_deposit": 1000000,  # $10,000 USD
        "daily_withdrawal": 1000000,
        "rapid_deposits": 5,  # 5 deposits in 1 hour
        "round_amounts": 3,  # 3+ round amounts (e.g., $1000, $5000)
        "structuring": 900000  # Multiple deposits just under $10k
    }
    
    @staticmethod
    async def check_transaction(db, user_id: str, amount: int, transaction_type: str) -> dict:
        """
        Check transaction for suspicious patterns
        Returns: {
            "allowed": bool,
            "flags": list of suspicious patterns detected
        }
        """
        flags = []
        
        # Check daily volume
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
        daily_total = await db.transactions.aggregate([
            {
                "$match": {
                    "user_id": user_id,
                    "type": transaction_type,
                    "timestamp": {"$gte": today_start.isoformat()}
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        daily_amount = daily_total[0]["total"] if daily_total else 0
        
        if daily_amount + amount > AMLMonitor.THRESHOLDS["daily_deposit"]:
            flags.append("HIGH_DAILY_VOLUME")
        
        # Check for rapid deposits
        hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_count = await db.transactions.count_documents({
            "user_id": user_id,
            "type": transaction_type,
            "timestamp": {"$gte": hour_ago.isoformat()}
        })
        
        if recent_count >= AMLMonitor.THRESHOLDS["rapid_deposits"]:
            flags.append("RAPID_TRANSACTIONS")
        
        # Check for round amounts (possible structuring)
        if amount % 100000 == 0:  # Round thousands
            recent_round = await db.transactions.count_documents({
                "user_id": user_id,
                "type": transaction_type,
                "amount": {"$mod": [100000, 0]},
                "timestamp": {"$gte": today_start.isoformat()}
            })
            
            if recent_round >= AMLMonitor.THRESHOLDS["round_amounts"]:
                flags.append("SUSPICIOUS_ROUND_AMOUNTS")
        
        # If flags detected, create SAR (Suspicious Activity Report)
        if flags:
            await db.suspicious_activity_reports.insert_one({
                "user_id": user_id,
                "transaction_type": transaction_type,
                "amount": amount,
                "flags": flags,
                "status": "PENDING_REVIEW",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Block transaction if critical flags
        critical_flags = ["HIGH_DAILY_VOLUME", "RAPID_TRANSACTIONS"]
        should_block = any(flag in critical_flags for flag in flags)
        
        return {
            "allowed": not should_block,
            "flags": flags,
            "requires_review": len(flags) > 0
        }
