"""
Referral & Affiliate System
Users earn by inviting friends
Feature #4 of 35
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from uuid import uuid4
from config import get_database
import secrets
import string

router = APIRouter(prefix="/referrals", tags=["referrals"])

# Referral rewards configuration
REFERRAL_REWARDS = {
    "referrer_bonus": 10.00,  # $10 when friend signs up
    "referee_bonus": 5.00,    # $5 for new user
    "commission_rate": 0.05,  # 5% of friend's spending
    "tier_bonuses": {
        5: 50.00,   # Refer 5 friends: $50 bonus
        10: 150.00, # Refer 10 friends: $150 bonus
        25: 500.00, # Refer 25 friends: $500 bonus
        50: 1500.00 # Refer 50 friends: $1500 bonus
    }
}

class ReferralCodeCreate(BaseModel):
    user_id: str
    custom_code: Optional[str] = None

class ReferralSignup(BaseModel):
    new_user_id: str
    referral_code: str

def generate_referral_code() -> str:
    """Generate unique referral code"""
    """Generate unique referral code using cryptographically secure random"""
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(8))
async def create_referral_code(request: ReferralCodeCreate) -> Dict[str, Any]:
    """Create referral code for user"""
    db = get_database()
    
    # Check if user already has a code
    existing = await db.referral_codes.find_one({"user_id": request.user_id}, {"_id": 0})
    if existing:
        return {
            "success": True,
            "referral_code": existing,
            "message": "Using existing referral code"
        }
    
    # Generate or use custom code
    code = request.custom_code or generate_referral_code()
    
    # Check if code already exists
    if await db.referral_codes.find_one({"code": code}, {"_id": 0}):
        raise HTTPException(status_code=400, detail="Referral code already exists")
    
    referral_code = {
        "code": code,
        "user_id": request.user_id,
        "total_referrals": 0,
        "total_earnings": 0,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.referral_codes.insert_one(referral_code)
    
    return {
        "success": True,
        "referral_code": referral_code,
        "share_link": f"https://globalvibez.com/signup?ref={code}"
    }

@router.post("/apply-referral")
async def apply_referral_code(request: ReferralSignup) -> Dict[str, Any]:
    """Apply referral code when new user signs up"""
    db = get_database()
    
    # Get referral code
    referral = await db.referral_codes.find_one({"code": request.referral_code}, {"_id": 0})
    if not referral:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    # Check if new user already used a referral
    if await db.referral_signups.find_one({"new_user_id": request.new_user_id}, {"_id": 0}):
        raise HTTPException(status_code=400, detail="User already used a referral code")
    
    # Create referral signup record
    signup = {
        "signup_id": str(uuid4()),
        "referrer_id": referral["user_id"],
        "new_user_id": request.new_user_id,
        "referral_code": request.referral_code,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.referral_signups.insert_one(signup)
    
    # Update referral code stats
    await db.referral_codes.update_one(
        {"code": request.referral_code},
        {"$inc": {"total_referrals": 1}}
    )
    
    # Grant bonuses
    # Referrer bonus
    await db.users.update_one(
        {"user_id": referral["user_id"]},
        {"$inc": {"balance": REFERRAL_REWARDS["referrer_bonus"]}}
    )
    
    # Referee bonus
    await db.users.update_one(
        {"user_id": request.new_user_id},
        {"$inc": {"balance": REFERRAL_REWARDS["referee_bonus"]}}
    )
    
    # Check for tier bonuses
    total_refs = referral["total_referrals"] + 1
    if total_refs in REFERRAL_REWARDS["tier_bonuses"]:
        tier_bonus = REFERRAL_REWARDS["tier_bonuses"][total_refs]
        await db.users.update_one(
            {"user_id": referral["user_id"]},
            {"$inc": {"balance": tier_bonus}}
        )
    
    return {
        "success": True,
        "message": "Referral applied! Both users received bonuses.",
        "referrer_bonus": REFERRAL_REWARDS["referrer_bonus"],
        "referee_bonus": REFERRAL_REWARDS["referee_bonus"]
    }

@router.get("/my-referrals/{user_id}")
async def get_user_referrals(user_id: str) -> Dict[str, Any]:
    """Get user's referral stats and earnings"""
    db = get_database()
    
    # Get referral code
    code = await db.referral_codes.find_one({"user_id": user_id}, {"_id": 0})
    if not code:
        return {
            "success": True,
            "has_code": False,
            "message": "Create a referral code to start earning"
        }
    
    # Get all signups from this code
    signups = await db.referral_signups.find(
        {"referrer_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Calculate total earnings
    total_earnings = (
        len(signups) * REFERRAL_REWARDS["referrer_bonus"] +
        sum(REFERRAL_REWARDS["tier_bonuses"].get(milestone, 0) 
            for milestone in REFERRAL_REWARDS["tier_bonuses"] 
            if len(signups) >= milestone)
    )
    
    return {
        "success": True,
        "referral_code": code,
        "total_referrals": len(signups),
        "total_earnings": total_earnings,
        "signups": signups,
        "next_milestone": next((m for m in sorted(REFERRAL_REWARDS["tier_bonuses"].keys()) if m > len(signups)), None)
    }

@router.post("/track-commission/{user_id}")
async def track_referral_commission(user_id: str, amount: float) -> Dict[str, Any]:
    """
    Track commission from referred user's spending.
    Called by payment processing when referred user makes a purchase.
    """
    db = get_database()
    
    # Check if this user was referred
    signup = await db.referral_signups.find_one({"new_user_id": user_id}, {"_id": 0})
    if not signup:
        return {"success": True, "message": "User not referred"}
    
    # Calculate commission
    commission = amount * REFERRAL_REWARDS["commission_rate"]
    
    # Grant commission to referrer
    await db.users.update_one(
        {"user_id": signup["referrer_id"]},
        {"$inc": {"balance": commission}}
    )
    
    # Record commission
    await db.referral_commissions.insert_one({
        "commission_id": str(uuid4()),
        "referrer_id": signup["referrer_id"],
        "referee_id": user_id,
        "amount": commission,
        "from_purchase": amount,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "commission_paid": commission,
        "to_user": signup["referrer_id"]
    }

@router.get("/leaderboard")
async def get_referral_leaderboard(limit: int = 50) -> Dict[str, Any]:
    """Get top referrers"""
    db = get_database()
    
    leaderboard = await db.referral_codes.aggregate([
        {"$sort": {"total_referrals": -1}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "user_id",
                "as": "user"
            }
        },
        {"$unwind": "$user"},
        {
            "$project": {
                "_id": 0,
                "code": 1,
                "username": "$user.username",
                "total_referrals": 1,
                "total_earnings": 1
            }
        }
    ]).to_list(limit)
    
    return {
        "success": True,
        "leaderboard": leaderboard
    }
