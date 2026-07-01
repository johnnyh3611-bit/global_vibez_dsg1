"""
User Reporting & Blocking System
Report users, report content, block/unblock users
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid
from utils.database import get_database, get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])

class ReportUserRequest(BaseModel):
    reported_user_id: str
    reason: str  # "harassment", "fake_profile", "inappropriate_content", "spam", "other"
    description: Optional[str] = None

class ReportContentRequest(BaseModel):
    content_type: str  # "photo", "message", "profile", "post"
    content_id: str
    reported_user_id: str
    reason: str
    description: Optional[str] = None

# ==================== REPORT USER ====================

@router.post("/user")
async def report_user(data: ReportUserRequest, request: Request) -> Dict[str, Any]:
    """Report a user for violations"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Create report
    report = {
        "report_id": f"report_{uuid.uuid4().hex[:16]}",
        "reporter_id": current_user.user_id,
        "reported_user_id": data.reported_user_id,
        "report_type": "user",
        "reason": data.reason,
        "description": data.description,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "action_taken": None
    }
    
    await db.user_reports.insert_one(report)
    report.pop("_id", None)
    
    return {
        "success": True,
        "message": "User reported successfully. Our team will review this report.",
        "report": report
    }


# ==================== REPORT CONTENT ====================

@router.post("/content")
async def report_content(data: ReportContentRequest, request: Request) -> Dict[str, Any]:
    """Report specific content for violations"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Create content report
    report = {
        "report_id": f"report_{uuid.uuid4().hex[:16]}",
        "reporter_id": current_user.user_id,
        "reported_user_id": data.reported_user_id,
        "content_type": data.content_type,
        "content_id": data.content_id,
        "reason": data.reason,
        "description": data.description,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "action_taken": None
    }
    
    await db.content_reports.insert_one(report)
    report.pop("_id", None)
    
    return {
        "success": True,
        "message": "Content reported successfully. Thank you for helping keep our community safe.",
        "report": report
    }


# ==================== BLOCK USER ====================

@router.post("/block/{user_id}")
async def block_user(user_id: str, request: Request) -> Dict[str, Any]:
    """Block a user (prevents all contact)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if already blocked
    existing = await db.blocked_users.find_one({
        "blocker_id": current_user.user_id,
        "blocked_id": user_id
    }, {"_id": 0})
    
    if existing:
        return {"success": True, "message": "User already blocked"}
    
    # Create block record
    block = {
        "block_id": f"block_{uuid.uuid4().hex[:16]}",
        "blocker_id": current_user.user_id,
        "blocked_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.blocked_users.insert_one(block)
    
    return {
        "success": True,
        "message": "User blocked successfully. You will no longer see their content or receive messages from them."
    }


@router.post("/unblock/{user_id}")
async def unblock_user(user_id: str, request: Request) -> Dict[str, Any]:
    """Unblock a user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    result = await db.blocked_users.delete_one({
        "blocker_id": current_user.user_id,
        "blocked_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not blocked")
    
    return {
        "success": True,
        "message": "User unblocked successfully"
    }


@router.get("/blocked")
async def get_blocked_users(request: Request) -> Dict[str, Any]:
    """Get list of blocked users"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    blocked = await db.blocked_users.find(
        {"blocker_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    # Get user details for blocked users
    blocked_user_ids = [b["blocked_id"] for b in blocked]
    users = await db.users.find(
        {"user_id": {"$in": blocked_user_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "photos": 1}
    ).to_list(1000)
    
    return {
        "blocked_users": users,
        "count": len(users)
    }


@router.get("/is-blocked/{user_id}")
async def check_if_blocked(user_id: str, request: Request) -> Dict[str, Any]:
    """Check if a user is blocked"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check both directions (if current user blocked them, or if they blocked current user)
    blocked_by_me = await db.blocked_users.find_one({
        "blocker_id": current_user.user_id,
        "blocked_id": user_id
    }, {"_id": 0})
    
    blocked_me = await db.blocked_users.find_one({
        "blocker_id": user_id,
        "blocked_id": current_user.user_id
    }, {"_id": 0})
    
    return {
        "blocked_by_me": blocked_by_me is not None,
        "blocked_me": blocked_me is not None,
        "can_contact": blocked_by_me is None and blocked_me is None
    }


# ==================== MY REPORTS ====================

@router.get("/my-reports")
async def get_my_reports(request: Request) -> Dict[str, Any]:
    """Get reports submitted by current user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    user_reports = await db.user_reports.find(
        {"reporter_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    content_reports = await db.content_reports.find(
        {"reporter_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "user_reports": user_reports,
        "content_reports": content_reports,
        "total": len(user_reports) + len(content_reports)
    }
