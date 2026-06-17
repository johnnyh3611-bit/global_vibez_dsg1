"""
Prize Wheel Routes — Random Tier Prize Engine API surface.

Endpoints (all under /api):

  Public (auth required):
    GET  /prize-wheel/status      — current tier + spin eligibility
                                    + outcome matrix (coins only, no USD)
    POST /prize-wheel/spin        — execute today's spin
    GET  /prize-wheel/inventory   — list unclaimed perks the user holds

  Admin (founder-only):
    GET  /admin/prize-wheel/summary — breaker + recent activity ledger
    GET  /admin/prize-wheel/spins   — paginated spin audit trail
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query

from config import db
from services.prize_wheel import (
    get_status,
    resolve_user_tier,
    spin as run_spin,
    _breaker_state,
)
from utils.admin_guard import require_admin
from utils.auth_dependencies import get_current_user_from_session

router = APIRouter(prefix="/prize-wheel", tags=["prize-wheel"])
admin_router = APIRouter(prefix="/admin/prize-wheel", tags=["admin-prize-wheel"])


@router.get("/status")
async def status(
    current_user: dict = Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    tier = await resolve_user_tier(db, current_user)
    return await get_status(db, current_user, tier)


@router.post("/spin")
async def spin(
    current_user: dict = Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    tier = await resolve_user_tier(db, current_user)
    return await run_spin(db, current_user, tier)


@router.get("/inventory")
async def inventory(
    status_filter: str = Query(default="unclaimed", alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user_from_session),
) -> Dict[str, Any]:
    q: Dict[str, Any] = {"user_id": current_user["user_id"]}
    if status_filter:
        q["status"] = status_filter
    cursor = (db.user_prize_inventory
              .find(q, {"_id": 0})
              .sort("awarded_at", -1)
              .limit(limit))
    rows = [r async for r in cursor]
    return {"rows": rows, "count": len(rows)}


@admin_router.get("/summary")
async def admin_summary(admin=Depends(require_admin)) -> Dict[str, Any]:
    breaker = await _breaker_state(db)
    # 24h spin counts by kind
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    agg = await db.prize_wheel_spins.aggregate([
        {"$match": {"at": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$kind",
            "count": {"$sum": 1},
            "coin_amount": {"$sum": "$coin_amount"},
        }},
    ]).to_list(length=10)
    return {
        "breaker": breaker,
        "rolling_24h": {row["_id"]: {
            "count": int(row["count"]),
            "coins_minted": int(row.get("coin_amount") or 0),
        } for row in agg},
    }


@admin_router.get("/spins")
async def admin_spins(
    user_id: Optional[str] = Query(default=None),
    tier: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    q: Dict[str, Any] = {}
    if user_id:
        q["user_id"] = user_id
    if tier:
        q["tier"] = tier
    cursor = (db.prize_wheel_spins
              .find(q, {"_id": 0})
              .sort("at", -1)
              .limit(limit))
    rows = [r async for r in cursor]
    return {"rows": rows, "count": len(rows)}
