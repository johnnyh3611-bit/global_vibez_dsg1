"""
DSG Economic Engine — FastAPI routes.

Encodes the spec from `Global_Vibez_DSG_Economic_Engine.pdf` so the
Dual-Asset Shield economic logic is visible + queryable from the app
+ admin tools.

Endpoints (all mounted under /api/economic-engine):
  GET  /constants            — public constants (cheap, no DB)
  GET  /snapshot             — full state: supply, burn rate, liquidity, progress
  GET  /burn-rate?supply=X   — dynamic burn rate at a hypothetical supply
  GET  /dynamic-price        — coins needed for a fixed-USD cost
  POST /process-revenue      — admin-only: ingest fee revenue (50/50 split + burn)
  GET  /events               — admin-only: audit log of every engine action

Stripped of any external dependencies — pure deterministic math + Mongo
persistence. The same module the operator could hand to an auditor.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from services import dsg_economic_engine as engine
from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/economic-engine", tags=["economic-engine"])


# ───────────────────────────────────────── Helpers ──

def _require_admin(user) -> None:
    if not user:
        raise HTTPException(status_code=401, detail="Auth required")
    if not (getattr(user, "is_admin", False) or getattr(user, "role", "") == "admin"):
        raise HTTPException(status_code=403, detail="Admin only")


# ───────────────────────────────────────── Public reads ──

@router.get("/constants")
async def get_constants() -> Dict[str, Any]:
    """Public — the immutable spec constants. Safe to fetch unauthenticated."""
    return {
        "initial_supply": engine.INITIAL_SUPPLY,
        "stabilization_target_supply": engine.STABILIZATION_TARGET_SUPPLY,
        "golden_asset_supply": engine.GOLDEN_ASSET_SUPPLY,
        "initial_burn_rate": engine.INITIAL_BURN_RATE,
        "minimum_burn_rate": engine.MINIMUM_BURN_RATE,
        "revenue_split_ratio": engine.REVENUE_SPLIT_RATIO,
        "default_utility_cost_usd": engine.DEFAULT_UTILITY_COST_USD,
        "parity_usd": engine.PARITY_USD,
    }


@router.get("/snapshot")
async def get_snapshot() -> Dict[str, Any]:
    """Public — full live state. Used by the landing page + admin
    dashboard so investors / users can verify the engine is running."""
    db = get_database()
    return await engine.snapshot(db)


@router.get("/burn-rate")
async def burn_rate(
    supply: Optional[float] = Query(
        default=None,
        description="Optional hypothetical supply. Defaults to live current_supply.",
    ),
) -> Dict[str, Any]:
    """Return the dynamic burn rate at `supply` (or live current_supply)."""
    if supply is not None:
        if supply < 0:
            raise HTTPException(status_code=400, detail="supply must be >= 0")
        return {
            "supply": supply,
            "burn_rate": engine.calculate_dynamic_burn_rate(supply),
            "live": False,
        }
    db = get_database()
    snap = await engine.snapshot(db)
    return {
        "supply": snap["current_supply"],
        "burn_rate": snap["current_burn_rate"],
        "live": True,
    }


@router.get("/dynamic-price")
async def dynamic_price(
    cost_usd: float = Query(default=engine.DEFAULT_UTILITY_COST_USD, gt=0),
    coin_price_usd: float = Query(default=engine.PARITY_USD, gt=0),
) -> Dict[str, Any]:
    """Coins required for a fixed-USD utility-room transaction.

    Defaults assume parity ($1.00). Frontends can pass live coin price
    once an oracle is wired (currently the buy/burn engine targets parity
    so the default is a safe approximation)."""
    coins = engine.calculate_dynamic_price(cost_usd, coin_price_usd)
    return {
        "cost_usd": cost_usd,
        "coin_price_usd": coin_price_usd,
        "coins_required": round(coins, 6),
    }


# ───────────────────────────────────────── Admin writes ──

class ProcessRevenuePayload(BaseModel):
    amount_usd: float = Field(..., gt=0, description="Fee revenue in USD")
    coin_price_usd: float = Field(
        default=engine.PARITY_USD,
        gt=0,
        description="Live coin price; defaults to $1.00 parity",
    )
    source: str = Field(default="manual_admin", max_length=64)
    dry_run: bool = Field(default=False)


@router.post("/process-revenue")
async def process_revenue(
    payload: ProcessRevenuePayload,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Admin-only — ingest fee revenue, split 50/50 to liquidity + buyback/burn.

    `dry_run=true` returns the projected effects without mutating state.
    """
    _require_admin(user)

    if payload.dry_run:
        split = engine.split_revenue(payload.amount_usd)
        burned = engine.calculate_dynamic_price(split["buyback_usd"], payload.coin_price_usd)
        return {
            "dry_run": True,
            "amount_usd": payload.amount_usd,
            "split": split,
            "projected_burned_coins": round(burned, 6),
        }

    db = get_database()
    result = await engine.process_revenue(
        db,
        amount_usd=payload.amount_usd,
        coin_price_usd=payload.coin_price_usd,
        source=payload.source,
        actor=getattr(user, "user_id", None) or getattr(user, "id", None),
    )
    return {"success": True, **result}


@router.get("/events")
async def list_events(
    limit: int = Query(default=50, ge=1, le=500),
    source: Optional[str] = None,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Admin-only — paginated audit log of every engine state mutation."""
    _require_admin(user)
    db = get_database()
    q: Dict[str, Any] = {}
    if source:
        q["source"] = source
    events: List[Dict[str, Any]] = await db.dsg_economic_events.find(
        q, {"_id": 0}
    ).sort("ts", -1).limit(limit).to_list(limit)
    return {"events": events, "count": len(events)}
