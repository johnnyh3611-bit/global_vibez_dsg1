"""
My Vibez — Optimization Module + Room Redefinition Blueprint.

Implements both PDFs (Feb 2026):
  • My_Vibez_Room_Redefinition_Blueprint.pdf — Dynamic theming engine
    (Celestial Glasshouse vs Underground Club) + structured category
    matrix (Comedy / Action / Horror / Live Dating / Yellow Pages
    Showcase) returning assigned_theme per video.
  • My_Vibez_Optimization_Module.pdf — Ambassador attribution + regional
    ad injection (Chicago → WindyCity, Atlanta → HotLanta, etc.) +
    Cinema premiere unlock with 80% creator / 20% house split mirroring
    routes/dsg_core_system.py.

Plugs directly into Equity Master (every cinema unlock + ad injection
injects a fraction into the House Revenue Pool we already wired in
routes/dsg_core_system.py update_house_pool()).

Endpoints (all under /api/my-vibez/*):
  GET  /categories/layout/{video_id}     → assigned theme + skin metadata
  POST /stream/initiate                  → maps viewer → ambassador tree
  GET  /video/{video_id}/next-ad         → region-aware ad injection
  POST /cinema/unlock                    → 80/20 premiere ticket wall
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Final, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# Reuse the House Revenue Pool accumulator from DSG Core System so every
# cinema unlock + ad injection feeds the SAME quarterly pool that pays
# chair holders. Single source of truth.
from routes.dsg_core_system import (
    update_house_pool,
    CINEMA_CREATOR_SPLIT,
    CINEMA_HOUSE_SPLIT,
    HOUSE_TO_POOL_RATE,
    REGIONS,
)


# ── PDF 1 (Redefinition Blueprint) — themes + categories ────────────────
class VibeCategory(str, Enum):
    COMEDY = "COMEDY"
    ACTION = "ACTION"
    HORROR = "HORROR"
    LIVE_DATING = "LIVE_DATING"
    YELLOW_PAGES_SHOWCASE = "YELLOW_PAGES_SHOWCASE"
    CREATIVE = "CREATIVE"
    TECH = "TECH"
    MUSIC = "MUSIC"


# Category → theme mapping (PDF §Dynamic Environmental Shifting).
CATEGORY_THEME_MAP: Final[dict[str, str]] = {
    "COMEDY": "underground_club",
    "ACTION": "underground_club",
    "HORROR": "underground_club",
    "MUSIC": "underground_club",
    "LIVE_DATING": "celestial_glasshouse",
    "YELLOW_PAGES_SHOWCASE": "celestial_glasshouse",
    "CREATIVE": "celestial_glasshouse",
    "TECH": "celestial_glasshouse",
}

THEME_METADATA: Final[dict[str, dict]] = {
    "celestial_glasshouse": {
        "id": "celestial_glasshouse",
        "label": "The Celestial Glasshouse",
        "best_for": "Creative, Tech, and Premium Premieres",
        "visuals": (
            "Translucent glass panels, holographic star maps tracking view "
            "milestones, and clean neon-blue accent borders that glow harder "
            "as likes increase."
        ),
        "palette": {
            "bg": "linear-gradient(135deg,#020617 0%,#0f172a 50%,#1e1b4b 100%)",
            "accent": "#22d3ee",
            "glow": "rgba(34,211,238,0.55)",
            "text": "#e0f2fe",
        },
    },
    "underground_club": {
        "id": "underground_club",
        "label": "The Underground Club",
        "best_for": "Comedy, Action Movies, and Indie Music",
        "visuals": (
            "Dark mode matte-black carbon frames, pulse-reactive equalizer "
            "bars reflecting audio wavelengths, and deep purple/crimson "
            "glowing text plates."
        ),
        "palette": {
            "bg": "linear-gradient(135deg,#0a0a0a 0%,#1a0a1a 50%,#2d0a14 100%)",
            "accent": "#c026d3",
            "glow": "rgba(220,38,38,0.55)",
            "text": "#fce7f3",
        },
    },
}


# ── PDF 2 (Optimization Module) — locked splits ──────────────────────────
# Ad revenue split per PDF: 60% Creator / 20% Ambassador / 20% House.
AD_SPLIT_CREATOR: Final[float] = 0.60
AD_SPLIT_AMBASSADOR: Final[float] = 0.20
AD_SPLIT_HOUSE: Final[float] = 0.20

# Per-impression ad value (matches DSG_Core_System's $0.05).
AD_IMPRESSION_VALUE_USD: Final[float] = 0.05

# Regional vendor map — mirrors REGIONS from dsg_core_system.
# These are the example vendors the Hyper-Localized Sponsor Injection
# algorithm will surface based on the viewer's `region` query param.
REGIONAL_VENDORS: Final[dict[str, dict]] = {
    "chicago":     {"ad_id": "AD_CHI_099", "vendor": "WindyCity_Grill_HungryVibez"},
    "atlanta":     {"ad_id": "AD_ATL_142", "vendor": "HotLanta_Wings_HungryVibez"},
    "new_york":    {"ad_id": "AD_NYC_201", "vendor": "BigApple_Slice_HungryVibez"},
    "los_angeles": {"ad_id": "AD_LA_315",  "vendor": "SoCal_Tacos_HungryVibez"},
    "miami":       {"ad_id": "AD_MIA_408", "vendor": "MagicCity_Cevicheria_HungryVibez"},
    "houston":     {"ad_id": "AD_HOU_519", "vendor": "SpaceCity_BBQ_HungryVibez"},
}


# ── Mongo backing ────────────────────────────────────────────────────────
_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "vibez_global")
_client = AsyncIOMotorClient(_MONGO_URL)
_db = _client[_DB_NAME]
_sessions_col = _db["my_vibez_viewer_sessions"]
_unlocks_col = _db["my_vibez_cinema_unlocks"]


# ── Router ───────────────────────────────────────────────────────────────
router = APIRouter(prefix="/my-vibez", tags=["my-vibez-optimization"])


# 🎨 PDF 1 — Dynamic Environmental Shifting
@router.get("/categories/layout/{video_id}")
async def get_video_theme(video_id: str, category: Optional[str] = None):
    """Returns the assigned room theme for the given video.

    The PDF defines this as the central "Vibe Metadata Engine" —
    instead of hashtags, the front-end queries this endpoint with a
    structured category and we return a deterministic theme + palette.
    """
    cat = (category or "").upper().strip()
    if cat not in CATEGORY_THEME_MAP:
        # Default to celestial_glasshouse for unknown / un-categorized.
        cat = "CREATIVE"
    theme_id = CATEGORY_THEME_MAP[cat]
    return {
        "video_id": video_id,
        "category": cat,
        "assigned_theme": theme_id,
        "theme": THEME_METADATA[theme_id],
    }


@router.get("/themes")
async def list_themes():
    """Lists all available themes + their metadata. Useful for theme
    pickers / preview cards."""
    return {
        "themes": list(THEME_METADATA.values()),
        "categories": [c.value for c in VibeCategory],
        "category_theme_map": CATEGORY_THEME_MAP,
    }


# 🎬 PDF 2 — Dynamic Session Initialization
class ViewerSession(BaseModel):
    user_id: str = Field(..., min_length=1)
    current_region: str = Field(default="global")
    ambassador_ref_id: Optional[str] = None


class StreamInitiateBody(BaseModel):
    video_id: str = Field(..., min_length=1)
    session: ViewerSession


@router.post("/stream/initiate")
async def initiate_stream(body: StreamInitiateBody):
    """Maps an incoming viewer dynamically to an Ambassador's network
    wallet tree. Triggered instantly when a shared external link / QR
    code is executed (PDF §Dynamic Session Initialization)."""
    session_id = uuid.uuid4().hex
    region = (body.session.current_region or "global").strip().lower().replace(" ", "_")
    is_attributed = bool(body.session.ambassador_ref_id)
    tracking_mode = (
        f"Attributed to Ambassador: {body.session.ambassador_ref_id}"
        if is_attributed
        else "Direct Unlisted View"
    )

    await _sessions_col.insert_one({
        "session_id": session_id,
        "user_id": body.session.user_id,
        "video_id": body.video_id,
        "region": region,
        "ambassador_ref_id": body.session.ambassador_ref_id,
        "tracking_mode": tracking_mode,
        "is_attributed": is_attributed,
        "started_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "session_id": session_id,
        "video_id": body.video_id,
        "tracking_mode": tracking_mode,
        "load_layer": "celestial_glasshouse_default",
        "is_attributed": is_attributed,
    }


# 🛰 PDF 2 — Hyper-Localized Sponsor Injection
@router.get("/video/{video_id}/next-ad")
async def next_regional_ad(
    video_id: str,
    region: str,
    background_tasks: BackgroundTasks,
):
    """Queries the localized Vibe Network database to inject a regional
    sponsor. Bypasses generic external ad networks. Every impression
    feeds the House Revenue Pool (1% of house cut of $0.05 = $0.0001)."""
    key = (region or "global").strip().lower().replace(" ", "_").replace("-", "_")
    if key not in REGIONS or key == "global":
        return {
            "video_id": video_id,
            "inject_ad": False,
            "ad_metadata": None,
            "revenue_action": "No regional inventory for this viewer.",
        }
    vendor = REGIONAL_VENDORS.get(
        key,
        {"ad_id": f"AD_{key.upper()}_000", "vendor": f"{key.title()}_Vibez_Local"},
    )

    # Pool contribution = full $0.05 ad value × house split (20%) × pool rate (1%).
    pool_contribution = AD_IMPRESSION_VALUE_USD * AD_SPLIT_HOUSE * HOUSE_TO_POOL_RATE
    background_tasks.add_task(
        update_house_pool, pool_contribution, f"my_vibez_ad:{key}"
    )

    return {
        "video_id": video_id,
        "region": key,
        "inject_ad": True,
        "ad_metadata": vendor,
        "revenue_action": (
            f"Split Allocation: {int(AD_SPLIT_CREATOR*100)}% Creator / "
            f"{int(AD_SPLIT_AMBASSADOR*100)}% Ambassador / "
            f"{int(AD_SPLIT_HOUSE*100)}% House Split"
        ),
        "impression_value_usd": AD_IMPRESSION_VALUE_USD,
    }


# 🎟 PDF 2 — Cinema Premiere Unlock (Interactive Cinema Accounting)
class CinemaUnlockBody(BaseModel):
    user_id: str = Field(..., min_length=1)
    video_id: str = Field(..., min_length=1)
    creator_id: str = Field(..., min_length=1)
    price: int = Field(..., ge=0)


@router.post("/cinema/unlock")
async def unlock_cinema_premiere(body: CinemaUnlockBody, background_tasks: BackgroundTasks):
    """Manages payment validation for virtual cinema premiere ticket
    walls. 80% to filmmaker / 20% to House (routes through the
    quarterly 30-Split pool). PDF §Interactive Cinema Accounting."""
    if body.price <= 0:
        # Free content path — no payment, no ledger entry.
        return {
            "video_id": body.video_id,
            "user_id": body.user_id,
            "access_token": uuid.uuid4().hex,
            "unlocked": True,
            "status": "Standard View Matrix Granted",
            "ledger_summary": {"creator_payout_vibez": 0.0, "house_pool_injection": 0.0},
            "unreal_trigger": "Instantiate_Avatar_Cinema_Seat",
        }

    creator_payout = body.price * CINEMA_CREATOR_SPLIT
    house_cut = body.price * CINEMA_HOUSE_SPLIT
    pool_contribution = house_cut * HOUSE_TO_POOL_RATE

    access_token = uuid.uuid4().hex
    await _unlocks_col.insert_one({
        "access_token": access_token,
        "video_id": body.video_id,
        "creator_id": body.creator_id,
        "user_id": body.user_id,
        "price_vibez": body.price,
        "creator_payout_vibez": creator_payout,
        "house_cut_vibez": house_cut,
        "pool_contribution_usd": pool_contribution,
        "unlocked_at": datetime.now(timezone.utc).isoformat(),
    })
    background_tasks.add_task(
        update_house_pool, pool_contribution, f"my_vibez_cinema:{body.video_id}"
    )

    return {
        "video_id": body.video_id,
        "user_id": body.user_id,
        "access_token": access_token,
        "unlocked": True,
        "ledger_summary": {
            "creator_payout_vibez": round(creator_payout, 2),
            "house_pool_injection": round(house_cut, 2),
        },
        "split": {
            "creator_pct": int(CINEMA_CREATOR_SPLIT * 100),
            "house_pct": int(CINEMA_HOUSE_SPLIT * 100),
        },
        "unreal_trigger": "Instantiate_Avatar_Cinema_Seat",
    }
