"""
Localization HTTP routes (v2.0 LOCKED).

Source spec: /app/memory/locked_specs/v8_INTERNATIONAL_LOGIC.md

Endpoints (all /api/localization):
  GET  /countries            — country list (flag, currency, units, dialect)
  GET  /languages            — language list w/ dialects
  POST /detect               — Tier-1 auto-sync detection (Accept-Language + CF-IPCountry)
  POST /select               — Tier-2 manual selection from Cultural Hub
  GET  /me/{user_id}         — get user's saved localization
  POST /me/{user_id}/save    — Tier-3 deep persistence to MongoDB
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel, Field

from services.localization import (
    LocalizationPayload,
    detect_locale, build_payload_from_selection,
    list_countries, list_languages,
)
from utils.database import get_database


localization_router = APIRouter(prefix="/localization", tags=["localization-v2"])

USER_METADATA_COLLECTION = "user_metadata"


# ──────────────────────────────────────────────────────────────────────────
# 1. List endpoints
# ──────────────────────────────────────────────────────────────────────────
@localization_router.get("/countries")
async def get_countries() -> Dict[str, Any]:
    return {"countries": list_countries()}


@localization_router.get("/languages")
async def get_languages() -> Dict[str, Any]:
    return {"languages": list_languages()}


# ──────────────────────────────────────────────────────────────────────────
# 2. Tier-1 — Auto-Sync detection
# ──────────────────────────────────────────────────────────────────────────
@localization_router.post("/detect")
async def detect(
    request: Request,
    accept_language: Optional[str] = Header(default=None, alias="Accept-Language"),
    cf_ipcountry: Optional[str] = Header(default=None, alias="CF-IPCountry"),
    x_country: Optional[str] = Header(default=None, alias="X-Country"),
) -> Dict[str, Any]:
    """Tier 1: GISA Agent pings device locale (IP + System Language)."""
    cf = cf_ipcountry or x_country
    payload = detect_locale(accept_language=accept_language, cf_country=cf)
    return {"localization": asdict(payload)}


# ──────────────────────────────────────────────────────────────────────────
# 3. Tier-2 — Cultural Hub manual selection
# ──────────────────────────────────────────────────────────────────────────
class SelectRequest(BaseModel):
    country_code: str = Field(..., min_length=2, max_length=10)
    language_code: Optional[str] = None
    dialect: Optional[str] = None


@localization_router.post("/select")
async def select(req: SelectRequest) -> Dict[str, Any]:
    """Tier 2: user picks from the Globe FAB's Cultural Hub."""
    try:
        payload = build_payload_from_selection(
            country_code=req.country_code,
            language_code=req.language_code,
            dialect=req.dialect,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"localization": asdict(payload)}


# ──────────────────────────────────────────────────────────────────────────
# 4. Tier-3 — Deep persistence
# ──────────────────────────────────────────────────────────────────────────
class SavePayloadRequest(BaseModel):
    country_code: str
    language_code: Optional[str] = None
    dialect: Optional[str] = None


@localization_router.post("/me/{user_id}/save")
async def save_localization(user_id: str, req: SavePayloadRequest) -> Dict[str, Any]:
    """Tier 3: persist to MongoDB user_metadata.localization."""
    try:
        payload = build_payload_from_selection(
            country_code=req.country_code,
            language_code=req.language_code,
            dialect=req.dialect,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        db = get_database()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"db unavailable: {e!s}")

    await db[USER_METADATA_COLLECTION].update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "localization": asdict(payload),
        }},
        upsert=True,
    )
    return {"ok": True, "localization": asdict(payload)}


@localization_router.get("/me/{user_id}")
async def get_my_localization(user_id: str) -> Dict[str, Any]:
    try:
        db = get_database()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"db unavailable: {e!s}")
    doc = await db[USER_METADATA_COLLECTION].find_one(
        {"user_id": user_id},
        {"_id": 0, "localization": 1},
    )
    if not doc or "localization" not in doc:
        # Soft-default — return Tier-1 detection-style US default
        payload = build_payload_from_selection(country_code="US")
        return {"localization": asdict(payload), "saved": False}
    return {"localization": doc["localization"], "saved": True}


__all__ = ["localization_router"]
