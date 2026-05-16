"""Merchant Genius Phase onboarding.

Implements the founder's `dsg_merchant_strategy.pdf` (2026-05-16):
single-entry flat fee, no subscriptions, includes one $20 chair baked in,
hard-capped at 50,000 chairs across the Genius Phase, 100-chair ceiling
per individual merchant.

Compatible with existing economics:
  • $20 chair price = our existing buy-back floor in equity_master.py
  • Genius Phase 50,000 chairs slots INSIDE the 1,000,000 total chair pool
  • No subscription = no conflict with creator 70% / cinema 80% splits
  • Stays inside 90-day dividend cycle, 5× mining multiplier, etc.

Endpoints under `/api/merchant`:
  GET  /genius-phase           — live cap + price + remaining slots
  POST /onboard                — pay flat activation fee, mints 1 chair
  POST /acquire-chair          — buy +1 chair up to the 100 ceiling
  GET  /me/{merchant_id}       — merchant profile + chair count + radius
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/merchant", tags=["merchant"])


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


# ────────────────────────────────────────────── Constants (PDF source) ──
ACTIVATION_FEE_MIN = 100        # USD — low end of the founder's $100-$150 band
ACTIVATION_FEE_MAX = 150        # USD — high end (used for premium SKUs later)
GENIUS_CHAIR_PRICE = 20         # USD per chair (matches $20 buy-back floor)
GENIUS_CHAIR_CAP = 50_000       # Genius Phase total slot count
INDIVIDUAL_CHAIR_CEILING = 100  # Max chairs any single merchant can hold
PUSH_BLAST_RADIUS_MILES = 3     # Hyper-Local Target Push Blast radius

# Service branding from the PDF — kept as a constant so the frontend and
# the tour narration read from the same source of truth.
MERCHANT_SERVICES = [
    {"id": "hunger_vibez", "label": "Hunger Vibez", "desc": "Food, grocery, QSR delivery + ordering"},
    {"id": "vibez_spots",  "label": "Vibez Spots",  "desc": "Hourly venue + private space booking"},
    {"id": "viberidez",    "label": "VibeRidez",    "desc": "On-demand mobility network"},
]


# ────────────────────────────────────────────── Models ──
class OnboardRequest(BaseModel):
    merchant_id: str = Field(min_length=3, max_length=80)
    business_name: str = Field(min_length=2, max_length=160)
    service: str = Field(description="One of MERCHANT_SERVICES.id")
    activation_fee_paid: int = Field(ge=ACTIVATION_FEE_MIN, le=ACTIVATION_FEE_MAX)
    lat: Optional[float] = None
    lng: Optional[float] = None


class AcquireChairRequest(BaseModel):
    merchant_id: str
    chairs: int = Field(ge=1, le=INDIVIDUAL_CHAIR_CEILING)


# ────────────────────────────────────────────── Endpoints ──
@router.get("/genius-phase")
async def genius_phase_status() -> Dict[str, Any]:
    """Live Genius Phase counter — chairs claimed, remaining, cap, price."""
    claimed = 0
    try:
        agg = _db().merchant_genius_phase.aggregate([
            {"$group": {"_id": None, "n": {"$sum": "$chairs_held"}}},
        ])
        async for row in agg:
            claimed = int(row.get("n") or 0)
    except Exception as e:
        logger.warning("genius-phase aggregation failed: %s", e)

    remaining = max(0, GENIUS_CHAIR_CAP - claimed)
    pct = round(claimed / GENIUS_CHAIR_CAP * 100, 2) if GENIUS_CHAIR_CAP else 0.0
    return {
        "phase": "GENIUS",
        "cap": GENIUS_CHAIR_CAP,
        "claimed": claimed,
        "remaining": remaining,
        "claimed_pct": pct,
        "chair_price_usd": GENIUS_CHAIR_PRICE,
        "activation_fee_usd": {"min": ACTIVATION_FEE_MIN, "max": ACTIVATION_FEE_MAX},
        "individual_ceiling": INDIVIDUAL_CHAIR_CEILING,
        "push_radius_miles": PUSH_BLAST_RADIUS_MILES,
        "services": MERCHANT_SERVICES,
    }


@router.post("/onboard")
async def onboard_merchant(req: OnboardRequest) -> Dict[str, Any]:
    """Pay the one-time activation fee, get 1 chair baked in.

    Idempotent per merchant_id — repeat calls return the existing record
    instead of double-billing. The 1-chair grant is part of the fee, so
    `chairs_held` starts at 1 and ticks up via `/acquire-chair`.
    """
    if req.service not in {s["id"] for s in MERCHANT_SERVICES}:
        raise HTTPException(400, f"Unknown service '{req.service}'")

    existing = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if existing:
        return {**existing, "already_onboarded": True}

    # Hard-cap: refuse onboard if we've already issued all 50K chairs.
    status = await genius_phase_status()
    if status["remaining"] < 1:
        raise HTTPException(409, detail="Genius Phase cap reached")

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "merchant_id": req.merchant_id,
        "business_name": req.business_name,
        "service": req.service,
        "activation_fee_paid": req.activation_fee_paid,
        "chairs_held": 1,  # 1 chair baked into the activation fee
        "lat": req.lat,
        "lng": req.lng,
        "push_radius_miles": PUSH_BLAST_RADIUS_MILES,
        "vibe_shield_enabled": True,
        "dsg_tv_placement": True,
        "onboarded_at": now_iso,
    }
    await _db().merchant_genius_phase.insert_one(doc.copy())
    doc.pop("_id", None)
    return {**doc, "already_onboarded": False}


@router.post("/acquire-chair")
async def acquire_chair(req: AcquireChairRequest) -> Dict[str, Any]:
    """Purchase additional Genius Phase chairs up to the 100-ceiling.
    Atomic check-and-increment via a conditional update so we can't
    race past the cap or the ceiling under concurrent requests."""
    merchant = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(404, "Merchant not onboarded yet")

    new_total = int(merchant.get("chairs_held", 1)) + req.chairs
    if new_total > INDIVIDUAL_CHAIR_CEILING:
        raise HTTPException(
            400,
            detail=f"Would exceed individual ceiling of {INDIVIDUAL_CHAIR_CEILING}",
        )

    status = await genius_phase_status()
    if status["remaining"] < req.chairs:
        raise HTTPException(409, detail="Insufficient Genius Phase chairs left")

    await _db().merchant_genius_phase.update_one(
        {"merchant_id": req.merchant_id},
        {"$inc": {"chairs_held": req.chairs}},
    )
    return {
        "merchant_id": req.merchant_id,
        "chairs_acquired": req.chairs,
        "chairs_held": new_total,
        "usd_paid": req.chairs * GENIUS_CHAIR_PRICE,
    }


@router.get("/me/{merchant_id}")
async def get_merchant(merchant_id: str) -> Dict[str, Any]:
    """Merchant profile — chair count + 3-mile push radius + benefits."""
    merchant = await _db().merchant_genius_phase.find_one(
        {"merchant_id": merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(404, "merchant_not_found")
    return merchant
