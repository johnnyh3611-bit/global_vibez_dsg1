"""
Stripe Connect / Payouts webhook handler.

Receives ALL the Connect & Charge events we registered on Stripe's side
when the founder pasted the live API key (2026-02 sprint):

  - account.updated                  → flip user's `stripe_payouts_enabled` flag
  - account.external_account.created → first time a driver/host adds a bank
  - payout.paid                      → mark a payout as settled in Mongo
  - payout.failed                    → notify the user + escalate to admin
  - charge.succeeded                 → reconcile against `pending_charges`
  - charge.refunded                  → reconcile refunds
  - checkout.session.completed       → flip order/booking status to "paid"

Stripe signs every webhook with `Stripe-Signature` header using the
`STRIPE_WEBHOOK_SECRET` we capture during webhook endpoint creation.
We use the official `stripe.Webhook.construct_event` helper so signature
verification + replay protection are guaranteed correct.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict

import stripe
from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payouts", tags=["stripe-payouts-webhook"])

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY

_db = AsyncIOMotorClient(os.environ.get("MONGO_URL"))[
    os.environ.get("DB_NAME", "global_vibez_dsg")
]


@router.post("/stripe-webhook")
async def stripe_payouts_webhook(request: Request) -> Dict[str, Any]:
    """Cryptographically-verified ingest for Stripe Connect & Charge
    events. Returns 200 quickly so Stripe doesn't retry — heavy work
    happens via DB writes that downstream features pick up async."""
    if not STRIPE_WEBHOOK_SECRET:
        # Without a secret we'd accept anything claiming to be Stripe,
        # so we hard-fail instead. This is the right posture for live
        # mode; if a deploy is mid-rotation, fix the env, don't relax.
        raise HTTPException(503, detail="STRIPE_WEBHOOK_SECRET not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    if not sig_header:
        raise HTTPException(400, detail="Missing Stripe-Signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig_header,
            secret=STRIPE_WEBHOOK_SECRET,
            tolerance=300,  # 5-minute replay window
        )
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(401, detail=f"Invalid Stripe signature: {e}")
    except ValueError as e:
        raise HTTPException(400, detail=f"Invalid payload: {e}")

    event_type = event.get("type", "")
    data_obj: Dict[str, Any] = event.get("data", {}).get("object", {})  # type: ignore

    # Persist the raw event for audit + replay debugging. _id excluded
    # from any future reads via projection in the consuming route.
    await _db.stripe_webhook_events.insert_one({
        "stripe_event_id": event.get("id"),
        "type": event_type,
        "livemode": event.get("livemode", False),
        "received_at": datetime.now(timezone.utc).isoformat(),
        "object_id": data_obj.get("id"),
        "raw": event,
    })

    # Per-event side-effects. Each handler is intentionally small + idempotent
    # (stripe_event_id is unique, so dup events from retries don't double-fire).
    if event_type == "account.updated":
        await _handle_account_updated(data_obj)
    elif event_type == "account.external_account.created":
        await _handle_external_account_created(data_obj)
    elif event_type == "payout.paid":
        await _handle_payout_paid(data_obj)
    elif event_type == "payout.failed":
        await _handle_payout_failed(data_obj)
    elif event_type == "charge.succeeded":
        await _handle_charge_succeeded(data_obj)
    elif event_type == "charge.refunded":
        await _handle_charge_refunded(data_obj)
    elif event_type == "checkout.session.completed":
        await _handle_checkout_completed(data_obj)
    else:
        # Unknown event — log + still ack so Stripe doesn't retry.
        logger.info("Unhandled Stripe event type: %s", event_type)

    return {"ok": True, "type": event_type, "id": event.get("id")}


# ────────────────────────────────────────────── Per-event handlers ──
async def _handle_account_updated(obj: Dict[str, Any]) -> None:
    account_id = obj.get("id")
    if not account_id:
        return
    await _db.users.update_many(
        {"stripe_connect_account_id": account_id},
        {"$set": {
            "stripe_charges_enabled": obj.get("charges_enabled", False),
            "stripe_payouts_enabled": obj.get("payouts_enabled", False),
            "stripe_details_submitted": obj.get("details_submitted", False),
            "stripe_account_updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )


async def _handle_external_account_created(obj: Dict[str, Any]) -> None:
    # `account` field on the external_account object identifies which
    # Connect account it belongs to.
    connect_account_id = obj.get("account")
    if not connect_account_id:
        return
    await _db.users.update_many(
        {"stripe_connect_account_id": connect_account_id},
        {"$set": {
            "stripe_bank_attached": True,
            "stripe_bank_attached_at": datetime.now(timezone.utc).isoformat(),
        }},
    )


async def _handle_payout_paid(obj: Dict[str, Any]) -> None:
    payout_id = obj.get("id")
    if not payout_id:
        return
    await _db.payouts.update_one(
        {"stripe_payout_id": payout_id},
        {"$set": {
            "status": "paid",
            "settled_at": datetime.now(timezone.utc).isoformat(),
            "arrival_date": obj.get("arrival_date"),
        }},
    )


async def _handle_payout_failed(obj: Dict[str, Any]) -> None:
    payout_id = obj.get("id")
    if not payout_id:
        return
    await _db.payouts.update_one(
        {"stripe_payout_id": payout_id},
        {"$set": {
            "status": "failed",
            "failed_at": datetime.now(timezone.utc).isoformat(),
            "failure_code": obj.get("failure_code"),
            "failure_message": obj.get("failure_message"),
        }},
    )
    # Queue an admin alert so someone reaches out to the user.
    await _db.admin_alerts.insert_one({
        "kind": "stripe_payout_failed",
        "stripe_payout_id": payout_id,
        "amount": obj.get("amount"),
        "currency": obj.get("currency"),
        "destination_account": obj.get("destination"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved": False,
    })


async def _handle_charge_succeeded(obj: Dict[str, Any]) -> None:
    # Generic reconciliation hook — feature surfaces that initiated
    # the charge can pick up via the stored event log.
    charge_id = obj.get("id")
    if not charge_id:
        return
    await _db.charges.update_one(
        {"stripe_charge_id": charge_id},
        {"$set": {
            "status": "succeeded",
            "amount_received": obj.get("amount_captured") or obj.get("amount"),
            "succeeded_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )


async def _handle_charge_refunded(obj: Dict[str, Any]) -> None:
    charge_id = obj.get("id")
    if not charge_id:
        return
    await _db.charges.update_one(
        {"stripe_charge_id": charge_id},
        {"$set": {
            "status": "refunded",
            "amount_refunded": obj.get("amount_refunded"),
            "refunded_at": datetime.now(timezone.utc).isoformat(),
        }},
    )


async def _handle_checkout_completed(obj: Dict[str, Any]) -> None:
    """Stripe Checkout sessions flip orders/bookings to paid.
    `client_reference_id` is set by the originating feature to our
    internal record ID.

    Special case: refs starting with `feature:` belong to the Featured
    Streamers tier and route to a dedicated grant function so the
    `featured_until` window extends idempotently.
    """
    ref = obj.get("client_reference_id")
    if not ref:
        return

    # Featured Streamers tier — route to dedicated grant fn.
    if isinstance(ref, str) and ref.startswith("feature:"):
        streamer_id = ref.split(":", 1)[1]
        try:
            from routes.featured_streamers import apply_feature_grant  # noqa: PLC0415
            await apply_feature_grant(
                streamer_id=streamer_id,
                stripe_session_id=obj.get("id"),
            )
        except Exception as e:
            logger.exception("Failed to apply feature grant for %s: %s", streamer_id, e)
        return

    # Generic order/booking paid flip.
    now = datetime.now(timezone.utc).isoformat()
    for coll in ("orders", "bookings", "venue_bookings", "smartstack_orders"):
        await _db[coll].update_one(
            {"_id": ref},
            {"$set": {"payment_status": "paid", "paid_at": now}},
        )
