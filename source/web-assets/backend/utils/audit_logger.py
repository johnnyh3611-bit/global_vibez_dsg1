"""
Audit Logging System

Records all staff actions for accountability and security:
- Payout approvals/rejections
- Staff role changes
- User bans/unbans
- System configuration changes
"""

from datetime import datetime
from typing import Optional
from config import db


# === ACTION TYPE CONSTANTS ===

ACTION_PAYOUT_APPROVE = "PAYOUT_APPROVE"
ACTION_PAYOUT_REJECT = "PAYOUT_REJECT"
ACTION_PAYOUT_COMPLETE = "PAYOUT_COMPLETE"
ACTION_STAFF_INVITE = "STAFF_INVITE"
ACTION_STAFF_ROLE_CHANGE = "STAFF_ROLE_CHANGE"
ACTION_STAFF_REVOKE = "STAFF_REVOKE"
ACTION_USER_BAN = "USER_BAN"
ACTION_USER_UNBAN = "USER_UNBAN"
ACTION_COIN_ADJUST = "COIN_ADJUST"
ACTION_GAME_RESET = "GAME_RESET"
ACTION_CONFIG_CHANGE = "CONFIG_CHANGE"

ACTION_LABELS = {
    ACTION_PAYOUT_APPROVE: "Payout Approved",
    ACTION_PAYOUT_REJECT: "Payout Rejected",
    ACTION_PAYOUT_COMPLETE: "Payout Completed",
    ACTION_STAFF_INVITE: "Staff Invited",
    ACTION_STAFF_ROLE_CHANGE: "Staff Role Changed",
    ACTION_STAFF_REVOKE: "Staff Access Revoked",
    ACTION_USER_BAN: "User Banned",
    ACTION_USER_UNBAN: "User Unbanned",
    ACTION_COIN_ADJUST: "Coins Adjusted",
    ACTION_GAME_RESET: "Game Reset",
    ACTION_CONFIG_CHANGE: "Configuration Changed"
}


# === AUDIT LOGGER ===

async def record_staff_action(
    employee_id: str,
    employee_name: str,
    action_type: str,
    action_detail: str,
    target_id: Optional[str] = None,
    target_type: Optional[str] = None,
    metadata: Optional[dict] = None
):
    """
    Record a staff action to the audit trail.
    
    Args:
        employee_id: ID of the staff member performing the action
        employee_name: Name of the staff member
        action_type: Type of action (use ACTION_* constants)
        action_detail: Human-readable description of the action
        target_id: ID of the affected entity (user, payout, etc.)
        target_type: Type of target (user, payout, staff, etc.)
        metadata: Additional data (amounts, reasons, etc.)
    """
    log_entry = {
        "employee_id": employee_id,
        "employee_name": employee_name,
        "action_type": action_type,
        "action_label": ACTION_LABELS.get(action_type, action_type),
        "action_detail": action_detail,
        "target_id": target_id,
        "target_type": target_type,
        "metadata": metadata or {},
        "timestamp": datetime.utcnow(),
        "ip_address": None  # TODO: Capture from request
    }
    
    await db.audit_trail.insert_one(log_entry)
    
    return log_entry


async def get_audit_logs(
    limit: int = 100,
    skip: int = 0,
    employee_id: Optional[str] = None,
    action_type: Optional[str] = None,
    target_id: Optional[str] = None
):
    """
    Retrieve audit logs with optional filters.
    
    Args:
        limit: Maximum number of logs to return
        skip: Number of logs to skip (for pagination)
        employee_id: Filter by specific employee
        action_type: Filter by action type
        target_id: Filter by target entity
        
    Returns:
        List of audit log entries
    """
    query = {}
    
    if employee_id:
        query["employee_id"] = employee_id
    
    if action_type:
        query["action_type"] = action_type
    
    if target_id:
        query["target_id"] = target_id
    
    logs = await db.audit_trail.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return logs


async def get_audit_stats():
    """
    Get audit log statistics.
    
    Returns:
        Dictionary with counts by action type and employee
    """
    # Count total logs
    total = await db.audit_trail.count_documents({})
    
    # Count by action type
    by_action = await db.audit_trail.aggregate([
        {"$group": {"_id": "$action_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]).to_list(100)
    
    # Count by employee
    by_employee = await db.audit_trail.aggregate([
        {"$group": {"_id": "$employee_id", "count": {"$sum": 1}, "name": {"$first": "$employee_name"}}},
        {"$sort": {"count": -1}}
    ]).to_list(100)
    
    return {
        "total_logs": total,
        "by_action_type": by_action,
        "by_employee": by_employee
    }


async def get_target_history(target_id: str, target_type: str):
    """
    Get all audit logs for a specific target (user, payout, etc.)
    
    Args:
        target_id: ID of the target entity
        target_type: Type of target
        
    Returns:
        List of audit logs affecting this target
    """
    logs = await db.audit_trail.find(
        {
            "target_id": target_id,
            "target_type": target_type
        },
        {"_id": 0}
    ).sort("timestamp", -1).to_list(1000)
    
    return logs
