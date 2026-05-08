"""
Teleport Cosmetics — the specific VFX a user sees when they teleport in VR.

Separate from the general `cosmetics` route — this tracks the user's
*equipped teleport effect* (digital_cubes, hearts_vibe, binary_rain,
golden_dust, romantic_hearts, etc.) and drives the auto-unlock engine
(e.g. `romantic_hearts` at 10 completed VR dates).

Endpoints:
    GET  /api/cosmetics/teleport/active       — current equipped effect
    POST /api/cosmetics/teleport/equip        — equip a previously-unlocked effect
    POST /api/cosmetics/teleport/check-unlock — increment a stat; auto-unlock if threshold
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cosmetics/teleport", tags=["teleport_cosmetics"])


DEFAULT_EFFECTS = ["digital_cubes"]  # everyone gets this out of the gate

# stat name → [(threshold, cosmetic_id), ...]
TELEPORT_UNLOCK_RULES = {
    "vr_dates_completed": [(10, "romantic_hearts")],
    "tournaments_won": [(5, "golden_dust"), (25, "champion_aura")],
    "vr_hours": [(20, "binary_rain"), (100, "matrix_void")],
    "hearts_given": [(50, "hearts_vibe")],
}


class EquipRequest(BaseModel):
    user_id: str
    effect_id: str


class CheckUnlockRequest(BaseModel):
    user_id: str
    stat: str
    increment: int = 1


async def _get_or_init_user_vfx(user_id: str) -> dict:
    """Fetch (or lazily create) the user's teleport-vfx document."""
    doc = await db.teleport_vfx.find_one({"user_id": user_id}, {"_id": 0})
    if doc:
        return doc
    now = datetime.now(timezone.utc).isoformat()
    fresh = {
        "user_id": user_id,
        "unlocked_effects": list(DEFAULT_EFFECTS),
        "active_effect": DEFAULT_EFFECTS[0],
        "stats": {},
        "created_at": now,
        "updated_at": now,
    }
    await db.teleport_vfx.insert_one(fresh.copy())
    return fresh


@router.get("/active")
async def get_active_teleport_effect(user_id: str) -> dict:
    doc = await _get_or_init_user_vfx(user_id)
    return {
        "user_id": user_id,
        "active_effect": doc.get("active_effect"),
        "unlocked_effects": doc.get("unlocked_effects", []),
    }


@router.get("/my-vfx/{user_id}")
async def get_my_vfx(user_id: str) -> dict:
    """Full VFX state: active effect, unlocked list, per-stat progression."""
    doc = await _get_or_init_user_vfx(user_id)
    return {
        "user_id": user_id,
        "active_effect": doc.get("active_effect", "default"),
        "unlocked_effects": doc.get("unlocked_effects", []) or [],
        "stats": doc.get("stats", {}) or {},
    }


@router.get("/unlock-rules")
async def get_teleport_unlock_rules() -> dict:
    return {
        "rules": {
            stat: [{"threshold": thr, "cosmetic_id": cid} for thr, cid in rules]
            for stat, rules in TELEPORT_UNLOCK_RULES.items()
        }
    }


@router.post("/equip")
async def equip_teleport_effect(req: EquipRequest) -> dict:
    doc = await _get_or_init_user_vfx(req.user_id)
    if req.effect_id not in doc.get("unlocked_effects", []):
        raise HTTPException(status_code=403, detail=f"Effect '{req.effect_id}' is not unlocked.")
    now = datetime.now(timezone.utc).isoformat()
    await db.teleport_vfx.update_one(
        {"user_id": req.user_id},
        {"$set": {"active_effect": req.effect_id, "updated_at": now}},
    )
    return {"user_id": req.user_id, "active_effect": req.effect_id, "status": "equipped"}


@router.post("/check-unlock")
async def check_teleport_unlock(req: CheckUnlockRequest) -> dict:
    """Increment a stat; return any cosmetics that just unlocked at this value."""
    if req.stat not in TELEPORT_UNLOCK_RULES:
        raise HTTPException(status_code=400, detail=f"Unknown stat: {req.stat}")

    doc = await _get_or_init_user_vfx(req.user_id)
    new_value = int(doc.get("stats", {}).get(req.stat, 0)) + req.increment
    already = list(doc.get("unlocked_effects", []))

    fresh = [
        cid
        for threshold, cid in TELEPORT_UNLOCK_RULES[req.stat]
        if new_value >= threshold and cid not in already
    ]

    now = datetime.now(timezone.utc).isoformat()
    update: dict = {"$set": {f"stats.{req.stat}": new_value, "updated_at": now}}
    if fresh:
        update["$addToSet"] = {"unlocked_effects": {"$each": fresh}}

    await db.teleport_vfx.update_one({"user_id": req.user_id}, update)

    return {
        "user_id": req.user_id,
        "stat": req.stat,
        "new_value": new_value,
        "unlocked_now": fresh,
    }
