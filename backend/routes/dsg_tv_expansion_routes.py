"""DSG TV Expansion — public + admin endpoints (₵-only, no in-app burn)."""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from config import db
from services.dsg_tv_expansion import (
    get_my_chair, upgrade_chair, get_stool_balance, grant_stools,
    redeem_stools_for_chair, create_pool, stake_on_pool, resolve_pool,
    list_open_pools, PRESTIGE_TIERS, UPGRADE_COIN_COSTS, STOOLS_PER_CHAIR,
)
from utils.admin_guard import require_admin
from utils.auth_dependencies import get_current_user_from_session

router = APIRouter(prefix="/dsg-tv", tags=["dsg-tv-expansion"])
admin_router = APIRouter(prefix="/admin/dsg-tv", tags=["admin-dsg-tv"])


# ─── Prestige ───
@router.get("/prestige/me")
async def me_chair(current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    chair = await get_my_chair(db, current_user["user_id"])
    return {
        "ok": True, "chair": chair,
        "tiers": list(PRESTIGE_TIERS),
        "upgrade_costs_coins": {f"{f}->{t}": c for (f, t), c in UPGRADE_COIN_COSTS.items()},
    }


class UpgradeRequest(BaseModel):
    target_tier: str = Field(...)


@router.post("/prestige/upgrade")
async def upgrade(body: UpgradeRequest, current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await upgrade_chair(db, user_id=current_user["user_id"], target_tier=body.target_tier)


# ─── Stools ───
@router.get("/stools/me")
async def me_stools(current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    bal = await get_stool_balance(db, current_user["user_id"])
    return {"ok": True, "stools": bal, "stools_per_chair": STOOLS_PER_CHAIR}


@router.post("/stools/redeem")
async def redeem(current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await redeem_stools_for_chair(db, user_id=current_user["user_id"])


class GrantStoolsRequest(BaseModel):
    user_id: str = Field(...)
    count: int = Field(..., gt=0, le=10_000)
    reason: Optional[str] = Field(default=None, max_length=120)


@admin_router.post("/stools/grant")
async def admin_grant_stools(body: GrantStoolsRequest, admin=Depends(require_admin)) -> Dict[str, Any]:
    return await grant_stools(db, user_id=body.user_id, count=body.count,
                              reason=body.reason or "admin_grant")


# ─── Predict-to-Win ───
@router.get("/predict/open")
async def list_pools() -> Dict[str, Any]:
    rows = await list_open_pools(db, limit=25)
    return {"rows": rows, "count": len(rows)}


class CreatePoolRequest(BaseModel):
    prompt: str = Field(..., min_length=4, max_length=200)
    options: List[str] = Field(..., min_length=2, max_length=6)


@router.post("/predict/create")
async def create_pred_pool(body: CreatePoolRequest, current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await create_pool(db, broadcaster_id=current_user["user_id"],
                             prompt=body.prompt, options=body.options)


class StakeRequest(BaseModel):
    pool_id: str = Field(...)
    option: str = Field(...)
    coins: int = Field(..., gt=0, le=10_000_000)


@router.post("/predict/stake")
async def stake(body: StakeRequest, current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await stake_on_pool(db, pool_id=body.pool_id,
                               user_id=current_user["user_id"],
                               option=body.option, coins=body.coins)


class ResolveRequest(BaseModel):
    pool_id: str = Field(...)
    outcome: str = Field(...)


@admin_router.post("/predict/resolve")
async def admin_resolve(body: ResolveRequest, admin=Depends(require_admin)) -> Dict[str, Any]:
    return await resolve_pool(db, pool_id=body.pool_id, outcome=body.outcome)


@router.get("/constants")
async def constants() -> Dict[str, Any]:
    from services.dsg_tv_expansion import (
        PRED_BROADCASTER_PCT, PRED_TREASURY_PCT, PRED_WINNERS_PCT,
    )
    return {
        "prestige_tiers": list(PRESTIGE_TIERS),
        "upgrade_costs_coins": {f"{f}->{t}": c for (f, t), c in UPGRADE_COIN_COSTS.items()},
        "stools_per_chair": STOOLS_PER_CHAIR,
        "predict_split": {
            "broadcaster_pct": PRED_BROADCASTER_PCT,
            "treasury_pct": PRED_TREASURY_PCT,
            "winners_pct": PRED_WINNERS_PCT,
            "burn_pct": 0.0,
        },
    }
