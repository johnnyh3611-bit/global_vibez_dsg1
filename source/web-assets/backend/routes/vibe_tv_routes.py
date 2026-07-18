"""Vibe TV Continuity — HTTP routes (v6.5 Phase 6 + persisted ad flights)."""
from __future__ import annotations

import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from services.vibe_tv import (
    TVEpisode, TVAd, TVSlot,
    compute_listing_fee,
    generate_schedule, select_ad_for_viewer, inject_ads,
    EPISODE_LISTING_FEE_PER_30M, AD_SLOT_DURATION_SECONDS,
    EPISODES_BETWEEN_ADS, LOCAL_AD_TARGET_WEIGHT,
)
from utils.database import get_database, get_current_user


vibe_tv_router = APIRouter(prefix="/vibe-tv", tags=["vibe-tv"])

_EPISODES: Dict[str, TVEpisode] = {}
_ADS: Dict[str, TVAd] = {}


async def _hydrate_ads_from_mongo() -> None:
    """Load active flights into the in-memory queue (idempotent merge)."""
    try:
        db = get_database()
        cursor = db.merchant_dsg_tv_ads.find(
            {"is_active": {"$ne": False}}, {"_id": 0}
        ).sort("published_at", -1).limit(200)
        async for doc in cursor:
            aid = doc.get("ad_id")
            if not aid or aid in _ADS:
                continue
            _ADS[aid] = TVAd(
                ad_id=aid,
                advertiser_id=doc.get("advertiser_id") or doc.get("merchant_id") or "",
                title=doc.get("title") or "Ad",
                target_zip_codes=list(doc.get("target_zip_codes") or []),
                duration_seconds=int(doc.get("duration_seconds") or AD_SLOT_DURATION_SECONDS),
                is_active=bool(doc.get("is_active", True)),
                creative_url=str(doc.get("creative_url") or ""),
                channel_id=str(doc.get("channel_id") or ""),
                business_name=str(doc.get("business_name") or ""),
            )
    except Exception:
        pass


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
    creative_url: str = ""
    channel_id: str = ""
    business_name: str = ""


@vibe_tv_router.post("/ads/publish")
async def ad_publish(req: PublishAdRequest) -> Dict:
    aid = str(uuid.uuid4())
    ad = TVAd(
        ad_id=aid, advertiser_id=req.advertiser_id, title=req.title,
        target_zip_codes=req.target_zip_codes,
        duration_seconds=req.duration_seconds,
        creative_url=req.creative_url or "",
        channel_id=req.channel_id or "",
        business_name=req.business_name or "",
    )
    _ADS[aid] = ad
    try:
        db = get_database()
        await db.merchant_dsg_tv_ads.insert_one({
            **ad.__dict__,
            "merchant_id": req.advertiser_id,
            "published_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True,
        })
    except Exception:
        pass
    return ad.__dict__


@vibe_tv_router.get("/ads")
async def ad_list() -> Dict:
    await _hydrate_ads_from_mongo()
    return {"ads": [a.__dict__ for a in _ADS.values() if a.is_active]}


@vibe_tv_router.get("/ads/now-playing")
async def ads_now_playing(
    channel_id: Optional[str] = None,
    viewer_zip: Optional[str] = None,
) -> Dict[str, Any]:
    """Return the next paid commercial creative for a channel viewer."""
    await _hydrate_ads_from_mongo()
    pool = [a for a in _ADS.values() if a.is_active]
    if channel_id:
        targeted = [a for a in pool if not a.channel_id or a.channel_id == channel_id]
        if targeted:
            pool = targeted
    if not pool:
        return {"ad": None, "reason": "no_active_ads"}
    picked = select_ad_for_viewer(pool, viewer_zip)
    if not picked:
        # Zip miss / empty national bucket — still serve something playable.
        with_creative = [a for a in pool if a.creative_url]
        picked = with_creative[0] if with_creative else pool[0]
    if not picked:
        return {"ad": None, "reason": "no_match"}
    return {
        "ad": {
            "ad_id": picked.ad_id,
            "title": picked.title,
            "creative_url": picked.creative_url,
            "duration_seconds": picked.duration_seconds,
            "business_name": picked.business_name,
            "advertiser_id": picked.advertiser_id,
            "channel_id": picked.channel_id,
        }
    }


class BuyFlightCreditsRequest(BaseModel):
    """Buy DSG TV flight credits with in-app credits_balance (₵)."""
    merchant_id: str
    quantity: int = Field(default=1, ge=1, le=50)


# ₵1000 ≈ $1 flight packaging used elsewhere; keep a clear product price.
FLIGHT_PRICE_CREDITS = 2500  # ₵2500 per 15–60s commercial flight


@vibe_tv_router.post("/ads/buy-flights")
async def buy_flight_credits(req: BuyFlightCreditsRequest, request: Request) -> Dict[str, Any]:
    """Pay with wallet credits for DSG TV ad flights (Helio/Solana fund the wallet)."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    merchant = await db.merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(404, "Merchant not found — onboard at /merchant first")
    owner = merchant.get("owner_user_id") or merchant.get("user_id")
    if owner and owner != user.user_id:
        raise HTTPException(403, "Not the merchant owner")

    total = int(req.quantity) * FLIGHT_PRICE_CREDITS
    result = await db.users.update_one(
        {"user_id": user.user_id, "credits_balance": {"$gte": total}},
        {"$inc": {"credits_balance": -total}},
    )
    if result.modified_count == 0:
        raise HTTPException(402, f"Need ₵{total} — top up via Solana or Helio first")

    await db.merchant_addon_credits.update_one(
        {"merchant_id": req.merchant_id},
        {
            "$inc": {"dsg_tv_flights": int(req.quantity)},
            "$setOnInsert": {"merchant_id": req.merchant_id},
        },
        upsert=True,
    )
    credits = await db.merchant_addon_credits.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    ) or {}
    return {
        "purchased": True,
        "quantity": req.quantity,
        "credits_spent": total,
        "price_per_flight_credits": FLIGHT_PRICE_CREDITS,
        "remaining_flights": int(credits.get("dsg_tv_flights", 0)),
        "pay_hint": "Fund wallet with Helio card or Solana deposit, then buy flights here.",
    }


# ── SCHEDULE ──────────────────────────────────────────────────────────────
@vibe_tv_router.get("/schedule")
async def schedule(hours: int = 24, viewer_zip: Optional[str] = None) -> Dict:
    if hours <= 0 or hours > 168:
        raise HTTPException(status_code=400, detail="hours must be 1..168")
    await _hydrate_ads_from_mongo()
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
        "flight_price_credits": FLIGHT_PRICE_CREDITS,
    }


__all__ = ["vibe_tv_router", "_ADS"]
