"""Vibe TV Continuity — HTTP routes (v6.5 Phase 6)."""
from __future__ import annotations

import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.vibe_tv import (
    TVEpisode, TVAd, TVSlot,
    compute_listing_fee,
    generate_schedule, select_ad_for_viewer, inject_ads,
    EPISODE_LISTING_FEE_PER_30M, AD_SLOT_DURATION_SECONDS,
    EPISODES_BETWEEN_ADS, LOCAL_AD_TARGET_WEIGHT,
)


vibe_tv_router = APIRouter(prefix="/vibe-tv", tags=["vibe-tv"])

_EPISODES: Dict[str, TVEpisode] = {}
_ADS: Dict[str, TVAd] = {}


class PublishEpisodeRequest(BaseModel):
    creator_id: str
    title: str = Field(..., min_length=1, max_length=200)
    duration_minutes: int = Field(..., gt=0)
    genre: str


@vibe_tv_router.post("/episodes/publish")
def episode_publish(req: PublishEpisodeRequest) -> Dict:
    fee = compute_listing_fee(req.duration_minutes)
    ep_id = str(uuid.uuid4())
    ep = TVEpisode(
        episode_id=ep_id, creator_id=req.creator_id, title=req.title,
        duration_minutes=req.duration_minutes, genre=req.genre,
        listing_fee_paid=fee,
    )
    _EPISODES[ep_id] = ep
    return {**ep.__dict__, "duration_seconds": ep.duration_seconds}


@vibe_tv_router.get("/episodes")
def episode_list() -> Dict:
    return {"episodes": [
        {**e.__dict__, "duration_seconds": e.duration_seconds}
        for e in _EPISODES.values() if e.is_active
    ]}


@vibe_tv_router.get("/listing-fee")
def listing_fee_calc(duration_minutes: int) -> Dict:
    if duration_minutes <= 0:
        raise HTTPException(status_code=400, detail="duration_minutes must be > 0")
    return {
        "duration_minutes": duration_minutes,
        "fee_usd": compute_listing_fee(duration_minutes),
        "rate_per_30m": EPISODE_LISTING_FEE_PER_30M,
    }


# ── ADS ───────────────────────────────────────────────────────────────────
class PublishAdRequest(BaseModel):
    advertiser_id: str
    title: str = Field(..., min_length=1, max_length=200)
    target_zip_codes: List[str] = Field(default_factory=list)
    duration_seconds: int = AD_SLOT_DURATION_SECONDS


@vibe_tv_router.post("/ads/publish")
def ad_publish(req: PublishAdRequest) -> Dict:
    aid = str(uuid.uuid4())
    ad = TVAd(
        ad_id=aid, advertiser_id=req.advertiser_id, title=req.title,
        target_zip_codes=req.target_zip_codes,
        duration_seconds=req.duration_seconds,
    )
    _ADS[aid] = ad
    return ad.__dict__


@vibe_tv_router.get("/ads")
def ad_list() -> Dict:
    return {"ads": [a.__dict__ for a in _ADS.values() if a.is_active]}


# ── SCHEDULE ──────────────────────────────────────────────────────────────
@vibe_tv_router.get("/schedule")
def schedule(hours: int = 24, viewer_zip: Optional[str] = None) -> Dict:
    if hours <= 0 or hours > 168:
        raise HTTPException(status_code=400, detail="hours must be 1..168")
    eps = [e for e in _EPISODES.values() if e.is_active]
    if not eps:
        raise HTTPException(status_code=400, detail="no active episodes available")
    raw = generate_schedule(eps, datetime.now(timezone.utc), duration_hours=hours)
    final = inject_ads(raw, list(_ADS.values()), viewer_zip)
    return {
        "viewer_zip": viewer_zip,
        "horizon_hours": hours,
        "slot_count": len(final),
        "slots": [asdict(s) for s in final],
    }


@vibe_tv_router.get("/constants")
def vibe_tv_constants() -> Dict:
    return {
        "episode_listing_fee_per_30m": EPISODE_LISTING_FEE_PER_30M,
        "ad_slot_duration_seconds": AD_SLOT_DURATION_SECONDS,
        "episodes_between_ads": EPISODES_BETWEEN_ADS,
        "local_ad_target_weight": LOCAL_AD_TARGET_WEIGHT,
    }


__all__ = ["vibe_tv_router"]
