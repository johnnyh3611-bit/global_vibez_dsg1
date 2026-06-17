"""
Founders Pass — Casino House Tiers (Scenario D, user-selected April 2026).

NOT a security. This is a one-time prepaid utility purchase that grants:
  • A permanent stake-accrual MULTIPLIER on the existing Vibe Stakes loyalty
    program (member must STILL play to earn — multiplier amplifies activity,
    it is not yield on capital).
  • A one-time STARTER STAKES grant (gift, not a vesting schedule).
  • Cosmetic perks: Founder badge, profile aura, tier-specific unlocks.

Why this is NOT a security (Howey test breakdown):
  ✗ NO common enterprise — buyers don't pool capital that a third party
    invests on their behalf.
  ✗ NO expectation of profit DERIVED FROM EFFORTS OF OTHERS — the buyer
    must actively play games / ride / deposit to earn stakes that get the
    multiplier applied. Sitting passively earns $0.
  ✗ NO transferability — the pass is bound to the user_id; no resale.
  ✗ Quarterly distributions remain DISCRETIONARY bonus payouts (not
    dividends on owned property).

Same legal structure as: Discord Nitro, Costco Lifetime, World of Warcraft
"Founders Pack", OnlyFans Lifetime Tier, Patreon Founding Patron.

Endpoints:
  GET  /api/founders-pass/tiers          (public)
  GET  /api/founders-pass/me             (auth)
  POST /api/founders-pass/checkout       (auth) — creates Stripe checkout
  POST /api/founders-pass/test-activate  (auth) — preview/dev only; gated
                                                   by FOUNDERS_PASS_TEST_MODE env
  GET  /api/admin/founders-pass/stats    (admin) — ARPU + tier mix dashboard
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin_dashboard import verify_admin_cookie
from routes.god_mode_audit import record_god_event

logger = logging.getLogger(__name__)
router = APIRouter()


# ─────────────────────────────────────────────── Tier definitions (Scenario D)

TIERS: Dict[str, Dict[str, Any]] = {
    "the_slots": {
        "id": "the_slots",
        "name": "The Slots",
        "icon": "🃏",
        "price_usd": 19.00,
        "multiplier": 1.5,
        "starter_stakes": 300,
        "color": "from-amber-400 to-orange-500",
        "tagline": "First spin's on you.",
        "perks": [
            "1.5× Vibe Stakes multiplier — forever",
            "300 starter Vibe Stakes",
            "Founder badge on profile",
            "Glowing 'Slots' aura on game tables",
        ],
    },
    "blackjack": {
        "id": "blackjack",
        "name": "Blackjack Tier",
        "icon": "🎴",
        "price_usd": 99.00,
        "multiplier": 4.0,
        "starter_stakes": 2_500,
        "color": "from-emerald-400 to-teal-500",
        "tagline": "Hit twenty-one.",
        "perks": [
            "4× Vibe Stakes multiplier — forever",
            "2,500 starter Vibe Stakes",
            "Premium-tier perks bundled (1.5× boost stacks)",
            "Founder badge + Blackjack profile aura",
            "Priority matchmaking on all card games",
        ],
    },
    "craps": {
        "id": "craps",
        "name": "Craps Tier",
        "icon": "🎲",
        "price_usd": 399.00,
        "multiplier": 9.0,
        "starter_stakes": 10_000,
        "color": "from-fuchsia-500 to-pink-500",
        "tagline": "Roll with the house.",
        "perks": [
            "9× Vibe Stakes multiplier — forever",
            "10,000 starter Vibe Stakes",
            "All Blackjack tier perks",
            "Free entry into all weekly tournaments",
            "Custom Vibe Phone vanity number",
            "VIP-only chat room access",
        ],
    },
    "spades_royale": {
        "id": "spades_royale",
        "name": "Spades Royale",
        "icon": "♠️",
        "price_usd": 1_499.00,
        "multiplier": 20.0,
        "starter_stakes": 50_000,
        "color": "from-cyan-400 to-purple-600",
        "tagline": "Sit at the boss table.",
        "perks": [
            "20× Vibe Stakes multiplier — forever",
            "50,000 starter Vibe Stakes",
            "All Craps tier perks",
            "Private quarterly Spades AAA tournament — ₵100,000 prize pool",
            "Direct line to the founders (monthly call)",
            "Co-design vote on the next game added to the platform",
            "Lifetime Diamond VIP status",
        ],
    },
}

VALID_TIER_IDS = set(TIERS.keys())


# ─────────────────────────────────────────────── Helpers

async def _get_user_pass(db, user_id: str) -> Optional[Dict[str, Any]]:
    """Returns the user's active founders pass row, or None."""
    return await db.founders_passes.find_one(
        {"user_id": user_id, "status": "active"},
        {"_id": 0},
        sort=[("activated_at", -1)],
    )


async def _next_pass_number(db, tier_id: str) -> int:
    """Atomic per-tier counter. Spades Royale #1, #2, #3 … is INDEPENDENT
    of The Slots #1, #2, #3 …  Counter doc lives at
    `founders_pass_counters._id == tier_id`.
    """
    rec = await db.founders_pass_counters.find_one_and_update(
        {"_id": tier_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,  # 'after' — Motor accepts the constant from pymongo
    )
    # If `return_document` constant isn't honored on a particular Motor
    # version, the upsert path returns None for the first call. Re-read.
    if rec is None or "seq" not in (rec or {}):
        rec = await db.founders_pass_counters.find_one({"_id": tier_id}) or {}
    return int(rec.get("seq", 1))


async def _peek_next_pass_number(db, tier_id: str) -> int:
    """Read-only — what would the next buyer's number be? (Public marketing)."""
    rec = await db.founders_pass_counters.find_one({"_id": tier_id}) or {}
    return int(rec.get("seq", 0)) + 1


async def _activate_pass(
    db,
    user_id: str,
    tier_id: str,
    payment_ref: str,
    amount_usd: float,
) -> Dict[str, Any]:
    """
    Idempotent: if this payment_ref already activated a pass, return that
    record. Otherwise insert a new row + cache multiplier on user record +
    grant starter stakes.
    """
    # Idempotency guard
    existing = await db.founders_passes.find_one(
        {"payment_ref": payment_ref}, {"_id": 0}
    )
    if existing:
        return {**existing, "idempotent_replay": True}

    if tier_id not in VALID_TIER_IDS:
        raise HTTPException(400, f"Unknown tier '{tier_id}'.")

    tier = TIERS[tier_id]
    now = datetime.now(timezone.utc).isoformat()

    pass_number = await _next_pass_number(db, tier_id)

    pass_doc = {
        "pass_id": f"fp_{tier_id}_{payment_ref[-12:]}",
        "user_id": user_id,
        "tier_id": tier_id,
        "tier_name": tier["name"],
        "multiplier": tier["multiplier"],
        "starter_stakes_granted": tier["starter_stakes"],
        "amount_paid_usd": amount_usd,
        "payment_ref": payment_ref,
        "pass_number": pass_number,
        "pass_number_label": f"{tier['name']} Founder #{pass_number:03d}",
        "activated_at": now,
        "status": "active",
    }
    # Insert into a copy so the returned dict doesn't pick up the
    # auto-generated `_id` (Pydantic can't serialize bson.ObjectId).
    await db.founders_passes.insert_one(dict(pass_doc))

    # Cache the highest multiplier on the user record so the accrual hot path
    # only does one read instead of querying founders_passes every time.
    await db.users.update_one(
        {"user_id": user_id},
        {"$max": {"founders_pass_multiplier": tier["multiplier"]},
         "$set": {"founders_pass_tier": tier_id, "founders_pass_activated_at": now}},
        upsert=False,
    )

    # Grant starter stakes via the loyalty program.
    try:
        from routes.profit_share import accrue_stake
        await accrue_stake(
            user_id, "manual_admin_grant",
            amount=tier["starter_stakes"],
            meta={"reason": "founders_pass_starter", "tier": tier_id, "ref": payment_ref},
        )
    except Exception as e:
        logger.warning(f"[founders-pass] starter-stake grant failed: {e}")

    # If Blackjack+ tier, also bump them to Premium for the 1.5× stack.
    if tier["multiplier"] >= 4.0:
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "subscription_tier": "premium",
                "premium_activated_at": now,
                "premium_source": "founders_pass",
            }},
        )

    await record_god_event(
        user_id, "FOUNDERS_PASS_ACTIVATED", amount_usd,
        meta={
            "tier": tier_id,
            "multiplier": tier["multiplier"],
            "starter_stakes": tier["starter_stakes"],
            "payment_ref": payment_ref,
        },
    )

    logger.info(
        f"[founders-pass] {user_id} activated {tier_id} "
        f"(${amount_usd:.2f}, {tier['multiplier']}×, +{tier['starter_stakes']:,} stakes)"
    )

    return {**pass_doc, "idempotent_replay": False}


# ─────────────────────────────────────────────── Public endpoints

@router.get("/founders-pass/tiers")
async def list_tiers() -> Dict[str, Any]:
    """Public — returns the 4 House Tiers with pricing + perks + the
    next-available founder number per tier (for FOMO marketing copy
    like "Be Spades Royale Founder #04")."""
    db = get_database()
    tiers_out = []
    for k in ["the_slots", "blackjack", "craps", "spades_royale"]:
        t = dict(TIERS[k])
        try:
            t["next_pass_number"] = await _peek_next_pass_number(db, k)
        except Exception:
            t["next_pass_number"] = 1
        tiers_out.append(t)
    return {
        "currency": "USD",
        "tiers": tiers_out,
        "legal_disclaimer": (
            "One-time purchase. Non-refundable, non-transferable. The "
            "stake multiplier applies to stakes you EARN through platform "
            "activity. Quarterly Vibe Stakes distributions are discretionary "
            "loyalty bonuses, not guaranteed returns. Not a security."
        ),
    }


@router.get("/founders-pass/me")
async def my_pass(http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    pass_doc = await _get_user_pass(db, user.user_id)
    if not pass_doc:
        return {"has_pass": False, "tier": None, "multiplier": 1.0}
    tier = TIERS.get(pass_doc["tier_id"], {})
    return {
        "has_pass": True,
        "tier": pass_doc["tier_id"],
        "tier_name": pass_doc["tier_name"],
        "multiplier": pass_doc["multiplier"],
        "starter_stakes_granted": pass_doc.get("starter_stakes_granted", 0),
        "amount_paid_usd": pass_doc.get("amount_paid_usd", 0),
        "activated_at": pass_doc.get("activated_at"),
        "pass_number": pass_doc.get("pass_number"),
        "pass_number_label": pass_doc.get("pass_number_label"),
        "icon": tier.get("icon"),
        "color": tier.get("color"),
    }


# ─────────────────────────────────────────────── Checkout

class CheckoutPayload(BaseModel):
    tier_id: str = Field(..., min_length=3, max_length=40)


@router.post("/founders-pass/checkout")
async def create_checkout(payload: CheckoutPayload, http_request: Request) -> Dict[str, Any]:
    """
    Creates a Stripe checkout session for the requested tier. Returns a
    redirect URL; the frontend opens it in-window.

    The tier_id + user_id are stamped into Stripe metadata so the webhook
    can activate the pass on payment.success.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")

    if payload.tier_id not in VALID_TIER_IDS:
        raise HTTPException(400, f"Unknown tier '{payload.tier_id}'.")

    db = get_database()
    existing = await _get_user_pass(db, user.user_id)
    if existing and TIERS[existing["tier_id"]]["price_usd"] >= TIERS[payload.tier_id]["price_usd"]:
        raise HTTPException(
            409,
            f"You already hold {existing['tier_name']} which is equal or higher tier."
        )

    tier = TIERS[payload.tier_id]

    # Stripe checkout — uses the same emergentintegrations helper the rest
    # of the platform uses. Falls back to a clear 503 if Stripe isn't
    # configured in this preview env.
    try:
        from emergentintegrations.payments.stripe.checkout import (
            StripeCheckout, CheckoutSessionRequest,
        )
    except ImportError as e:
        raise HTTPException(503, f"Stripe library unavailable: {e}")

    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        raise HTTPException(
            503,
            "Stripe not configured in this environment. Use the test-activate "
            "endpoint for preview/dev, or wire STRIPE_API_KEY in backend/.env.",
        )

    origin = http_request.headers.get("origin") or http_request.headers.get("referer") or ""
    origin = origin.rstrip("/")
    if not origin:
        raise HTTPException(400, "Origin header required.")

    success_url = f"{origin}/founders-pass/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/founders-pass"

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    sc = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)

    metadata = {
        "user_id": user.user_id,
        "tier_id": payload.tier_id,
        "purchase_type": "founders_pass",
        "email": user.email,
    }

    session = await sc.create_checkout_session(CheckoutSessionRequest(
        amount=tier["price_usd"],
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    ))

    # Persist the pending intent so the webhook + status poll can reconcile.
    await db.founders_pass_pending.insert_one({
        "session_id": session.session_id,
        "user_id": user.user_id,
        "tier_id": payload.tier_id,
        "amount_usd": tier["price_usd"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "checkout_url": session.url,
        "session_id": session.session_id,
        "tier": payload.tier_id,
        "amount_usd": tier["price_usd"],
    }


@router.get("/founders-pass/checkout-status/{session_id}")
async def checkout_status(session_id: str, http_request: Request) -> Dict[str, Any]:
    """Polled by the success page. On `paid`, activates the pass once."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")

    db = get_database()
    pending = await db.founders_pass_pending.find_one(
        {"session_id": session_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not pending:
        raise HTTPException(404, "Checkout session not found.")

    if pending.get("status") == "activated":
        return {"status": "activated", "tier": pending["tier_id"]}

    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
    except ImportError as e:
        raise HTTPException(503, f"Stripe library unavailable: {e}")

    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        raise HTTPException(503, "Stripe not configured.")

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    sc = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)

    status = await sc.get_checkout_status(session_id)

    if status.payment_status == "paid":
        result = await _activate_pass(
            db,
            user.user_id,
            pending["tier_id"],
            payment_ref=session_id,
            amount_usd=pending["amount_usd"],
        )
        await db.founders_pass_pending.update_one(
            {"session_id": session_id},
            {"$set": {"status": "activated", "activated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"status": "activated", "tier": pending["tier_id"], "pass": result}

    return {"status": status.payment_status, "tier": pending["tier_id"]}


# ─────────────────────────────────────────────── Test / dev activation

class TestActivatePayload(BaseModel):
    tier_id: str = Field(..., min_length=3, max_length=40)
    payment_ref: str = Field(..., min_length=3, max_length=200)


@router.post("/founders-pass/test-activate")
async def test_activate(payload: TestActivatePayload, http_request: Request) -> Dict[str, Any]:
    """
    Preview/dev shortcut — activates a pass without going through Stripe.

    Hard-gated by TWO conditions (both must be true):
      1. FOUNDERS_PASS_TEST_MODE=1 in env
      2. ENV != "production" (or unset). Even if test-mode flag is left on
         by mistake, this endpoint refuses to fire in a production deploy.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")

    env_name = (os.environ.get("ENV") or os.environ.get("ENVIRONMENT") or "").lower()
    if env_name == "production":
        raise HTTPException(
            503,
            "Test activation is permanently disabled in production deployments. "
            "Use the Stripe checkout flow instead."
        )
    if os.environ.get("FOUNDERS_PASS_TEST_MODE", "0") != "1":
        raise HTTPException(
            503,
            "Test activation disabled. Set FOUNDERS_PASS_TEST_MODE=1 in "
            "backend/.env to enable for preview/dev.",
        )

    if payload.tier_id not in VALID_TIER_IDS:
        raise HTTPException(400, f"Unknown tier '{payload.tier_id}'.")

    db = get_database()
    tier = TIERS[payload.tier_id]
    return await _activate_pass(
        db, user.user_id, payload.tier_id,
        payment_ref=payload.payment_ref,
        amount_usd=tier["price_usd"],
    )


# ─────────────────────────────────────────────── Admin stats

@router.get("/admin/founders-pass/stats")
async def admin_stats(_: bool = Depends(verify_admin_cookie)) -> Dict[str, Any]:
    """ARPU, tier mix, gross revenue, active pass count."""
    db = get_database()

    # Tier mix + revenue
    rows = await db.founders_passes.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {
            "_id": "$tier_id",
            "count": {"$sum": 1},
            "revenue_usd": {"$sum": "$amount_paid_usd"},
        }},
    ]).to_list(length=10)

    by_tier = {r["_id"]: {"count": r["count"], "revenue_usd": round(r["revenue_usd"], 2)} for r in rows}
    total_passes = sum(r["count"] for r in rows)
    gross_revenue = round(sum(r["revenue_usd"] for r in rows), 2)
    arpu = round(gross_revenue / total_passes, 2) if total_passes > 0 else 0.0

    return {
        "active_passes": total_passes,
        "gross_revenue_usd": gross_revenue,
        "arpu_usd": arpu,
        "tier_mix": [
            {
                "tier_id": tid,
                "tier_name": TIERS[tid]["name"],
                "price_usd": TIERS[tid]["price_usd"],
                "active_count": by_tier.get(tid, {}).get("count", 0),
                "revenue_usd": by_tier.get(tid, {}).get("revenue_usd", 0),
                "share_pct": round(
                    100 * by_tier.get(tid, {}).get("count", 0) / total_passes, 2
                ) if total_passes > 0 else 0.0,
            }
            for tid in ["the_slots", "blackjack", "craps", "spades_royale"]
        ],
    }
