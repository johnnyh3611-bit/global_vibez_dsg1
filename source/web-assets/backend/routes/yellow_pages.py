"""
Vibe Yellow Pages (May 2026)
─────────────────────────────────────────────────────────────────────
The 4th Pillar of the Global Vibez DSG marketing onesheet:
"Supporting local Mom & Pop businesses · hyper-local sponsorship ·
DSG Guard safety protocol".

Three tiers (visually distinct):
  • Listed       — free, gray "Listed" tag
  • Verified     — $29 one-time, green shield
  • Elite        — $99 one-time + license review, gold shield
  • Featured     — $19/month recurring (top-of-zip pin, orange flame)

Ambassador commission (one-time only — locks LTV after month 1):
  • Verified  → 50% one-time = $14.50 in vibe_credits
  • Elite     → 50% one-time = $49.50 in vibe_credits
  • Featured  → 50% of FIRST month only = $9.50 in vibe_credits.
                Renewal months 2..N are 100% platform.

Adult/Entertainer category is double-gated:
  • Listing owner MUST upload a license/permit BEFORE the listing
    becomes visible (admin review).
  • Public viewers must be `age_verified=true` to see adult listings.
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

router = APIRouter(prefix="/yellow-pages", tags=["yellow-pages"])

# ────────────────────── Database ──────────────────────
# Reuse the shared db handle (already wired with MONGO_URL/DB_NAME via
# config.py). Direct os.environ lookups here would fail at import time
# in pytest workers that don't load .env automatically.
from config import db as _db

LISTINGS = _db.yellow_pages_listings
PAYMENTS = _db.yellow_pages_payments
USERS = _db.users

# ────────────────────── Pricing (LOCKED) ──────────────────────
PRICING = {
    "verified": {
        "label": "DSG Guard Verified",
        "price_usd": 29.00,
        "kind": "one_time",
        "ambassador_cut_usd": 14.50,    # 50% one-time
        "badge_color": "#10B981",
        "badge_icon": "shield-check",
    },
    "elite": {
        "label": "DSG Guard Elite",
        "price_usd": 99.00,
        "kind": "one_time",
        "ambassador_cut_usd": 49.50,    # 50% one-time
        "badge_color": "#F59E0B",
        "badge_icon": "crown",
        "requires_license_review": True,
    },
    "featured": {
        "label": "Featured / Top of Zip",
        "price_usd": 19.00,
        "kind": "monthly",
        "ambassador_cut_usd": 9.50,     # 50% of FIRST month only
        "badge_color": "#FB923C",
        "badge_icon": "flame",
        "ambassador_paid_first_month_only": True,
    },
}

CATEGORIES = [
    {"id": "food",          "label": "Food & Drink",                     "icon": "utensils"},
    {"id": "beauty",        "label": "Beauty & Wellness",                "icon": "sparkles"},
    {"id": "home_services", "label": "Home Services",                    "icon": "wrench"},
    {"id": "auto",          "label": "Auto",                             "icon": "car"},
    {"id": "retail",        "label": "Retail & Shops",                   "icon": "shopping-bag"},
    {"id": "events",        "label": "Events & Entertainment",           "icon": "music"},
    {"id": "adult",         "label": "Adult / Entertainer (18+)",        "icon": "lock",
        "is_adult": True,
        "requires_license": True,
        "requires_age_gate": True},
]
CATEGORY_IDS = {c["id"] for c in CATEGORIES}
ADULT_CATEGORIES = {c["id"] for c in CATEGORIES if c.get("is_adult")}


# ────────────────────── Models ──────────────────────
class ListingCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=140)
    category: str
    description: str = Field(default="", max_length=2000)
    address: str = Field(..., min_length=3, max_length=300)
    city: str = Field(..., min_length=1, max_length=80)
    state: Optional[str] = Field(default=None, max_length=80)
    zip_code: str = Field(..., min_length=2, max_length=20)
    country: str = Field(default="US", max_length=80)
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    hours: Optional[str] = None
    photo_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    license_doc_url: Optional[str] = None  # required for adult category
    ambassador_ref: Optional[str] = None   # ?ref= referral code


class UpgradeRequest(BaseModel):
    listing_id: str
    tier: str   # "verified" | "elite" | "featured"
    origin_url: str  # for Stripe redirect
    payment_method: str = "card"   # "card" (default) | "coins"


class AdminReviewRequest(BaseModel):
    listing_id: str
    decision: str   # "approve" | "reject"
    note: Optional[str] = None


# ────────────────────── Helpers ──────────────────────
async def _resolve_user(authorization: Optional[str]) -> Optional[Dict[str, Any]]:
    """Best-effort resolve user from Bearer token via user_sessions table."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None
    sess = await _db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    user = await USERS.find_one({"user_id": sess.get("user_id")}, {"_id": 0, "password_hash": 0})
    return user


async def _get_user_from_request(request: Request) -> Optional[Dict[str, Any]]:
    return await _resolve_user(request.headers.get("authorization"))


def _public_listing(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Strip mongo internals, return wire-safe shape."""
    pricing_meta = PRICING.get(doc.get("tier", "free")) if doc.get("tier") not in (None, "free") else None
    return {
        "id": doc["id"],
        "owner_user_id": doc.get("owner_user_id"),
        "name": doc["name"],
        "category": doc["category"],
        "description": doc.get("description", ""),
        "address": doc["address"],
        "city": doc["city"],
        "state": doc.get("state"),
        "zip_code": doc["zip_code"],
        "country": doc.get("country", "US"),
        "phone": doc.get("phone"),
        "email": doc.get("email"),
        "website": doc.get("website"),
        "hours": doc.get("hours"),
        "photo_url": doc.get("photo_url"),
        "lat": doc.get("lat"),
        "lng": doc.get("lng"),
        "tier": doc.get("tier", "free"),
        "tier_active": bool(doc.get("tier_active")),
        "tier_expires_at": doc.get("tier_expires_at"),
        "is_adult": doc.get("category") in ADULT_CATEGORIES,
        "license_status": doc.get("license_review_status", "none"),
        "is_featured": doc.get("tier") == "featured" and bool(doc.get("tier_active")),
        "badge_color": (pricing_meta or {}).get("badge_color"),
        "badge_icon": (pricing_meta or {}).get("badge_icon"),
        "tier_label": (pricing_meta or {}).get("label", "Listed"),
        "created_at": doc.get("created_at"),
    }


# ────────────────────── Public/meta ──────────────────────
@router.get("/categories")
async def get_categories() -> Dict[str, Any]:
    """All category metadata for the directory filter UI."""
    return {"categories": CATEGORIES}


@router.get("/pricing")
async def get_pricing() -> Dict[str, Any]:
    """Public pricing table — used by the upgrade page."""
    from services.coin_wallet import usd_to_coins
    return {
        "tiers": [
            {
                "id": tier,
                **meta,
                # Exposed so the frontend never has to know the rate;
                # if we ever change COINS_PER_USD, the FE auto-updates.
                "price_coins": usd_to_coins(meta["price_usd"]),
            } for tier, meta in PRICING.items()
        ]
    }


# ────────────────────── Listings — public read ──────────────────────
@router.get("/listings")
async def list_listings(
    request: Request,
    q: Optional[str] = None,
    category: Optional[str] = None,
    zip_code: Optional[str] = None,
    city: Optional[str] = None,
    show_adult: bool = False,
    limit: int = 50,
) -> Dict[str, Any]:
    """Search the directory. Adult listings are filtered out unless the
    caller is age-verified AND explicitly opts in via `show_adult`."""
    user = await _get_user_from_request(request)
    user_age_verified = bool(user and user.get("age_verified"))

    query: Dict[str, Any] = {"published": True}
    if category and category in CATEGORY_IDS:
        query["category"] = category
    if zip_code:
        query["zip_code"] = zip_code
    if city:
        query["city"] = {"$regex": f"^{city}$", "$options": "i"}
    if q:
        query["$or"] = [
            {"name":        {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]

    # Adult listings filter: only show them if the caller is age-verified
    # AND opts in via show_adult=true. Otherwise exclude them entirely.
    if not (show_adult and user_age_verified):
        if category in ADULT_CATEGORIES:
            return {"listings": [], "total": 0, "adult_blocked": True}
        if "category" not in query:
            query["category"] = {"$nin": list(ADULT_CATEGORIES)}

    cursor = LISTINGS.find(query, {"_id": 0}).sort([
        # Featured pinned to the top, then verified > elite > listed
        ("tier_rank", -1),
        ("created_at", -1),
    ]).limit(min(int(limit), 200))

    rows = [_public_listing(doc) async for doc in cursor]
    return {"listings": rows, "total": len(rows)}


@router.get("/listings/{listing_id}")
async def get_listing(listing_id: str, request: Request) -> Dict[str, Any]:
    doc = await LISTINGS.find_one({"id": listing_id, "published": True}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Listing not found")
    if doc.get("category") in ADULT_CATEGORIES:
        user = await _get_user_from_request(request)
        if not (user and user.get("age_verified")):
            raise HTTPException(403, "Age verification required to view this listing")
    return _public_listing(doc)


# ────────────────────── Listings — owner write ──────────────────────
@router.post("/listings")
async def create_listing(payload: ListingCreate, request: Request) -> Dict[str, Any]:
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Sign in to create a listing")
    if payload.category not in CATEGORY_IDS:
        raise HTTPException(400, f"Invalid category. Must be one of {sorted(CATEGORY_IDS)}")

    is_adult = payload.category in ADULT_CATEGORIES
    if is_adult and not payload.license_doc_url:
        raise HTTPException(400, "Adult / Entertainer listings require a license_doc_url")

    listing_id = f"yp_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    # Adult listings start UNPUBLISHED until admin reviews the license.
    published = not is_adult
    license_status = "pending_review" if is_adult else "none"

    doc = {
        "id": listing_id,
        "owner_user_id": user["user_id"],
        "name": payload.name.strip(),
        "category": payload.category,
        "description": payload.description.strip(),
        "address": payload.address.strip(),
        "city": payload.city.strip(),
        "state": (payload.state or "").strip() or None,
        "zip_code": payload.zip_code.strip(),
        "country": payload.country.strip() or "US",
        "phone": (payload.phone or "").strip() or None,
        "email": (payload.email or "").strip() or None,
        "website": (payload.website or "").strip() or None,
        "hours": (payload.hours or "").strip() or None,
        "photo_url": (payload.photo_url or "").strip() or None,
        "lat": payload.lat,
        "lng": payload.lng,
        "license_doc_url": payload.license_doc_url,
        "license_review_status": license_status,
        "ambassador_ref": payload.ambassador_ref,
        "tier": "free",
        "tier_active": True,
        "tier_rank": 0,
        "tier_expires_at": None,
        "published": published,
        "created_at": now,
        "updated_at": now,
    }
    await LISTINGS.insert_one(doc)
    return {"success": True, "listing": _public_listing(doc),
            "needs_review": is_adult,
            "message": "Submitted for admin review" if is_adult else "Listing published"}


# ────────────────────── Stripe upgrade ──────────────────────
@router.post("/upgrade")
async def upgrade_listing(payload: UpgradeRequest, request: Request) -> Dict[str, Any]:
    """Create a Stripe checkout session to upgrade a listing's tier."""
    if payload.tier not in PRICING:
        raise HTTPException(400, f"Invalid tier. Must be one of {sorted(PRICING.keys())}")
    user = await _get_user_from_request(request)
    if not user:
        raise HTTPException(401, "Sign in to upgrade a listing")

    listing = await LISTINGS.find_one({"id": payload.listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(404, "Listing not found")
    if listing.get("owner_user_id") != user["user_id"]:
        raise HTTPException(403, "Only the listing owner can upgrade this listing")

    tier_meta = PRICING[payload.tier]
    amount = tier_meta["price_usd"]

    # ─── Coin payment branch (instant, no Stripe round-trip) ──────────
    if payload.payment_method == "coins":
        from services.coin_wallet import usd_to_coins, debit_coins, credit_coins
        coins_due = usd_to_coins(amount)
        debit = await debit_coins(
            _db, user["user_id"], coins_due,
            reason="yellow_pages_upgrade",
            metadata={"listing_id": payload.listing_id, "tier": payload.tier},
        )
        if not debit["ok"]:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient Vibez Coins (need ₵{coins_due}, have ₵{debit['balance_after']})",
            )

        # Synthesize a payment row + apply the upgrade immediately.
        pay_doc = {
            "id": f"yp_pay_{uuid.uuid4().hex[:12]}",
            "listing_id": payload.listing_id,
            "tier": payload.tier,
            "amount_usd": amount,
            "coins_paid": coins_due,
            "ambassador_ref": listing.get("ambassador_ref"),
            "ambassador_paid_credits": 0,
            "stripe_session_id": None,
            "payment_method": "coins",
            "status": "paid",
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await PAYMENTS.insert_one(pay_doc)

        # Apply tier + ambassador commission via the existing helper.
        await _apply_paid_upgrade(pay_doc)

        new_balance = debit["balance_after"]
        return {
            "success": True,
            "payment_method": "coins",
            "coins_paid": coins_due,
            "balance_after": new_balance,
            "tier": payload.tier,
            "applied": True,
        }

    # ─── Card payment branch (Stripe checkout) ────────────────────────
    # Lazy-import Stripe so the route still loads if the SDK is missing on a
    # legacy backend image.
    from services.payment_hub import (
        StripeCheckout, CheckoutSessionRequest,
    )
    from config import STRIPE_API_KEY

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/yellow-pages/webhook/stripe"
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    success_url = f"{payload.origin_url.rstrip('/')}/yellow-pages/{payload.listing_id}?upgrade=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{payload.origin_url.rstrip('/')}/yellow-pages/{payload.listing_id}?upgrade=cancelled"

    metadata = {
        "kind": "yellow_pages_upgrade",
        "listing_id": payload.listing_id,
        "tier": payload.tier,
        "owner_user_id": user["user_id"],
        "ambassador_ref": listing.get("ambassador_ref") or "",
    }

    session = await sc.create_checkout_session(CheckoutSessionRequest(
        amount=amount, currency="usd",
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata,
    ))

    await PAYMENTS.insert_one({
        "id": f"yp_pay_{uuid.uuid4().hex[:12]}",
        "listing_id": payload.listing_id,
        "tier": payload.tier,
        "amount_usd": amount,
        "ambassador_ref": listing.get("ambassador_ref"),
        "ambassador_paid_credits": 0,
        "stripe_session_id": session.session_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "checkout_url": session.url, "session_id": session.session_id}


@router.get("/payments/{session_id}/status")
async def check_payment_status(session_id: str, request: Request) -> Dict[str, Any]:
    """Poll Stripe + reconcile listing tier + ambassador commission."""
    from services.payment_hub import StripeCheckout
    from config import STRIPE_API_KEY

    host_url = str(request.base_url).rstrip("/")
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/yellow-pages/webhook/stripe")
    status_resp = await sc.get_checkout_status(session_id)

    pay = await PAYMENTS.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not pay:
        return {"status": status_resp.payment_status, "applied": False, "reason": "unknown_session"}

    if pay["status"] == "paid":
        return {"status": "paid", "applied": True, "already": True}

    if status_resp.payment_status == "paid":
        await _apply_paid_upgrade(pay)
        return {"status": "paid", "applied": True}

    return {"status": status_resp.payment_status, "applied": False}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request) -> Dict[str, Any]:
    from services.payment_hub import StripeCheckout
    from config import STRIPE_API_KEY

    host_url = str(request.base_url).rstrip("/")
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/yellow-pages/webhook/stripe")
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        evt = await sc.handle_webhook(body, sig)
    except Exception as e:
        log.error(f"yellow_pages stripe webhook parse failed: {e}")
        raise HTTPException(400, "invalid webhook")

    if (evt.event_type or "").endswith("checkout.session.completed") and evt.payment_status == "paid":
        pay = await PAYMENTS.find_one({"stripe_session_id": evt.session_id}, {"_id": 0})
        if pay and pay.get("status") != "paid":
            await _apply_paid_upgrade(pay)

    return {"received": True}


# ────────────────────── Apply paid upgrade ──────────────────────
async def _apply_paid_upgrade(pay: Dict[str, Any]) -> None:
    """Mark payment paid, bump listing tier, credit ambassador (one-time only)."""
    listing_id = pay["listing_id"]
    tier = pay["tier"]
    tier_meta = PRICING[tier]
    now = datetime.now(timezone.utc)

    expires_at = None
    if tier_meta["kind"] == "monthly":
        expires_at = (now + timedelta(days=30)).isoformat()

    tier_rank = {"verified": 2, "elite": 3, "featured": 4}.get(tier, 1)

    await LISTINGS.update_one(
        {"id": listing_id},
        {"$set": {
            "tier": tier,
            "tier_active": True,
            "tier_rank": tier_rank,
            "tier_expires_at": expires_at,
            "updated_at": now.isoformat(),
        }}
    )

    # Ambassador commission — one-time only.
    ambassador_credits = 0
    ambassador_ref = pay.get("ambassador_ref")
    if ambassador_ref:
        # Featured: only first month. Subsequent renewals do NOT pay the
        # ambassador. We detect renewal by checking if any prior paid
        # featured payment for this listing already exists.
        prior_featured_paid = 0
        if tier == "featured":
            prior_featured_paid = await PAYMENTS.count_documents({
                "listing_id": listing_id,
                "tier": "featured",
                "status": "paid",
                "id": {"$ne": pay["id"]},
            })

        if prior_featured_paid == 0:
            cents = int(round(tier_meta["ambassador_cut_usd"] * 100))
            ambassador_credits = cents  # 1 credit ≈ 1 cent USD pre-TGE
            await USERS.update_one(
                {"$or": [
                    {"referral_code": ambassador_ref},
                    {"user_id": ambassador_ref},
                ]},
                {"$inc": {"credits_balance": ambassador_credits,
                          "yellow_pages_commission_cents": cents}}
            )

    await PAYMENTS.update_one(
        {"id": pay["id"]},
        {"$set": {
            "status": "paid",
            "paid_at": now.isoformat(),
            "ambassador_paid_credits": ambassador_credits,
        }}
    )


# ────────────────────── Admin (Elite + Adult license review) ──────────────────────
@router.get("/admin/review-queue")
async def admin_review_queue(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    user = await _resolve_user(authorization)
    if not user or not _is_admin(user):
        raise HTTPException(403, "Admin only")
    rows = await LISTINGS.find(
        {"license_review_status": "pending_review"}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=200)
    return {"queue": [_public_listing(r) | {"license_doc_url": r.get("license_doc_url")} for r in rows]}


@router.post("/admin/review")
async def admin_review(
    payload: AdminReviewRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    user = await _resolve_user(authorization)
    if not user or not _is_admin(user):
        raise HTTPException(403, "Admin only")
    if payload.decision not in ("approve", "reject"):
        raise HTTPException(400, "decision must be approve|reject")

    new_status = "approved" if payload.decision == "approve" else "rejected"
    publish = payload.decision == "approve"
    await LISTINGS.update_one(
        {"id": payload.listing_id},
        {"$set": {
            "license_review_status": new_status,
            "license_review_note": payload.note,
            "published": publish,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"success": True, "decision": payload.decision, "listing_id": payload.listing_id}


def _is_admin(user: Dict[str, Any]) -> bool:
    admin_emails = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}
    return (user.get("email") or "").lower() in admin_emails
