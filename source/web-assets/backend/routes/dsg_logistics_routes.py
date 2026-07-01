"""DSG Logistics Master — public + admin endpoints (₵-only, no burns).

Mounts under `/api/dsg-logistics/*` (public) + `/api/admin/dsg-logistics/*`
(admin). Houses all 8 modules from the Logistics Master Blueprint.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from config import db
from services.dsg_logistics import (
    trigger_breakdown, arm_safety_loop, manual_override,
    verify_hardware, get_hardware_compliance,
    log_white_glove_violation,
    process_cancellation_payout,
    driver_override_state,
    compute_driver_tier,
    register_creator_kitchen, get_kitchen, get_my_kitchen,
    set_featured_dish, place_live_order, push_kitchen_delay,
    list_active_incidents, list_recent_payouts,
    BREAKDOWN_KINDS, SAFETY_COUNTDOWN_SECONDS,
    PAYOUT_SPLITS, CANCELLATION_FLAT_FEE_COINS,
    EMERGENCY_REDIRECT_BASE_FARE_COINS,
    TIER_RULES, CREATOR_FEATURED_DISH_COINS,
    HARDWARE_VERIFICATION_TTL_DAYS,
    WHITE_GLOVE_WARN_THRESHOLD, WHITE_GLOVE_SUSPEND_THRESHOLD,
)
from utils.admin_guard import require_admin
from utils.auth_dependencies import get_current_user_from_session

router = APIRouter(prefix="/dsg-logistics", tags=["dsg-logistics"])
admin_router = APIRouter(prefix="/admin/dsg-logistics",
                          tags=["admin-dsg-logistics"])


# ────────────────────── Constants & status ─────────────────────────

@router.get("/constants")
async def constants() -> Dict[str, Any]:
    return {
        "breakdown_kinds": list(BREAKDOWN_KINDS),
        "safety_countdown_seconds": SAFETY_COUNTDOWN_SECONDS,
        "payout_splits": PAYOUT_SPLITS,
        "cancellation_flat_fee_coins": CANCELLATION_FLAT_FEE_COINS,
        "emergency_redirect_base_fare_coins": EMERGENCY_REDIRECT_BASE_FARE_COINS,
        "tier_rules": TIER_RULES,
        "creator_featured_dish_coins": CREATOR_FEATURED_DISH_COINS,
        "hardware_verification_ttl_days": HARDWARE_VERIFICATION_TTL_DAYS,
        "white_glove_thresholds": {
            "warn": WHITE_GLOVE_WARN_THRESHOLD,
            "suspend_24h": WHITE_GLOVE_SUSPEND_THRESHOLD,
        },
        "recirculation_model": "40/30/30",
        "in_app_burn_pct": 0.0,
    }


# ──────────────────── Module 1 — Breakdown ─────────────────────────

class BreakdownRequest(BaseModel):
    kind: str = Field(..., description="vibe_ridez | hunger_vibez")
    job_id: Optional[str] = None
    coords: Optional[Dict[str, float]] = None


@router.post("/breakdown/trigger")
async def trigger(body: BreakdownRequest,
                  current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await trigger_breakdown(
        db, driver_id=current_user["user_id"], kind=body.kind,
        job_id=body.job_id, coords=body.coords,
    )


# ──────────────────── Module 2 — Safety Loop ───────────────────────

class SafetyArmRequest(BaseModel):
    incident_id: str = Field(...)
    stream_url: str = Field(..., min_length=8)


@router.post("/safety/arm")
async def arm_safety(body: SafetyArmRequest,
                     current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await arm_safety_loop(
        db, incident_id=body.incident_id, stream_url=body.stream_url,
    )


class OverrideRequest(BaseModel):
    incident_id: str = Field(...)
    note: Optional[str] = Field(default="", max_length=280)


@router.post("/safety/override")
async def safety_override(body: OverrideRequest,
                          current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await manual_override(
        db, incident_id=body.incident_id,
        actor_id=current_user["user_id"], note=body.note or "",
    )


# ──────────────────── Module 3 — Hardware ──────────────────────────

class HardwareVerifyRequest(BaseModel):
    interior_lens_ok: bool
    exterior_lens_ok: bool
    hardware_id: str = Field(..., min_length=3, max_length=80)


@router.post("/hardware/verify")
async def verify(body: HardwareVerifyRequest,
                 current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await verify_hardware(
        db, driver_id=current_user["user_id"],
        interior_lens_ok=body.interior_lens_ok,
        exterior_lens_ok=body.exterior_lens_ok,
        hardware_id=body.hardware_id,
    )


@router.get("/hardware/me")
async def my_hardware(current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return {"ok": True, "compliance":
            await get_hardware_compliance(db, current_user["user_id"])}


# ───────────────── Module 4 — White-Glove Strikes ─────────────────

class WhiteGloveRequest(BaseModel):
    driver_id: str
    job_id: Optional[str] = None
    physical_constraint_verified: bool = False
    note: Optional[str] = Field(default="", max_length=280)


@admin_router.post("/white-glove/violation")
async def wg_violation(body: WhiteGloveRequest,
                       admin=Depends(require_admin)) -> Dict[str, Any]:
    return await log_white_glove_violation(
        db, driver_id=body.driver_id, job_id=body.job_id,
        physical_constraint_verified=body.physical_constraint_verified,
        note=body.note or "",
    )


# ────────────────── Module 5 — Cancellation ────────────────────────

class CancellationRequest(BaseModel):
    job_id: str
    driver_id: str
    rider_id: Optional[str] = None
    kind: str = Field(..., description="passenger_cancel_late | "
                       "passenger_no_show | platform_emergency_redirect")
    fee_coins: Optional[int] = Field(default=None, ge=0, le=10_000_000)


@admin_router.post("/cancellation/process")
async def process_cancel(body: CancellationRequest,
                          admin=Depends(require_admin)) -> Dict[str, Any]:
    return await process_cancellation_payout(
        db, job_id=body.job_id, driver_id=body.driver_id,
        rider_id=body.rider_id, kind=body.kind, fee_coins=body.fee_coins,
    )


@admin_router.get("/cancellation/recent")
async def recent_payouts(admin=Depends(require_admin)) -> Dict[str, Any]:
    rows = await list_recent_payouts(db, limit=25)
    return {"rows": rows, "count": len(rows)}


# ──────────────── Module 6 — Override Console ─────────────────────

@router.get("/override-console/me")
async def override_console(current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await driver_override_state(db, current_user["user_id"])


# ──────────────────── Module 7 — Driver Tier ──────────────────────

@router.get("/tier/me")
async def my_tier(current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await compute_driver_tier(db, current_user["user_id"])


# ─────────── Module 8 — Hunger Vibez Creator Kitchen ──────────────

class KitchenRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    bio: Optional[str] = Field(default="", max_length=400)


@router.post("/creator-kitchen/register")
async def kitchen_register(body: KitchenRegisterRequest,
                            current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await register_creator_kitchen(
        db, user_id=current_user["user_id"],
        name=body.name, bio=body.bio or "",
    )


@router.get("/creator-kitchen/me")
async def kitchen_me(current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return {"ok": True, "kitchen":
            await get_my_kitchen(db, current_user["user_id"])}


@router.get("/creator-kitchen/{kitchen_id}")
async def kitchen_get(kitchen_id: str) -> Dict[str, Any]:
    kit = await get_kitchen(db, kitchen_id)
    if not kit:
        return {"ok": False, "reason": "not_found"}
    return {"ok": True, "kitchen": kit}


class FeaturedDishRequest(BaseModel):
    kitchen_id: str
    dish_name: str = Field(..., min_length=2, max_length=80)
    price_coins: Optional[int] = Field(
        default=CREATOR_FEATURED_DISH_COINS, ge=100, le=1_000_000,
    )


@router.post("/creator-kitchen/featured-dish")
async def featured_dish(body: FeaturedDishRequest,
                        current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await set_featured_dish(
        db, kitchen_id=body.kitchen_id, user_id=current_user["user_id"],
        dish_name=body.dish_name,
        price_coins=int(body.price_coins or CREATOR_FEATURED_DISH_COINS),
    )


class LiveOrderRequest(BaseModel):
    kitchen_id: str


@router.post("/creator-kitchen/order")
async def live_order(body: LiveOrderRequest,
                     current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await place_live_order(
        db, kitchen_id=body.kitchen_id, user_id=current_user["user_id"],
    )


class DelayRequest(BaseModel):
    kitchen_id: str
    prep_minutes: int = Field(..., gt=0, le=240)
    affected_order_id: Optional[str] = None


@router.post("/creator-kitchen/delay")
async def kitchen_delay(body: DelayRequest,
                        current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await push_kitchen_delay(
        db, kitchen_id=body.kitchen_id, owner_id=current_user["user_id"],
        prep_minutes=body.prep_minutes,
        affected_order_id=body.affected_order_id,
    )


# ─────────────────────── Admin dashboards ──────────────────────────

@admin_router.get("/incidents/active")
async def active_incidents(admin=Depends(require_admin)) -> Dict[str, Any]:
    rows = await list_active_incidents(db, limit=25)
    return {"rows": rows, "count": len(rows)}
