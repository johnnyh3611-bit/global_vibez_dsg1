"""
Vibe Venues - hourly-housing + Vibe Artisan booking platform.
Spec: Vibe_Venues_Master_Lock_In.pdf
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Body, Request
from pydantic import BaseModel

from utils.database import get_database

# Stripe checkout via emergentintegrations (already used by VibeRidez)
try:
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout,
        CheckoutSessionRequest,
    )

    _STRIPE_KEY = os.environ.get("STRIPE_API_KEY", "")
    _stripe_checkout = StripeCheckout(api_key=_STRIPE_KEY) if _STRIPE_KEY else None
except Exception:
    _stripe_checkout = None
    CheckoutSessionRequest = None  # type: ignore

router = APIRouter(prefix="/vibe-venues", tags=["VibeVenues"])

# spec-locked rules
HOURLY_BLOCKS = [3, 6, 9, 12, 24]
ARTISAN_MEMBERSHIP_FEE_USD = 20.00
PLATFORM_RENTAL_FEE_PCT = float(os.getenv("VIBE_VENUES_PLATFORM_FEE_PCT", "0.20"))
PREP_FEE_PCT = float(os.getenv("VIBE_VENUES_PREP_FEE_PCT", "0.30"))
LIFECYCLE = [
    "pending", "escrowed", "prep_released", "in_progress",
    "completed", "paid_out", "cancelled", "disputed",
]


class HostListing(BaseModel):
    host_user_id: str
    name: str
    description: str
    address: str
    city: str
    zip_code: str
    capacity: int = 4
    cover_photo: Optional[str] = None
    walkthrough_3d_url: Optional[str] = None
    base_hourly_rate_usd: float = 50.0
    amenities: List[str] = []


class ArtisanProfile(BaseModel):
    user_id: str
    artisan_type: str = "chef"
    display_name: str
    bio: str
    signature_dishes: List[str] = []
    cover_photo: Optional[str] = None
    commercial_video_url: Optional[str] = None
    service_area_zips: List[str] = []
    base_service_rate_usd: float = 100.0


class BookingCreate(BaseModel):
    customer_user_id: str
    venue_id: str
    artisan_id: Optional[str] = None
    start_at: str
    block_hours: int
    artisan_service_total_usd: float = 0.0


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ====================== VENUES ======================
@router.post("/venues/list")
async def create_venue(payload: HostListing) -> Dict[str, Any]:
    db = get_database()
    venue_id = f"vv_{uuid.uuid4().hex[:12]}"
    doc = {
        "venue_id": venue_id,
        **payload.model_dump(),
        "listing_status": "approved",
        "created_at": _utc_iso(),
        "updated_at": _utc_iso(),
        "average_rating": 0,
        "review_count": 0,
        "total_bookings": 0,
    }
    await db.vibe_venues_listings.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "venue": doc}


@router.get("/venues")
async def list_venues(
    city: Optional[str] = None,
    zip_code: Optional[str] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    db = get_database()
    q: Dict[str, Any] = {"listing_status": "approved"}
    if city:
        q["city"] = {"$regex": city, "$options": "i"}
    if zip_code:
        q["zip_code"] = zip_code
    venues = await db.vibe_venues_listings.find(q, {"_id": 0}).sort(
        "average_rating", -1
    ).limit(limit).to_list(limit)
    return {"venues": venues, "hourly_blocks": HOURLY_BLOCKS}


@router.get("/venues/{venue_id}")
async def get_venue(venue_id: str) -> Dict[str, Any]:
    db = get_database()
    doc = await db.vibe_venues_listings.find_one({"venue_id": venue_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Venue not found")
    return doc


@router.get("/venues/{venue_id}/calendar")
async def venue_calendar(venue_id: str, days_ahead: int = 30) -> Dict[str, Any]:
    """
    Returns the booked time blocks for the next N days. Frontend uses
    this to grey out conflicting hourly slots.
    """
    db = get_database()
    venue = await db.vibe_venues_listings.find_one({"venue_id": venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")
    now = datetime.now(timezone.utc)
    cutoff = (now.replace(microsecond=0).isoformat())
    end_iso = (
        datetime.fromtimestamp(now.timestamp() + days_ahead * 86400, tz=timezone.utc)
        .replace(microsecond=0)
        .isoformat()
    )
    bookings = await db.vibe_venues_bookings.find(
        {
            "venue_id": venue_id,
            "lifecycle_state": {"$nin": ["cancelled", "disputed"]},
            "start_at": {"$gte": cutoff, "$lte": end_iso},
        },
        {"_id": 0, "booking_id": 1, "start_at": 1, "block_hours": 1, "lifecycle_state": 1},
    ).sort("start_at", 1).to_list(500)
    return {
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "hourly_rate_usd": venue["base_hourly_rate_usd"],
        "hourly_blocks": HOURLY_BLOCKS,
        "booked_blocks": bookings,
    }


# ====================== ARTISANS ======================
@router.post("/artisans/onboard")
async def onboard_artisan(payload: ArtisanProfile) -> Dict[str, Any]:
    db = get_database()
    artisan_id = f"va_{uuid.uuid4().hex[:12]}"
    doc = {
        "artisan_id": artisan_id,
        **payload.model_dump(),
        "membership_status": "pending_payment",
        "membership_fee_usd": ARTISAN_MEMBERSHIP_FEE_USD,
        "created_at": _utc_iso(),
        "updated_at": _utc_iso(),
        "completed_jobs": 0,
        "average_rating": 0,
    }
    await db.vibe_venues_artisans.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "artisan": doc}


@router.get("/artisans")
async def list_artisans(
    artisan_type: Optional[str] = None,
    zip_code: Optional[str] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    db = get_database()
    q: Dict[str, Any] = {"membership_status": {"$in": ["pending_payment", "active"]}}
    if artisan_type:
        q["artisan_type"] = artisan_type
    if zip_code:
        q["service_area_zips"] = zip_code
    artisans = await db.vibe_venues_artisans.find(q, {"_id": 0}).sort(
        "average_rating", -1
    ).limit(limit).to_list(limit)
    return {"artisans": artisans, "membership_fee_usd": ARTISAN_MEMBERSHIP_FEE_USD}


# ====================== BOOKINGS / ESCROW ======================
@router.post("/bookings/create")
async def create_booking(payload: BookingCreate) -> Dict[str, Any]:
    db = get_database()
    if payload.block_hours not in HOURLY_BLOCKS:
        raise HTTPException(400, f"block_hours must be one of {HOURLY_BLOCKS}")

    venue = await db.vibe_venues_listings.find_one({"venue_id": payload.venue_id}, {"_id": 0})
    if not venue:
        raise HTTPException(404, "Venue not found")

    house_rental_total = venue["base_hourly_rate_usd"] * payload.block_hours
    platform_fee = round(house_rental_total * PLATFORM_RENTAL_FEE_PCT, 2)
    host_payout = round(house_rental_total - platform_fee, 2)

    artisan_prep_fee = 0.0
    artisan_balance = 0.0
    artisan = None
    if payload.artisan_id and payload.artisan_service_total_usd > 0:
        artisan = await db.vibe_venues_artisans.find_one(
            {"artisan_id": payload.artisan_id}, {"_id": 0}
        )
        if not artisan:
            raise HTTPException(404, "Artisan not found")
        artisan_prep_fee = round(payload.artisan_service_total_usd * PREP_FEE_PCT, 2)
        artisan_balance = round(payload.artisan_service_total_usd - artisan_prep_fee, 2)

    grand_total = round(house_rental_total + payload.artisan_service_total_usd, 2)

    booking_id = f"bk_{uuid.uuid4().hex[:12]}"
    doc = {
        "booking_id": booking_id,
        "customer_user_id": payload.customer_user_id,
        "venue_id": payload.venue_id,
        "venue_name": venue["name"],
        "host_user_id": venue["host_user_id"],
        "artisan_id": payload.artisan_id,
        "artisan_name": artisan["display_name"] if artisan else None,
        "start_at": payload.start_at,
        "block_hours": payload.block_hours,
        "pricing": {
            "house_rental_total_usd": round(house_rental_total, 2),
            "platform_fee_usd": platform_fee,
            "host_payout_usd": host_payout,
            "artisan_service_total_usd": round(payload.artisan_service_total_usd, 2),
            "artisan_prep_fee_usd": artisan_prep_fee,
            "artisan_balance_usd": artisan_balance,
            "grand_total_usd": grand_total,
        },
        "lifecycle_state": "pending",
        "lifecycle_history": [{"state": "pending", "at": _utc_iso()}],
        "review": None,
        "vibe_check_passed_at": None,
        "created_at": _utc_iso(),
    }
    await db.vibe_venues_bookings.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "booking": doc}


@router.post("/bookings/{booking_id}/escrow-lock")
async def lock_escrow(booking_id: str, tx_signature: str = Body(..., embed=True)):
    db = get_database()
    res = await db.vibe_venues_bookings.find_one_and_update(
        {"booking_id": booking_id, "lifecycle_state": "pending"},
        {
            "$set": {
                "lifecycle_state": "escrowed",
                "escrow_tx_signature": tx_signature,
                "escrowed_at": _utc_iso(),
            },
            "$push": {"lifecycle_history": {"state": "escrowed", "at": _utc_iso(), "tx": tx_signature}},
        },
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(409, "Booking not found or not in 'pending' state")
    return {"success": True, "booking": res}


@router.post("/bookings/{booking_id}/release-prep")
async def release_prep_fee(booking_id: str):
    db = get_database()
    res = await db.vibe_venues_bookings.find_one_and_update(
        {"booking_id": booking_id, "lifecycle_state": "escrowed"},
        {
            "$set": {"lifecycle_state": "prep_released", "prep_released_at": _utc_iso()},
            "$push": {"lifecycle_history": {"state": "prep_released", "at": _utc_iso()}},
        },
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(409, "Booking not in 'escrowed' state")
    return {"success": True, "booking": res}


@router.post("/bookings/{booking_id}/vibe-check")
async def vibe_check(
    booking_id: str,
    rating: int = Body(..., embed=True, ge=1, le=5),
    review_text: str = Body("", embed=True),
):
    db = get_database()
    res = await db.vibe_venues_bookings.find_one_and_update(
        {"booking_id": booking_id, "lifecycle_state": {"$in": ["prep_released", "in_progress", "completed"]}},
        {
            "$set": {
                "lifecycle_state": "paid_out",
                "vibe_check_passed_at": _utc_iso(),
                "review": {"rating": rating, "text": review_text, "at": _utc_iso()},
            },
            "$push": {"lifecycle_history": {"state": "paid_out", "at": _utc_iso(), "rating": rating}},
        },
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(409, "Booking not in a Vibe-Checkable state")
    return {"success": True, "booking": res}


@router.post("/bookings/{booking_id}/dispute")
async def open_dispute(booking_id: str, reason: str = Body(..., embed=True)):
    db = get_database()
    res = await db.vibe_venues_bookings.find_one_and_update(
        {"booking_id": booking_id},
        {
            "$set": {"lifecycle_state": "disputed", "dispute_reason": reason},
            "$push": {"lifecycle_history": {"state": "disputed", "at": _utc_iso(), "reason": reason}},
        },
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(404, "Booking not found")
    return {"success": True, "booking": res}


@router.get("/bookings/mine/{user_id}")
async def my_bookings(user_id: str) -> Dict[str, Any]:
    db = get_database()
    bookings = await db.vibe_venues_bookings.find(
        {"$or": [
            {"customer_user_id": user_id},
            {"host_user_id": user_id},
            {"artisan_id": user_id},
        ]},
        {"_id": 0},
    ).sort("created_at", -1).limit(100).to_list(100)
    return {"bookings": bookings}


@router.get("/config")
async def get_config() -> Dict[str, Any]:
    return {
        "hourly_blocks": HOURLY_BLOCKS,
        "platform_rental_fee_pct": PLATFORM_RENTAL_FEE_PCT,
        "prep_fee_pct": PREP_FEE_PCT,
        "artisan_membership_fee_usd": ARTISAN_MEMBERSHIP_FEE_USD,
        "lifecycle_states": LIFECYCLE,
    }


@router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str) -> Dict[str, Any]:
    db = get_database()
    doc = await db.vibe_venues_bookings.find_one({"booking_id": booking_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Booking not found")
    return doc


# =============== VIBE-SYNC ARCHITECTURE PHASE CHAT ===============
# Per Master Lock-In: a private chat opens between User + Artisan once
# the booking is escrowed, so they can finalize setup, decor, menu,
# and any special pricing before the event.

class ChatMessage(BaseModel):
    sender_user_id: str
    sender_role: str          # customer | artisan | host | admin
    text: str


@router.post("/bookings/{booking_id}/chat")
async def post_chat(booking_id: str, payload: ChatMessage) -> Dict[str, Any]:
    db = get_database()
    booking = await db.vibe_venues_bookings.find_one(
        {"booking_id": booking_id}, {"_id": 0}
    )
    if not booking:
        raise HTTPException(404, "Booking not found")
    msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "booking_id": booking_id,
        **payload.model_dump(),
        "at": _utc_iso(),
    }
    await db.vibe_venues_chat.insert_one(msg)
    msg.pop("_id", None)
    return {"success": True, "message": msg}


@router.get("/bookings/{booking_id}/chat")
async def get_chat(booking_id: str) -> Dict[str, Any]:
    db = get_database()
    msgs = await db.vibe_venues_chat.find(
        {"booking_id": booking_id}, {"_id": 0}
    ).sort("at", 1).limit(500).to_list(500)
    return {"messages": msgs}


# === Typing indicators (lightweight, no websockets required) ===
class TypingPing(BaseModel):
    sender_user_id: str
    sender_role: str


@router.post("/bookings/{booking_id}/chat/typing")
async def post_typing(booking_id: str, payload: TypingPing) -> Dict[str, Any]:
    """
    Records a typing-indicator ping. Frontend posts this every ~2s while
    the user types. Other clients fetch /typing to see who's currently
    active in the last 5s window.
    """
    db = get_database()
    await db.vibe_venues_typing.update_one(
        {"booking_id": booking_id, "sender_user_id": payload.sender_user_id},
        {
            "$set": {
                "booking_id": booking_id,
                "sender_user_id": payload.sender_user_id,
                "sender_role": payload.sender_role,
                "at": _utc_iso(),
            }
        },
        upsert=True,
    )
    return {"ok": True}


@router.get("/bookings/{booking_id}/chat/typing")
async def get_typing(booking_id: str) -> Dict[str, Any]:
    """Returns users who pinged in the last 5 seconds."""
    db = get_database()
    cutoff = (
        datetime.fromtimestamp(
            datetime.now(timezone.utc).timestamp() - 5, tz=timezone.utc
        )
        .replace(microsecond=0)
        .isoformat()
    )
    rows = await db.vibe_venues_typing.find(
        {"booking_id": booking_id, "at": {"$gte": cutoff}},
        {"_id": 0, "sender_user_id": 1, "sender_role": 1, "at": 1},
    ).to_list(20)
    return {"typing": rows}


# =============== FOUNDERS & CREW DISPUTE RESOLUTION ===============
@router.get("/admin/disputes")
async def list_disputes() -> Dict[str, Any]:
    """All bookings currently in 'disputed' state for the master-key panel."""
    db = get_database()
    rows = await db.vibe_venues_bookings.find(
        {"lifecycle_state": "disputed"}, {"_id": 0}
    ).sort("created_at", -1).limit(200).to_list(200)
    return {"disputes": rows}


@router.post("/admin/disputes/{booking_id}/resolve")
async def resolve_dispute(
    booking_id: str,
    resolution: str = Body(..., embed=True),  # "release" | "refund"
    note: str = Body("", embed=True),
):
    """
    Founders & Crew master-key resolution.
      • release  → flip booking to paid_out (host + artisan get balance)
      • refund   → flip to cancelled, frontend triggers off-chain refund
    """
    db = get_database()
    if resolution not in ("release", "refund"):
        raise HTTPException(400, "resolution must be 'release' or 'refund'")
    next_state = "paid_out" if resolution == "release" else "cancelled"
    res = await db.vibe_venues_bookings.find_one_and_update(
        {"booking_id": booking_id, "lifecycle_state": "disputed"},
        {
            "$set": {
                "lifecycle_state": next_state,
                "dispute_resolution": resolution,
                "dispute_resolved_at": _utc_iso(),
                "dispute_note": note,
            },
            "$push": {
                "lifecycle_history": {
                    "state": next_state,
                    "at": _utc_iso(),
                    "by": "founders_and_crew",
                    "resolution": resolution,
                    "note": note,
                }
            },
        },
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(409, "Booking not in 'disputed' state")
    return {"success": True, "booking": res}


# ====================== STRIPE - ARTISAN MEMBERSHIP ($20/mo) ======================
@router.post("/artisans/{artisan_id}/checkout")
async def artisan_checkout(artisan_id: str) -> Dict[str, Any]:
    """
    Create a Stripe checkout session for the $20.00 Vibe Artisan
    monthly membership. Per the Master Lock-In, this is a flat fee.

    NOTE: emergentintegrations Stripe SDK only supports one-time payments
    today, so we charge $20 once per month and rely on the artisan
    re-checking-out (or - future task - wire native Stripe subscriptions).
    """
    db = get_database()
    if _stripe_checkout is None:
        raise HTTPException(503, "Stripe not configured")
    artisan = await db.vibe_venues_artisans.find_one(
        {"artisan_id": artisan_id}, {"_id": 0}
    )
    if not artisan:
        raise HTTPException(404, "Artisan not found")

    frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    req = CheckoutSessionRequest(
        amount=ARTISAN_MEMBERSHIP_FEE_USD,
        currency="usd",
        success_url=f"{frontend}/vibe-venues/artisan/payment-success?session_id={{CHECKOUT_SESSION_ID}}&artisan_id={artisan_id}",
        cancel_url=f"{frontend}/vibe-venues/artisan",
        metadata={
            "kind": "artisan_membership",
            "artisan_id": artisan_id,
        },
    )
    session = await _stripe_checkout.create_checkout_session(req)
    await db.vibe_venues_subscriptions.insert_one({
        "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
        "kind": "artisan_membership",
        "artisan_id": artisan_id,
        "amount_usd": ARTISAN_MEMBERSHIP_FEE_USD,
        "stripe_session_id": session.session_id,
        "status": "pending",
        "created_at": _utc_iso(),
    })
    return {"success": True, "checkout_url": session.url, "session_id": session.session_id}


@router.get("/payment/status/{session_id}")
async def payment_status(session_id: str) -> Dict[str, Any]:
    """
    Poll Stripe for status. On `complete`, mark subscription active
    and flip the artisan / restaurant membership row to active.
    """
    db = get_database()
    if _stripe_checkout is None:
        raise HTTPException(503, "Stripe not configured")
    status = await _stripe_checkout.get_checkout_status(session_id)
    sub = await db.vibe_venues_subscriptions.find_one(
        {"stripe_session_id": session_id}, {"_id": 0}
    )
    if status.status == "complete" and sub and sub["status"] == "pending":
        await db.vibe_venues_subscriptions.update_one(
            {"stripe_session_id": session_id},
            {"$set": {"status": "paid", "paid_at": _utc_iso()}},
        )
        if sub["kind"] == "artisan_membership":
            await db.vibe_venues_artisans.update_one(
                {"artisan_id": sub["artisan_id"]},
                {"$set": {"membership_status": "active", "membership_paid_at": _utc_iso()}},
            )
        elif sub["kind"] == "restaurant_partnership":
            await db.restaurants.update_one(
                {"restaurant_id": sub["restaurant_id"]},
                {"$set": {"subscription_active": True, "subscription_paid_at": _utc_iso()}},
            )
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "subscription": sub,
    }


# =================== STRIPE - RESTAURANT PARTNERSHIP ($30/mo) ===================
RESTAURANT_PARTNERSHIP_FEE_USD = 30.00


@router.post("/restaurants/{restaurant_id}/checkout")
async def restaurant_partnership_checkout(restaurant_id: str) -> Dict[str, Any]:
    """
    $30/month Date Spot Finder + Hungry Vibez partnership: unlocks
    the Neon Purple Vibe-Ring + priority placement + commercials.
    """
    db = get_database()
    if _stripe_checkout is None:
        raise HTTPException(503, "Stripe not configured")
    venue = await db.restaurants.find_one(
        {"restaurant_id": restaurant_id}, {"_id": 0}
    )
    if not venue:
        raise HTTPException(404, "Restaurant not found")

    frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    req = CheckoutSessionRequest(
        amount=RESTAURANT_PARTNERSHIP_FEE_USD,
        currency="usd",
        success_url=f"{frontend}/restaurants/{restaurant_id}/payment-success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{frontend}/restaurants/{restaurant_id}",
        metadata={
            "kind": "restaurant_partnership",
            "restaurant_id": restaurant_id,
        },
    )
    session = await _stripe_checkout.create_checkout_session(req)
    await db.vibe_venues_subscriptions.insert_one({
        "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
        "kind": "restaurant_partnership",
        "restaurant_id": restaurant_id,
        "amount_usd": RESTAURANT_PARTNERSHIP_FEE_USD,
        "stripe_session_id": session.session_id,
        "status": "pending",
        "created_at": _utc_iso(),
    })
    return {"success": True, "checkout_url": session.url, "session_id": session.session_id}


# ===================== STRIPE WEBHOOK =====================
@router.post("/stripe/webhook")
async def vibe_venues_stripe_webhook(request: Request) -> Dict[str, Any]:
    """
    Stripe webhook for Vibe Venues subscriptions (artisan + restaurant
    partnership). Handles `checkout.session.completed` and
    `payment_intent.succeeded` to flip membership state automatically
    without the frontend having to poll.

    Configure in Stripe Dashboard -> Developers -> Webhooks:
      Endpoint URL: {backend}/api/vibe-venues/stripe/webhook
      Events:       checkout.session.completed, payment_intent.succeeded
    """
    db = get_database()
    if _stripe_checkout is None:
        raise HTTPException(503, "Stripe not configured")

    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/vibe-venues/stripe/webhook"

    from emergentintegrations.payments.stripe.checkout import StripeCheckout as _SC
    sc = _SC(api_key=os.environ.get("STRIPE_API_KEY", ""), webhook_url=webhook_url)
    webhook_response = await sc.handle_webhook(body, signature)

    if webhook_response.event_type not in (
        "checkout.session.completed",
        "payment_intent.succeeded",
    ):
        return {"received": True, "ignored": webhook_response.event_type}

    session_id = webhook_response.session_id
    sub = await db.vibe_venues_subscriptions.find_one(
        {"stripe_session_id": session_id}, {"_id": 0}
    )
    if not sub:
        return {"received": True, "warn": "subscription_not_found"}
    if sub["status"] == "paid":
        return {"received": True, "already_processed": True}

    await db.vibe_venues_subscriptions.update_one(
        {"stripe_session_id": session_id},
        {"$set": {
            "status": "paid",
            "paid_at": _utc_iso(),
            "stripe_event": webhook_response.event_type,
        }},
    )
    if sub["kind"] == "artisan_membership":
        await db.vibe_venues_artisans.update_one(
            {"artisan_id": sub["artisan_id"]},
            {"$set": {
                "membership_status": "active",
                "membership_paid_at": _utc_iso(),
                "membership_renews_at": _utc_iso(),
            }},
        )
    elif sub["kind"] == "restaurant_partnership":
        await db.restaurants.update_one(
            {"restaurant_id": sub["restaurant_id"]},
            {"$set": {
                "subscription_active": True,
                "subscription_paid_at": _utc_iso(),
            }},
        )

    # Send receipt email via Resend (no-op if RESEND_API_KEY is unset).
    try:
        await _send_receipt_email(sub)
    except Exception as e:  # noqa: BLE001
        # Non-fatal — webhook should still 200 OK so Stripe doesn't retry.
        import logging
        logging.getLogger(__name__).warning(f"Receipt email failed: {e}")

    return {"received": True, "subscription_id": sub["subscription_id"], "kind": sub["kind"]}


async def _send_receipt_email(sub: Dict[str, Any]) -> None:
    """
    Sends a Stripe receipt email via Resend. Pulls customer email from
    the linked artisan / restaurant row. Subject + body branded for
    Global Vibez DSG.

    No-ops if RESEND_API_KEY is missing OR if the linked record has no
    email field.
    """
    import os
    import asyncio
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return
    sender = os.environ.get("RESEND_SENDER_EMAIL", "support@globalvibezdsg.com")

    db = get_database()
    to_email: Optional[str] = None
    name = "Vibe member"
    perks = ""

    if sub["kind"] == "artisan_membership":
        a = await db.vibe_venues_artisans.find_one(
            {"artisan_id": sub["artisan_id"]}, {"_id": 0}
        )
        if a:
            name = a.get("display_name", name)
            user = await db.users.find_one(
                {"user_id": a.get("user_id")}, {"_id": 0, "email": 1}
            )
            to_email = (user or {}).get("email")
            perks = """
              • Signature Commercials inside venue 360° walkthroughs<br>
              • AI Perfect-Mate auto-matching with bookings<br>
              • 1-2hr early-access prep window per booking<br>
              • 30% prep-fee on confirm + 70% balance on Vibe-Check
            """
    elif sub["kind"] == "restaurant_partnership":
        r = await db.restaurants.find_one(
            {"restaurant_id": sub["restaurant_id"]}, {"_id": 0}
        )
        if r:
            name = r.get("name", name)
            to_email = r.get("email") or r.get("contact_email")
            perks = """
              • Neon Purple Vibe-Ring on every Date Spot Finder card<br>
              • Priority placement in zip-code search<br>
              • In-app commercials on the venue detail page
            """

    if not to_email:
        return

    amount = sub["amount_usd"]
    kind_label = "Vibe Artisan Membership" if sub["kind"] == "artisan_membership" else "Restaurant Partnership"

    html = f"""
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#07030F;color:#fff;padding:32px;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <h1 style="font-size:28px;margin:0;background:linear-gradient(90deg,#d946ef,#a855f7);-webkit-background-clip:text;color:transparent">
          GLOBAL VIBEZ DSG
        </h1>
        <p style="color:#a78bfa;font-size:11px;letter-spacing:3px;margin:4px 0 0">
          PAYMENT RECEIVED
        </p>
      </div>
      <h2 style="font-size:20px;color:#fff;margin-bottom:12px">Welcome aboard, {name}.</h2>
      <p style="color:#c4b5fd;line-height:1.6">
        Your <strong>${amount:.2f}</strong> {kind_label} payment cleared.
        Your account is now active and the perks listed below are unlocked
        immediately.
      </p>
      <div style="background:#0F0720;border:1px solid #d946ef33;border-radius:8px;padding:16px;margin:20px 0">
        <p style="color:#d946ef;font-size:11px;letter-spacing:3px;margin:0 0 8px">PERKS UNLOCKED</p>
        <div style="color:#c4b5fd;font-size:14px;line-height:1.7">{perks}</div>
      </div>
      <p style="color:#a78bfa;font-size:12px;line-height:1.6;margin-top:24px">
        Receipt ID: <code style="color:#fff">{sub['subscription_id']}</code><br>
        Stripe Session: <code style="color:#fff">{sub['stripe_session_id']}</code>
      </p>
      <hr style="border:none;border-top:1px solid #4c1d95;margin:24px 0">
      <p style="color:#a78bfa;font-size:11px;text-align:center">
        © Global Vibez DSG · Gaming · Dating · Rides · Food · Venues
      </p>
    </div>
    """

    try:
        import resend
    except ImportError:
        return
    resend.api_key = api_key
    params = {
        "from": sender,
        "to": [to_email],
        "subject": f"Receipt — Global Vibez {kind_label} (${amount:.2f})",
        "html": html,
    }
    await asyncio.to_thread(resend.Emails.send, params)


# ─── HOST DASHBOARD ENDPOINTS ───────────────────────────────────────────
# 2026-05-12 founder ask: dashboards for "people that have the Airbnbs or
# the Vibrants". The existing /vibe-venues/host route is a ONE-TIME listing
# form. Hosts need a recurring dashboard to:
#   1. See all properties they've listed
#   2. See incoming bookings across all their properties
#   3. See earnings (pending escrow / released / paid out)
#
# We piggy-back on what's already wired: hosts can drive bookings through
# the existing /release-prep + state machine. This module only adds the
# read-side aggregation the dashboard needs.


@router.get("/host/venues/{user_id}")
async def host_my_venues(user_id: str) -> Dict[str, Any]:
    """List every venue the host has put on the platform."""
    db = get_database()
    venues = await db.vibe_venues_listings.find(
        {"host_user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    return {"success": True, "count": len(venues), "venues": venues}


@router.get("/host/bookings/{user_id}")
async def host_my_bookings(user_id: str, status: Optional[str] = None) -> Dict[str, Any]:
    """All bookings ACROSS every property the host owns.
    Optional `?status=pending|escrowed|prep_released|in_progress|completed|paid_out|cancelled|disputed`."""
    db = get_database()
    # 1. Resolve every venue_id the host owns.
    venue_docs = await db.vibe_venues_listings.find(
        {"host_user_id": user_id}, {"_id": 0, "venue_id": 1, "name": 1}
    ).to_list(length=200)
    if not venue_docs:
        return {"success": True, "count": 0, "bookings": []}
    venue_id_to_name = {v["venue_id"]: v.get("name", "") for v in venue_docs}

    # 2. Find every booking against those venues.
    q: Dict[str, Any] = {"venue_id": {"$in": list(venue_id_to_name.keys())}}
    if status:
        q["lifecycle_state"] = status
    bookings = await db.vibe_venues_bookings.find(q, {"_id": 0}).sort(
        "created_at", -1
    ).limit(200).to_list(length=200)

    # 3. Decorate each booking with the venue name (saves a frontend join).
    for b in bookings:
        b["venue_name"] = venue_id_to_name.get(b.get("venue_id"), b.get("venue_name", ""))
        # Mirror lifecycle_state into `state` for the frontend pill helper.
        b["state"] = b.get("lifecycle_state", "pending")
        # Project pricing.host_payout (frontend expects pricing.host_payout, not _usd suffix).
        if "pricing" in b and "host_payout_usd" in b["pricing"]:
            b["pricing"]["host_payout"] = b["pricing"]["host_payout_usd"]
            b["pricing"]["grand_total"] = b["pricing"].get("grand_total_usd")

    return {"success": True, "count": len(bookings), "bookings": bookings}


@router.get("/host/earnings/{user_id}")
async def host_earnings_summary(user_id: str) -> Dict[str, Any]:
    """Rolled-up host earnings across every property:
      - escrowed_usd:    sitting in escrow waiting for prep_released
      - released_usd:    chef released the prep fee but stay not paid out yet
      - paid_out_usd:    actually settled into host wallet (lifetime)
      - active_count:    bookings currently in flight
      - all_time_count:  every completed/paid_out booking
    """
    db = get_database()
    venue_docs = await db.vibe_venues_listings.find(
        {"host_user_id": user_id}, {"_id": 0, "venue_id": 1}
    ).to_list(length=200)
    if not venue_docs:
        return {
            "success": True,
            "escrowed_usd": 0.0,
            "released_usd": 0.0,
            "paid_out_usd": 0.0,
            "active_count": 0,
            "all_time_count": 0,
            "venue_count": 0,
            "platform_fee_pct": PLATFORM_RENTAL_FEE_PCT,
            "prep_fee_pct": PREP_FEE_PCT,
        }
    venue_ids = [v["venue_id"] for v in venue_docs]
    pipeline = [
        {"$match": {"venue_id": {"$in": venue_ids}}},
        {
            "$group": {
                "_id": "$lifecycle_state",
                "total_payout": {"$sum": {"$ifNull": ["$pricing.host_payout_usd", 0]}},
                "count": {"$sum": 1},
            }
        },
    ]
    agg = await db.vibe_venues_bookings.aggregate(pipeline).to_list(length=20)
    by_state = {row["_id"]: row for row in agg}

    def payout_of(state: str) -> float:
        return round(float(by_state.get(state, {}).get("total_payout", 0)), 2)

    def count_of(state: str) -> int:
        return int(by_state.get(state, {}).get("count", 0))

    return {
        "success": True,
        "escrowed_usd": payout_of("escrowed"),
        "released_usd": payout_of("prep_released") + payout_of("in_progress"),
        "paid_out_usd": payout_of("paid_out") + payout_of("completed"),
        "active_count": (
            count_of("pending") + count_of("escrowed")
            + count_of("prep_released") + count_of("in_progress")
        ),
        "all_time_count": count_of("completed") + count_of("paid_out"),
        "venue_count": len(venue_ids),
        "platform_fee_pct": PLATFORM_RENTAL_FEE_PCT,
        "prep_fee_pct": PREP_FEE_PCT,
    }



@router.post("/host/test-booking/{user_id}")
async def host_drop_test_booking(user_id: str) -> Dict[str, Any]:
    """2026-05-12 — mirror of HungryVibes Test Order. Drops a synthetic
    6-hour booking onto the host's NEWEST venue so they can practice the
    pending → escrowed → prep_released → in_progress → completed flow
    without needing a real customer to spin up Solflare and lock USDC.

    The booking is marked `is_test=True` so reporting + earnings widgets
    can exclude it. If host has no venues yet, returns 404."""
    db = get_database()
    venue = await db.vibe_venues_listings.find_one(
        {"host_user_id": user_id},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    if not venue:
        raise HTTPException(
            status_code=404,
            detail="List a property first via /api/vibe-venues/venues/list",
        )

    block_hours = 6
    house_rental_total = float(venue["base_hourly_rate_usd"]) * block_hours
    platform_fee = round(house_rental_total * PLATFORM_RENTAL_FEE_PCT, 2)
    host_payout = round(house_rental_total - platform_fee, 2)
    booking_id = f"bk_test_{uuid.uuid4().hex[:8]}"
    now_iso = _utc_iso()
    doc = {
        "booking_id": booking_id,
        "customer_user_id": "test-customer",
        "venue_id": venue["venue_id"],
        "venue_name": venue["name"],
        "host_user_id": user_id,
        "artisan_id": None,
        "artisan_name": None,
        "start_at": now_iso,
        "block_hours": block_hours,
        "pricing": {
            "house_rental_total_usd": round(house_rental_total, 2),
            "platform_fee_usd": platform_fee,
            "host_payout_usd": host_payout,
            "artisan_service_total_usd": 0.0,
            "artisan_prep_fee_usd": 0.0,
            "artisan_balance_usd": 0.0,
            "grand_total_usd": round(house_rental_total, 2),
        },
        "lifecycle_state": "pending",
        "lifecycle_history": [{"state": "pending", "at": now_iso}],
        "review": None,
        "vibe_check_passed_at": None,
        "is_test": True,
        "created_at": now_iso,
    }
    await db.vibe_venues_bookings.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "booking": doc}

