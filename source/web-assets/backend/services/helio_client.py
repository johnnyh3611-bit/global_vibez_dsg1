"""
Helio (MoonPay Commerce) client — fiat/crypto checkout for coin packs.

You (the operator) create the Helio merchant account and keys.
Code here only calls Helio once HELIO_* env vars are on Railway.

Docs: https://docs.hel.io/reference/charge/create
      https://docs.hel.io/docs/webhooks

Env (all required for live charges):
  HELIO_API_KEY       — public API key (query param)
  HELIO_SECRET_KEY    — secret / bearer token
  HELIO_PAYLINK_ID    — dynamic Pay Link id used as paymentRequestId
  HELIO_WEBHOOK_TOKEN — sharedToken from Helio webhook setup (optional verify)
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from typing import Any, Dict, Optional, Tuple

import httpx

log = logging.getLogger(__name__)

HELIO_API_BASE = os.environ.get("HELIO_API_BASE", "https://api.hel.io/v1").rstrip("/")


def helio_configured() -> bool:
    return bool(
        os.environ.get("HELIO_API_KEY")
        and os.environ.get("HELIO_SECRET_KEY")
        and os.environ.get("HELIO_PAYLINK_ID")
    )


def helio_status() -> Dict[str, Any]:
    return {
        "configured": helio_configured(),
        "api_key_present": bool(os.environ.get("HELIO_API_KEY")),
        "secret_present": bool(os.environ.get("HELIO_SECRET_KEY")),
        "paylink_present": bool(os.environ.get("HELIO_PAYLINK_ID")),
        "webhook_token_present": bool(os.environ.get("HELIO_WEBHOOK_TOKEN")),
        "provider": "helio",
        "docs": "https://docs.hel.io/docs/for-developers",
    }


async def create_charge(
    *,
    amount_usd: float,
    metadata: Dict[str, Any],
    card_only: bool = True,
) -> Tuple[str, str]:
    """
    Create a one-time Helio charge. Returns (charge_id, checkout_url).

    Raises RuntimeError if not configured or Helio returns an error.
    """
    if not helio_configured():
        raise RuntimeError(
            "Helio is not configured. Set HELIO_API_KEY, HELIO_SECRET_KEY, "
            "and HELIO_PAYLINK_ID on the backend."
        )

    api_key = os.environ["HELIO_API_KEY"]
    secret = os.environ["HELIO_SECRET_KEY"]
    paylink_id = os.environ["HELIO_PAYLINK_ID"]

    # additionalJSON must be a string per Helio docs
    additional = json.dumps(metadata)

    body = {
        "paymentRequestId": paylink_id,
        "requestAmount": f"{amount_usd:.2f}",
        "prepareRequestBody": {
            "customerDetails": {
                "additionalJSON": additional,
            }
        },
    }

    url = f"{HELIO_API_BASE}/charge/api-key"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {secret}",
    }
    params = {"apiKey": api_key}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, params=params, json=body)

    if resp.status_code >= 400:
        log.error("helio create_charge failed status=%s body=%s", resp.status_code, resp.text[:500])
        raise RuntimeError(f"Helio charge failed ({resp.status_code})")

    data = resp.json()
    charge_id = str(data.get("id") or "")
    page_url = str(data.get("pageUrl") or data.get("url") or "")
    if not page_url:
        raise RuntimeError("Helio charge response missing pageUrl")

    if card_only and "cardonly=" not in page_url:
        sep = "&" if "?" in page_url else "?"
        page_url = f"{page_url}{sep}cardonly=true"

    return charge_id, page_url


def _require_webhook_auth() -> bool:
    """Fail closed in production (or when PAYMENTS_REQUIRE_WEBHOOK_AUTH=1)."""
    force = (os.environ.get("PAYMENTS_REQUIRE_WEBHOOK_AUTH") or "").strip().lower()
    if force in ("1", "true", "yes", "on"):
        return True
    if force in ("0", "false", "no", "off"):
        return False
    env = (os.environ.get("ENVIRONMENT") or os.environ.get("ENV") or "").strip().lower()
    return env in ("production", "prod", "live")


def verify_webhook_signature(raw_body: bytes, signature: Optional[str]) -> bool:
    """HMAC-SHA256 of body with HELIO_WEBHOOK_TOKEN.

    Soft-pass only allowed in non-production when the token is unset.
    Production always requires a configured token + valid signature.
    """
    token = os.environ.get("HELIO_WEBHOOK_TOKEN") or ""
    if not token:
        if _require_webhook_auth():
            log.error("HELIO_WEBHOOK_TOKEN unset — refusing webhook in production")
            return False
        return True  # local/dev soft verify until token is provisioned
    if not signature:
        return False
    digest = hmac.new(token.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


def extract_payment_meta(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Best-effort extract of our metadata from Helio webhook shapes."""
    meta: Dict[str, Any] = {}

    # Direct fields
    for key in ("payment_id", "pack_id", "user_id", "coins"):
        if key in payload:
            meta[key] = payload[key]

    # Nested customerDetails.additionalJSON (string or object)
    candidates = [
        payload.get("customerDetails"),
        payload.get("data", {}).get("customerDetails") if isinstance(payload.get("data"), dict) else None,
        payload.get("transaction", {}).get("customerDetails") if isinstance(payload.get("transaction"), dict) else None,
        payload.get("meta"),
        payload.get("metadata"),
    ]
    for cand in candidates:
        if not isinstance(cand, dict):
            continue
        raw = cand.get("additionalJSON") or cand.get("additionalJson")
        if isinstance(raw, str) and raw.strip():
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    meta.update(parsed)
            except json.JSONDecodeError:
                pass
        elif isinstance(raw, dict):
            meta.update(raw)
        for key in ("payment_id", "pack_id", "user_id", "coins"):
            if key in cand and key not in meta:
                meta[key] = cand[key]

    return meta
