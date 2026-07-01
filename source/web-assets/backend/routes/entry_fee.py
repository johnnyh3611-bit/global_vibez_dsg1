"""
B2P Entry Fee System
48-hour trial → $50 paywall for platform access
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime, timezone, timedelta
from services.payment_hub import StripeCheckout, CheckoutSessionRequest
from utils.database import get_database, get_current_user
import os
import uuid

router = APIRouter(prefix="/entry-fee", tags=["entry_fee"])

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
ENTRY_FEE_AMOUNT = 50.00  # $50 USD
TRIAL_DURATION_HOURS = 48

# ==================== MODELS ====================

class CheckTrialStatus(BaseModel):
    user_id: str


class StartTrialResponse(BaseModel):
    trial_started_at: str
    trial_expires_at: str
    hours_remaining: float
    access_tier: str


# ==================== HELPER FUNCTIONS ====================

async def check_user_access(user_id: str, db) -> dict:
    """Check user's access status (trial, paid, locked)"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return {"has_access": False, "reason": "user_not_found"}
    
    # Check if entry fee paid
    if user.get("entry_fee_paid", False):
        return {
            "has_access": True,
            "access_tier": "paid",
            "entry_fee_paid": True,
            "paid_at": user.get("entry_fee_paid_at")
        }
    
    # Check trial status
    trial_expires = user.get("trial_expires_at")
    if trial_expires:
        expires_dt = trial_expires if isinstance(trial_expires, datetime) else datetime.fromisoformat(trial_expires)
        # Ensure timezone-aware comparison
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        
        if now < expires_dt:
            hours_left = (expires_dt - now).total_seconds() / 3600
            return {
                "has_access": True,
                "access_tier": "trial",
                "trial_active": True,
                "trial_expires_at": trial_expires.isoformat() if isinstance(trial_expires, datetime) else trial_expires,
                "hours_remaining": round(hours_left, 1)
            }
        else:
            # Trial expired
            return {
                "has_access": False,
                "access_tier": "locked",
                "trial_expired": True,
                "trial_expired_at": trial_expires.isoformat() if isinstance(trial_expires, datetime) else trial_expires
            }
    
    # No trial started yet - auto-start on first check
    return {
        "has_access": False,
        "access_tier": "new_user",
        "needs_trial_start": True
    }


async def start_trial(user_id: str, db) -> dict:
    """Start 48-hour trial for new user"""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=TRIAL_DURATION_HOURS)
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "trial_started_at": now,
                "trial_expires_at": expires_at,
                "access_tier": "trial",
                "updated_at": now
            }
        }
    )
    
    if result.modified_count > 0:
        return {
            "success": True,
            "trial_started_at": now.isoformat(),
            "trial_expires_at": expires_at.isoformat(),
            "hours_remaining": TRIAL_DURATION_HOURS,
            "access_tier": "trial"
        }
    
    return {"success": False, "error": "Failed to start trial"}


# ==================== ENDPOINTS ====================

@router.get("/status")
async def get_entry_fee_status(request: Request) -> Dict[str, Any]:
    """Get user's entry fee and trial status"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    access_status = await check_user_access(current_user.user_id, db)
    
    # Auto-start trial for new users
    if access_status.get("needs_trial_start"):
        trial_result = await start_trial(current_user.user_id, db)
        if trial_result.get("success"):
            return {
                "entry_fee_paid": False,
                "trial_active": True,
                "trial_started_at": trial_result["trial_started_at"],
                "trial_expires_at": trial_result["trial_expires_at"],
                "hours_remaining": trial_result["hours_remaining"],
                "access_tier": "trial",
                "entry_fee_amount": ENTRY_FEE_AMOUNT
            }
    
    return {
        **access_status,
        "entry_fee_amount": ENTRY_FEE_AMOUNT
    }


@router.post("/start-trial")
async def manual_start_trial(request: Request) -> Dict[str, Any]:
    """Manually start trial (fallback endpoint)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    # Check if trial already started or entry fee paid
    if user.get("trial_started_at") or user.get("entry_fee_paid"):
        raise HTTPException(status_code=400, detail="Trial already started or entry fee already paid")
    
    result = await start_trial(current_user.user_id, db)
    
    if result.get("success"):
        return result
    else:
        raise HTTPException(status_code=500, detail="Failed to start trial")


@router.post("/purchase")
async def purchase_entry_fee(request: Request) -> Dict[str, Any]:
    """Create Stripe checkout session for $50 entry fee"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    # Check if already paid
    if user.get("entry_fee_paid"):
        raise HTTPException(status_code=400, detail="Entry fee already paid")
    
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
        
        frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")
        
        # emergentintegrations uses simple amount/currency format (amount in dollars)
        session_request = CheckoutSessionRequest(
            amount=ENTRY_FEE_AMOUNT,  # $50.00 in dollars
            currency="usd",
            success_url=f"{frontend_url}/entry-fee/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/entry-fee/cancel",
            metadata={
                "user_id": current_user.user_id,
                "type": "entry_fee",
                "amount": str(ENTRY_FEE_AMOUNT)
            }
        )
        
        session = await stripe_checkout.create_checkout_session(session_request)
        
        # Store pending payment
        payment_record = {
            "payment_id": f"entry_{uuid.uuid4().hex[:12]}",
            "user_id": current_user.user_id,
            "type": "entry_fee",
            "stripe_session_id": session.session_id,
            "amount": ENTRY_FEE_AMOUNT,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.entry_fee_payments.insert_one(payment_record)
        
        return {
            "success": True,
            "checkout_url": session.url,
            "session_id": session.session_id,
            "amount": ENTRY_FEE_AMOUNT
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")


@router.post("/verify-payment")
async def verify_entry_fee_payment(session_id: str, request: Request) -> Dict[str, Any]:
    """Verify Stripe payment and grant platform access"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
        status = await stripe_checkout.get_checkout_status(session_id)
        
        if status.status != "complete":
            raise HTTPException(status_code=400, detail="Payment not completed")
        
        # Verify metadata matches user
        if status.metadata.get("user_id") != current_user.user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Check if already processed
        existing_payment = await db.entry_fee_payments.find_one({
            "stripe_session_id": session_id,
            "status": "completed"
        }, {"_id": 0})
        
        if existing_payment:
            return {
                "success": True,
                "message": "Payment already processed",
                "access_granted": True
            }
        
        # Grant platform access
        now = datetime.now(timezone.utc)
        await db.users.update_one(
            {"user_id": current_user.user_id},
            {
                "$set": {
                    "entry_fee_paid": True,
                    "entry_fee_amount": ENTRY_FEE_AMOUNT,
                    "entry_fee_paid_at": now,
                    "access_tier": "paid",
                    "guest_passes_available": 3,  # Grant 3 guest passes on purchase
                    "updated_at": now
                }
            }
        )
        
        # Update payment record
        await db.entry_fee_payments.update_one(
            {"stripe_session_id": session_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": now.isoformat()
                }
            }
        )
        
        return {
            "success": True,
            "message": "Entry fee verified! Welcome to Global Vibez DSG.",
            "access_granted": True,
            "entry_fee_paid": True,
            "guest_passes_granted": 3
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to verify payment: {str(e)}")


@router.post("/send-guest-pass")
async def send_guest_pass(recipient_email: str, request: Request) -> Dict[str, Any]:
    """Send 24-hour guest pass to a friend"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    # Check if user has paid entry fee
    if not user.get("entry_fee_paid"):
        raise HTTPException(status_code=403, detail="Must purchase entry fee to send guest passes")
    
    # Check if user has available passes
    if user.get("guest_passes_available", 0) <= 0:
        raise HTTPException(status_code=400, detail="No guest passes available")
    
    # Create guest pass code
    guest_pass_code = f"GP{uuid.uuid4().hex[:8].upper()}"
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    
    guest_pass = {
        "code": guest_pass_code,
        "sender_user_id": current_user.user_id,
        "sender_name": user.get("name", "A friend"),
        "recipient_email": recipient_email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
        "used": False,
        "used_by": None
    }
    
    await db.guest_passes.insert_one(guest_pass)
    
    # Decrement available passes
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$inc": {"guest_passes_available": -1},
            "$push": {"guest_passes_sent": recipient_email}
        }
    )
    
    return {
        "success": True,
        "guest_pass_code": guest_pass_code,
        "recipient_email": recipient_email,
        "expires_in_hours": 24,
        "remaining_passes": user.get("guest_passes_available", 0) - 1
    }


@router.post("/redeem-guest-pass")
async def redeem_guest_pass(pass_code: str, request: Request) -> Dict[str, Any]:
    """Redeem guest pass for 24-hour trial"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Find guest pass
    guest_pass = await db.guest_passes.find_one({"code": pass_code}, {"_id": 0})
    
    if not guest_pass:
        raise HTTPException(status_code=404, detail="Invalid guest pass code")
    
    if guest_pass.get("used"):
        raise HTTPException(status_code=400, detail="Guest pass already used")
    
    # Check expiration
    expires_at = datetime.fromisoformat(guest_pass["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Guest pass expired")
    
    # Grant 24-hour access
    now = datetime.now(timezone.utc)
    trial_expires = now + timedelta(hours=24)
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$set": {
                "trial_started_at": now,
                "trial_expires_at": trial_expires,
                "access_tier": "trial",
                "updated_at": now
            }
        }
    )
    
    # Mark guest pass as used
    await db.guest_passes.update_one(
        {"code": pass_code},
        {
            "$set": {
                "used": True,
                "used_by": current_user.user_id,
                "used_at": now.isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "message": "Guest pass redeemed! Enjoy 24 hours of full access.",
        "trial_expires_at": trial_expires.isoformat(),
        "sender": guest_pass.get("sender_name")
    }


# Export helper for middleware
__all__ = ['check_user_access']
