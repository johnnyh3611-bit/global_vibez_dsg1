"""
Audit Log API Routes

Endpoints for viewing staff action history.
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional

from middleware.permissions import require_manager
from utils.audit_logger import get_audit_logs, get_audit_stats, get_target_history

router = APIRouter(prefix="/v1/admin", tags=["Admin - Audit Logs"])


@router.get("/audit-logs")
async def get_logs(
    limit: int = Query(100, le=1000),
    skip: int = Query(0, ge=0),
    employee_id: Optional[str] = None,
    action_type: Optional[str] = None,
    target_id: Optional[str] = None,
    user = Depends(require_manager)
):
    """
    Get audit logs with optional filters (Manager+ access).
    
    Query params:
    - limit: Max logs to return (default 100, max 1000)
    - skip: Pagination offset
    - employee_id: Filter by employee
    - action_type: Filter by action type
    - target_id: Filter by target entity
    """
    logs = await get_audit_logs(
        limit=limit,
        skip=skip,
        employee_id=employee_id,
        action_type=action_type,
        target_id=target_id
    )
    
    return {
        "count": len(logs),
        "limit": limit,
        "skip": skip,
        "logs": logs
    }


@router.get("/audit-stats")
async def get_stats(user = Depends(require_manager)):
    """
    Get audit log statistics (Manager+ access).
    
    Returns counts by action type and employee.
    """
    stats = await get_audit_stats()
    return stats


@router.get("/audit-logs/target/{target_type}/{target_id}")
async def get_entity_history(
    target_type: str,
    target_id: str,
    user = Depends(require_manager)
):
    """
    Get all audit logs for a specific entity (Manager+ access).
    
    Examples:
    - /audit-logs/target/user/user-123
    - /audit-logs/target/payout/PO-20260418-abc
    """
    logs = await get_target_history(target_id, target_type)
    
    return {
        "target_id": target_id,
        "target_type": target_type,
        "log_count": len(logs),
        "logs": logs
    }
