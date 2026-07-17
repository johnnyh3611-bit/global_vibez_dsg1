"""
Vibez Coin Top-Up (May 2026)
─────────────────────────────────────────────────────────────────
Buy Vibez Coins (₵) — canonical platform credit for JFTN, games, tips.

Preferred providers (in order):
  1. Solana deposit (frontend SolanaDepositPanel + indexer) — no card
  2. Helio / MoonPay Commerce — fiat card → crypto checkout
  3. Stripe — legacy card path (payment_hub stub may 503)

Coin packs (LOCKED — bigger packs reward bigger commitment):
  • ₵5,000   →  $5    starter   (1,000 ₵ / $1)
  • ₵10,000  →  $9    popular   (~11% bonus)
  • ₵25,000  →  $20   pro       (25% bonus)
  • ₵50,000  →  $35   vip       (~43% bonus)

On successful payment, ``users.credits_balance`` is incremented and
a row is written to ``coin_topup_payments`` for audit.
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
# Coin amounts scale with COINS_PER_USD = 1,000 (2026-05-18 founder
# ask: rate updated from 2,000 → 1,000 ₵/$ to roughly 2× per-coin value).
# Bigger packs reward bigger commitment via discounted ₵/$ rate:
#   starter  →  exactly 1000 ₵/$ (no discount)
#   popular  →  ~1111 ₵/$  (11% bonus)
#   pro      →  1250 ₵/$   (25% bonus)
#   vip      →  ~1429 ₵/$  (43% bonus — VIPs save the most)
COIN_PACKS = {
    "starter":  {"coins": 5_000,  "usd": 5.00,  "label": "Starter",  "bonus_pct": 0,  "popular": False},
    "popular":  {"coins": 10_000, "usd": 9.00,  "label": "Popular",  "bonus_pct": 11, "popular": True},
    "pro":      {"coins": 25_000, "usd": 20.00, "label": "Pro",      "bonus_pct": 25, "popular": False},
    "vip":      {"coins": 50_000, "usd": 35.00, "label": "VIP",      "bonus_pct": 43, "popular": False},
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


@router.get("/topup/providers")
async def list_topup_providers() -> Dict[str, Any]:
    """Which checkout rails are ready (no secrets)."""
    from services.helio_client import helio_configured

    stripe_ready = bool(
        os.environ.get("STRIPE_API_KEY") or os.environ.get("STRIPE_SECRET_KEY")
    )
    solana_ready = bool(
        os.environ.get("GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET")
        or os.environ.get("SOLANA_RECEIVE_WALLET")
    )
    paylink_id = os.environ.get("HELIO_PAYLINK_ID") or ""
    network = (os.environ.get("HELIO_NETWORK") or "main").strip().lower()
    if network not in ("test", "main"):
        network = "main"
    return {
        "providers": [
            {
                "id": "solana",
                "label": "Solana",
                "ready": solana_ready,
                "primary": True,
                "kind": "crypto_deposit",
            },
            {
                "id": "helio",
                "label": "Card via Helio",
                "ready": helio_configured(),
                "primary": False,
                "kind": "fiat_onramp",
                # Pay Link id is public (Helio embed uses it client-side).
                "paylink_id": paylink_id or None,
                "network": network,
                "embed": bool(paylink_id),
            },
            {
                "id": "stripe",
                "label": "Card (legacy)",
                "ready": stripe_ready,
                "primary": False,
                "kind": "card_legacy",
            },
        ]
    }


@router.post("/topup/helio")
async def create_helio_topup(
    payload: CheckoutRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """Create a Helio (MoonPay Commerce) charge for a coin pack — Stripe alternative."""
    from services.helio_client import create_charge, helio_configured

    user = await _resolve_user(authorization)
    if not user:
        raise HTTPException(401, "Sign in to top up")

    pack = COIN_PACKS.get(payload.pack_id)
    if not pack:
        raise HTTPException(400, f"Invalid pack_id. Choose from {list(COIN_PACKS)}")

    if not helio_configured():
        raise HTTPException(
            503,
            "Helio is not configured yet. Set HELIO_API_KEY, HELIO_SECRET_KEY, "
            "and HELIO_PAYLINK_ID — or pay with Solana from the wallet.",
        )

    payment_id = f"coin_pay_{uuid.uuid4().hex[:12]}"
    metadata = {
        "kind": "coin_topup",
        "payment_id": payment_id,
        "pack_id": payload.pack_id,
        "user_id": user["user_id"],
        "coins": pack["coins"],
        "usd": pack["usd"],
    }

    try:
        charge_id, checkout_url = await create_charge(
            amount_usd=float(pack["usd"]),
            metadata=metadata,
            card_only=True,
        )
    except RuntimeError as exc:
        raise HTTPException(502, str(exc)) from exc

    await PAYMENTS.insert_one({
        "id": payment_id,
        "user_id": user["user_id"],
        "pack_id": payload.pack_id,
        "coins": pack["coins"],
        "amount_usd": pack["usd"],
        "provider": "helio",
        "helio_charge_id": charge_id,
        "status": "pending",
        "credited": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "origin_url": payload.origin_url,
    })

    try:
        from services.payments_audit import record_payment_event  # noqa: PLC0415
        await record_payment_event(
            _db,
            kind="coin_topup",
            source="helio_checkout",
            status="created",
            user_id=user["user_id"],
            amount_usd=pack["usd"],
            coins=pack["coins"],
            metadata={"pack_id": payload.pack_id, "payment_id": payment_id, "helio_charge_id": charge_id},
        )
    except Exception:
        pass

    return {
        "success": True,
        "provider": "helio",
        "checkout_url": checkout_url,
        "charge_id": charge_id,
        "payment_id": payment_id,
        "pack": {**pack, "id": payload.pack_id},
    }


@router.post("/webhook/helio")
async def helio_webhook(request: Request) -> Dict[str, Any]:
    """Helio / MoonPay Commerce payment webhook → credit coin pack."""
    from services.helio_client import extract_payment_meta, verify_webhook_signature

    raw = await request.body()
    sig = request.headers.get("X-Signature") or request.headers.get("x-signature")
    auth = request.headers.get("Authorization") or ""
    token = os.environ.get("HELIO_WEBHOOK_TOKEN") or ""

    if token:
        bearer_ok = auth.lower().startswith("bearer ") and auth.split(" ", 1)[1].strip() == token
        if not bearer_ok and not verify_webhook_signature(raw, sig):
            raise HTTPException(401, "invalid helio webhook auth")
    elif sig and not verify_webhook_signature(raw, sig):
        raise HTTPException(401, "invalid helio webhook signature")

    try:
        import json as _json
        payload = _json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        raise HTTPException(400, "invalid json")

    # Helio fires on several event names; credit on SUCCESS / COMPLETED styles.
    event = str(
        payload.get("event")
        or payload.get("eventType")
        or payload.get("status")
        or payload.get("transactionStatus")
        or ""
    ).upper()
    success_markers = ("SUCCESS", "COMPLETED", "PAID", "SETTLED", "CONFIRMED")
    if event and not any(m in event for m in success_markers):
        # Still try to credit if metadata is present and transaction looks paid
        tx_status = str(payload.get("transaction", {}).get("status", "")).upper() if isinstance(payload.get("transaction"), dict) else ""
        if not any(m in tx_status for m in success_markers):
            return {"received": True, "credited": False, "reason": f"ignored_event:{event or 'unknown'}"}

    meta = extract_payment_meta(payload if isinstance(payload, dict) else {})
    payment_id = meta.get("payment_id")
    data_obj = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    charge_id = (
        payload.get("id")
        or payload.get("chargeId")
        or data_obj.get("id")
        or meta.get("helio_charge_id")
    )

    pay = None
    if payment_id:
        pay = await PAYMENTS.find_one({"id": payment_id}, {"_id": 0})
    if not pay and charge_id:
        pay = await PAYMENTS.find_one({"helio_charge_id": str(charge_id)}, {"_id": 0})

    if not pay:
        log.warning("helio webhook: no matching payment meta=%s charge=%s", meta, charge_id)
        return {"received": True, "credited": False, "reason": "unknown_payment"}

    if pay.get("credited"):
        return {"received": True, "credited": True, "already": True}

    await PAYMENTS.update_one(
        {"id": pay["id"]},
        {"$set": {"helio_webhook_event": event or "SUCCESS", "provider": "helio"}},
    )
    await _credit_user(pay, source="helio_webhook")
    return {"received": True, "credited": True, "payment_id": pay["id"]}


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

    from services.payment_hub import (
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

    # Unified payments audit — best-effort, never fails the checkout.
    try:
        from services.payments_audit import record_payment_event  # noqa: PLC0415
        await record_payment_event(
            _db,
            kind="coin_topup",
            source="stripe_checkout",
            status="created",
            user_id=user["user_id"],
            amount_usd=pack["usd"],
            coins=pack["coins"],
            stripe_session_id=session.session_id,
            metadata={"pack_id": payload.pack_id, "payment_id": payment_id},
        )
    except Exception:
        pass

    return {
        "success": True,
        "checkout_url": session.url,
        "session_id": session.session_id,
        "pack": {**pack, "id": payload.pack_id},
    }


@router.get("/topup/status/{session_id}")
async def check_topup_status(session_id: str, request: Request) -> Dict[str, Any]:
    """Poll Stripe + reconcile coin credit on success."""
    from services.payment_hub import StripeCheckout
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
    from services.payment_hub import StripeCheckout
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


async def _credit_user(pay: Dict[str, Any], source: str = "stripe_webhook") -> None:
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
        "coin_topup credited user_id=%s coins=%d pack=%s source=%s",
        pay["user_id"], pay["coins"], pay["pack_id"], source,
    )
    # Unified payments audit — paid + credited event.
    try:
        from services.payments_audit import record_payment_event  # noqa: PLC0415
        await record_payment_event(
            _db,
            kind="coin_topup",
            source=source,
            status="credited",
            user_id=pay["user_id"],
            amount_usd=pay.get("amount_usd"),
            coins=int(pay["coins"]),
            stripe_session_id=pay.get("stripe_session_id"),
            metadata={
                "pack_id": pay.get("pack_id"),
                "payment_id": pay.get("id"),
                "helio_charge_id": pay.get("helio_charge_id"),
                "provider": pay.get("provider") or ("helio" if "helio" in source else "stripe"),
            },
        )
    except Exception:
        pass
