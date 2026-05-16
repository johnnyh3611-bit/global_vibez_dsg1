"""Merchant Genius Phase onboarding (DSG Merchant Acquisition Strategy).

Implements `dsg_merchant_strategy.pdf` (2026-05-16) in full:

  • Single-entry flat **$100–$150 activation fee** — no subscription.
  • One **$20 Genius Phase Chair** baked into the fee (founder's stake).
  • Hard-cap **50,000 chairs** total across the Genius Phase.
  • **100-chair ceiling** per individual merchant.
  • **3-mile Hyper-Local Push Blast radius**.
  • Native **Vibe Shield** flag + **DSG TV** automated media placement.
  • Add-on services billed via Stripe Checkout:
        - DSG TV ad-flights ($X per flight, configurable)
        - Hyper-Local Push Blasts ($Y per blast, configurable)
        - Additional Genius Phase Chair acquisition ($20/chair)

Compatible with existing economics:
  • $20 chair price = our existing buy-back floor in equity_master.py
  • 50K Genius Phase chairs sit INSIDE the 1M total chair pool
  • No subscription = no conflict with creator 70% / cinema 80% splits

Endpoints under `/api/merchant`:
  GET   /genius-phase                — live cap + price + remaining + add-on pricing
  POST  /onboard                     — internal: marks onboarded after fee paid
  POST  /onboard/checkout            — create Stripe Checkout for activation fee
  POST  /onboard/verify              — verify session → mint merchant + 1 chair
  POST  /acquire-chair/checkout      — Stripe Checkout for +N chairs
  POST  /acquire-chair/verify        — verify session → grant chairs
  POST  /addon/dsg-tv/checkout       — Stripe Checkout for DSG TV ad-flight
  POST  /addon/push-blast/checkout   — Stripe Checkout for Hyper-Local Push Blast
  POST  /addon/verify                — verify add-on session → grant credit
  POST  /push-blast/send             — consume a push-blast credit + record send
  GET   /me/{merchant_id}            — merchant profile + chair count + radius
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/merchant", tags=["merchant"])


def _db():
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


# ────────────────────────────────────────────── Constants (PDF source) ──
ACTIVATION_FEE_MIN = 100         # USD — low end of the founder's $100-$150 band
ACTIVATION_FEE_MAX = 150         # USD — high end (used for premium SKUs later)
GENIUS_CHAIR_PRICE = 20          # USD per chair (matches $20 buy-back floor)
GENIUS_CHAIR_CAP = 50_000        # Genius Phase total slot count
INDIVIDUAL_CHAIR_CEILING = 100   # Max chairs any single merchant can hold
PUSH_BLAST_RADIUS_MILES = 3      # Hyper-Local Target Push Blast radius

# Add-on pricing — keep modest defaults so a real merchant can run a
# campaign without thinking. Override via env if marketing decides.
DSG_TV_FLIGHT_PRICE_USD = float(os.environ.get("MERCHANT_DSG_TV_FLIGHT_USD", 49.0))
PUSH_BLAST_PRICE_USD = float(os.environ.get("MERCHANT_PUSH_BLAST_USD", 19.0))

# Service branding from the PDF — kept as a constant so the frontend and
# the tour narration read from the same source of truth.
MERCHANT_SERVICES = [
    {"id": "hunger_vibez", "label": "Hunger Vibez", "desc": "Food, grocery, QSR delivery + ordering"},
    {"id": "vibez_spots",  "label": "Vibez Spots",  "desc": "Hourly venue + private space booking"},
    {"id": "viberidez",    "label": "VibeRidez",    "desc": "On-demand mobility network"},
]


# Lazy Stripe import — emergentintegrations is installed but if the env
# is misconfigured we still want the rest of the routes to load.
try:  # pragma: no cover — runtime side-effect
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout,
        CheckoutSessionRequest,
    )
    _STRIPE_AVAILABLE = True
except ImportError:  # pragma: no cover
    _STRIPE_AVAILABLE = False

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")


def _stripe_ok() -> bool:
    return _STRIPE_AVAILABLE and bool(STRIPE_API_KEY)


def _frontend_url() -> str:
    return os.environ.get(
        "FRONTEND_URL",
        os.environ.get("REACT_APP_BACKEND_URL", ""),
    )


# ────────────────────────────────────────────── Models ──
class OnboardRequest(BaseModel):
    merchant_id: str = Field(min_length=3, max_length=80)
    business_name: str = Field(min_length=2, max_length=160)
    service: str = Field(description="One of MERCHANT_SERVICES.id")
    activation_fee_paid: int = Field(ge=ACTIVATION_FEE_MIN, le=ACTIVATION_FEE_MAX)
    lat: Optional[float] = None
    lng: Optional[float] = None


class CheckoutOnboardRequest(BaseModel):
    merchant_id: str = Field(min_length=3, max_length=80)
    business_name: str = Field(min_length=2, max_length=160)
    service: str
    activation_fee_usd: int = Field(ge=ACTIVATION_FEE_MIN, le=ACTIVATION_FEE_MAX)
    lat: Optional[float] = None
    lng: Optional[float] = None


class VerifySessionRequest(BaseModel):
    session_id: str
    merchant_id: str


class AcquireChairRequest(BaseModel):
    merchant_id: str
    chairs: int = Field(ge=1, le=INDIVIDUAL_CHAIR_CEILING)


class AcquireChairCheckoutRequest(BaseModel):
    merchant_id: str
    chairs: int = Field(ge=1, le=INDIVIDUAL_CHAIR_CEILING)


class AddonCheckoutRequest(BaseModel):
    merchant_id: str
    quantity: int = Field(ge=1, le=100, default=1)


class PushBlastSendRequest(BaseModel):
    merchant_id: str
    headline: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=2, max_length=300)
    deep_link: Optional[str] = None


# ────────────────────────────────────────────── Status / Read endpoints ──
@router.get("/genius-phase")
async def genius_phase_status() -> Dict[str, Any]:
    """Live Genius Phase counter — chairs claimed, remaining, cap, price."""
    claimed = 0
    try:
        agg = _db().merchant_genius_phase.aggregate([
            {"$group": {"_id": None, "n": {"$sum": "$chairs_held"}}},
        ])
        async for row in agg:
            claimed = int(row.get("n") or 0)
    except Exception as e:
        logger.warning("genius-phase aggregation failed: %s", e)

    remaining = max(0, GENIUS_CHAIR_CAP - claimed)
    pct = round(claimed / GENIUS_CHAIR_CAP * 100, 2) if GENIUS_CHAIR_CAP else 0.0
    return {
        "phase": "GENIUS",
        "cap": GENIUS_CHAIR_CAP,
        "claimed": claimed,
        "remaining": remaining,
        "claimed_pct": pct,
        "chair_price_usd": GENIUS_CHAIR_PRICE,
        "activation_fee_usd": {"min": ACTIVATION_FEE_MIN, "max": ACTIVATION_FEE_MAX},
        "individual_ceiling": INDIVIDUAL_CHAIR_CEILING,
        "push_radius_miles": PUSH_BLAST_RADIUS_MILES,
        "services": MERCHANT_SERVICES,
        "addons": {
            "dsg_tv_flight_usd": DSG_TV_FLIGHT_PRICE_USD,
            "push_blast_usd": PUSH_BLAST_PRICE_USD,
        },
        "stripe_configured": _stripe_ok(),
    }


@router.get("/me/{merchant_id}")
async def get_merchant(merchant_id: str) -> Dict[str, Any]:
    """Merchant profile — chair count + 3-mile push radius + benefits + credits."""
    merchant = await _db().merchant_genius_phase.find_one(
        {"merchant_id": merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(404, "merchant_not_found")
    # Hydrate credit balances from the credits collection so the
    # dashboard can show "you own N ad flights, M push blasts".
    credits = await _db().merchant_addon_credits.find_one(
        {"merchant_id": merchant_id}, {"_id": 0}
    ) or {}
    merchant["credits"] = {
        "dsg_tv_flights": int(credits.get("dsg_tv_flights", 0)),
        "push_blasts": int(credits.get("push_blasts", 0)),
    }
    return merchant


# ────────────────────────────────────────────── Direct onboard (internal/test) ──
@router.post("/onboard")
async def onboard_merchant(req: OnboardRequest) -> Dict[str, Any]:
    """Direct onboard — used by tests and admin tooling.

    The real customer path goes through `/onboard/checkout` → Stripe →
    `/onboard/verify`. Idempotent per merchant_id.
    """
    if req.service not in {s["id"] for s in MERCHANT_SERVICES}:
        raise HTTPException(400, f"Unknown service '{req.service}'")

    existing = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if existing:
        return {**existing, "already_onboarded": True}

    status = await genius_phase_status()
    if status["remaining"] < 1:
        raise HTTPException(409, detail="Genius Phase cap reached")

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "merchant_id": req.merchant_id,
        "business_name": req.business_name,
        "service": req.service,
        "activation_fee_paid": req.activation_fee_paid,
        "chairs_held": 1,
        "lat": req.lat,
        "lng": req.lng,
        "push_radius_miles": PUSH_BLAST_RADIUS_MILES,
        "vibe_shield_enabled": True,
        "dsg_tv_placement": True,
        "onboarded_at": now_iso,
    }
    await _db().merchant_genius_phase.insert_one(doc.copy())
    doc.pop("_id", None)
    return {**doc, "already_onboarded": False}


@router.post("/acquire-chair")
async def acquire_chair(req: AcquireChairRequest) -> Dict[str, Any]:
    """Direct chair acquisition — used by tests and admin tooling.

    The real customer path goes through `/acquire-chair/checkout` →
    Stripe → `/acquire-chair/verify`."""
    merchant = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(404, "Merchant not onboarded yet")

    new_total = int(merchant.get("chairs_held", 1)) + req.chairs
    if new_total > INDIVIDUAL_CHAIR_CEILING:
        raise HTTPException(
            400,
            detail=f"Would exceed individual ceiling of {INDIVIDUAL_CHAIR_CEILING}",
        )

    status = await genius_phase_status()
    if status["remaining"] < req.chairs:
        raise HTTPException(409, detail="Insufficient Genius Phase chairs left")

    await _db().merchant_genius_phase.update_one(
        {"merchant_id": req.merchant_id},
        {"$inc": {"chairs_held": req.chairs}},
    )
    return {
        "merchant_id": req.merchant_id,
        "chairs_acquired": req.chairs,
        "chairs_held": new_total,
        "usd_paid": req.chairs * GENIUS_CHAIR_PRICE,
    }


# ────────────────────────────────────────────── Stripe — Onboard ──
async def _create_session(
    *, amount: float, metadata: Dict[str, str], path_back: str
) -> Dict[str, Any]:
    """Shared helper to create a Stripe Checkout session."""
    if not _stripe_ok():
        raise HTTPException(503, "Stripe not configured (missing STRIPE_API_KEY)")

    frontend = _frontend_url()
    if not frontend:
        raise HTTPException(500, "FRONTEND_URL not configured for Stripe redirect")

    success_url = (
        f"{frontend}{path_back}?merchant_session={{CHECKOUT_SESSION_ID}}&kind="
        f"{metadata.get('kind', 'merchant')}"
    )
    cancel_url = f"{frontend}{path_back}?merchant_cancelled=1"

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
    session_request = CheckoutSessionRequest(
        amount=float(amount),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(session_request)
    # Record the pending session so /verify can cross-check it.
    await _db().merchant_stripe_sessions.insert_one({
        "session_id": session.session_id,
        "merchant_id": metadata.get("merchant_id"),
        "kind": metadata.get("kind"),
        "amount_usd": float(amount),
        "metadata": metadata,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"checkout_url": session.url, "session_id": session.session_id, "amount_usd": amount}


@router.post("/onboard/checkout")
async def onboard_checkout(req: CheckoutOnboardRequest) -> Dict[str, Any]:
    """Create a Stripe Checkout session for the flat activation fee."""
    if req.service not in {s["id"] for s in MERCHANT_SERVICES}:
        raise HTTPException(400, f"Unknown service '{req.service}'")

    existing = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if existing:
        raise HTTPException(409, "Merchant already onboarded")

    status_doc = await genius_phase_status()
    if status_doc["remaining"] < 1:
        raise HTTPException(409, "Genius Phase cap reached")

    metadata = {
        "kind": "merchant_activation",
        "merchant_id": req.merchant_id,
        "business_name": req.business_name,
        "service": req.service,
        "amount": str(req.activation_fee_usd),
        "lat": str(req.lat) if req.lat is not None else "",
        "lng": str(req.lng) if req.lng is not None else "",
    }
    return await _create_session(
        amount=float(req.activation_fee_usd),
        metadata=metadata,
        path_back="/merchant/dashboard",
    )


async def _verify_and_get_session(session_id: str, expected_kind: str) -> Dict[str, Any]:
    """Pull Stripe status, ensure it's complete and matches our kind."""
    if not _stripe_ok():
        raise HTTPException(503, "Stripe not configured")

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Invalid or expired session: {exc}")
    if status.status != "complete":
        raise HTTPException(400, "Payment not completed")

    meta = status.metadata or {}
    if meta.get("kind") != expected_kind:
        raise HTTPException(400, f"Wrong session kind (got {meta.get('kind')})")
    return {"status": status, "metadata": meta}


@router.post("/onboard/verify")
async def onboard_verify(req: VerifySessionRequest) -> Dict[str, Any]:
    """Verify Stripe session → mint the merchant + 1 baked-in chair."""
    res = await _verify_and_get_session(req.session_id, "merchant_activation")
    meta = res["metadata"]
    if meta.get("merchant_id") != req.merchant_id:
        raise HTTPException(403, "Session belongs to another merchant")

    # Idempotency — replays return the existing record.
    existing = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if existing:
        return {**existing, "already_onboarded": True}

    status_doc = await genius_phase_status()
    if status_doc["remaining"] < 1:
        raise HTTPException(409, "Genius Phase cap reached")

    now_iso = datetime.now(timezone.utc).isoformat()
    lat = float(meta["lat"]) if meta.get("lat") else None
    lng = float(meta["lng"]) if meta.get("lng") else None
    doc = {
        "id": str(uuid.uuid4()),
        "merchant_id": req.merchant_id,
        "business_name": meta.get("business_name", ""),
        "service": meta.get("service", ""),
        "activation_fee_paid": int(meta.get("amount", ACTIVATION_FEE_MIN)),
        "chairs_held": 1,
        "lat": lat,
        "lng": lng,
        "push_radius_miles": PUSH_BLAST_RADIUS_MILES,
        "vibe_shield_enabled": True,
        "dsg_tv_placement": True,
        "stripe_session_id": req.session_id,
        "onboarded_at": now_iso,
    }
    await _db().merchant_genius_phase.insert_one(doc.copy())
    await _db().merchant_stripe_sessions.update_one(
        {"session_id": req.session_id},
        {"$set": {"status": "complete", "verified_at": now_iso}},
    )
    doc.pop("_id", None)
    return {**doc, "already_onboarded": False}


# ────────────────────────────────────────────── Stripe — Acquire Chair ──
@router.post("/acquire-chair/checkout")
async def acquire_chair_checkout(req: AcquireChairCheckoutRequest) -> Dict[str, Any]:
    """Create Stripe Checkout to buy +N Genius Phase chairs ($20 each)."""
    merchant = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(404, "Merchant not onboarded yet")

    new_total = int(merchant.get("chairs_held", 1)) + req.chairs
    if new_total > INDIVIDUAL_CHAIR_CEILING:
        raise HTTPException(400, f"Would exceed individual ceiling of {INDIVIDUAL_CHAIR_CEILING}")

    status_doc = await genius_phase_status()
    if status_doc["remaining"] < req.chairs:
        raise HTTPException(409, "Insufficient Genius Phase chairs left")

    amount = float(req.chairs * GENIUS_CHAIR_PRICE)
    metadata = {
        "kind": "merchant_chair",
        "merchant_id": req.merchant_id,
        "chairs": str(req.chairs),
        "amount": str(amount),
    }
    return await _create_session(amount=amount, metadata=metadata, path_back="/merchant/dashboard")


@router.post("/acquire-chair/verify")
async def acquire_chair_verify(req: VerifySessionRequest) -> Dict[str, Any]:
    """Verify Stripe session → grant chairs to the merchant."""
    res = await _verify_and_get_session(req.session_id, "merchant_chair")
    meta = res["metadata"]
    if meta.get("merchant_id") != req.merchant_id:
        raise HTTPException(403, "Session belongs to another merchant")

    chairs = int(meta.get("chairs", 0) or 0)
    if chairs < 1:
        raise HTTPException(400, "No chairs in session metadata")

    # Idempotency — once a session has been processed we don't double-grant.
    sess = await _db().merchant_stripe_sessions.find_one(
        {"session_id": req.session_id}, {"_id": 0}
    )
    if sess and sess.get("status") == "complete":
        merchant = await _db().merchant_genius_phase.find_one(
            {"merchant_id": req.merchant_id}, {"_id": 0}
        )
        return {
            "merchant_id": req.merchant_id,
            "chairs_acquired": chairs,
            "chairs_held": int((merchant or {}).get("chairs_held", 0)),
            "already_granted": True,
        }

    merchant = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(404, "Merchant not onboarded yet")

    new_total = int(merchant.get("chairs_held", 1)) + chairs
    if new_total > INDIVIDUAL_CHAIR_CEILING:
        raise HTTPException(400, "Would exceed individual ceiling")

    await _db().merchant_genius_phase.update_one(
        {"merchant_id": req.merchant_id},
        {"$inc": {"chairs_held": chairs}},
    )
    await _db().merchant_stripe_sessions.update_one(
        {"session_id": req.session_id},
        {"$set": {"status": "complete", "verified_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {
        "merchant_id": req.merchant_id,
        "chairs_acquired": chairs,
        "chairs_held": new_total,
        "usd_paid": chairs * GENIUS_CHAIR_PRICE,
        "already_granted": False,
    }


# ────────────────────────────────────────────── Stripe — Add-ons ──
@router.post("/addon/dsg-tv/checkout")
async def addon_dsg_tv_checkout(req: AddonCheckoutRequest) -> Dict[str, Any]:
    """Buy N DSG TV ad-flight credits."""
    merchant = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(404, "Merchant not onboarded yet")

    amount = float(req.quantity * DSG_TV_FLIGHT_PRICE_USD)
    metadata = {
        "kind": "merchant_addon_dsg_tv",
        "merchant_id": req.merchant_id,
        "quantity": str(req.quantity),
        "amount": str(amount),
    }
    return await _create_session(amount=amount, metadata=metadata, path_back="/merchant/dashboard")


@router.post("/addon/push-blast/checkout")
async def addon_push_blast_checkout(req: AddonCheckoutRequest) -> Dict[str, Any]:
    """Buy N Hyper-Local Push Blast credits (3-mile radius each)."""
    merchant = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(404, "Merchant not onboarded yet")

    amount = float(req.quantity * PUSH_BLAST_PRICE_USD)
    metadata = {
        "kind": "merchant_addon_push_blast",
        "merchant_id": req.merchant_id,
        "quantity": str(req.quantity),
        "amount": str(amount),
    }
    return await _create_session(amount=amount, metadata=metadata, path_back="/merchant/dashboard")


@router.post("/addon/verify")
async def addon_verify(req: VerifySessionRequest) -> Dict[str, Any]:
    """Verify a DSG TV or Push Blast purchase → credit the merchant."""
    if not _stripe_ok():
        raise HTTPException(503, "Stripe not configured")
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)
    try:
        status = await stripe_checkout.get_checkout_status(req.session_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Invalid session: {exc}")
    if status.status != "complete":
        raise HTTPException(400, "Payment not completed")
    meta = status.metadata or {}
    kind = meta.get("kind", "")
    if kind not in {"merchant_addon_dsg_tv", "merchant_addon_push_blast"}:
        raise HTTPException(400, f"Wrong session kind ({kind})")
    if meta.get("merchant_id") != req.merchant_id:
        raise HTTPException(403, "Session belongs to another merchant")

    quantity = int(meta.get("quantity", 1) or 1)

    # Idempotency
    sess = await _db().merchant_stripe_sessions.find_one(
        {"session_id": req.session_id}, {"_id": 0}
    )
    if sess and sess.get("status") == "complete":
        credits = await _db().merchant_addon_credits.find_one(
            {"merchant_id": req.merchant_id}, {"_id": 0}
        ) or {}
        return {
            "merchant_id": req.merchant_id,
            "kind": kind,
            "quantity": quantity,
            "already_granted": True,
            "credits": {
                "dsg_tv_flights": int(credits.get("dsg_tv_flights", 0)),
                "push_blasts": int(credits.get("push_blasts", 0)),
            },
        }

    field = "dsg_tv_flights" if kind == "merchant_addon_dsg_tv" else "push_blasts"
    await _db().merchant_addon_credits.update_one(
        {"merchant_id": req.merchant_id},
        {"$inc": {field: quantity}, "$setOnInsert": {"merchant_id": req.merchant_id}},
        upsert=True,
    )
    await _db().merchant_stripe_sessions.update_one(
        {"session_id": req.session_id},
        {"$set": {"status": "complete", "verified_at": datetime.now(timezone.utc).isoformat()}},
    )
    credits = await _db().merchant_addon_credits.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    ) or {}
    return {
        "merchant_id": req.merchant_id,
        "kind": kind,
        "quantity": quantity,
        "already_granted": False,
        "credits": {
            "dsg_tv_flights": int(credits.get("dsg_tv_flights", 0)),
            "push_blasts": int(credits.get("push_blasts", 0)),
        },
    }


# ────────────────────────────────────────────── Push Blast send ──
@router.post("/push-blast/send")
async def push_blast_send(req: PushBlastSendRequest) -> Dict[str, Any]:
    """Consume one push-blast credit, record the send (3-mile radius)."""
    merchant = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(404, "Merchant not onboarded yet")

    # Atomic decrement so we can't double-spend a credit under concurrency.
    result = await _db().merchant_addon_credits.find_one_and_update(
        {"merchant_id": req.merchant_id, "push_blasts": {"$gte": 1}},
        {"$inc": {"push_blasts": -1}},
        projection={"_id": 0},
        return_document=False,  # return doc before update — fine, we just need a non-None
    )
    if result is None:
        raise HTTPException(402, "No push-blast credits remaining — purchase an add-on")

    blast = {
        "id": str(uuid.uuid4()),
        "merchant_id": req.merchant_id,
        "business_name": merchant.get("business_name", ""),
        "headline": req.headline,
        "body": req.body,
        "deep_link": req.deep_link,
        "lat": merchant.get("lat"),
        "lng": merchant.get("lng"),
        "radius_miles": PUSH_BLAST_RADIUS_MILES,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db().merchant_push_blasts.insert_one(blast.copy())
    blast.pop("_id", None)
    credits = await _db().merchant_addon_credits.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    ) or {}
    return {
        "sent": True,
        "blast": blast,
        "remaining_credits": int(credits.get("push_blasts", 0)),
    }


@router.get("/push-blast/recent/{merchant_id}")
async def push_blast_recent(merchant_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Recent blasts sent by a merchant — for the dashboard timeline."""
    limit = max(1, min(50, int(limit)))
    cursor = _db().merchant_push_blasts.find(
        {"merchant_id": merchant_id}, {"_id": 0}
    ).sort("sent_at", -1).limit(limit)
    return [doc async for doc in cursor]
