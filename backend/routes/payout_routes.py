"""
Vibez Coins Payout API Routes

Handles user payout requests, 72-hour security holds, and cashout processing.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Dict, Any

from logic.treasury import (
    calculate_payout,
    calculate_security_release_date,
    validate_minimum_payout
)
from config import db

router = APIRouter(prefix="/api/v1/payout", tags=["Payouts"])


# === REQUEST MODELS ===

class PayoutRequest(BaseModel):
    user_id: str = Field(..., description="User ID requesting payout")
    coin_amount: int = Field(..., gt=0, description="Amount of Vibez Coins to cash out")
    payout_method: str = Field(default="paypal", description="Payout method (paypal, bank, etc.)")


class PayoutResponse(BaseModel):
    message: str
    payout_id: str
    gross_usd: float
    platform_fee: float
    net_payout: float
    release_date: datetime
    status: str


# === ENDPOINTS ===

@router.post("/request", response_model=PayoutResponse)
async def request_payout(request: PayoutRequest) -> Dict[str, Any]:
    """
    Request a payout (72-hour security hold).
    
    Process:
    1. Validate user has sufficient coins
    2. Calculate USD value and fees
    3. Deduct coins from user balance immediately (prevent double-spend)
    4. Create payout entry with 72-hour hold
    
    Returns:
        Payout details with release date
    """
    db_instance = db
    
    # === STEP 1: Validate User Balance ===
    user = await db_instance.users.find_one({"id": request.user_id}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_balance = user.get("credits_balance", 0)
    
    if user_balance < request.coin_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient Vibez Coins. You have ₵{user_balance}, requested ₵{request.coin_amount}"
        )
    
    # === STEP 2: Validate Minimum Payout ===
    if not validate_minimum_payout(request.coin_amount):
        raise HTTPException(
            status_code=400,
            detail="Minimum payout is ₵20,000 ($10.00)"
        )
    
    # === STEP 3: Calculate Payout ===
    payout_calc = calculate_payout(request.coin_amount)
    release_date = calculate_security_release_date()
    
    # === STEP 4: Create Payout Entry ===
    payout_entry = {
        "payout_id": f"PO-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{request.user_id[:8]}",
        "user_id": request.user_id,
        "username": user.get("username", "Unknown"),
        "coins_debited": request.coin_amount,
        "gross_usd": payout_calc["gross"],
        "platform_fee": payout_calc["fee"],
        "net_usd": payout_calc["net"],
        "payout_method": request.payout_method,
        "status": "security_hold",
        "request_date": datetime.utcnow(),
        "release_date": release_date,
        "approved_by": None,
        "approved_date": None,
        "completed_date": None
    }
    
    await db_instance.payouts.insert_one(payout_entry)
    
    # === STEP 5: Deduct Coins Immediately (Prevent Double-Spend) ===
    await db_instance.users.update_one(
        {"id": request.user_id},
        {
            "$inc": {"credits_balance": -request.coin_amount},
            "$set": {"last_payout_request": datetime.utcnow()}
        }
    )
    
    return PayoutResponse(
        message=f"Payout of ${payout_calc['net']} requested successfully. Verification takes 72 hours.",
        payout_id=payout_entry["payout_id"],
        gross_usd=payout_calc["gross"],
        platform_fee=payout_calc["fee"],
        net_payout=payout_calc["net"],
        release_date=release_date,
        status="security_hold"
    )


@router.get("/status/{payout_id}")
async def get_payout_status(payout_id: str) -> Dict[str, Any]:
    """
    Check status of a payout request.
    """
    db_instance = db
    
    payout = await db_instance.payouts.find_one({"payout_id": payout_id}, {"_id": 0})
    
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    # Calculate time remaining
    now = datetime.utcnow()
    release_date = payout.get("release_date")
    
    if release_date and now < release_date:
        hours_remaining = (release_date - now).total_seconds() / 3600
        payout["hours_remaining"] = round(hours_remaining, 1)
    else:
        payout["hours_remaining"] = 0
    
    return payout


@router.get("/my-payouts/{user_id}")
async def get_user_payouts(user_id: str, limit: int = 10) -> Dict[str, Any]:
    """
    Get all payout requests for a user.
    """
    db_instance = db
    
    payouts = await db_instance.payouts.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("request_date", -1).limit(limit).to_list(limit)
    
    return {
        "user_id": user_id,
        "total_payouts": len(payouts),
        "payouts": payouts
    }


@router.delete("/cancel/{payout_id}")
async def cancel_payout(payout_id: str, user_id: str) -> Dict[str, Any]:
    """
    Cancel a pending payout (only if still in security_hold).
    Refunds coins back to user.
    """
    db_instance = db
    
    payout = await db_instance.payouts.find_one({"payout_id": payout_id}, {"_id": 0})
    
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    if payout["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    if payout["status"] != "security_hold":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel payout with status: {payout['status']}"
        )
    
    # Refund coins
    await db_instance.users.update_one(
        {"id": user_id},
        {"$inc": {"credits_balance": payout["coins_debited"]}}
    )
    
    # Update payout status
    await db_instance.payouts.update_one(
        {"payout_id": payout_id},
        {
            "$set": {
                "status": "cancelled",
                "cancelled_date": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": "Payout cancelled successfully",
        "coins_refunded": payout["coins_debited"]
    }
