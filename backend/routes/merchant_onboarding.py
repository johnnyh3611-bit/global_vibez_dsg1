"""Merchant Genius Phase onboarding (DSG Merchant Acquisition Strategy).

Implements `dsg_merchant_strategy.pdf` (2026-05-16) end-to-end:

  • Flat **$100–$150 activation fee** — no subscription.
  • One **$20 Genius Phase Chair** baked into the fee (founder's stake).
  • Hard-cap **50,000 chairs** total across the Genius Phase.
  • **100-chair ceiling** per individual merchant.
  • **3-mile Hyper-Local Push Blast radius** (FCM fan-out wired).
  • Native **Vibe Shield** flag + **DSG TV** automated media placement
    (real insertion into the `/api/vibe-tv/ads` queue when a flight is
    consumed).
  • Stripe Checkout via `emergentintegrations` SDK.
  • **Auth-gated writes** — every POST is bound to the signed-in user
    via `get_current_user`. Reads (`/genius-phase`, `/me/{id}`) remain
    public so the landing page can render without a session.
"""
from __future__ import annotations

import logging
import math
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/merchant", tags=["merchant"])


def _db():
    """Fresh motor client per call — avoids stale-loop binding across
    TestClient instances. The connection-pool cost is negligible for
    this module's throughput; production routes that need a singleton
    can switch to `config.get_database()`."""
    return AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


# ────────────────────────────────────────────── Constants (PDF source) ──
ACTIVATION_FEE_MIN = 100
ACTIVATION_FEE_MAX = 150
GENIUS_CHAIR_PRICE = 20
GENIUS_CHAIR_CAP = 50_000
INDIVIDUAL_CHAIR_CEILING = 100
PUSH_BLAST_RADIUS_MILES = 3
DSG_TV_FLIGHT_PRICE_USD = float(os.environ.get("MERCHANT_DSG_TV_FLIGHT_USD", 49.0))
PUSH_BLAST_PRICE_USD = float(os.environ.get("MERCHANT_PUSH_BLAST_USD", 19.0))

# Referral program — turn every onboarded merchant into a sales agent.
# Every Nth successful referral grants the referrer 1 free Genius Phase
# chair (worth $20).
REFERRAL_REWARD_THRESHOLD = int(os.environ.get("MERCHANT_REFERRAL_REWARD_EVERY", 5))

MERCHANT_SERVICES = [
    {"id": "hunger_vibez", "label": "Hunger Vibez", "desc": "Food, grocery, QSR delivery + ordering"},
    {"id": "vibez_spots",  "label": "Vibez Spots",  "desc": "Hourly venue + private space booking"},
    {"id": "viberidez",    "label": "VibeRidez",    "desc": "On-demand mobility network"},
]


# ────────────────────────────────────────────── Stripe + integrations ──
try:  # pragma: no cover
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


# ────────────────────────────────────────────── Auth helpers ──
async def _require_user(request: Request):
    """Reject if no valid session — used on every write endpoint.

    Re-implemented locally (instead of using `utils.database.get_current_user`)
    so we read the session via a **fresh motor client per call**. The
    shared singleton in `config.database` caches its event loop and
    breaks once another test/route on a different loop has used it —
    the merchant module owns its connection lifecycle to stay
    independent of that global state.
    """
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization") or ""
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "", 1)
    if not token:
        raise HTTPException(401, "Not authenticated")

    db = _db()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(401, "Not authenticated")
    user = await db.users.find_one(
        {"user_id": session["user_id"]}, {"_id": 0}
    )
    if not user:
        raise HTTPException(401, "Not authenticated")
    # Return a lightweight object mirroring the User model surface we use.
    class _U:  # noqa: D401, N801 — tiny adapter, intentionally minimal
        pass
    u = _U()
    u.user_id = user["user_id"]
    u.email = user.get("email", "")
    return u


async def _assert_owner(merchant_id: str, user_id: str) -> Dict[str, Any]:
    """Look up a merchant and 403 if the caller isn't the owner."""
    m = await _db().merchant_genius_phase.find_one(
        {"merchant_id": merchant_id}, {"_id": 0}
    )
    if not m:
        raise HTTPException(404, "merchant_not_found")
    if m.get("owner_user_id") and m["owner_user_id"] != user_id:
        raise HTTPException(403, "Not the owner of this merchant")
    return m


# ────────────────────────────────────────────── Referral helpers ──
async def _attribute_referral(referrer_id: str, new_merchant_id: str) -> Dict[str, Any]:
    """Attribute a successful referral and grant rewards on every Nth.

    Returns the updated counters + reward state for the dashboard toast.
    No-op (returns empty dict) if the referrer doesn't exist or refers
    to itself — we never error here, the new merchant's onboarding must
    not fail because of a bad referral tag.
    """
    if not referrer_id or referrer_id == new_merchant_id:
        return {}
    referrer = await _db().merchant_genius_phase.find_one(
        {"merchant_id": referrer_id}, {"_id": 0}
    )
    if not referrer:
        return {}

    # Idempotency: don't double-credit if this referral was already logged.
    existing = await _db().merchant_referrals.find_one(
        {"new_merchant_id": new_merchant_id}, {"_id": 0}
    )
    if existing:
        return {}

    await _db().merchant_referrals.insert_one({
        "id": str(uuid.uuid4()),
        "referrer_id": referrer_id,
        "new_merchant_id": new_merchant_id,
        "credited_at": datetime.now(timezone.utc).isoformat(),
    })
    updated = await _db().merchant_genius_phase.find_one_and_update(
        {"merchant_id": referrer_id},
        {"$inc": {"referrals_completed": 1}},
        projection={"_id": 0, "referrals_completed": 1, "chairs_held": 1,
                    "referral_rewards_granted": 1, "merchant_id": 1},
        return_document=True,
    )
    if not updated:
        return {}
    new_total = int(updated.get("referrals_completed", 0) or 0)
    prior_rewards = int(updated.get("referral_rewards_granted", 0) or 0)
    earned = new_total // REFERRAL_REWARD_THRESHOLD
    new_rewards = max(0, earned - prior_rewards)

    # Grant free chairs — capped by the individual ceiling AND the
    # global Genius Phase remaining pool.
    granted = 0
    if new_rewards > 0:
        current_chairs = int(updated.get("chairs_held", 0) or 0)
        per_user_capacity = max(0, INDIVIDUAL_CHAIR_CEILING - current_chairs)
        status_doc = await genius_phase_status()
        global_capacity = int(status_doc.get("remaining", 0) or 0)
        granted = min(new_rewards, per_user_capacity, global_capacity)
        if granted > 0:
            await _db().merchant_genius_phase.update_one(
                {"merchant_id": referrer_id},
                {"$inc": {
                    "chairs_held": granted,
                    "referral_rewards_granted": granted,
                }},
            )
    return {
        "referrer_id": referrer_id,
        "referrals_completed": new_total,
        "chairs_granted_now": granted,
        "next_reward_at": ((new_total // REFERRAL_REWARD_THRESHOLD) + 1)
            * REFERRAL_REWARD_THRESHOLD,
    }


# ────────────────────────────────────────────── Geo helpers ──
def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in miles."""
    R = 3958.7613
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ────────────────────────────────────────────── Models ──
class OnboardRequest(BaseModel):
    merchant_id: str = Field(min_length=3, max_length=80)
    business_name: str = Field(min_length=2, max_length=160)
    service: str
    activation_fee_paid: int = Field(ge=ACTIVATION_FEE_MIN, le=ACTIVATION_FEE_MAX)
    lat: Optional[float] = None
    lng: Optional[float] = None
    referred_by: Optional[str] = Field(default=None, max_length=80)


class CheckoutOnboardRequest(BaseModel):
    merchant_id: str = Field(min_length=3, max_length=80)
    business_name: str = Field(min_length=2, max_length=160)
    service: str
    activation_fee_usd: int = Field(ge=ACTIVATION_FEE_MIN, le=ACTIVATION_FEE_MAX)
    lat: Optional[float] = None
    lng: Optional[float] = None
    referred_by: Optional[str] = Field(default=None, max_length=80)


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


class PublishAdFlightRequest(BaseModel):
    merchant_id: str
    title: str = Field(min_length=2, max_length=200)
    target_zip_codes: List[str] = Field(default_factory=list)
    duration_seconds: int = Field(default=15, ge=5, le=60)


# ────────────────────────────────────────────── Read endpoints (public) ──
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
    """Merchant profile — public so partners can verify Chair holding."""
    merchant = await _db().merchant_genius_phase.find_one(
        {"merchant_id": merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(404, "merchant_not_found")
    credits = await _db().merchant_addon_credits.find_one(
        {"merchant_id": merchant_id}, {"_id": 0}
    ) or {}
    merchant["credits"] = {
        "dsg_tv_flights": int(credits.get("dsg_tv_flights", 0)),
        "push_blasts": int(credits.get("push_blasts", 0)),
    }
    return merchant


@router.get("/push-blast/recent/{merchant_id}")
async def push_blast_recent(merchant_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Recent blasts sent by a merchant — for the dashboard timeline."""
    limit = max(1, min(50, int(limit)))
    cursor = _db().merchant_push_blasts.find(
        {"merchant_id": merchant_id}, {"_id": 0}
    ).sort("sent_at", -1).limit(limit)
    return [doc async for doc in cursor]


# ────────────────────────────────────────────── Direct onboard (auth) ──
@router.post("/onboard")
async def onboard_merchant(req: OnboardRequest, request: Request) -> Dict[str, Any]:
    """Direct onboard — binds owner_user_id to the signed-in user.

    The real customer path goes through `/onboard/checkout` → Stripe →
    `/onboard/verify`. Idempotent per merchant_id."""
    user = await _require_user(request)
    if req.service not in {s["id"] for s in MERCHANT_SERVICES}:
        raise HTTPException(400, f"Unknown service '{req.service}'")

    existing = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if existing:
        if existing.get("owner_user_id") and existing["owner_user_id"] != user.user_id:
            raise HTTPException(409, "merchant_id already claimed by another user")
        return {**existing, "already_onboarded": True}

    status = await genius_phase_status()
    if status["remaining"] < 1:
        raise HTTPException(409, detail="Genius Phase cap reached")

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "merchant_id": req.merchant_id,
        "owner_user_id": user.user_id,
        "business_name": req.business_name,
        "service": req.service,
        "activation_fee_paid": req.activation_fee_paid,
        "chairs_held": 1,
        "lat": req.lat,
        "lng": req.lng,
        "push_radius_miles": PUSH_BLAST_RADIUS_MILES,
        "vibe_shield_enabled": True,
        "dsg_tv_placement": True,
        "referred_by": req.referred_by,
        "referrals_completed": 0,
        "referral_rewards_granted": 0,
        "onboarded_at": now_iso,
    }
    await _db().merchant_genius_phase.insert_one(doc.copy())
    if req.referred_by:
        await _attribute_referral(req.referred_by, req.merchant_id)
    doc.pop("_id", None)
    return {**doc, "already_onboarded": False}


@router.post("/acquire-chair")
async def acquire_chair(req: AcquireChairRequest, request: Request) -> Dict[str, Any]:
    """Direct chair acquisition — owner-only."""
    user = await _require_user(request)
    merchant = await _assert_owner(req.merchant_id, user.user_id)

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


# ────────────────────────────────────────────── Stripe — shared helpers ──
async def _create_session(
    *, amount: float, metadata: Dict[str, str], path_back: str
) -> Dict[str, Any]:
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
        amount=float(amount), currency="usd",
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(session_request)
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


async def _verify_session(session_id: str, expected_kind: str) -> Dict[str, Any]:
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


# ────────────────────────────────────────────── Stripe — Onboard ──
@router.post("/onboard/checkout")
async def onboard_checkout(
    req: CheckoutOnboardRequest, request: Request
) -> Dict[str, Any]:
    """Create a Stripe Checkout session for the flat activation fee."""
    user = await _require_user(request)
    if req.service not in {s["id"] for s in MERCHANT_SERVICES}:
        raise HTTPException(400, f"Unknown service '{req.service}'")
    existing = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if existing:
        raise HTTPException(409, "Merchant already onboarded")
    if (await genius_phase_status())["remaining"] < 1:
        raise HTTPException(409, "Genius Phase cap reached")

    metadata = {
        "kind": "merchant_activation",
        "merchant_id": req.merchant_id,
        "owner_user_id": user.user_id,
        "business_name": req.business_name,
        "service": req.service,
        "amount": str(req.activation_fee_usd),
        "lat": str(req.lat) if req.lat is not None else "",
        "lng": str(req.lng) if req.lng is not None else "",
        "referred_by": req.referred_by or "",
    }
    return await _create_session(
        amount=float(req.activation_fee_usd),
        metadata=metadata,
        path_back="/merchant/dashboard",
    )


@router.post("/onboard/verify")
async def onboard_verify(
    req: VerifySessionRequest, request: Request
) -> Dict[str, Any]:
    """Verify Stripe session → mint the merchant + 1 baked-in chair."""
    user = await _require_user(request)
    res = await _verify_session(req.session_id, "merchant_activation")
    meta = res["metadata"]
    if meta.get("merchant_id") != req.merchant_id:
        raise HTTPException(403, "Session belongs to another merchant")
    if meta.get("owner_user_id") not in {None, "", user.user_id}:
        raise HTTPException(403, "Session belongs to another user")

    existing = await _db().merchant_genius_phase.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    )
    if existing:
        return {**existing, "already_onboarded": True}

    if (await genius_phase_status())["remaining"] < 1:
        raise HTTPException(409, "Genius Phase cap reached")

    now_iso = datetime.now(timezone.utc).isoformat()
    lat = float(meta["lat"]) if meta.get("lat") else None
    lng = float(meta["lng"]) if meta.get("lng") else None
    referred_by = meta.get("referred_by") or None
    doc = {
        "id": str(uuid.uuid4()),
        "merchant_id": req.merchant_id,
        "owner_user_id": user.user_id,
        "business_name": meta.get("business_name", ""),
        "service": meta.get("service", ""),
        "activation_fee_paid": int(meta.get("amount", ACTIVATION_FEE_MIN)),
        "chairs_held": 1,
        "lat": lat,
        "lng": lng,
        "push_radius_miles": PUSH_BLAST_RADIUS_MILES,
        "vibe_shield_enabled": True,
        "dsg_tv_placement": True,
        "referred_by": referred_by,
        "referrals_completed": 0,
        "referral_rewards_granted": 0,
        "stripe_session_id": req.session_id,
        "onboarded_at": now_iso,
    }
    await _db().merchant_genius_phase.insert_one(doc.copy())
    await _db().merchant_stripe_sessions.update_one(
        {"session_id": req.session_id},
        {"$set": {"status": "complete", "verified_at": now_iso}},
    )
    if referred_by:
        await _attribute_referral(referred_by, req.merchant_id)
    doc.pop("_id", None)
    return {**doc, "already_onboarded": False}


# ────────────────────────────────────────────── Stripe — Acquire Chair ──
@router.post("/acquire-chair/checkout")
async def acquire_chair_checkout(
    req: AcquireChairCheckoutRequest, request: Request
) -> Dict[str, Any]:
    user = await _require_user(request)
    merchant = await _assert_owner(req.merchant_id, user.user_id)
    new_total = int(merchant.get("chairs_held", 1)) + req.chairs
    if new_total > INDIVIDUAL_CHAIR_CEILING:
        raise HTTPException(400, f"Would exceed individual ceiling of {INDIVIDUAL_CHAIR_CEILING}")
    if (await genius_phase_status())["remaining"] < req.chairs:
        raise HTTPException(409, "Insufficient Genius Phase chairs left")
    amount = float(req.chairs * GENIUS_CHAIR_PRICE)
    metadata = {
        "kind": "merchant_chair",
        "merchant_id": req.merchant_id,
        "owner_user_id": user.user_id,
        "chairs": str(req.chairs),
        "amount": str(amount),
    }
    return await _create_session(amount=amount, metadata=metadata, path_back="/merchant/dashboard")


@router.post("/acquire-chair/verify")
async def acquire_chair_verify(
    req: VerifySessionRequest, request: Request
) -> Dict[str, Any]:
    user = await _require_user(request)
    await _assert_owner(req.merchant_id, user.user_id)
    res = await _verify_session(req.session_id, "merchant_chair")
    meta = res["metadata"]
    if meta.get("merchant_id") != req.merchant_id:
        raise HTTPException(403, "Session belongs to another merchant")

    chairs = int(meta.get("chairs", 0) or 0)
    if chairs < 1:
        raise HTTPException(400, "No chairs in session metadata")

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
async def addon_dsg_tv_checkout(
    req: AddonCheckoutRequest, request: Request
) -> Dict[str, Any]:
    user = await _require_user(request)
    await _assert_owner(req.merchant_id, user.user_id)
    amount = float(req.quantity * DSG_TV_FLIGHT_PRICE_USD)
    metadata = {
        "kind": "merchant_addon_dsg_tv",
        "merchant_id": req.merchant_id,
        "owner_user_id": user.user_id,
        "quantity": str(req.quantity),
        "amount": str(amount),
    }
    return await _create_session(amount=amount, metadata=metadata, path_back="/merchant/dashboard")


@router.post("/addon/push-blast/checkout")
async def addon_push_blast_checkout(
    req: AddonCheckoutRequest, request: Request
) -> Dict[str, Any]:
    user = await _require_user(request)
    await _assert_owner(req.merchant_id, user.user_id)
    amount = float(req.quantity * PUSH_BLAST_PRICE_USD)
    metadata = {
        "kind": "merchant_addon_push_blast",
        "merchant_id": req.merchant_id,
        "owner_user_id": user.user_id,
        "quantity": str(req.quantity),
        "amount": str(amount),
    }
    return await _create_session(amount=amount, metadata=metadata, path_back="/merchant/dashboard")


@router.post("/addon/verify")
async def addon_verify(
    req: VerifySessionRequest, request: Request
) -> Dict[str, Any]:
    user = await _require_user(request)
    await _assert_owner(req.merchant_id, user.user_id)

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
    sess = await _db().merchant_stripe_sessions.find_one(
        {"session_id": req.session_id}, {"_id": 0}
    )
    if sess and sess.get("status") == "complete":
        credits = await _db().merchant_addon_credits.find_one(
            {"merchant_id": req.merchant_id}, {"_id": 0}
        ) or {}
        return {
            "merchant_id": req.merchant_id, "kind": kind,
            "quantity": quantity, "already_granted": True,
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
        "merchant_id": req.merchant_id, "kind": kind,
        "quantity": quantity, "already_granted": False,
        "credits": {
            "dsg_tv_flights": int(credits.get("dsg_tv_flights", 0)),
            "push_blasts": int(credits.get("push_blasts", 0)),
        },
    }


# ────────────────────────────────────────────── Push Blast send + fan-out ──
async def _fanout_push_blast(blast: Dict[str, Any]) -> Dict[str, int]:
    """Fan a blast out via Firebase Cloud Messaging.

    Find every user whose `home_lat`/`home_lng` (or fcm_tokens.last_lat/
    last_lng) falls inside the 3-mile radius around the merchant, then
    fire FCM messages to each of their active tokens.

    If Firebase isn't initialised (dev env / no credentials), record the
    intended recipients without sending. Returns counts for the response.
    """
    lat, lng = blast.get("lat"), blast.get("lng")
    radius = float(blast.get("radius_miles") or PUSH_BLAST_RADIUS_MILES)

    # Find candidate users by lat/lng — prefer users.home_lat/lng (set
    # during onboarding), fall back to any user with a known location.
    candidate_user_ids: List[str] = []
    if lat is not None and lng is not None:
        try:
            cursor = _db().users.find(
                {"home_lat": {"$ne": None}, "home_lng": {"$ne": None}},
                {"_id": 0, "user_id": 1, "home_lat": 1, "home_lng": 1},
            )
            async for u in cursor:
                d = _haversine_miles(lat, lng, u["home_lat"], u["home_lng"])
                if d <= radius:
                    candidate_user_ids.append(u["user_id"])
        except Exception as e:  # noqa: BLE001
            logger.warning("merchant push-blast user query failed: %s", e)

    # No geo-tagged users → fall back to a global broadcast within the
    # active token set (better than zero reach in early days).
    token_query: Dict[str, Any] = {"active": True}
    if candidate_user_ids:
        token_query["user_id"] = {"$in": candidate_user_ids}

    tokens: List[str] = []
    try:
        cursor = _db().fcm_tokens.find(token_query, {"_id": 0, "token": 1})
        async for t in cursor:
            if t.get("token"):
                tokens.append(t["token"])
    except Exception as e:  # noqa: BLE001
        logger.warning("merchant push-blast token query failed: %s", e)

    sent = 0
    failed = 0
    fcm_initialised = False
    try:
        import firebase_admin  # noqa: PLC0415
        from firebase_admin import messaging  # noqa: PLC0415
        fcm_initialised = bool(firebase_admin._apps)
    except Exception:  # noqa: BLE001
        fcm_initialised = False

    if fcm_initialised and tokens:
        from firebase_admin import messaging  # noqa: PLC0415
        for tok in tokens:
            try:
                msg = messaging.Message(
                    notification=messaging.Notification(
                        title=blast["headline"], body=blast["body"],
                    ),
                    data={
                        "type": "merchant_push_blast",
                        "merchant_id": str(blast.get("merchant_id", "")),
                        "deep_link": str(blast.get("deep_link") or ""),
                    },
                    token=tok,
                )
                messaging.send(msg)
                sent += 1
            except Exception:  # noqa: BLE001
                failed += 1

    return {
        "candidates_in_radius": len(candidate_user_ids),
        "tokens_targeted": len(tokens),
        "fcm_sent": sent,
        "fcm_failed": failed,
        "fcm_initialised": fcm_initialised,
    }


@router.post("/push-blast/send")
async def push_blast_send(
    req: PushBlastSendRequest, request: Request
) -> Dict[str, Any]:
    """Consume one push-blast credit, fan-out, record the send."""
    user = await _require_user(request)
    merchant = await _assert_owner(req.merchant_id, user.user_id)

    result = await _db().merchant_addon_credits.find_one_and_update(
        {"merchant_id": req.merchant_id, "push_blasts": {"$gte": 1}},
        {"$inc": {"push_blasts": -1}},
        projection={"_id": 0},
        return_document=False,
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
    fanout = await _fanout_push_blast(blast)
    blast["fanout"] = fanout

    await _db().merchant_push_blasts.insert_one(blast.copy())
    blast.pop("_id", None)
    credits = await _db().merchant_addon_credits.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    ) or {}
    return {
        "sent": True,
        "blast": blast,
        "remaining_credits": int(credits.get("push_blasts", 0)),
        "fanout": fanout,
    }


# ────────────────────────────────────────────── DSG TV ad-flight publish ──
@router.post("/dsg-tv/publish-ad")
async def dsg_tv_publish_ad(
    req: PublishAdFlightRequest, request: Request
) -> Dict[str, Any]:
    """Consume one DSG TV flight credit + insert a TVAd into the broadcast
    queue (`services/vibe_tv._ADS`). This is the bridge from the merchant
    paywall into the live 24/7 schedule that `/api/vibe-tv/schedule`
    surfaces to viewers."""
    user = await _require_user(request)
    merchant = await _assert_owner(req.merchant_id, user.user_id)

    # Atomic credit decrement.
    result = await _db().merchant_addon_credits.find_one_and_update(
        {"merchant_id": req.merchant_id, "dsg_tv_flights": {"$gte": 1}},
        {"$inc": {"dsg_tv_flights": -1}},
        projection={"_id": 0},
        return_document=False,
    )
    if result is None:
        raise HTTPException(402, "No DSG TV flight credits remaining — purchase an add-on")

    # Insert into the in-memory broadcast queue used by the scheduler.
    try:
        from services.vibe_tv import TVAd  # noqa: PLC0415
        from routes.vibe_tv_routes import _ADS  # noqa: PLC0415
        ad_id = str(uuid.uuid4())
        ad = TVAd(
            ad_id=ad_id,
            advertiser_id=req.merchant_id,
            title=req.title,
            target_zip_codes=req.target_zip_codes or [],
            duration_seconds=req.duration_seconds,
        )
        _ADS[ad_id] = ad
        ad_doc = ad.__dict__
    except Exception as e:  # pragma: no cover — fallback when vibe_tv service unavailable
        logger.warning("DSG TV insertion fell back to mongo-only: %s", e)
        ad_id = str(uuid.uuid4())
        ad_doc = {
            "ad_id": ad_id,
            "advertiser_id": req.merchant_id,
            "title": req.title,
            "target_zip_codes": req.target_zip_codes or [],
            "duration_seconds": req.duration_seconds,
            "is_active": True,
        }

    # Mirror to mongo for audit + dashboard history.
    record = {
        **ad_doc,
        "merchant_id": req.merchant_id,
        "business_name": merchant.get("business_name", ""),
        "published_at": datetime.now(timezone.utc).isoformat(),
    }
    await _db().merchant_dsg_tv_ads.insert_one(record.copy())
    record.pop("_id", None)
    credits = await _db().merchant_addon_credits.find_one(
        {"merchant_id": req.merchant_id}, {"_id": 0}
    ) or {}
    return {
        "published": True,
        "ad": record,
        "remaining_credits": int(credits.get("dsg_tv_flights", 0)),
    }


@router.get("/dsg-tv/ads/{merchant_id}")
async def dsg_tv_recent_ads(merchant_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Public: recent ads this merchant has published (audit + history)."""
    limit = max(1, min(50, int(limit)))
    cursor = _db().merchant_dsg_tv_ads.find(
        {"merchant_id": merchant_id}, {"_id": 0}
    ).sort("published_at", -1).limit(limit)
    return [doc async for doc in cursor]


# ────────────────────────────────────────────── Leaderboard ──
@router.get("/leaderboard")
async def merchant_leaderboard(limit: int = 10) -> Dict[str, Any]:
    """Top merchants by completed referrals — public.

    Powers `/merchant/leaderboard`. Returns the top N + the reward
    constants so the page can render the "next reward at" badge.
    """
    limit = max(1, min(100, int(limit)))
    cursor = _db().merchant_genius_phase.find(
        {"referrals_completed": {"$gt": 0}},
        {
            "_id": 0,
            "merchant_id": 1,
            "business_name": 1,
            "service": 1,
            "chairs_held": 1,
            "referrals_completed": 1,
            "referral_rewards_granted": 1,
        },
    ).sort("referrals_completed", -1).limit(limit)
    top = [doc async for doc in cursor]
    return {
        "top": top,
        "reward_threshold": REFERRAL_REWARD_THRESHOLD,
        "chair_price_usd": GENIUS_CHAIR_PRICE,
    }
