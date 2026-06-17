"""
Admin Treasury & Payout Management Routes

God-Mode endpoints for:
- Viewing pending payouts (72-hour queue)
- Approving/rejecting payouts
- Revenue analytics
- Coin circulation tracking
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from typing import Optional, Dict, Any

from logic.treasury import convert_coins_to_dollars
from config import db
from middleware.permissions import require_god_mode, require_manager
from utils.audit_logger import (
    record_staff_action,
    ACTION_PAYOUT_APPROVE,
    ACTION_PAYOUT_REJECT
)

router = APIRouter(prefix="/v1/admin", tags=["Admin - Treasury"])


# === ADMIN ENDPOINTS ===

@router.get("/pending-payouts", dependencies=[Depends(require_god_mode)])
async def get_pending_payouts() -> Dict[str, Any]:
    """
    Get all payouts in 72-hour security hold.
    
    Returns:
        List of pending payouts with time remaining
    """
    db_instance = db
    
    # Find all payouts in security hold
    pending = await db_instance.payouts.find(
        {"status": "security_hold"},
        {"_id": 0}
    ).sort("request_date", 1).to_list(1000)
    
    now = datetime.utcnow()
    
    # Calculate hours remaining for each
    for payout in pending:
        release_date = payout.get("release_date")
        if release_date and now < release_date:
            hours_remaining = (release_date - now).total_seconds() / 3600
            payout["hours_remaining"] = round(hours_remaining, 1)
            payout["is_ready"] = False
        else:
            payout["hours_remaining"] = 0
            payout["is_ready"] = True
    
    # Separate ready vs waiting
    ready = [p for p in pending if p["is_ready"]]
    waiting = [p for p in pending if not p["is_ready"]]
    
    return {
        "total_pending": len(pending),
        "ready_for_approval": len(ready),
        "still_in_hold": len(waiting),
        "ready": ready,
        "waiting": waiting,
        "all_pending": pending
    }


@router.post("/payout/approve/{payout_id}", dependencies=[Depends(require_god_mode)])
async def approve_payout(payout_id: str, admin_notes: Optional[str] = None, user = Depends(require_god_mode)):
    """
    Approve a payout (God-Mode only).
    
    Marks payout as approved and ready for processing.
    """
    db_instance = db
    
    payout = await db_instance.payouts.find_one({"payout_id": payout_id}, {"_id": 0})
    
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    if payout["status"] != "security_hold":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve payout with status: {payout['status']}"
        )
    
    # Check if 72 hours passed
    now = datetime.utcnow()
    if now < payout["release_date"]:
        hours_remaining = (payout["release_date"] - now).total_seconds() / 3600
        raise HTTPException(
            status_code=400,
            detail=f"Security hold not complete. {hours_remaining:.1f} hours remaining."
        )
    
    # Update payout status
    await db_instance.payouts.update_one(
        {"payout_id": payout_id},
        {
            "$set": {
                "status": "approved",
                "approved_date": datetime.utcnow(),
                "approved_by": user.get("id", "admin"),
                "admin_notes": admin_notes
            }
        }
    )
    
    # AUDIT LOG
    await record_staff_action(
        employee_id=user.get("id", "admin"),
        employee_name=user.get("username", "Admin"),
        action_type=ACTION_PAYOUT_APPROVE,
        action_detail=f"Approved payout of ${payout['net_usd']} for user {payout['username']}",
        target_id=payout_id,
        target_type="payout",
        metadata={
            "payout_id": payout_id,
            "user_id": payout["user_id"],
            "amount_usd": payout["net_usd"],
            "coins": payout["coins_debited"],
            "notes": admin_notes
        }
    )
    
    return {
        "message": "Payout approved successfully",
        "payout_id": payout_id,
        "net_amount": payout["net_usd"],
        "user_id": payout["user_id"]
    }


@router.post("/payout/reject/{payout_id}", dependencies=[Depends(require_god_mode)])
async def reject_payout(payout_id: str, reason: str, user = Depends(require_god_mode)):
    """
    Reject a payout and refund coins to user.
    """
    db_instance = db
    
    payout = await db_instance.payouts.find_one({"payout_id": payout_id}, {"_id": 0})
    
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    if payout["status"] not in ["security_hold", "approved"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject payout with status: {payout['status']}"
        )
    
    # Refund coins to user
    await db_instance.users.update_one(
        {"id": payout["user_id"]},
        {"$inc": {"credits_balance": payout["coins_debited"]}}
    )
    
    # Update payout
    await db_instance.payouts.update_one(
        {"payout_id": payout_id},
        {
            "$set": {
                "status": "rejected",
                "rejected_date": datetime.utcnow(),
                "rejection_reason": reason,
                "coins_refunded": payout["coins_debited"],
                "rejected_by": user.get("id", "admin")
            }
        }
    )
    
    # AUDIT LOG
    await record_staff_action(
        employee_id=user.get("id", "admin"),
        employee_name=user.get("username", "Admin"),
        action_type=ACTION_PAYOUT_REJECT,
        action_detail=f"Rejected payout of ${payout['net_usd']} for {payout['username']}. Reason: {reason}",
        target_id=payout_id,
        target_type="payout",
        metadata={
            "payout_id": payout_id,
            "user_id": payout["user_id"],
            "amount_usd": payout["net_usd"],
            "coins_refunded": payout["coins_debited"],
            "reason": reason
        }
    )
    
    return {
        "message": "Payout rejected and coins refunded",
        "coins_refunded": payout["coins_debited"]
    }


@router.get("/revenue-summary")
async def get_revenue_summary(user = Depends(require_manager)):
    """
    Get platform revenue analytics.
    
    Returns:
        - Total fees collected
        - Active coin circulation
        - Pending payout amounts
    """
    db_instance = db
    
    # === Total Platform Fees ===
    completed_payouts = await db_instance.payouts.aggregate([
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total_fees": {"$sum": "$platform_fee"}}}
    ]).to_list(1)
    
    total_fees = completed_payouts[0]["total_fees"] if completed_payouts else 0
    
    # === Pending Payouts ===
    pending_payouts = await db_instance.payouts.aggregate([
        {"$match": {"status": {"$in": ["security_hold", "approved"]}}},
        {"$group": {"_id": None, "total_pending_usd": {"$sum": "$net_usd"}}}
    ]).to_list(1)
    
    pending_usd = pending_payouts[0]["total_pending_usd"] if pending_payouts else 0
    
    # === Active Coin Circulation ===
    all_users = await db_instance.users.aggregate([
        {"$group": {"_id": None, "total_coins": {"$sum": "$credits_balance"}}}
    ]).to_list(1)
    
    total_coins = all_users[0]["total_coins"] if all_users else 0
    
    # === Total Users ===
    total_users = await db_instance.users.count_documents({})
    
    return {
        "total_fees_usd": round(total_fees, 2),
        "pending_payouts_usd": round(pending_usd, 2),
        "active_circulation_coins": total_coins,
        "active_circulation_usd": round(convert_coins_to_dollars(total_coins), 2),
        "total_users": total_users,
        "exchange_rate": "2,000 Coins = $1.00",
        "platform_fee": "5%"
    }


@router.get("/payout-history", dependencies=[Depends(require_god_mode)])
async def get_payout_history(status: Optional[str] = None, limit: int = 100) -> Dict[str, Any]:
    """
    Get payout history with optional status filter.
    
    Statuses: security_hold, approved, completed, rejected, cancelled
    """
    db_instance = db
    
    query = {"status": status} if status else {}
    
    payouts = await db_instance.payouts.find(
        query,
        {"_id": 0}
    ).sort("request_date", -1).limit(limit).to_list(limit)
    
    return {
        "count": len(payouts),
        "status_filter": status or "all",
        "payouts": payouts
    }


@router.post("/payout/complete/{payout_id}", dependencies=[Depends(require_god_mode)])
async def mark_payout_completed(payout_id: str, transaction_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Mark payout as completed (money sent to user).
    """
    db_instance = db
    
    payout = await db_instance.payouts.find_one({"payout_id": payout_id}, {"_id": 0})
    
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    if payout["status"] != "approved":
        raise HTTPException(
            status_code=400,
            detail="Payout must be approved before marking as completed"
        )
    
    await db_instance.payouts.update_one(
        {"payout_id": payout_id},
        {
            "$set": {
                "status": "completed",
                "completed_date": datetime.utcnow(),
                "transaction_id": transaction_id
            }
        }
    )
    
    return {
        "message": "Payout marked as completed",
        "payout_id": payout_id
    }
