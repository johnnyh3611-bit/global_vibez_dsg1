"""
Video Vault — marketplace for video-side creators (filmmakers, motion
graphics designers, B-roll stockers, VFX template makers, livestream
overlay designers, tutorial authors).

Mirrors the Beat Vault pattern but for video assets, and wires every
upload through `services.content_rights` so we get:
  - Fingerprint dedupe
  - Metadata blocklist (no "official trailer", "leaked", etc.)
  - Signed time-limited download URLs on purchase
  - DMCA queue + 10-day escrow

License tiers (Spec — Content Rights & IP Policy §3):
  - standard   — single-use, non-exclusive (default)
  - extended   — multi-use, non-exclusive (3x price)
  - exclusive  — buyer gets exclusive rights, asset retired (10x price)
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from services import content_rights

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/video-vault", tags=["video-vault"])

# ────────────────────────────────────────────── DB ──
MONGO_URL = os.environ.get("MONGO_URL")
_client = AsyncIOMotorClient(MONGO_URL)
db = _client[os.environ.get("DB_NAME", "global_vibez_dsg")]

# ────────────────────────────────────────────── Constants ──
VALID_CATEGORIES = {
    "clip",            # short clip / cinematic
    "b_roll",          # background footage
    "motion_graphics", # animated templates
    "music_video",     # full music videos
    "tutorial",        # how-to / explainer
    "vfx_template",    # After Effects / DaVinci templates
    "stream_overlay",  # animated overlays for OBS
    "short_film",      # narrative shorts
}

LICENSE_TIERS = {
    "standard": 1.0,
    "extended": 3.0,
    "exclusive": 10.0,
}

DEFAULT_PRICE_USD = 5.00  # Video vault baseline (Beat vault is $0.50)


# ────────────────────────────────────────────── Models ──
class VideoListing(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: str = Field("", max_length=2000)
    category: str
    license_tier: str = "standard"
    base_price_usd: float = DEFAULT_PRICE_USD
    duration_seconds: int = Field(..., ge=1, le=21600)  # up to 6h
    thumbnail_url: Optional[str] = None
    preview_url: Optional[str] = None  # 30s watermarked sample
    master_url: str  # creator-hosted master (never exposed)
    tags: List[str] = []


class PurchaseRequest(BaseModel):
    buyer_user_id: str


def _public_video(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Mongo-safe + master-url-safe response shape."""
    return {
        k: v for k, v in doc.items()
        if k not in ("_id", "master_url", "fingerprint")
    }


# ────────────────────────────────────────────── Endpoints ──
@router.get("/videos")
async def list_videos(
    category: Optional[str] = Query(None),
    license_tier: Optional[str] = Query(None),
    creator_id: Optional[str] = Query(None),
    limit: int = Query(60, ge=1, le=200),
) -> Dict[str, Any]:
    """Browse the public catalog. Excludes any video under an upheld
    DMCA takedown or marked inactive."""
    q: Dict[str, Any] = {"is_active": True, "takedown_status": {"$ne": "upheld"}}
    if category:
        q["category"] = category
    if license_tier:
        q["license_tier"] = license_tier
    if creator_id:
        q["creator_id"] = creator_id

    cursor = db.video_vault_listings.find(q, {"_id": 0, "master_url": 0, "fingerprint": 0})
    items = await cursor.sort("created_at", -1).to_list(limit)
    return {"videos": items, "count": len(items)}


@router.get("/videos/{video_id}")
async def get_video(video_id: str) -> Dict[str, Any]:
    doc = await db.video_vault_listings.find_one(
        {"video_id": video_id},
        {"_id": 0, "master_url": 0, "fingerprint": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Video not found")
    return doc


@router.post("/videos")
async def list_video(listing: VideoListing, creator_id: str = Query(...)) -> Dict[str, Any]:
    """Creator lists a new video. Routes through the Content Rights
    preflight: metadata blocklist + fingerprint dedupe. Returns the
    public listing payload (master URL never leaves the server)."""
    if listing.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Valid: {sorted(VALID_CATEGORIES)}",
        )
    if listing.license_tier not in LICENSE_TIERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid license_tier. Valid: {sorted(LICENSE_TIERS)}",
        )

    # Metadata blocklist — surfaces "official trailer", "leaked", etc.
    blocked = content_rights.metadata_block_check(
        listing.title, listing.description, " ".join(listing.tags)
    )
    if blocked:
        raise HTTPException(
            status_code=400,
            detail=f"Listing blocked: term '{blocked}' is on the IP protection blocklist.",
        )

    # Fingerprint the master URL string — when real uploads land, this
    # becomes content_rights.compute_fingerprint(file_bytes).
    fingerprint = content_rights.compute_fingerprint(listing.master_url.encode("utf-8"))

    # Compute tier price
    final_price = round(listing.base_price_usd * LICENSE_TIERS[listing.license_tier], 2)

    video_id = f"vid_{uuid.uuid4().hex[:14]}"
    doc = {
        "video_id": video_id,
        "creator_id": creator_id,
        "title": listing.title,
        "description": listing.description,
        "category": listing.category,
        "license_tier": listing.license_tier,
        "price_usd": final_price,
        "duration_seconds": listing.duration_seconds,
        "thumbnail_url": listing.thumbnail_url,
        "preview_url": listing.preview_url,
        "master_url": listing.master_url,
        "fingerprint": fingerprint,
        "tags": listing.tags,
        "use_count": 0,
        "is_active": True,
        "takedown_status": "none",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.video_vault_listings.insert_one(dict(doc))

    # Register on the Content Rights master ledger as well, so DMCA +
    # signed-URL plumbing is unified across asset types.
    await content_rights.register_asset(
        db=db,
        seller_id=creator_id,
        title=listing.title,
        description=listing.description,
        fingerprint=fingerprint,
        master_url=listing.master_url,
        sample_url=listing.preview_url,
        price_usd=final_price,
        asset_type="video",
    )

    return _public_video(doc)


@router.post("/videos/{video_id}/use")
async def purchase_video(video_id: str, req: PurchaseRequest) -> Dict[str, Any]:
    """Buyer purchases a use-right. Returns a signed, time-limited
    download URL via the Content Rights ledger. Exclusive-tier
    purchases retire the listing."""
    doc = await db.video_vault_listings.find_one({"video_id": video_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Video not found")
    if not doc.get("is_active"):
        raise HTTPException(status_code=409, detail="Listing is no longer active")
    if doc.get("takedown_status") == "upheld":
        raise HTTPException(status_code=451, detail="Listing under DMCA takedown")

    # The Content Rights ledger tracks the canonical signed-URL flow.
    # We resolve via fingerprint to the underlying content_asset.
    asset = await db.content_assets.find_one(
        {"fingerprint": doc["fingerprint"]}, {"_id": 0, "asset_id": 1}
    )
    if not asset:
        raise HTTPException(
            status_code=500,
            detail="Internal: video registered without content-rights asset",
        )

    purchase = await content_rights.record_purchase(
        db=db, asset_id=asset["asset_id"], buyer_user_id=req.buyer_user_id,
    )

    # Bump use count + retire if exclusive
    update: Dict[str, Any] = {"$inc": {"use_count": 1}}
    if doc.get("license_tier") == "exclusive":
        update["$set"] = {"is_active": False}
    await db.video_vault_listings.update_one({"video_id": video_id}, update)

    return {
        "video_id": video_id,
        "title": doc.get("title"),
        "price_paid_usd": doc.get("price_usd"),
        "creator_id": doc.get("creator_id"),
        "license_tier": doc.get("license_tier"),
        **purchase,  # purchase_id, download_url, expires_at, escrow_*
    }


@router.get("/stats")
async def vault_stats() -> Dict[str, Any]:
    """Public vault stats — used by the volumetric dashboard tile."""
    total = await db.video_vault_listings.count_documents(
        {"is_active": True, "takedown_status": {"$ne": "upheld"}}
    )
    by_category: Dict[str, int] = {}
    cursor = db.video_vault_listings.aggregate([
        {"$match": {"is_active": True}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ])
    async for row in cursor:
        by_category[row["_id"]] = row["count"]

    return {
        "active_listings": total,
        "by_category": by_category,
        "valid_categories": sorted(VALID_CATEGORIES),
        "license_tiers": LICENSE_TIERS,
    }
