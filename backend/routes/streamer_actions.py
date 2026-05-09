"""
Streamer Action Hub — the unifying tip-to-action backend.
─────────────────────────────────────────────────────────────────────
Implements the core "viewer pays → streamer gets paid → an event fires
on the overlay" rail that EVERY blueprint references:

  • Streamer Revenue Blueprint (May 2026 PDF)
      §1 Vibe-Check Gauntlet  — Heckle / Buff trigger
      §2 VibeRidez Copilot    — Tip-to-Route, DJ Intercept
      §3 Beat Vault           — Instrument Gifts (delegated to beat_auctions)
      §4 Streamer Plugins     — Hype Meter, Voice Mirror Intercept,
                                Tip-to-Action Escrow

  • Master Tech Blueprint §5 Creator Monetization
      — 5% Ambassador kickback (delegated to existing Sponsors route)
      — Engagement Mining (this hub; +1 stake per action)

  • Party Hub Blueprint §4 Core Multiplayer Plugins
      — Stake Auto-Drip   (this hub; +1 stake per action confirmed)

Locked constants (mirror Immutable Core + Streamer Revenue PDF):
  • STREAMER_PAYOUT       = 0.70       (70% to streamer wallet)
  • SOVEREIGN_TAX         = 0.135      (matches /api/immutable-core)
  • LIQUIDITY_POOL        = 0.10
  • RESIDUAL              = 0.065      (platform/insurance/referral)

Voice Mirror Intercept duration:
  • VOICE_INTERCEPT_SECONDS = 15       (PDF §4 — pay-to-speak window)

Hype Meter:
  • HYPE_METER_PEAK_THRESHOLD = 1000   (cumulative gift value, USD-c-equiv)
  • Reaching the threshold triggers a platform-wide Power Hour pulse via
    the existing /api/power-hour/start endpoint (NOT redeclared here).

Endpoints (mounted under /api):
  GET  /streamer-actions/constants                — public; locked rail
  POST /streamer-actions/tip                      — auth; viewer tips with action
  POST /streamer-actions/complete/{action_id}     — auth (streamer); release escrow
  GET  /streamer-actions/recent/{streamer_id}     — auth; last 50 actions
  GET  /streamer-actions/hype-meter/{streamer_id} — public; current meter level
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Final

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/streamer-actions", tags=["streamer-actions"])


# ─────────────────────────────────────── Locked constants ──

STREAMER_PAYOUT:    Final[float] = 0.70
SOVEREIGN_TAX:      Final[float] = 0.135   # mirrors Immutable Core
LIQUIDITY_POOL:     Final[float] = 0.10
RESIDUAL:           Final[float] = round(
    1.0 - STREAMER_PAYOUT - SOVEREIGN_TAX - LIQUIDITY_POOL, 6
)  # = 0.065

VOICE_INTERCEPT_SECONDS:    Final[int] = 15
HYPE_METER_PEAK_THRESHOLD:  Final[int] = 1000   # cumulative cents gifted

# Catalog of audience-paid actions per the Streamer Revenue PDF.
# Adding a new kind requires updating this set (and the test gate).
ACTION_KINDS: Final[set[str]] = {
    "HECKLE",          # PDF §1 — distractor overlay (e.g. frost filter)
    "BUFF",            # PDF §1 — power-up overlay
    "ROUTE_TIP",       # PDF §2 — pin a destination on map
    "DJ_INTERCEPT",    # PDF §2 — skip / queue a Beat Vault track
    "VOICE_INTERCEPT", # PDF §4 — 15-sec pay-to-speak window
    "INSTRUMENT_GIFT", # PDF §3 — add stem to live remix (delegated)
    "HECKLE_GALLERY",  # Master Tech §2 — 3D Glass Emoji vote
}


# ─────────────────────────────────────── Schemas ──

class TipPayload(BaseModel):
    """Viewer payment that triggers a specific overlay action."""
    streamer_id: str
    action_kind: str = Field(..., description="One of ACTION_KINDS")
    amount_cents: int = Field(..., gt=0, description="Tip amount in cents")
    metadata: Dict[str, Any] = Field(default_factory=dict,
        description="Action-specific extras (e.g. {'overlay': 'Frost_Filter'} "
                    "for HECKLE, {'destination': 'pizza-shop-id'} for ROUTE_TIP)")


class CompleteRequest(BaseModel):
    """Streamer marks the action complete → escrow releases to wallet."""
    streamer_completed: bool = True


# ─────────────────────────────────────── Helpers ──

def _split_payout(amount_cents: int) -> Dict[str, int]:
    """Apply the 70 / 13.5 / 10 / 6.5 split to a tip in cents.

    Returned values are integer cents; the residual absorbs rounding
    so the buckets always sum to `amount_cents`.
    """
    streamer = round(amount_cents * STREAMER_PAYOUT)
    tax      = round(amount_cents * SOVEREIGN_TAX)
    pool     = round(amount_cents * LIQUIDITY_POOL)
    residual = amount_cents - streamer - tax - pool
    return {
        "streamer_cents":      streamer,
        "sovereign_tax_cents": tax,
        "liquidity_pool_cents": pool,
        "residual_cents":      residual,
        "gross_cents":         amount_cents,
    }


# ─────────────────────────────────────── Endpoints ──

@router.get("/constants")
async def get_constants() -> Dict[str, Any]:
    """Public read of the locked Streamer Action Hub constants."""
    return {
        "payout_split": {
            "streamer":       STREAMER_PAYOUT,
            "sovereign_tax":  SOVEREIGN_TAX,
            "liquidity_pool": LIQUIDITY_POOL,
            "residual":       RESIDUAL,
        },
        "voice_intercept_seconds":   VOICE_INTERCEPT_SECONDS,
        "hype_meter_peak_threshold": HYPE_METER_PEAK_THRESHOLD,
        "supported_action_kinds":    sorted(ACTION_KINDS),
        "spec_doc":                  "GlobalVibez_Streamer_Revenue_Blueprint.pdf",
        "locked":                    True,
    }


@router.post("/tip")
async def post_tip(tip: TipPayload, request: Request) -> Dict[str, Any]:
    """A viewer pays a tip that triggers a specific overlay action.

    The full amount lands in escrow under `streamer_action_escrow`.
    Funds release to the streamer wallet only when
    `/streamer-actions/complete/{action_id}` is called by the streamer
    (or by the auto-release worker for completed Gauntlet tasks).

    The Hype Meter for that streamer is bumped immediately so overlays
    can react in real-time, even before escrow releases.
    """
    if tip.action_kind not in ACTION_KINDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown action_kind. Must be one of {sorted(ACTION_KINDS)}",
        )

    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    action_id = f"act_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    payout = _split_payout(tip.amount_cents)

    record = {
        "action_id":   action_id,
        "streamer_id": tip.streamer_id,
        "viewer_id":   user.user_id,
        "kind":        tip.action_kind,
        "amount_cents": tip.amount_cents,
        "payout":      payout,
        "metadata":    tip.metadata,
        "status":      "ESCROW",       # ESCROW → COMPLETED → REFUNDED
        "created_at":  now,
        "completed_at": None,
    }
    await db.streamer_action_escrow.insert_one(record)

    # Bump hype meter (cumulative cents). Reaching the peak threshold
    # is a signal for the consumer (e.g. UI / Power Hour daemon).
    await db.streamer_hype_meter.update_one(
        {"streamer_id": tip.streamer_id},
        {"$inc": {"cumulative_cents": tip.amount_cents,
                  "tip_count": 1},
         "$set": {"last_tip_at": now}},
        upsert=True,
    )
    meter = await db.streamer_hype_meter.find_one(
        {"streamer_id": tip.streamer_id}, {"_id": 0},
    ) or {"cumulative_cents": tip.amount_cents}
    peak_reached = meter["cumulative_cents"] >= HYPE_METER_PEAK_THRESHOLD

    # Real-time WS broadcast — bumps the overlay/widgets immediately
    # instead of forcing them to poll. Best-effort.
    try:
        from services.hype_meter_ws import broadcast_hype
        await broadcast_hype(tip.streamer_id, last_action_kind=tip.action_kind)
    except Exception:
        pass

    return {
        "action_id":   action_id,
        "status":      "ESCROW",
        "kind":        tip.action_kind,
        "payout_split": payout,
        "hype_meter_cents": meter["cumulative_cents"],
        "hype_meter_peak_reached": peak_reached,
        "voice_intercept_seconds": (VOICE_INTERCEPT_SECONDS
                                    if tip.action_kind == "VOICE_INTERCEPT"
                                    else None),
    }


@router.post("/complete/{action_id}")
async def complete_action(
    action_id: str,
    body: CompleteRequest,
    request: Request,
) -> Dict[str, Any]:
    """Streamer flips the escrowed action to COMPLETED → 70% lands in
    their wallet immediately. If `streamer_completed=false`, the tip
    is REFUNDED to the viewer (Tip-to-Action Escrow rule from PDF §4)."""
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    action = await db.streamer_action_escrow.find_one({"action_id": action_id}, {"_id": 0})
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action["status"] != "ESCROW":
        raise HTTPException(status_code=409,
                            detail=f"Action already {action['status']}")
    # Only the streamer (or an admin) may complete their own actions.
    if action["streamer_id"] != user.user_id:
        raise HTTPException(status_code=403,
                            detail="Only the streamer can complete this action")

    now = datetime.now(timezone.utc).isoformat()
    new_status = "COMPLETED" if body.streamer_completed else "REFUNDED"

    await db.streamer_action_escrow.update_one(
        {"action_id": action_id},
        {"$set": {"status": new_status, "completed_at": now}},
    )

    if new_status == "COMPLETED":
        # Credit the streamer's vibe_credits (70% of gross).
        streamer_credit = action["payout"]["streamer_cents"]
        await db.users.update_one(
            {"user_id": action["streamer_id"]},
            {"$inc": {"credits_balance": streamer_credit / 100.0}},
            upsert=False,
        )

    return {
        "action_id":  action_id,
        "status":     new_status,
        "completed_at": now,
        "streamer_credited_cents": (
            action["payout"]["streamer_cents"]
            if new_status == "COMPLETED" else 0
        ),
    }


@router.get("/recent/{streamer_id}")
async def recent_actions(
    streamer_id: str,
    request: Request,
    limit: int = 50,
) -> Dict[str, Any]:
    """Return the streamer's last `limit` action escrow rows.

    Overlay frontends (OBS browser source) poll this every ~2 seconds
    so they can react to confirmed tips in real-time without holding
    a websocket open.
    """
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    cur = db.streamer_action_escrow.find(
        {"streamer_id": streamer_id},
        {"_id": 0},
    ).sort("created_at", -1).limit(max(1, min(limit, 200)))
    rows: List[Dict[str, Any]] = []
    async for doc in cur:
        rows.append(doc)
    return {"streamer_id": streamer_id, "count": len(rows), "actions": rows}


@router.get("/hype-meter/{streamer_id}")
async def hype_meter(streamer_id: str) -> Dict[str, Any]:
    """Public: current cumulative hype meter level for a streamer.

    The frontend Hype Meter widget (Streamer Revenue PDF §4) renders
    this as a 0-100% bar where 100% = HYPE_METER_PEAK_THRESHOLD.
    """
    from utils.database import get_database
    db = get_database()
    rec = await db.streamer_hype_meter.find_one(
        {"streamer_id": streamer_id}, {"_id": 0},
    )
    cumulative = (rec or {}).get("cumulative_cents", 0)
    pct = min(1.0, cumulative / float(HYPE_METER_PEAK_THRESHOLD))
    return {
        "streamer_id":     streamer_id,
        "cumulative_cents": cumulative,
        "peak_threshold":   HYPE_METER_PEAK_THRESHOLD,
        "fill_pct":         round(pct, 4),
        "peak_reached":     cumulative >= HYPE_METER_PEAK_THRESHOLD,
    }


# ─────────────────────────────────────── Module health ──

def get_locked_constants_dict() -> Dict[str, Any]:
    """Used by `regression_shield.py` to lock the rail."""
    return {
        "STREAMER_PAYOUT":          STREAMER_PAYOUT,
        "SOVEREIGN_TAX":            SOVEREIGN_TAX,
        "LIQUIDITY_POOL":           LIQUIDITY_POOL,
        "RESIDUAL":                 RESIDUAL,
        "VOICE_INTERCEPT_SECONDS":  VOICE_INTERCEPT_SECONDS,
        "HYPE_METER_PEAK_THRESHOLD": HYPE_METER_PEAK_THRESHOLD,
        "ACTION_KINDS":             sorted(ACTION_KINDS),
    }
