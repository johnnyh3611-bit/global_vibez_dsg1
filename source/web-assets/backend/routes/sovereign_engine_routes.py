"""
Sovereign Engine routes — Master Vault v9.

Endpoints:
  GET  /api/economy/status                 → live 3B-coin economy snapshot
                                              (powers Chair Hall Infinity Table)
  POST /api/engine/process-transaction     → admin/server-only sovereign-tax helper
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.database import get_database
from routes.admin_dashboard import verify_admin_cookie
from services.sovereign_engine import (
    SOVEREIGN_TAX,
    TOTAL_SUPPLY_CAP,
    TREASURY_RESERVE,
    BRIDGE_COMPRESSION_RATIO,
    GENIUS_PHASE_BONUS,
    calculate_bridge,
    get_economy_status,
    process_transaction,
)

router = APIRouter(tags=["sovereign-engine"])


@router.get("/economy/status")
async def economy_status() -> Dict[str, Any]:
    """Public snapshot of the 3-Billion-Coin Sovereign Economy.
    Consumed by the Chair Hall (`/chair-hall`) Infinity Table widget
    per the v9 Integration Guide."""
    db = get_database()
    return await get_economy_status(db)


class ProcessTxPayload(BaseModel):
    user_id: str = Field(..., min_length=1)
    amount: int = Field(..., ge=1)
    tx_type: str = Field(..., min_length=2, max_length=40)
    is_ambassador: bool = False
    metadata: Optional[Dict[str, Any]] = None


@router.post("/engine/process-transaction", dependencies=[Depends(verify_admin_cookie)])
async def engine_process_transaction(payload: ProcessTxPayload) -> Dict[str, Any]:
    """Admin-only audited sovereign-tax helper. Used by ops for manual
    settlement or by trusted internal services that don't yet carry a
    user-cookie context. Returns `{payout, dividend, tax, tax_rate}`."""
    db = get_database()
    if payload.amount > TOTAL_SUPPLY_CAP - TREASURY_RESERVE:
        raise HTTPException(400, "amount exceeds circulating cap")
    return await process_transaction(
        db,
        user_id=payload.user_id,
        amount=int(payload.amount),
        tx_type=payload.tx_type,
        is_ambassador=bool(payload.is_ambassador),
        metadata=payload.metadata,
    )


# Re-export for tests / regression shield introspection.
__all__ = ["router", "SOVEREIGN_TAX", "TOTAL_SUPPLY_CAP", "TREASURY_RESERVE"]


# ── v10 Solana Bridge calculator (public, read-only) ──
@router.get("/bridge/calculate")
async def bridge_calculate(coins: int, genius_bonus: bool = False) -> Dict[str, Any]:
    """v10 Constitution — preview the 4:1 (in-app coins → DSG) bridge
    payout. `genius_bonus=true` applies the 1.5× Genius Phase multiplier."""
    if coins < 0:
        raise HTTPException(400, "coins must be non-negative")
    payout = calculate_bridge(coins, genius_bonus=genius_bonus)
    return {
        "coins_in": int(coins),
        "ratio": BRIDGE_COMPRESSION_RATIO,
        "genius_bonus_applied": bool(genius_bonus),
        "genius_multiplier": GENIUS_PHASE_BONUS,
        "tokens_out": payout,
    }
