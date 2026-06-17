"""
$VIBEZ Activity Multiplier reward formula.
─────────────────────────────────────────────────────────────────────
Implements `Global_Vibez_DSG_Implementation_Roadmap.pdf §1`:

    R_total = (B_base × M_multiplier) + T_bonus

  • B_base       — base tokens per minute of active gameplay/streaming
  • M_multiplier — environmental boost (1.5× during Power Hour, etc.)
  • T_bonus      — social-interaction bonuses (chat, gifts, matches)

Implementation Trigger (PDF §1):
    "When a match ends in Spades, Global Vibe Dice, or Chess, the
     backend sends a transaction request to the Solana mint address."

Until the founder confirms the safe phrase `project complete`, all
mints are SIMULATED — same pattern as `routes/beat_dlc.py`. The
calculation, ledger entries, and audit trail are otherwise identical
so the formula can be tested end-to-end during beta.

Endpoints (mounted under /api/vibez-rewards):
  GET  /constants            — public; locked B_base + multipliers + bonuses
  POST /match-end            — auth; trigger payout for a finished match
  GET  /history/{user_id}    — auth; last 50 reward rows
"""
from __future__ import annotations

import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Final, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/vibez-rewards", tags=["vibez-rewards"])


# ─────────────────────────────────────── Locked constants ──

B_BASE_PER_MINUTE: Final[float] = 1.0       # base tokens per minute
POWER_HOUR_MULT:   Final[float] = 1.5       # PDF §1 example
DEFAULT_MULT:      Final[float] = 1.0

# Social-interaction bonus catalog (PDF §1 — T_bonus). Keys map 1:1
# to the Streamer Action Hub kinds where applicable.
T_BONUS: Final[Dict[str, float]] = {
    "chat_message":     0.05,
    "gift_sent":        0.50,
    "match_made":       2.00,    # successful dating-universe match
    "vibe_vote":        0.10,
    "buff_received":    0.20,
}

ELIGIBLE_GAMES: Final[set[str]] = {"spades", "vibe_dice", "chess",
                                   "blackjack", "poker", "hearts",
                                   "bid_whist"}

# Mint authority: locked behind founder safe phrase.
MINT_MODE: Final[str] = os.environ.get("VIBEZ_MINT_MODE", "SIMULATED")


# ─────────────────────────────────────── Schemas ──

class MatchEndPayload(BaseModel):
    game:                str = Field(..., description="spades|vibe_dice|chess|...")
    minutes_active:      float = Field(..., gt=0, le=600,
                                       description="Active minutes in this match")
    multiplier:          float = Field(default=DEFAULT_MULT, ge=1.0, le=10.0)
    bonus_events:        List[str] = Field(default_factory=list,
                                           description="Keys from T_BONUS catalog")
    chair_id:            Optional[str] = None  # for Seated Ownership boost


# ─────────────────────────────────────── Helpers ──

def _calculate_reward(payload: MatchEndPayload, chair_boost: float = 0.0) -> Dict[str, Any]:
    """Pure function — applies the PDF formula:
        R_total = (B_base × M_multiplier) + T_bonus + chair_boost
    `chair_boost` is added on top per Seated Ownership PDF §3.
    Returns the breakdown so the UI can show users exactly how their
    reward was computed.
    """
    b_total = B_BASE_PER_MINUTE * payload.minutes_active
    m_term  = b_total * payload.multiplier
    t_term  = sum(T_BONUS.get(b, 0.0) for b in payload.bonus_events)
    r_total = round(m_term + t_term + chair_boost, 4)
    return {
        "B_base":      round(b_total, 4),
        "M_term":      round(m_term, 4),
        "T_bonus":     round(t_term, 4),
        "chair_boost": round(chair_boost, 4),
        "R_total":     r_total,
        "multiplier":  payload.multiplier,
        "minutes":     payload.minutes_active,
    }


def _deterministic_tx(user_id: str, total: float) -> str:
    blob = f"{user_id}|{total}|{datetime.now(timezone.utc).isoformat()[:13]}"
    return "0x" + hashlib.sha256(blob.encode()).hexdigest()[:48]


# ─────────────────────────────────────── Endpoints ──

@router.get("/constants")
async def constants() -> Dict[str, Any]:
    """Public — published $VIBEZ rail constants."""
    return {
        "formula":           "R_total = (B_base × M_multiplier) + T_bonus + chair_boost",
        "B_base_per_minute": B_BASE_PER_MINUTE,
        "default_multiplier": DEFAULT_MULT,
        "power_hour_multiplier": POWER_HOUR_MULT,
        "T_bonus":           T_BONUS,
        "eligible_games":    sorted(ELIGIBLE_GAMES),
        "mint_mode":         MINT_MODE,
        "spec_doc":          "Global_Vibez_DSG_Implementation_Roadmap.pdf §1",
        "locked":            True,
    }


@router.post("/match-end")
async def match_end(payload: MatchEndPayload, request: Request) -> Dict[str, Any]:
    """Triggered by the game engine when a match ends. Calculates the
    PDF reward, applies the Seated Ownership boost if a chair is
    declared, and records a SIMULATED mint until mainnet TGE."""
    if payload.game.lower() not in ELIGIBLE_GAMES:
        raise HTTPException(status_code=400,
                            detail=f"Game '{payload.game}' not in eligible list")

    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()

    # Seated Ownership lookup — does the user actually own the chair
    # they're claiming? If yes, we add a 10% boost on top of R_total.
    chair_boost = 0.0
    chair_owned = False
    if payload.chair_id:
        chair = await db.chair_purchases.find_one(
            {"user_id": user.user_id, "chair_id": payload.chair_id},
            {"_id": 0, "chair_id": 1},
        )
        if chair:
            chair_owned = True
            base_pre_boost = (B_BASE_PER_MINUTE * payload.minutes_active
                              * payload.multiplier)
            chair_boost = round(base_pre_boost * 0.10, 4)

    breakdown = _calculate_reward(payload, chair_boost=chair_boost)
    reward_id = f"vrw_{uuid.uuid4().hex[:12]}"
    tx_hash = _deterministic_tx(user.user_id, breakdown["R_total"])
    now = datetime.now(timezone.utc).isoformat()

    record = {
        "reward_id":    reward_id,
        "user_id":      user.user_id,
        "game":         payload.game,
        "breakdown":    breakdown,
        "chair_id":     payload.chair_id,
        "chair_owned":  chair_owned,
        "mint_status":  MINT_MODE,
        "tx_hash":      tx_hash,
        "created_at":   now,
    }
    await db.vibez_reward_history.insert_one(record)

    # Credit the user's vibe credits (1 token = $0.01 in beta).
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$inc": {"credits_balance": breakdown["R_total"] / 100.0}},
        upsert=False,
    )

    return {
        "reward_id":   reward_id,
        "tx_hash":     tx_hash,
        "mint_status": MINT_MODE,
        "breakdown":   breakdown,
        "chair_owned": chair_owned,
    }


@router.get("/history/{user_id}")
async def history(user_id: str, request: Request, limit: int = 50) -> Dict[str, Any]:
    """Last N reward rows for a user — drives the wallet history view."""
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    cur = (db.vibez_reward_history
           .find({"user_id": user_id}, {"_id": 0})
           .sort("created_at", -1)
           .limit(max(1, min(limit, 200))))
    rows: List[Dict[str, Any]] = []
    async for r in cur:
        rows.append(r)
    return {"user_id": user_id, "count": len(rows), "rewards": rows}


def get_locked_constants_dict() -> Dict[str, Any]:
    """Used by `regression_shield.py` to lock the rail."""
    return {
        "B_BASE_PER_MINUTE": B_BASE_PER_MINUTE,
        "POWER_HOUR_MULT":   POWER_HOUR_MULT,
        "T_BONUS":           T_BONUS,
        "ELIGIBLE_GAMES":    sorted(ELIGIBLE_GAMES),
    }
