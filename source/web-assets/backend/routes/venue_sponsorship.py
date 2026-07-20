"""
Venue Partnership API — sponsored Vibez Spots as premium B2B inventory.

Endpoints (under /api):
  GET  /venue-sponsorship/tiers
  GET  /venue-sponsorship/carousel
  POST /venue-sponsorship/spots              — venue claims a sponsored listing
  POST /venue-sponsorship/spots/{id}/activate — activate with ₵ (demo/beta) or mark paid
  GET  /venue-sponsorship/mine
  POST /venue-sponsorship/convert            — perk redemption / lead conversion
  GET  /admin/venue-sponsorship              — admin inventory + ledger peek
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_current_user, get_database
from services.venue_sponsorship import (
    expires_in_days,
    list_active_sponsored_spots,
    record_conversion,
    resolve_tier,
    tier_catalog,
    utc_now_iso,
)

log = logging.getLogger(__name__)
router = APIRouter(tags=["venue-sponsorship"])

# ₵ price to activate a month of sponsorship in-app (beta / Founding Member path).
# ~1000 ₵ per USD list price so packs stay aligned with coin_topup tokenomics.
COINS_PER_USD = 1000


class CreateSponsoredSpot(BaseModel):
    venue_name: str = Field(min_length=2, max_length=120)
    tier_id: str = "partner"
    city: Optional[str] = None
    category: Optional[str] = "venue"  # venue | streamer | restaurant
    perk_title: Optional[str] = None
    perk_description: Optional[str] = None
    exclusive_offer: Optional[str] = None  # e.g. "Free welcome drink"
    website: Optional[str] = None
    image_url: Optional[str] = None
    restaurant_id: Optional[str] = None
    ambassador_user_id: Optional[str] = None
    spot_id: Optional[str] = None  # reuse existing vibe spot id


class ActivatePayload(BaseModel):
    """Pay with Vibez Coins for a 30-day sponsorship window (beta path)."""
    payment_method: str = "vibez_coins"  # vibez_coins | invoice


class ConvertPayload(BaseModel):
    spot_id: str
    kind: str = "perk_claim"  # perk_claim | lead | booking_complete
    amount_vibe: int = 0
    booking_id: Optional[str] = None
    notes: Optional[str] = None


@router.get("/venue-sponsorship/tiers")
async def get_tiers() -> Dict[str, Any]:
    return {
        "tiers": tier_catalog(),
        "currency": "USD",
        "note": (
            "Venues and streamers buy premium carousel visibility. "
            "Conversions (bookings / perk claims) generate platform commission."
        ),
        "coins_per_usd": COINS_PER_USD,
    }


@router.get("/venue-sponsorship/carousel")
async def sponsored_carousel(
    limit: int = 8,
    city: Optional[str] = None,
) -> Dict[str, Any]:
    db = get_database()
    rows = await list_active_sponsored_spots(db, limit=limit, city=city)
    # Seed a demo flagship if inventory is empty so the UI is never blank in beta.
    if not rows:
        demo = {
            "spot_id": "spot_demo_flagship",
            "venue_name": "Neon Harbor Lounge",
            "tier_id": "flagship",
            "tier_label": "Flagship",
            "city": city or "Global",
            "category": "venue",
            "perk_title": "Reserved table + welcome pour",
            "perk_description": "Show your Vibez Spot QR for a platform-only reserved table.",
            "exclusive_offer": "Free welcome drink for couples who book in-app",
            "carousel_weight": 50,
            "status": "active",
            "is_demo": True,
            "conversions": 0,
            "platform_commission_bps": 1000,
            "image_url": None,
            "activated_at": utc_now_iso(),
            "expires_at": expires_in_days(90),
        }
        existing = await db.venue_sponsored_spots.find_one(
            {"spot_id": demo["spot_id"]}, {"_id": 0}
        )
        if not existing:
            await db.venue_sponsored_spots.insert_one(dict(demo))
        rows = [demo]
    return {
        "spots": rows,
        "count": len(rows),
        "label": "Sponsored Vibez Spots",
    }


@router.post("/venue-sponsorship/spots")
async def create_sponsored_spot(
    payload: CreateSponsoredSpot, http_request: Request
) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    try:
        tier = resolve_tier(payload.tier_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    db = get_database()
    spot_id = (payload.spot_id or f"spot_{uuid.uuid4().hex[:12]}").strip()
    existing = await db.venue_sponsored_spots.find_one({"spot_id": spot_id}, {"_id": 0})
    if existing and existing.get("owner_user_id") not in (None, user.user_id):
        raise HTTPException(409, "Spot already claimed by another partner")

    # Pull ambassador commission_bps from vibe_sponsors if linked.
    ambassador_bps = 0
    if payload.ambassador_user_id:
        sponsor = await db.vibe_sponsors.find_one(
            {
                "ambassador_user_id": payload.ambassador_user_id,
                "status": "verified",
            },
            {"_id": 0, "commission_bps": 1},
        )
        if sponsor:
            ambassador_bps = int(sponsor.get("commission_bps") or 50)

    doc = {
        "spot_id": spot_id,
        "owner_user_id": user.user_id,
        "venue_name": payload.venue_name.strip(),
        "tier_id": tier["id"],
        "tier_label": tier["label"],
        "city": (payload.city or "").strip() or None,
        "category": (payload.category or "venue").strip().lower(),
        "perk_title": payload.perk_title
        or (tier["perks"][0] if tier.get("perks") else "Sponsored Spot"),
        "perk_description": payload.perk_description
        or "Exclusive platform-only perk for Vibez members.",
        "exclusive_offer": payload.exclusive_offer,
        "website": payload.website,
        "image_url": payload.image_url,
        "restaurant_id": payload.restaurant_id,
        "ambassador_user_id": payload.ambassador_user_id,
        "ambassador_commission_bps": ambassador_bps,
        "carousel_weight": tier["carousel_weight"],
        "platform_commission_bps": tier["platform_commission_bps"],
        "usd_month": tier["usd_month"],
        "status": "pending_payment",
        "conversions": 0,
        "commission_vibe_total": 0,
        "is_demo": False,
        "created_at": utc_now_iso(),
        "activated_at": None,
        "expires_at": None,
    }
    await db.venue_sponsored_spots.update_one(
        {"spot_id": spot_id},
        {"$set": doc},
        upsert=True,
    )
    # Mirror into vibe_spots config for QR / booking linkage.
    await db.vibe_spots.update_one(
        {"spot_id": spot_id},
        {
            "$set": {
                "spot_id": spot_id,
                "name": doc["venue_name"],
                "sponsored": True,
                "tier_id": tier["id"],
                "owner_user_id": user.user_id,
                "updated_at": utc_now_iso(),
            },
            "$setOnInsert": {"created_at": utc_now_iso()},
        },
        upsert=True,
    )
    return {"ok": True, "spot": doc, "activate_coins": int(tier["usd_month"] * COINS_PER_USD)}


@router.post("/venue-sponsorship/spots/{spot_id}/activate")
async def activate_sponsored_spot(
    spot_id: str, payload: ActivatePayload, http_request: Request
) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    spot = await db.venue_sponsored_spots.find_one({"spot_id": spot_id}, {"_id": 0})
    if not spot:
        raise HTTPException(404, "Sponsored spot not found")
    if spot.get("owner_user_id") != user.user_id:
        # Admins / founder emails can activate on behalf of venues.
        email = (getattr(user, "email", None) or "").lower()
        if not (
            getattr(user, "is_admin", False)
            or email.endswith("@globalvibez.com")
            or email.endswith("@globalvibezdsg.com")
        ):
            raise HTTPException(403, "Only the venue owner can activate")

    try:
        tier = resolve_tier(spot.get("tier_id") or "partner")
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    coins = int(tier["usd_month"] * COINS_PER_USD)
    method = (payload.payment_method or "vibez_coins").strip().lower()

    if method == "vibez_coins":
        from utils.wallet_fields import pick_wallet_field_for_debit  # noqa: PLC0415

        u = await db.users.find_one(
            {"user_id": user.user_id},
            {"_id": 0, "token_balance": 1, "credits_balance": 1},
        ) or {}
        try:
            field, _bal = pick_wallet_field_for_debit(u, coins)
        except ValueError:
            raise HTTPException(
                402,
                f"Need ₵{coins:,} to activate {tier['label']} for 30 days "
                f"(or choose payment_method=invoice).",
            )
        await db.users.update_one(
            {"user_id": user.user_id}, {"$inc": {field: -coins}}
        )
        payment = {"method": "vibez_coins", "coins": coins, "status": "paid"}
    elif method == "invoice":
        payment = {"method": "invoice", "usd": tier["usd_month"], "status": "invoiced"}
    else:
        raise HTTPException(400, "payment_method must be vibez_coins or invoice")

    activated = {
        "status": "active",
        "activated_at": utc_now_iso(),
        "expires_at": expires_in_days(30),
        "carousel_weight": tier["carousel_weight"],
        "platform_commission_bps": tier["platform_commission_bps"],
        "last_payment": payment,
    }
    await db.venue_sponsored_spots.update_one(
        {"spot_id": spot_id}, {"$set": activated}
    )

    # Promote linked restaurant into Date Spot carousel.
    if spot.get("restaurant_id"):
        await db.restaurants.update_one(
            {"restaurant_id": spot["restaurant_id"]},
            {
                "$set": {
                    "subscription_active": True,
                    "is_promoted": True,
                    "promoted_via": "venue_sponsorship",
                    "promoted_at": utc_now_iso(),
                }
            },
        )

    await db.venue_sponsorship_ledger.insert_one(
        {
            "event_id": f"vsl_act_{uuid.uuid4().hex[:12]}",
            "event_key": f"activate::{spot_id}::{activated['activated_at']}",
            "kind": "activation",
            "spot_id": spot_id,
            "user_id": user.user_id,
            "tier_id": tier["id"],
            "payment": payment,
            "at": utc_now_iso(),
        }
    )
    merged = {**spot, **activated}
    return {"ok": True, "spot": merged, "payment": payment}


@router.get("/venue-sponsorship/mine")
async def my_sponsored_spots(http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    rows: List[Dict[str, Any]] = await db.venue_sponsored_spots.find(
        {"owner_user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)
    return {"count": len(rows), "spots": rows}


@router.post("/venue-sponsorship/convert")
async def convert_sponsored_spot(
    payload: ConvertPayload, http_request: Request
) -> Dict[str, Any]:
    """User claims a platform-only perk or we record a lead conversion."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    kind = (payload.kind or "perk_claim").strip().lower()
    row = await record_conversion(
        db,
        spot_id=payload.spot_id,
        user_id=user.user_id,
        kind=kind,
        amount_vibe=max(0, int(payload.amount_vibe or 0)),
        booking_id=payload.booking_id,
        metadata={"notes": payload.notes} if payload.notes else {},
    )
    if not row:
        raise HTTPException(404, "Active sponsored spot not found")
    return {"ok": True, "conversion": row}


@router.get("/admin/venue-sponsorship")
async def admin_venue_sponsorship(
    http_request: Request, limit: int = 40
) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    email = (getattr(user, "email", None) or "").lower()
    if not (
        getattr(user, "is_admin", False)
        or email.endswith("@globalvibez.com")
        or email.endswith("@globalvibezdsg.com")
    ):
        raise HTTPException(403, "Admin only")
    db = get_database()
    spots = await db.venue_sponsored_spots.find({}, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(length=max(1, min(limit, 100)))
    ledger = await db.venue_sponsorship_ledger.find({}, {"_id": 0}).sort(
        "at", -1
    ).to_list(length=50)
    active = sum(1 for s in spots if s.get("status") == "active")
    commission = sum(int(s.get("commission_vibe_total") or 0) for s in spots)
    return {
        "spots": spots,
        "ledger": ledger,
        "stats": {
            "total_spots": len(spots),
            "active_spots": active,
            "commission_vibe_total": commission,
        },
    }
