"""
Cultural Onboarding HTTP routes (v2.0 LOCKED).

Source spec: /app/memory/locked_specs/v8_INTERNATIONAL_LOGIC.md

Endpoints (all /api/cultural-onboarding):
  GET  /steps                  — list of canonical 4 steps
  POST /{user_id}/submit       — submit one step
  GET  /{user_id}              — current cultural profile
  GET  /{user_id}/complete     — { complete: bool } gate for the Match feed
"""
from __future__ import annotations

from typing import Any, Dict, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.cultural_onboarding import (
    CANONICAL_STEPS, CulturalProfile, is_complete, merge_step,
)
from utils.database import get_database


cultural_onboarding_router = APIRouter(
    prefix="/cultural-onboarding", tags=["cultural-onboarding-v2"],
)

USER_METADATA_COLLECTION = "user_metadata"


# Step IDs literal
StepId = Literal[
    "origin_and_vibe", "linguistic_range",
    "dialect_selection", "cultural_values",
]


class StepSubmitRequest(BaseModel):
    step: StepId
    payload: Dict[str, Any]


async def _load_profile(user_id: str) -> CulturalProfile:
    try:
        db = get_database()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"db unavailable: {e!s}")
    doc = await db[USER_METADATA_COLLECTION].find_one(
        {"user_id": user_id}, {"_id": 0, "cultural_profile": 1},
    )
    cp = (doc or {}).get("cultural_profile") or {}
    cp["user_id"] = user_id
    cp.setdefault("languages_fluent", [])
    cp.setdefault("languages_learning", [])
    cp.setdefault("cultural_values", {})
    cp.setdefault("completed_steps", [])
    return CulturalProfile(**{k: v for k, v in cp.items() if k in CulturalProfile.__dataclass_fields__})


async def _save_profile(profile: CulturalProfile) -> None:
    try:
        db = get_database()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"db unavailable: {e!s}")
    await db[USER_METADATA_COLLECTION].update_one(
        {"user_id": profile.user_id},
        {"$set": {
            "user_id": profile.user_id,
            "cultural_profile": profile.to_doc(),
        }},
        upsert=True,
    )


@cultural_onboarding_router.get("/steps")
async def get_steps() -> Dict[str, Any]:
    return {
        "steps": [
            {"id": "origin_and_vibe",
             "title": "Origin & Current Vibe",
             "questions": ["Where is home?", "Where are you vibing today?"]},
            {"id": "linguistic_range",
             "title": "Linguistic Range",
             "questions": [
                 "Which languages do you speak fluently?",
                 "Which languages are you learning?",
             ]},
            {"id": "dialect_selection",
             "title": "Dialect Selection",
             "questions": [
                 "English dialect (US, UK, AU, JM, ZA, IN, etc.)",
                 "Spanish dialect (MX, ES, AR, CO, etc.)",
             ],
             "applies_to_languages": ["en", "es"]},
            {"id": "cultural_values",
             "title": "Cultural Values Filter (opt-in)",
             "questions": [
                 "Traditions",
                 "Dietary habits",
                 "Social etiquette / pace of communication",
             ]},
        ]
    }


@cultural_onboarding_router.post("/{user_id}/submit")
async def submit_step(user_id: str, req: StepSubmitRequest) -> Dict[str, Any]:
    profile = await _load_profile(user_id)
    try:
        merged = merge_step(profile, req.step, req.payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await _save_profile(merged)
    return {
        "ok": True,
        "completed_steps": merged.completed_steps,
        "complete": is_complete(merged),
        "cultural_profile": merged.to_doc(),
    }


@cultural_onboarding_router.get("/{user_id}")
async def get_profile(user_id: str) -> Dict[str, Any]:
    profile = await _load_profile(user_id)
    return {
        "cultural_profile": profile.to_doc(),
        "complete": is_complete(profile),
        "remaining_steps": [s for s in CANONICAL_STEPS if s not in profile.completed_steps],
    }


@cultural_onboarding_router.get("/{user_id}/complete")
async def is_user_complete(user_id: str) -> Dict[str, Any]:
    profile = await _load_profile(user_id)
    return {
        "complete": is_complete(profile),
        "completed_steps": profile.completed_steps,
        "remaining_steps": [s for s in CANONICAL_STEPS if s not in profile.completed_steps],
    }


__all__ = ["cultural_onboarding_router"]
