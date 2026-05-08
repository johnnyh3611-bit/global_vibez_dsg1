"""
Health Monitoring & System Status
Real-time platform health checks
"""
from typing import Dict, Any
from fastapi import APIRouter
from datetime import datetime, timezone
from config import get_database
import psutil
import os

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }

@router.get("/status")
async def system_status() -> Dict[str, Any]:
    """Detailed system status"""
    db = get_database()
    
    # Database connectivity
    db_healthy = True
    try:
        await db.users.count_documents({}, limit=1)
    except Exception as e:
        db_healthy = False
        # Log in production
        if os.getenv('ENV') != 'development':
            print(f"Database health check failed: {e}")
    
    # System metrics
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    return {
        "status": "healthy" if db_healthy else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "database": "up" if db_healthy else "down",
            "api": "up",
            "websockets": "up"
        },
        "metrics": {
            "cpu_usage_percent": cpu_percent,
            "memory_usage_percent": memory.percent,
            "memory_available_gb": round(memory.available / (1024**3), 2),
            "disk_usage_percent": disk.percent,
            "disk_free_gb": round(disk.free / (1024**3), 2)
        }
    }

@router.get("/stats")
async def platform_stats() -> Dict[str, Any]:
    """Real-time platform statistics"""
    db = get_database()
    
    stats = {
        "users": {
            "total": await db.users.count_documents({}),
            "online": await db.users.count_documents({"online": True}),
            "vip": await db.users.count_documents({"is_vip": True})
        },
        "games": {
            "active_tables": 0,  # TODO: Count from WebSocket connections
            "games_today": await db.game_results.count_documents({
                "completed_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()}
            })
        },
        "subscriptions": {
            "active": await db.subscriptions.count_documents({"status": "active"}),
            "premium_battle_pass": await db.battle_pass.count_documents({"has_premium": True})
        },
        "social": {
            "total_friendships": await db.friendships.count_documents({}),
            "active_guilds": await db.guilds.count_documents({})
        }
    }
    
    return {
        "success": True,
        "stats": stats,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/performance-metrics")
async def performance_metrics() -> Dict[str, Any]:
    """Database performance metrics"""
    db = get_database()
    
    # Test query speeds
    start = datetime.now(timezone.utc)
    await db.users.find_one({})
    user_query_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
    
    start = datetime.now(timezone.utc)
    await db.game_results.find({}).limit(100).to_list(100)
    game_query_ms = (datetime.now(timezone.utc) - start).total_seconds() * 1000
    
    return {
        "success": True,
        "metrics": {
            "avg_user_query_ms": round(user_query_ms, 2),
            "avg_game_query_ms": round(game_query_ms, 2),
            "database_status": "optimal" if user_query_ms < 50 else "slow"
        }
    }
