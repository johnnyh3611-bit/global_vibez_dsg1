"""
Beta Feedback collector + Nova dealer config endpoint + payout calculator
(rake / burn / maintenance split). Three small modules consolidated to
keep the route surface tidy.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin_dashboard import verify_admin_cookie

logger = logging.getLogger(__name__)
router = APIRouter()


# ────────────────────────────────────────────── Beta feedback ──

class FeedbackPayload(BaseModel):
    category: str = Field(
        ..., pattern="^(UI_GLITCH|GAME_BALANCE|TOKEN_ISSUE|FEATURE_REQUEST|OTHER)$"
    )
    comment: str = Field(..., min_length=3, max_length=2000)
    page: Optional[str] = Field(default=None, max_length=300)
    severity: str = Field(default="normal", pattern="^(low|normal|high|critical)$")


@router.post("/beta/feedback")
async def submit_feedback(payload: FeedbackPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    row = {
        "user_id": user.user_id,
        "category": payload.category,
        "severity": payload.severity,
        "page": payload.page,
        "comment": payload.comment.strip(),
        "status": "UNREAD",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.beta_feedback.insert_one(row)
    return {
        "ok": True,
        "feedback_id": str(res.inserted_id),
        "thanks": "Thank you for helping build Global Vibez!",
    }


@router.get("/beta/feedback")
async def list_feedback(
    limit: int = 100,
    status: Optional[str] = None,
    _: bool = Depends(verify_admin_cookie),
):
    db = get_database()
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status.upper()
    cursor = db.beta_feedback.find(q, {"_id": 0}).sort("submitted_at", -1).limit(min(max(1, limit), 500))
    rows: List[Dict[str, Any]] = await cursor.to_list(length=limit)
    return {"count": len(rows), "rows": rows}


# ────────────────────────────────────────────── Nova dealer config ──

NOVA_PROFILE: Dict[str, Any] = {
    "dealer_name": "Nova",
    "archetype": "Professional / High-Stakes",
    "features": {
        "eye_contact": "dynamic_tracking",
        "card_handling": "physics_based_realistic",
        "voice_tone": "sophisticated_warmth",
    },
    "reactions": {
        "on_player_win": "subtle_smile_congratulate",
        "on_high_bet": "raised_eyebrows_acknowledgment",
        "on_idle": "shuffling_cards_distraction",
        "on_calcify_high": "impressed_nod",
        "on_calcify_low": "subtle_frown",
    },
    "voice_pack": "nova_v1",
    "metahuman_id": "nova_dealer_v1",
    "version": "2026-04-26",
}


@router.get("/dealer/nova")
async def nova_config():
    """Public — Unity / MetaHuman pulls this on game start to render Nova consistently."""
    return NOVA_PROFILE


# ────────────────────────────────── Payout / rake / recirculation ──

class PayoutQuery(BaseModel):
    total_pot: float = Field(..., ge=0)
    rake_percent: float = Field(default=0.05, ge=0, le=0.30)
    burn_share: float = Field(
        default=0.50, ge=0, le=1.0,
        description=(
            "Fraction of the rake to send through the Recirculation Engine "
            "(40/30/30 — see Blueprint). Rest is maintenance. Field name "
            "kept as `burn_share` for back-compat."
        ),
    )


@router.post("/economy/payout")
async def calc_payout(payload: PayoutQuery):
    """
    Returns winner_payout, recirculation_amount, maintenance_amount for a pot.
    Pure-function endpoint — no DB writes — so the frontend can preview
    expected payouts before the table actually settles. Feb 2026: the
    `burn_amount` is now `recirculation_amount` (renamed for clarity, old
    key kept for back-compat).
    """
    house_cut = payload.total_pot * payload.rake_percent
    recirc_amount = house_cut * payload.burn_share
    maintenance = house_cut - recirc_amount
    return {
        "total_pot": round(payload.total_pot, 4),
        "winner_payout": round(payload.total_pot - house_cut, 4),
        "house_cut": round(house_cut, 4),
        "burn_amount": round(recirc_amount, 4),                 # back-compat
        "recirculation_amount": round(recirc_amount, 4),        # new name
        "maintenance_amount": round(maintenance, 4),
        "rake_percent": payload.rake_percent,
        "burn_share": payload.burn_share,
    }
