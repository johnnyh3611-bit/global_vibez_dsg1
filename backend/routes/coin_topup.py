"""
Vibez Coin Top-Up (May 2026)
─────────────────────────────────────────────────────────────────
Stripe checkout flow that lets users buy Vibez Coins (₵) — the
canonical platform credit used by JFTN, Yellow Pages, ambassador
commissions, casino games, etc.

Coin packs (LOCKED — bigger packs reward bigger commitment):
  • ₵500    →  $5    starter
  • ₵1000   →  $9    save 10%   (Most Popular)
  • ₵2500   →  $20   save 20%
  • ₵5000   →  $35   save 30%

On successful payment, ``users.credits_balance`` is incremented and
a row is written to ``coin_topup_payments`` for audit. The Stripe
session metadata locks the pack at server-side so the client cannot
manipulate the price.
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel

log = logging.getLogger(__name__)

router = APIRouter(prefix="/coins", tags=["coin-topup"])

from config import db as _db

PAYMENTS = _db.coin_topup_payments
USERS = _db.users

# ─────────────────────────────  Packs (LOCKED)  ─────────────────────────────
# Coin amounts scale with COINS_PER_USD = 2000.
# Bigger packs reward bigger commitment via discounted ₵/$ rate:
#   starter  →  exactly 2000 ₵/$ (no discount)
#   popular  →  ~2222 ₵/$  (10% bonus)
#   pro      →  2500 ₵/$   (25% bonus)
#   vip      →  ~2857 ₵/$  (43% bonus — VIPs save the most)
COIN_PACKS = {
    "starter":  {"coins": 10_000,  "usd": 5.00,  "label": "Starter",  "bonus_pct": 0,  "popular": False},
    "popular":  {"coins": 20_000,  "usd": 9.00,  "label": "Popular",  "bonus_pct": 10, "popular": True},
    "pro":      {"coins": 50_000,  "usd": 20.00, "label": "Pro",      "bonus_pct": 25, "popular": False},
    "vip":      {"coins": 100_000, "usd": 35.00, "label": "VIP",      "bonus_pct": 43, "popular": False},
}


class CheckoutRequest(BaseModel):
    pack_id: str
    origin_url: str  # e.g. window.location.origin from the frontend


# ─────────────────────────────  Helpers  ─────────────────────────────
async def _resolve_user(authorization: Optional[str]) -> Optional[Dict[str, Any]]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None
    sess = await _db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    return await USERS.find_one(
        {"user_id": sess.get("user_id")},
        {"_id": 0, "password_hash": 0},
    )


# ─────────────────────────────  Public API  ─────────────────────────────
@router.get("/packs")
async def list_packs() -> Dict[str, Any]:
    """Public pack catalogue for the top-up modal."""
    packs = []
    for pid, p in COIN_PACKS.items():
        packs.append({
            "id": pid,
            "label": p["label"],
            "coins": p["coins"],
            "usd": p["usd"],
            "bonus_pct": p["bonus_pct"],
            "popular": p["popular"],
            # value_per_coin lets the UI flag "save X%" badges
            "value_per_coin_cents": round(p["usd"] * 100 / p["coins"], 3),
        })
    return {"packs": packs}


@router.post("/topup/checkout")
async def create_topup_checkout(
    payload: CheckoutRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """Create a Stripe checkout session for a coin pack."""
    user = await _resolve_user(authorization)
    if not user:
        raise HTTPException(401, "Sign in to top up")

    pack = COIN_PACKS.get(payload.pack_id)
    if not pack:
        raise HTTPException(400, f"Invalid pack_id. Choose from {list(COIN_PACKS)}")

    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest,
    )
    from config import STRIPE_API_KEY

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/coins/webhook/stripe"
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    success_url = f"{payload.origin_url.rstrip('/')}/wallet/topup-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{payload.origin_url.rstrip('/')}/wallet/topup-cancelled"

    metadata = {
        "kind": "coin_topup",
        "pack_id": payload.pack_id,
        "user_id": user["user_id"],
        "coins": str(pack["coins"]),
        "usd": str(pack["usd"]),
    }

    session = await sc.create_checkout_session(CheckoutSessionRequest(
        amount=pack["usd"], currency="usd",
        success_url=success_url, cancel_url=cancel_url,
        metadata=metadata,
    ))

    payment_id = f"coin_pay_{uuid.uuid4().hex[:12]}"
    await PAYMENTS.insert_one({
        "id": payment_id,
        "user_id": user["user_id"],
        "pack_id": payload.pack_id,
        "coins": pack["coins"],
        "amount_usd": pack["usd"],
        "stripe_session_id": session.session_id,
        "status": "pending",
        "credited": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "success": True,
        "checkout_url": session.url,
        "session_id": session.session_id,
        "pack": {**pack, "id": payload.pack_id},
    }


@router.get("/topup/status/{session_id}")
async def check_topup_status(session_id: str, request: Request) -> Dict[str, Any]:
    """Poll Stripe + reconcile coin credit on success."""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    from config import STRIPE_API_KEY

    host_url = str(request.base_url).rstrip("/")
    sc = StripeCheckout(
        api_key=STRIPE_API_KEY,
        webhook_url=f"{host_url}/api/coins/webhook/stripe",
    )
    status_resp = await sc.get_checkout_status(session_id)

    pay = await PAYMENTS.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not pay:
        return {"status": status_resp.payment_status, "credited": False, "reason": "unknown_session"}

    if pay.get("credited"):
        return {"status": "paid", "credited": True, "already": True, "coins": pay["coins"]}

    if status_resp.payment_status == "paid":
        await _credit_user(pay)
        return {"status": "paid", "credited": True, "coins": pay["coins"]}

    return {"status": status_resp.payment_status, "credited": False}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request) -> Dict[str, Any]:
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    from config import STRIPE_API_KEY

    host_url = str(request.base_url).rstrip("/")
    sc = StripeCheckout(
        api_key=STRIPE_API_KEY,
        webhook_url=f"{host_url}/api/coins/webhook/stripe",
    )
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        evt = await sc.handle_webhook(body, sig)
    except Exception as e:
        log.error(f"coin top-up stripe webhook parse failed: {e}")
        raise HTTPException(400, "invalid webhook")

    if (evt.event_type or "").endswith("checkout.session.completed") and evt.payment_status == "paid":
        pay = await PAYMENTS.find_one({"stripe_session_id": evt.session_id}, {"_id": 0})
        if pay and not pay.get("credited"):
            await _credit_user(pay)

    return {"received": True}


async def _credit_user(pay: Dict[str, Any]) -> None:
    """Atomically credit coins to the user and mark the payment paid."""
    now = datetime.now(timezone.utc).isoformat()
    # Atomic compare-and-set on the credited flag prevents double-crediting
    # if both the webhook and the polling status check race each other.
    result = await PAYMENTS.update_one(
        {"id": pay["id"], "credited": {"$ne": True}},
        {"$set": {"status": "paid", "credited": True, "paid_at": now}},
    )
    if result.modified_count == 0:
        return  # someone else got there first
    await USERS.update_one(
        {"user_id": pay["user_id"]},
        {"$inc": {"credits_balance": int(pay["coins"])}},
    )
    log.info(
        "coin_topup credited user_id=%s coins=%d pack=%s",
        pay["user_id"], pay["coins"], pay["pack_id"],
    )
