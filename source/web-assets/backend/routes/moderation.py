"""
Moderation & Safety System
Shadow-ban, hardware ban, currency freeze, global blocks, AI filtering with Claude Sonnet 4
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from utils.database import get_database, get_current_user
from services.ai_content_filter import moderate_message
from services.ai_moderation import ai_moderator  # NEW: Claude AI moderation
import uuid
import hashlib

router = APIRouter(prefix="/moderation", tags=["moderation"])

# ==================== MODELS ====================

class ReportUser(BaseModel):
    reported_user_id: str
    report_type: str  # "harassment", "inappropriate_content", "cheating", "minor", "spam"
    description: str
    context: str  # "dating_chat", "game_match", "stream_comment", "profile"
    evidence_urls: List[str] = []


class BlockUser(BaseModel):
    blocked_user_id: str
    reason: Optional[str] = None


class ModerationActionRequest(BaseModel):
    user_id: str
    action_type: str  # "shadow_ban", "hardware_ban", "currency_freeze", "warning"
    reason: str
    description: str
    duration_hours: Optional[int] = None


class FilterMessage(BaseModel):
    text: str
    context: str = "general"


# ==================== HELPER FUNCTIONS ====================

async def apply_shadow_ban(user_id: str, duration_hours: int, reason: str, db) -> dict:
    """Apply temporary shadow ban"""
    ban_until = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
    
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "is_shadow_banned": True,
                "shadow_ban_until": ban_until,
                "updated_at": datetime.now(timezone.utc)
            },
            "$inc": {"warning_count": 1}
        }
    )
    
    # Record action
    action = {
        "action_id": f"mod_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "moderator_id": "system",
        "action_type": "shadow_ban",
        "reason": reason,
        "description": f"Temporary shadow ban for {duration_hours} hours",
        "severity": "medium",
        "duration_hours": duration_hours,
        "expires_at": ban_until.isoformat(),
        "status": "active",
        "review_time": "<2h",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.moderation_actions.insert_one(action)
    
    return {
        "success": True,
        "action": "shadow_ban",
        "expires_at": ban_until.isoformat()
    }


async def apply_hardware_ban(user_id: str, hardware_id: str, reason: str, db) -> dict:
    """Apply permanent hardware ID ban"""
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "is_hardware_banned": True,
                "hardware_id": hardware_id,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Record action
    action = {
        "action_id": f"mod_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "moderator_id": "system",
        "action_type": "hardware_ban",
        "reason": reason,
        "description": "Permanent hardware ID ban",
        "severity": "critical",
        "status": "active",
        "review_time": "instant",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.moderation_actions.insert_one(action)
    await db.hardware_bans.insert_one({"hardware_id": hardware_id, "banned_at": datetime.now(timezone.utc).isoformat()})
    
    return {
        "success": True,
        "action": "hardware_ban",
        "permanent": True
    }


async def apply_currency_freeze(user_id: str, duration_hours: int, reason: str, db) -> dict:
    """Freeze user's currency (anti-cheat)"""
    freeze_until = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
    
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "currency_frozen": True,
                "currency_frozen_until": freeze_until,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Record action
    action = {
        "action_id": f"mod_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "moderator_id": "system",
        "action_type": "currency_freeze",
        "reason": reason,
        "description": f"Currency frozen for {duration_hours} hours",
        "severity": "high",
        "duration_hours": duration_hours,
        "expires_at": freeze_until.isoformat(),
        "status": "active",
        "review_time": "<24h",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.moderation_actions.insert_one(action)
    
    return {
        "success": True,
        "action": "currency_freeze",
        "expires_at": freeze_until.isoformat()
    }


def generate_hardware_id(request: Request) -> str:
    """Generate hardware fingerprint from request"""
    user_agent = request.headers.get("user-agent", "")
    ip_address = request.client.host if request.client else ""
    
    fingerprint = f"{user_agent}_{ip_address}"
    return hashlib.sha256(fingerprint.encode()).hexdigest()[:16]


# ==================== ENDPOINTS ====================

@router.post("/report")
async def report_user(report: ReportUser, request: Request) -> Dict[str, Any]:
    """Report a user for misconduct"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if user exists
    reported_user = await db.users.find_one({"user_id": report.reported_user_id}, {"_id": 0})
    if not reported_user:
        raise HTTPException(status_code=404, detail="Reported user not found")
    
    # Create report
    report_record = {
        "report_id": f"report_{uuid.uuid4().hex[:12]}",
        "reporter_user_id": current_user.user_id,
        "reported_user_id": report.reported_user_id,
        "report_type": report.report_type,
        "description": report.description,
        "context": report.context,
        "evidence_urls": report.evidence_urls,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_reports.insert_one(report_record)
    
    # Increment moderation flags
    await db.users.update_one(
        {"user_id": report.reported_user_id},
        {"$inc": {"moderation_flags": 1}}
    )
    
    # Auto-action for critical cases
    if report.report_type == "minor":
        # Instant hardware ban for minors
        hardware_id = generate_hardware_id(request)
        await apply_hardware_ban(
            report.reported_user_id,
            hardware_id,
            "Minor on platform",
            db
        )
        
        return {
            "success": True,
            "message": "Report submitted. Immediate action taken.",
            "action": "hardware_ban"
        }
    
    elif report.report_type == "harassment":
        # Shadow ban for 48 hours pending review
        await apply_shadow_ban(
            report.reported_user_id,
            48,
            "Harassment reported",
            db
        )
        
        return {
            "success": True,
            "message": "Report submitted. User shadow-banned pending review.",
            "action": "shadow_ban"
        }
    
    return {
        "success": True,
        "message": "Report submitted successfully",
        "report_id": report_record["report_id"]
    }


@router.post("/block")
async def block_user(block: BlockUser, request: Request) -> Dict[str, Any]:
    """Block user globally (cross-platform)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if already blocked
    existing = await db.blocked_users.find_one({
        "blocker_user_id": current_user.user_id,
        "blocked_user_id": block.blocked_user_id
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="User already blocked")
    
    # Create block record
    block_record = {
        "block_id": f"block_{uuid.uuid4().hex[:12]}",
        "blocker_user_id": current_user.user_id,
        "blocked_user_id": block.blocked_user_id,
        "reason": block.reason,
        "contexts": ["dating", "gaming", "streaming"],  # Global
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.blocked_users.insert_one(block_record)
    
    # Update user's blocked list
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$push": {"blocked_users": block.blocked_user_id},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {
        "success": True,
        "message": "User blocked across all contexts",
        "contexts": ["dating", "gaming", "streaming"]
    }


@router.post("/unblock")
async def unblock_user(user_id: str, request: Request) -> Dict[str, Any]:
    """Unblock a user"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Remove block record
    await db.blocked_users.delete_one({
        "blocker_user_id": current_user.user_id,
        "blocked_user_id": user_id
    })
    
    # Update user's blocked list
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {
            "$pull": {"blocked_users": user_id},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {"success": True, "message": "User unblocked"}


@router.post("/filter-message")
async def filter_message(message: FilterMessage) -> Dict[str, Any]:
    """Filter message content using AI"""
    result = moderate_message(message.text, message.context)
    return result


@router.get("/status")
async def get_moderation_status(request: Request) -> Dict[str, Any]:
    """Get current user's moderation status"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    # Check if bans expired
    now = datetime.now(timezone.utc)
    
    if user.get("is_shadow_banned") and user.get("shadow_ban_until"):
        ban_until = user["shadow_ban_until"]
        if isinstance(ban_until, str):
            ban_until = datetime.fromisoformat(ban_until)
        
        if now > ban_until:
            # Expire shadow ban
            await db.users.update_one(
                {"user_id": current_user.user_id},
                {"$set": {"is_shadow_banned": False, "shadow_ban_until": None}}
            )
            user["is_shadow_banned"] = False
    
    if user.get("currency_frozen") and user.get("currency_frozen_until"):
        freeze_until = user["currency_frozen_until"]
        if isinstance(freeze_until, str):
            freeze_until = datetime.fromisoformat(freeze_until)
        
        if now > freeze_until:
            # Expire currency freeze
            await db.users.update_one(
                {"user_id": current_user.user_id},
                {"$set": {"currency_frozen": False, "currency_frozen_until": None}}
            )
            user["currency_frozen"] = False
    
    return {
        "is_shadow_banned": user.get("is_shadow_banned", False),
        "shadow_ban_until": user.get("shadow_ban_until"),
        "is_hardware_banned": user.get("is_hardware_banned", False),
        "currency_frozen": user.get("currency_frozen", False),
        "currency_frozen_until": user.get("currency_frozen_until"),
        "warning_count": user.get("warning_count", 0),
        "moderation_flags": user.get("moderation_flags", 0),
        "blocked_users": user.get("blocked_users", [])
    }


@router.get("/blocked-users")
async def get_blocked_users(request: Request) -> Dict[str, Any]:
    """Get list of blocked users"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    blocks = await db.blocked_users.find(
        {"blocker_user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(1000)
    
    return {"blocked_users": blocks}


# ==================== ADMIN ENDPOINTS ====================

@router.post("/admin/take-action")
async def admin_take_action(action: ModerationActionRequest, request: Request) -> Dict[str, Any]:
    """Admin endpoint to take moderation action"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    # For now, allow any authenticated user (change for production)
    
    db = get_database()
    
    if action.action_type == "shadow_ban":
        result = await apply_shadow_ban(
            action.user_id,
            action.duration_hours or 48,
            action.reason,
            db
        )
    elif action.action_type == "hardware_ban":
        hardware_id = f"admin_ban_{uuid.uuid4().hex[:8]}"
        result = await apply_hardware_ban(
            action.user_id,
            hardware_id,
            action.reason,
            db
        )
    elif action.action_type == "currency_freeze":
        result = await apply_currency_freeze(
            action.user_id,
            action.duration_hours or 24,
            action.reason,
            db
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid action type")
    
    return result


@router.get("/admin/reports")
async def get_pending_reports(request: Request) -> Dict[str, Any]:
    """Get pending moderation reports"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    
    db = get_database()
    
    reports = await db.user_reports.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {"reports": reports}



# ==================== AI MODERATION ENDPOINTS (Claude Sonnet 4) ====================

class AIModerateMessageRequest(BaseModel):
    content: str
    user_id: Optional[str] = None
    context: Optional[dict] = None

class AIModerateProfileRequest(BaseModel):
    user_id: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[List[str]] = None

@router.post("/ai/check-message")
async def ai_check_message(request: AIModerateMessageRequest, req: Request) -> Dict[str, Any]:
    """
    AI-powered message moderation using Claude Sonnet 4
    Returns safety decision, severity, and recommended action
    """
    current_user = await get_current_user(req)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get user violation history
    user_history = None
    if request.user_id:
        user_doc = await db.users.find_one({"id": request.user_id}, {"_id": 0})
        if user_doc:
            user_history = {
                "violation_count": user_doc.get("violation_count", 0),
                "last_violation": user_doc.get("last_violation")
            }
    
    # Run AI moderation
    result = await ai_moderator.check_message(
        content=request.content,
        context=request.context,
        user_id=request.user_id,
        user_history=user_history
    )
    
    # Log moderation check
    await db.moderation_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "ai_message_check",
        "user_id": request.user_id or "unknown",
        "content": request.content,
        "result": result.dict(),
        "checked_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Auto-action if needed
    if not result.is_safe and result.recommended_action != "ALLOW":
        await auto_moderate_user(
            user_id=request.user_id,
            action=result.recommended_action,
            reason=result.explanation,
            severity=result.severity,
            db=db
        )
    
    return {
        "success": True,
        "moderation": result.dict()
    }

@router.post("/ai/check-profile")
async def ai_check_profile(request: AIModerateProfileRequest, req: Request) -> Dict[str, Any]:
    """AI-powered profile content moderation"""
    current_user = await get_current_user(req)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Run AI moderation on profile
    result = await ai_moderator.check_profile_content(
        bio=request.bio,
        interests=request.interests,
        display_name=request.display_name
    )
    
    db = get_database()
    
    # Log check
    await db.moderation_logs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "ai_profile_check",
        "user_id": request.user_id,
        "display_name": request.display_name,
        "result": result.dict(),
        "checked_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "moderation": result.dict()
    }

@router.get("/ai/moderation-queue")
async def get_ai_moderation_queue(request: Request, status: str = "pending") -> Dict[str, Any]:
    """Get AI-flagged content pending review"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    
    db = get_database()
    
    # Get recent flagged content
    flagged = await db.moderation_logs.find(
        {
            "result.is_safe": False,
            "result.severity": {"$in": ["HIGH", "CRITICAL"]}
        },
        {"_id": 0}
    ).sort("checked_at", -1).limit(100).to_list(100)
    
    return {
        "success": True,
        "queue": flagged,
        "total": len(flagged)
    }

async def auto_moderate_user(user_id: str, action: str, reason: str, severity: str, db) -> Dict[str, Any]:
    """
    Automatically take moderation action based on AI recommendation
    """
    if not user_id or user_id == "unknown":
        return
    
    action_map = {
        "WARN": lambda: send_warning(user_id, reason, db),
        "MUTE": lambda: apply_temp_mute(user_id, severity, reason, db),
        "BAN": lambda: apply_ban(user_id, severity, reason, db)
    }
    
    handler = action_map.get(action)
    if handler:
        await handler()
    
    # Update user violation count
    await db.users.update_one(
        {"id": user_id},
        {
            "$inc": {"violation_count": 1},
            "$set": {"last_violation": datetime.now(timezone.utc).isoformat()}
        }
    )

async def send_warning(user_id: str, reason: str, db) -> Dict[str, Any]:
    """Send warning to user"""
    await db.user_warnings.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "reason": reason,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    print(f"⚠️ Warning sent to user {user_id}: {reason}")

async def apply_temp_mute(user_id: str, severity: str, reason: str, db) -> Dict[str, Any]:
    """Apply temporary mute based on severity"""
    duration_hours = {
        "LOW": 1,
        "MEDIUM": 6,
        "HIGH": 24,
        "CRITICAL": 72
    }.get(severity, 24)
    
    await apply_shadow_ban(user_id, duration_hours, reason, db)
    print(f"🔇 User {user_id} muted for {duration_hours} hours: {reason}")

async def apply_ban(user_id: str, severity: str, reason: str, db) -> Dict[str, Any]:
    """Apply ban based on severity"""
    if severity == "CRITICAL":
        # Permanent ban
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_banned": True, "ban_reason": reason}}
        )
        print(f"🚫 User {user_id} PERMANENTLY banned: {reason}")
    else:
        # Temporary ban (7 days)
        await apply_shadow_ban(user_id, 168, reason, db)
        print(f"🚫 User {user_id} banned for 7 days: {reason}")
