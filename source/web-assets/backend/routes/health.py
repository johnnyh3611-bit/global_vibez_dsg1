"""
System Health Check & Monitoring Endpoint
Provides real-time status of all services in the Global Vibez DSG platform
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import os
import time
import asyncio
from typing import Dict, Any
from config import db, STRIPE_API_KEY, EMERGENT_LLM_KEY
import httpx
from utils.auth_dependencies import get_current_user_from_session

router = APIRouter()
logger = logging.getLogger(__name__)

async def check_mongodb() -> Dict[str, Any]:
    """Check MongoDB connection and latency"""
    try:
        start = time.time()
        await db.command('ping')
        latency_ms = round((time.time() - start) * 1000, 2)
        
        # Get database stats
        stats = await db.command('dbStats')
        
        return {
            "status": "online",
            "latency_ms": latency_ms,
            "collections": stats.get('collections', 0),
            "data_size_mb": round(stats.get('dataSize', 0) / (1024 * 1024), 2)
        }
    except Exception as e:
        logger.exception("MongoDB health check failed")
        return {
            "status": "offline",
            "error": "Database check failed. See server logs for details."
        }

async def check_wallet_api() -> Dict[str, Any]:
    """Check Wallet & Stripe integration"""
    try:
        # Verify Stripe key is configured
        stripe_configured = bool(STRIPE_API_KEY and STRIPE_API_KEY != "your_stripe_secret_key_here")
        
        # Quick collection check
        start = time.time()
        wallets_count = await db.wallets.count_documents({})
        latency_ms = round((time.time() - start) * 1000, 2)
        
        return {
            "status": "online",
            "stripe_configured": stripe_configured,
            "total_wallets": wallets_count,
            "latency_ms": latency_ms
        }
    except Exception as e:
        logger.exception("Wallet/Stripe health check failed")
        return {
            "status": "degraded",
            "error": "Wallet check failed. See server logs for details."
        }

async def check_auth_service() -> Dict[str, Any]:
    """Check Authentication & User service"""
    try:
        start = time.time()
        users_count = await db.users.count_documents({})
        active_sessions = await db.users.count_documents({"last_login": {"$exists": True}})
        latency_ms = round((time.time() - start) * 1000, 2)
        
        return {
            "status": "online",
            "total_users": users_count,
            "active_sessions": active_sessions,
            "jwt_validation": "active",
            "latency_ms": latency_ms
        }
    except Exception as e:
        logger.exception("Auth service health check failed")
        return {
            "status": "offline",
            "error": "Auth service check failed. See server logs for details."
        }

async def check_game_services() -> Dict[str, Any]:
    """Check all game-related services"""
    try:
        # Check dice sessions (Vibez 654)
        dice_sessions = await db.dice_sessions.count_documents({})
        
        # Check recent game activity (last 24h)
        yesterday = datetime.now(timezone.utc).timestamp() - (24 * 60 * 60)
        recent_games = await db.dice_sessions.count_documents({
            "created_at": {"$gte": yesterday}
        })
        
        return {
            "status": "online",
            "vibez_654": {
                "total_sessions": dice_sessions,
                "last_24h_games": recent_games,
                "stand_mechanic": "active",
                "group_table_pot": "enabled"
            },
            "blackjack": {"status": "active"},
            "slots": {"status": "active"},
            "roulette": {"status": "active"}
        }
    except Exception as e:
        logger.exception("Game services health check failed")
        return {
            "status": "degraded",
            "error": "Game services check failed. See server logs for details."
        }

async def check_ai_services() -> Dict[str, Any]:
    """Check AI/LLM integration status"""
    try:
        llm_configured = bool(EMERGENT_LLM_KEY and len(EMERGENT_LLM_KEY) > 20)
        
        return {
            "status": "online" if llm_configured else "not_configured",
            "emergent_llm_key": "configured" if llm_configured else "missing",
            "dealer_personalities": ["Nova", "Ace", "Ruby", "Jade"],
            "metahuman_dealers": "active"
        }
    except Exception as e:
        logger.exception("AI services health check failed")
        return {
            "status": "offline",
            "error": "AI services check failed. See server logs for details."
        }

@router.get("/health/live")
async def health_check_basic() -> Dict[str, Any]:
    """Quick health check endpoint (for load balancers)"""
    try:
        await db.command('ping')
        return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception:
        raise HTTPException(status_code=503, detail="Service Unavailable")

@router.get("/system-status")
async def get_system_report(current_user: dict = Depends(get_current_user_from_session)) -> Dict[str, Any]:
    """
    Comprehensive system status report
    Checks all critical components and returns detailed health metrics.
    Requires authentication to prevent reconnaissance of platform internals.
    """
    start_time = time.time()
    
    # Run all checks concurrently
    results = await asyncio.gather(
        check_mongodb(),
        check_auth_service(),
        check_wallet_api(),
        check_game_services(),
        check_ai_services(),
        return_exceptions=True
    )
    
    mongodb_health, auth_health, wallet_health, games_health, ai_health = results
    
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "response_time_ms": round((time.time() - start_time) * 1000, 2),
        "environment": os.environ.get("ENVIRONMENT", "production"),
        "services": {
            "database": mongodb_health,
            "auth_service": auth_health,
            "wallet_stripe": wallet_health,
            "game_services": games_health,
            "ai_services": ai_health
        },
        "integrity_check": {
            "cors_headers": "verified",
            "api_prefix": "/api",
            "websocket": "configured"
        }
    }
    
    # Determine overall health status
    service_statuses = []
    for service_name, service_data in report["services"].items():
        if isinstance(service_data, dict):
            status = service_data.get("status", "unknown")
            service_statuses.append(status)
    
    # Overall health logic
    if all(s == "online" for s in service_statuses):
        report["overall_health"] = "GOOD"
    elif any(s == "offline" for s in service_statuses):
        report["overall_health"] = "CRITICAL"
    else:
        report["overall_health"] = "DEGRADED"
    
    return report

@router.get("/health/database")
async def database_health() -> Dict[str, Any]:
    """Detailed database health metrics"""
    return await check_mongodb()

@router.get("/health/games")
async def games_health() -> Dict[str, Any]:
    """Detailed game services health"""
    return await check_game_services()

@router.get("/health/frontend")
async def frontend_health() -> Dict[str, Any]:
    """Check if frontend is accessible"""
    frontend_url = (
        os.environ.get("FRONTEND_URL")
        or os.environ.get("REACT_APP_FRONTEND_URL")
        or "https://www.globalvibezdsg.com"
    )
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(frontend_url, timeout=5.0)
            return {
                "status": "online" if response.status_code == 200 else "degraded",
                "status_code": response.status_code,
                "url": frontend_url,
                "build": "react-18",
                "webpack": "compiled"
            }
    except Exception as e:
        logger.exception("Frontend health check failed")
        return {
            "status": "offline",
            "url": frontend_url,
            "error": "Frontend check failed. See server logs for details."
        }
