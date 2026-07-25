"""
Vibez Coin Top-Up (May 2026)
─────────────────────────────────────────────────────────────────
Buy Vibez Coins (₵) — canonical platform credit for JFTN, games, tips.

Preferred providers (in order):
  1. Solana deposit (frontend SolanaDepositPanel + indexer) — no card
  2. Helio / MoonPay Commerce — ONLY card rail (PCI via Helio embed)

Stripe is NOT used for coin top-up. Legacy ``/topup/checkout`` returns 410.

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
    from services.payment_beta_gate import payment_beta_public_status

    solana_ready = bool(
        os.environ.get("GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET")
        or os.environ.get("SOLANA_RECEIVE_WALLET")
    )
    paylink_id = os.environ.get("HELIO_PAYLINK_ID") or ""
    network = (os.environ.get("HELIO_NETWORK") or "main").strip().lower()
    if network not in ("test", "main"):
        network = "main"
    beta = payment_beta_public_status()
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
                "founding_member_required": beta["beta_mode"],
            },
            # Stripe deliberately omitted — Global Vibez does not use Stripe
            # for coin top-up. Card rail = Helio only.
        ],
        "environment": {
            "helio_network": network,
            "card_provider": "helio",
            "tls_required": True,
        },
        "beta_payment": beta,
    }


@router.post("/topup/helio")
async def create_helio_topup(
    payload: CheckoutRequest,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """Create a Helio (MoonPay Commerce) charge for a coin pack — the only card rail."""
    from services.helio_client import create_charge, helio_configured

    user = await _resolve_user(authorization)
    if not user:
        raise HTTPException(401, "Sign in to top up")

    from services.payment_beta_gate import require_payment_beta_access

    require_payment_beta_access(user)

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
        # create_charge already logged Helio's exact body/reason; surface it.
        log.error("helio topup create_charge raised: %s", exc)
        raise HTTPException(502, str(exc)) from exc

    paylink_id = os.environ.get("HELIO_PAYLINK_ID") or ""
    await PAYMENTS.insert_one({
        "id": payment_id,
        "user_id": user["user_id"],
        "pack_id": payload.pack_id,
        "coins": pack["coins"],
        "amount_usd": pack["usd"],
        "provider": "helio",
        "helio_charge_id": charge_id,
        "payment_request_id": paylink_id or None,
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
            metadata={
                "pack_id": payload.pack_id,
                "payment_id": payment_id,
                "helio_charge_id": charge_id,
                "payment_request_id": paylink_id or None,
            },
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
    """Helio / MoonPay Commerce payment webhook → credit coin pack.

    Security handshake: only Bearer ``HELIO_WEBHOOK_TOKEN`` or a valid
    ``x-helio-signature`` (HMAC-SHA256 of the raw body) is accepted.
    Spoofed POSTs are rejected with 401 and audited.
    """
    from services.helio_client import (
        extract_payment_meta,
        extract_webhook_signature,
        verify_webhook_signature,
    )
    from services.payments_audit import record_payment_event

    raw = await request.body()
    sig = extract_webhook_signature(request.headers)
    auth = request.headers.get("Authorization") or ""
    token = os.environ.get("HELIO_WEBHOOK_TOKEN") or ""

    # Never trust an unsigned payment event when a token is configured —
    # and never soft-pass in production (verify_webhook_signature fails closed).
    if token:
        bearer_ok = auth.lower().startswith("bearer ") and auth.split(" ", 1)[1].strip() == token
        if not bearer_ok and not verify_webhook_signature(raw, sig):
            log.warning(
                "helio webhook REJECTED — missing/invalid x-helio-signature "
                "(spoof attempt or misconfigured Helio dashboard)"
            )
            await record_payment_event(
                _db,
                kind="coin_topup",
                source="helio_webhook",
                status="rejected_signature",
                metadata={
                    "reason": "invalid_helio_webhook_auth",
                    "has_x_helio_signature": bool(sig),
                    "path": str(request.url.path),
                },
            )
            raise HTTPException(401, "invalid helio webhook auth")
    else:
        if not verify_webhook_signature(raw, sig):
            log.warning("helio webhook REJECTED — HELIO_WEBHOOK_TOKEN required")
            await record_payment_event(
                _db,
                kind="coin_topup",
                source="helio_webhook",
                status="rejected_signature",
                metadata={"reason": "helio_webhook_token_required"},
            )
            raise HTTPException(401, "helio webhook auth required")

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
    payment_request_id = meta.get("payment_request_id")
    transaction_hash = meta.get("transaction_hash")
    data_obj = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    charge_id = (
        payload.get("id")
        or payload.get("chargeId")
        or data_obj.get("id")
        or meta.get("helio_charge_id")
    )

    # Prefer matching on our payment_id; also accept Helio paymentRequestId
    # when the pending row stored it at charge-create time.
    pay = None
    if payment_id:
        pay = await PAYMENTS.find_one({"id": payment_id}, {"_id": 0})
    if not pay and charge_id:
        pay = await PAYMENTS.find_one({"helio_charge_id": str(charge_id)}, {"_id": 0})
    if not pay and payment_request_id:
        pay = await PAYMENTS.find_one(
            {"payment_request_id": str(payment_request_id)}, {"_id": 0}
        )

    if not pay:
        # Chair Vault Helio path — metadata.kind / payment_id prefix chair_*
        kind = str(meta.get("kind") or meta.get("purchase_type") or "").lower()
        looks_like_chair = kind == "chair_park" or (
            bool(payment_id) and str(payment_id).startswith("chair_")
        )
        if looks_like_chair or charge_id:
            try:
                from routes.chairs import activate_pending_chair_payment

                if transaction_hash:
                    from services.payment_idempotency import claim_tx_key  # noqa: PLC0415

                    claimed = await claim_tx_key(
                        _db,
                        rail="helio_chair",
                        tx_id=str(transaction_hash),
                        payment_id=str(payment_id) if payment_id else None,
                        meta={"charge_id": str(charge_id) if charge_id else None},
                    )
                    if not claimed:
                        return {
                            "received": True,
                            "credited": True,
                            "kind": "chair_park",
                            "already": True,
                            "reason": "tx_hash_already_processed",
                        }

                chair_result = await activate_pending_chair_payment(
                    _db,
                    payment_id=str(payment_id) if payment_id else None,
                    helio_charge_id=str(charge_id) if charge_id else None,
                    external_payment_id=str(
                        transaction_hash or charge_id or payment_id or ""
                    )
                    or None,
                    activated_via="helio_webhook",
                )
                if chair_result.get("ok"):
                    await record_payment_event(
                        _db,
                        kind="chair_park",
                        source="helio_webhook",
                        status="activated",
                        metadata={
                            "payment_id": chair_result.get("payment_id"),
                            "quantity": chair_result.get("quantity"),
                            "already_activated": chair_result.get(
                                "already_activated"
                            ),
                            "charge_id": str(charge_id) if charge_id else None,
                            "transaction_hash": transaction_hash,
                        },
                    )
                    return {
                        "received": True,
                        "credited": True,
                        "kind": "chair_park",
                        "payment_id": chair_result.get("payment_id"),
                        "already": bool(chair_result.get("already_activated")),
                    }
                if looks_like_chair:
                    log.warning(
                        "helio webhook: chair_park meta but no pending row "
                        "payment_id=%s charge=%s",
                        payment_id,
                        charge_id,
                    )
            except Exception as exc:
                log.exception("helio webhook chair_park activation failed: %s", exc)

        log.warning(
            "helio webhook: no matching payment meta=%s charge=%s payment_request_id=%s",
            meta,
            charge_id,
            payment_request_id,
        )
        await record_payment_event(
            _db,
            kind="coin_topup",
            source="helio_webhook",
            status="unknown_payment",
            metadata={
                "payment_request_id": payment_request_id,
                "transaction_hash": transaction_hash,
                "charge_id": str(charge_id) if charge_id else None,
            },
        )
        return {"received": True, "credited": False, "reason": "unknown_payment"}

    if pay.get("credited"):
        return {"received": True, "credited": True, "already": True}

    # Cross-rail idempotency — same Helio tx hash must never credit twice.
    if transaction_hash:
        from services.payment_idempotency import claim_tx_key  # noqa: PLC0415

        claimed = await claim_tx_key(
            _db,
            rail="helio",
            tx_id=str(transaction_hash),
            payment_id=pay.get("id"),
            user_id=pay.get("user_id"),
            meta={"charge_id": str(charge_id) if charge_id else None},
        )
        if not claimed:
            return {
                "received": True,
                "credited": True,
                "already": True,
                "reason": "tx_hash_already_processed",
                "payment_id": pay["id"],
            }

    await PAYMENTS.update_one(
        {"id": pay["id"]},
        {
            "$set": {
                "helio_webhook_event": event or "SUCCESS",
                "provider": "helio",
                "payment_request_id": payment_request_id
                or pay.get("payment_request_id"),
                "transaction_hash": transaction_hash,
            }
        },
    )
    # Stash ids on the in-memory pay dict so the audit row records them.
    pay["payment_request_id"] = payment_request_id or pay.get("payment_request_id")
    pay["transaction_hash"] = transaction_hash
    await _credit_user(pay, source="helio_webhook")
    return {
        "received": True,
        "credited": True,
        "payment_id": pay["id"],
        "payment_request_id": pay.get("payment_request_id"),
        "transaction_hash": transaction_hash,
    }


# Alias path from the Final Payment Test Protocol (/api/webhooks/helio).
# Same handler — Helio dashboard may be pointed at either URL.
helio_alias_router = APIRouter(tags=["coin-topup-webhooks"])


@helio_alias_router.post("/webhooks/helio")
async def helio_webhook_alias(request: Request) -> Dict[str, Any]:
    return await helio_webhook(request)


@router.post("/topup/checkout")
async def create_topup_checkout(
    payload: CheckoutRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    """Retired — Stripe is not used for coin top-up. Use Helio instead."""
    raise HTTPException(
        status_code=410,
        detail={
            "error": "stripe_retired",
            "message": (
                "Stripe checkout is not used. Pay with Helio (card) via "
                "POST /api/coins/topup/helio, or deposit Solana from the wallet."
            ),
            "use": "/api/coins/topup/helio",
        },
    )


@router.get("/topup/status/{session_id}")
async def check_topup_status(session_id: str, request: Request) -> Dict[str, Any]:
    """Retired — Stripe coin top-up status polling is no longer supported."""
    raise HTTPException(
        status_code=410,
        detail={
            "error": "stripe_retired",
            "message": (
                "Stripe coin checkout is retired. Pay with Helio (card) via "
                "POST /api/coins/topup/helio, or deposit Solana from the wallet."
            ),
            "use": "/api/coins/topup/helio",
        },
    )


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request) -> Dict[str, Any]:
    """Retired — Stripe coin top-up webhooks are no longer processed."""
    raise HTTPException(
        status_code=410,
        detail={
            "error": "stripe_retired",
            "message": (
                "Stripe coin checkout is retired. Pay with Helio (card) via "
                "POST /api/coins/topup/helio, or deposit Solana from the wallet."
            ),
            "use": "/api/coins/topup/helio",
        },
    )


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
                "payment_request_id": pay.get("payment_request_id"),
                "transaction_hash": pay.get("transaction_hash"),
                "status": "paid",
                "provider": pay.get("provider") or ("helio" if "helio" in source else "stripe"),
            },
        )
    except Exception:
        pass
