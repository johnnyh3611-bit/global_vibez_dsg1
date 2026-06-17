"""
God-Mode System Health & Auto-Repair API
Admin-only endpoints for monitoring and controlling the Master Integrity Sentinel
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any

from middleware.permissions import require_god_mode
from utils.master_integrity import Sentinel

router = APIRouter(prefix="/god-mode", tags=["God-Mode Monitoring"])


class RepairRequest(BaseModel):
    """Request model for manual module repair"""
    module_name: str
    admin_note: Optional[str] = None


@router.get("/system-health")
async def get_system_health() -> Dict[str, Any]:
    """
    Get real-time system health report
    PUBLIC endpoint - basic health check
    """
    report = Sentinel.generate_full_report()
    
    # Return simplified public version
    return {
        "status": report["system_health"],
        "uptime_seconds": report["uptime_seconds"],
        "timestamp": report["timestamp"]
    }


@router.get("/full-audit-report", dependencies=[Depends(require_god_mode)])
async def get_full_audit_report() -> Dict[str, Any]:
    """
    God-Mode: Complete system audit report
    Requires admin authentication
    """
    report = Sentinel.generate_full_report()
    recommendations = Sentinel.generate_fix_recommendations()
    
    return {
        **report,
        "fix_recommendations": recommendations
    }


@router.get("/module-status/{module_name}")
async def get_module_status(module_name: str) -> Dict[str, Any]:
    """
    Get specific module health status
    """
    is_healthy, message = Sentinel.check_module_health(module_name)
    
    if module_name not in Sentinel.modules:
        raise HTTPException(status_code=404, detail="Module not found")
    
    module_data = Sentinel.modules[module_name]
    
    return {
        "module": module_name,
        "is_healthy": is_healthy,
        "message": message,
        "status": module_data["status"],
        "circuit_breaker": module_data["circuit_breaker"].get_status()
    }


@router.post("/repair", dependencies=[Depends(require_god_mode)])
async def trigger_manual_repair(request: RepairRequest) -> Dict[str, Any]:
    """
    God-Mode: Manually trigger module recovery
    
    This will:
    1. Reset circuit breaker
    2. Clear error counters
    3. Set module to RECOVERING state
    """
    if request.module_name not in Sentinel.modules:
        raise HTTPException(status_code=404, detail=f"Module '{request.module_name}' not found")
    
    result = Sentinel.trigger_manual_recovery(request.module_name)
    
    return {
        "status": "SUCCESS",
        "message": f"Manual recovery initiated for {request.module_name}",
        "details": result,
        "admin_note": request.admin_note
    }


@router.get("/error-logs", dependencies=[Depends(require_god_mode)])
async def get_error_logs(limit: int = 50) -> Dict[str, Any]:
    """
    God-Mode: Retrieve recent error logs
    """
    logs = Sentinel.error_logs[-limit:] if len(Sentinel.error_logs) >= limit else Sentinel.error_logs
    
    return {
        "total_errors": len(Sentinel.error_logs),
        "showing": len(logs),
        "logs": logs
    }


@router.get("/recovery-history", dependencies=[Depends(require_god_mode)])
async def get_recovery_history(limit: int = 20) -> Dict[str, Any]:
    """
    God-Mode: Retrieve auto-repair action history
    """
    actions = Sentinel.recovery_actions[-limit:] if len(Sentinel.recovery_actions) >= limit else Sentinel.recovery_actions
    
    return {
        "total_actions": len(Sentinel.recovery_actions),
        "showing": len(actions),
        "actions": actions
    }


@router.post("/simulate-failure/{module_name}", dependencies=[Depends(require_god_mode)])
async def simulate_module_failure(module_name: str, error_detail: str = "Manual test failure") -> Dict[str, Any]:
    """
    God-Mode: Simulate module failure for testing
    CAUTION: This will actually trigger circuit breakers and quarantine
    """
    if module_name not in Sentinel.modules:
        raise HTTPException(status_code=404, detail="Module not found")
    
    Sentinel.record_module_failure(module_name, error_detail)
    
    return {
        "status": "SIMULATED",
        "message": f"Failure recorded for {module_name}",
        "circuit_breaker_status": Sentinel.modules[module_name]["circuit_breaker"].get_status()
    }


@router.get("/recommendations", dependencies=[Depends(require_god_mode)])
async def get_fix_recommendations() -> Dict[str, Any]:
    """
    God-Mode: Get AI-generated fix recommendations
    """
    recommendations = Sentinel.generate_fix_recommendations()
    
    return {
        "timestamp": Sentinel.generate_full_report()["timestamp"],
        "recommendations": recommendations,
        "total_recent_errors": len(Sentinel.error_logs[-20:])
    }
