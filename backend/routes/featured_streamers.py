"""
Featured Streamers — paid promotion tier for the Live Now Wall.

$5/month grants a streamer a glowing pinned position at the top of
`/streams/live` for 30 days. Direct revenue lever using the live Stripe
key + Stripe Checkout for the lowest-friction purchase path (no card-on-
file required, hosted by Stripe, PCI-compliant by definition).

Payment flow:
  1. Frontend hits POST /api/featured-streamers/checkout (this module).
  2. We create a Stripe Checkout Session with a 30-day $5 line item +
     `client_reference_id=<streamer_id>` and return the hosted URL.
  3. Stripe redirects the user → they pay → Stripe webhook fires
     `checkout.session.completed` to `/api/payouts/stripe-webhook`.
  4. The payouts webhook's `_handle_checkout_completed` handler sees a
     ref starting with `feature:` and calls `apply_feature_grant(...)`
     here to extend the streamer's `featured_until` for 30 days.
  5. The Live Now Wall (`/streams/live`) sorts by featured-then-recency
     and applies a glowing pinned style to anyone whose `featured_until`
     is in the future.

Live-key activation: requires STRIPE_API_KEY (already configured 2026-02).
When the key is absent or starts with `sk_test_`, the endpoint returns a
clearly-labeled mock checkout URL so the frontend can be exercised end-
to-end pre-payment.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import stripe
from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/featured-streamers", tags=["featured-streamers"])

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY

_db = AsyncIOMotorClient(os.environ.get("MONGO_URL"))[
    os.environ.get("DB_NAME", "global_vibez_dsg")
]

# ────────────────────────────────────────────── Constants ──
# DEFAULT values — actual price/duration read from the live pricing
# catalog so the founder can hot-edit from /admin/tier-pricing without
# a redeploy. Catalog ID: "featured_streamer".
FEATURED_PRICE_USD = 5.00
FEATURED_DURATION_DAYS = 30
FEATURED_REF_PREFIX = "feature:"


async def _live_pricing() -> Dict[str, Any]:
    """Read live featured-streamer pricing from the catalog. Falls back
    to the hardcoded defaults on any error so checkout never crashes."""
    try:
        from services.pricing_catalog import get_featured_streamer_pricing  # noqa: PLC0415
        return await get_featured_streamer_pricing(_db)
    except Exception:
        return {"price_usd": FEATURED_PRICE_USD, "duration_days": FEATURED_DURATION_DAYS}


class CheckoutRequest(BaseModel):
    streamer_id: str
    return_url: Optional[str] = None  # where to send the user after payment


def _is_live() -> bool:
    return bool(STRIPE_API_KEY) and STRIPE_API_KEY.startswith("sk_live_")


# ────────────────────────────────────────────── Endpoints ──
@router.post("/checkout")
async def create_checkout(req: CheckoutRequest) -> Dict[str, Any]:
    """Create a one-shot Stripe Checkout Session for a 30-day feature
    grant. Frontend redirects to `checkout_url`. We bake the streamer_id
    into `client_reference_id` so the webhook can identify the grant
    target without trusting the user's later state."""
    if not STRIPE_API_KEY:
        # Mock checkout for preview env without live key.
        live = await _live_pricing()
        return {
            "mode": "mock",
            "checkout_url": f"https://example.com/mock-checkout?streamer={req.streamer_id}&plan=featured",
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "price_usd": live["price_usd"],
            "duration_days": live["duration_days"],
        }

    # Where to bounce the user after Stripe collects payment. Default to
    # the Live Now Wall so they instantly see their feature land.
    return_url = req.return_url or "https://globalvibezdsg.com/streams/live"

    live = await _live_pricing()
    price_usd = live["price_usd"]
    duration_days = live["duration_days"]
    try:
        session = stripe.checkout.Session.create(
            mode="payment",  # one-shot purchase (we manage the duration window ourselves)
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"Featured Streamer · {duration_days} days",
                        "description": (
                            "Glowing pinned position at the top of the Live Now Wall "
                            f"for {duration_days} days. Boost discovery, grow your audience."
                        ),
                    },
                    "unit_amount": int(price_usd * 100),
                },
                "quantity": 1,
            }],
            success_url=f"{return_url}?featured=success",
            cancel_url=f"{return_url}?featured=cancel",
            client_reference_id=f"{FEATURED_REF_PREFIX}{req.streamer_id}",
            metadata={
                "kind": "featured_streamer",
                "streamer_id": req.streamer_id,
                "duration_days": str(duration_days),
            },
        )
    except stripe.error.StripeError as e:
        raise HTTPException(502, detail=f"Stripe checkout error: {e}")

    return {
        "mode": "live",
        "checkout_url": session.url,
        "session_id": session.id,
        "expires_at": datetime.fromtimestamp(session.expires_at, timezone.utc).isoformat() if session.expires_at else None,
        "price_usd": price_usd,
        "duration_days": duration_days,
    }


@router.get("/status/{streamer_id}")
async def feature_status(streamer_id: str) -> Dict[str, Any]:
    """Read whether a streamer is currently featured and when the
    grant expires. Public — used by the Live Now Wall to render the
    'pinned' style and by the Studio page to show 'Featured · 12 days
    left' messaging."""
    rec = await _db.featured_streamers.find_one(
        {"streamer_id": streamer_id}, {"_id": 0}
    )
    if not rec:
        return {"streamer_id": streamer_id, "is_featured": False, "featured_until": None}
    now = datetime.now(timezone.utc).isoformat()
    return {
        "streamer_id": streamer_id,
        "is_featured": (rec.get("featured_until") or "") > now,
        "featured_until": rec.get("featured_until"),
        "last_grant_session_id": rec.get("last_grant_session_id"),
    }


@router.get("/all-active")
async def list_active_features() -> Dict[str, Any]:
    """Bulk helper used by the Live Now Wall to mark featured streamers
    in a single round-trip (instead of N calls per tile)."""
    now = datetime.now(timezone.utc).isoformat()
    cursor = _db.featured_streamers.find(
        {"featured_until": {"$gt": now}}, {"_id": 0}
    )
    items = await cursor.to_list(500)
    return {"featured": items, "count": len(items)}


# ────────────────────────────────────────────── Grant fn (called by webhook) ──
async def apply_feature_grant(
    streamer_id: str, stripe_session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Idempotently extend a streamer's feature window by 30 days.

    Called by `routes/stripe_payouts_webhook.py::_handle_checkout_completed`
    when it sees a `client_reference_id` starting with `feature:`. Idempotency
    via `last_grant_session_id` — if we've already applied a grant for the
    same Stripe session, no-op (Stripe retries webhooks on 5xx + duplicates).
    """
    existing = await _db.featured_streamers.find_one(
        {"streamer_id": streamer_id}, {"_id": 0}
    )
    if existing and existing.get("last_grant_session_id") == stripe_session_id:
        return existing  # already applied — Stripe retry

    now = datetime.now(timezone.utc)
    # If they're already featured, extend from their current end date,
    # not from now (don't penalize early renewals).
    base = now
    if existing and existing.get("featured_until"):
        try:
            current = datetime.fromisoformat(existing["featured_until"])
            if current > now:
                base = current
        except ValueError:
            base = now
    new_until = base + timedelta(days=FEATURED_DURATION_DAYS)

    doc = {
        "streamer_id": streamer_id,
        "featured_until": new_until.isoformat(),
        "last_grant_session_id": stripe_session_id,
        "last_granted_at": now.isoformat(),
        "grant_count": (existing.get("grant_count", 0) if existing else 0) + 1,
    }
    await _db.featured_streamers.update_one(
        {"streamer_id": streamer_id}, {"$set": doc}, upsert=True,
    )
    logger.info("Granted FEATURED to %s until %s (session=%s)",
                streamer_id, new_until.isoformat(), stripe_session_id)
    return doc
