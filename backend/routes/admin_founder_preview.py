"""
Founder Preview Tools (Feb 2026)
─────────────────────────────────────────────────────────────────
Admin-only utility endpoints so the founder + ops staff can walk
into any premium / underground room (high-roller blackjack, Vibe
654 Tournament, VIP rooms, etc.) WITHOUT having to grind credits
or pay real money first.

What this is NOT:
  • This is NOT a "free coins for everyone" exploit. Every endpoint
    here is gated by ``utils.admin_guard.require_admin`` which checks
    ADMIN_EMAILS env + the user's ``is_admin`` flag.
  • This does NOT touch the Recirculation pools — preview top-ups
    are minted directly to the admin's wallet and ledgered with
    reason="founder_preview" so they are clearly distinguished from
    real player credits in the audit trail.

Endpoints (all under /api/admin/founder-preview):
  POST /top-up       — credit your own admin wallet (default 10M ₵)
  GET  /balance      — read your current credit balance
  POST /reset        — debit your wallet down to a target balance
                       so you can re-test gating rules cleanly
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from config import db
from services.coin_wallet import credit_coins, debit_coins, get_balance
from utils.admin_guard import require_admin

router = APIRouter(prefix="/admin/founder-preview", tags=["admin-founder-preview"])


class TopUpRequest(BaseModel):
    # Default: 10,000,000 ₵ — enough to walk into the biggest VIP
    # blackjack table (typically 10K-100K minimums) hundreds of times.
    amount_coins: int = Field(default=10_000_000, ge=1, le=1_000_000_000)
    note: Optional[str] = Field(default=None, max_length=200)


class ResetRequest(BaseModel):
    # Trim the wallet down to this exact balance so we can retest
    # insufficient-funds flows without creating a fresh admin account.
    target_balance: int = Field(default=0, ge=0)


@router.post("/top-up")
async def founder_preview_top_up(
    body: TopUpRequest,
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    """Credit the calling admin's wallet so they can walk into any
    premium/underground room for visual QA without paying."""
    user_id = admin.get("user_id") if isinstance(admin, dict) else getattr(admin, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=400, detail="Admin user_id missing on session")

    res = await credit_coins(
        db, user_id, body.amount_coins,
        reason="founder_preview",
        metadata={"note": body.note or "founder preview walkthrough",
                  "at": datetime.now(timezone.utc).isoformat()},
    )
    return {
        "ok": True,
        "credited_coins": body.amount_coins,
        "balance_after": res.get("balance_after"),
        "user_id": user_id,
    }


@router.get("/balance")
async def founder_preview_balance(admin=Depends(require_admin)) -> Dict[str, Any]:
    user_id = admin.get("user_id") if isinstance(admin, dict) else getattr(admin, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=400, detail="Admin user_id missing on session")
    bal = await get_balance(db, user_id)
    return {"ok": True, "user_id": user_id, "balance_coins": bal}


@router.post("/reset")
async def founder_preview_reset(
    body: ResetRequest,
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    """Bring the admin's wallet DOWN to ``target_balance`` by burning
    the excess via a no-op debit (so we can re-test insufficient-funds
    flows without juggling test accounts)."""
    user_id = admin.get("user_id") if isinstance(admin, dict) else getattr(admin, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=400, detail="Admin user_id missing on session")

    bal = await get_balance(db, user_id)
    excess = bal - body.target_balance
    if excess <= 0:
        return {"ok": True, "no_change": True, "balance_after": bal}

    res = await debit_coins(
        db, user_id, excess,
        reason="founder_preview_reset",
        metadata={"target_balance": body.target_balance},
    )
    return {
        "ok": True,
        "trimmed_coins": excess,
        "balance_after": res.get("balance_after"),
    }
