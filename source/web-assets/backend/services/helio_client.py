"""
Helio (MoonPay Commerce) client — fiat/crypto checkout for coin packs.

You (the operator) create the Helio merchant account and keys.
Code here only calls Helio once HELIO_* env vars are on Railway.

Docs: https://docs.hel.io/reference/charge/create
      https://docs.hel.io/docs/webhooks
      https://docs.hel.io/llms.txt  (prod vs dev API hosts)

Auth (OpenAPI POST /v1/charge/api-key):
  Query:  apiKey=<HELIO_API_KEY>          (public key)
  Header: Authorization: Bearer <HELIO_SECRET_KEY>
  Body:   paymentRequestId (= HELIO_PAYLINK_ID), requestAmount, …

Hosts:
  Production keys → https://api.hel.io/v1   (dashboard: moonpay.hel.io)
  Dev/test keys   → https://api.dev.hel.io/v1 (dashboard: moonpay.dev.hel.io)
  Override either with HELIO_API_BASE. When unset, HELIO_NETWORK=test|dev|devnet
  selects the dev host automatically.

Env (all required for live charges):
  HELIO_API_KEY       — public API key (query param apiKey)
  HELIO_SECRET_KEY    — secret / bearer token
  HELIO_PAYLINK_ID    — dynamic Pay Link id used as paymentRequestId
  HELIO_WEBHOOK_TOKEN — sharedToken from Helio webhook setup (optional verify)
  HELIO_NETWORK       — main|test (selects default API host when HELIO_API_BASE unset)
  HELIO_API_BASE      — optional full base URL override
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
from typing import Any, Dict, Optional, Tuple

import httpx

log = logging.getLogger(__name__)

_PROD_API_BASE = "https://api.hel.io/v1"
_DEV_API_BASE = "https://api.dev.hel.io/v1"
_SENSITIVE_RE = re.compile(
    r"(api[_-]?key|authorization|bearer|secret|token)\s*[:=]\s*\S+",
    re.IGNORECASE,
)


def _env_strip(name: str) -> str:
    """Read env var, strip whitespace and accidental surrounding quotes."""
    val = (os.environ.get(name) or "").strip()
    if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
        val = val[1:-1].strip()
    return val


def resolve_helio_api_base() -> str:
    """Resolve Helio API base at call time (not import time).

    Prefer HELIO_API_BASE when set. Otherwise map HELIO_NETWORK to the
    correct MoonPay Commerce host so test keys are not sent to prod.
    """
    explicit = _env_strip("HELIO_API_BASE").rstrip("/")
    if explicit:
        return explicit
    network = _env_strip("HELIO_NETWORK").lower() or "main"
    if network in ("test", "dev", "devnet", "sandbox"):
        return _DEV_API_BASE
    return _PROD_API_BASE


def helio_configured() -> bool:
    return bool(
        _env_strip("HELIO_API_KEY")
        and _env_strip("HELIO_SECRET_KEY")
        and _env_strip("HELIO_PAYLINK_ID")
    )


def helio_status() -> Dict[str, Any]:
    network = _env_strip("HELIO_NETWORK").lower() or "main"
    api_base = resolve_helio_api_base()
    return {
        "configured": helio_configured(),
        "api_key_present": bool(_env_strip("HELIO_API_KEY")),
        "secret_present": bool(_env_strip("HELIO_SECRET_KEY")),
        "paylink_present": bool(_env_strip("HELIO_PAYLINK_ID")),
        "webhook_token_present": bool(_env_strip("HELIO_WEBHOOK_TOKEN")),
        "network": network,
        "api_base": api_base,
        "api_base_is_dev": "api.dev.hel.io" in api_base,
        "provider": "helio",
        "docs": "https://docs.hel.io/docs/for-developers",
        "auth": {
            "query_param": "apiKey",
            "header": "Authorization: Bearer <HELIO_SECRET_KEY>",
            "endpoint": "POST {api_base}/charge/api-key",
        },
    }


def _redact_secrets(text: str) -> str:
    """Best-effort scrub of key-looking substrings before logging / surfacing."""
    if not text:
        return text
    scrubbed = _SENSITIVE_RE.sub(r"\1=<redacted>", text)
    for secret_name in ("HELIO_API_KEY", "HELIO_SECRET_KEY", "HELIO_WEBHOOK_TOKEN"):
        secret = _env_strip(secret_name)
        if secret and len(secret) >= 8 and secret in scrubbed:
            scrubbed = scrubbed.replace(secret, "<redacted>")
    return scrubbed


def _fingerprint(value: str, *, keep: int = 4) -> str:
    if not value:
        return "missing"
    if len(value) <= keep:
        return f"len={len(value)}"
    return f"len={len(value)} …{value[-keep:]}"


def _parse_helio_error_body(resp: httpx.Response) -> Dict[str, Any]:
    """Extract Helio's structured error fields when present."""
    raw = (resp.text or "")[:2000]
    out: Dict[str, Any] = {
        "status_code": resp.status_code,
        "raw_body": raw,
        "message": "",
        "error_code": "",
        "error_type": "",
    }
    try:
        data = resp.json()
    except Exception:
        return out
    if not isinstance(data, dict):
        return out
    out["message"] = str(
        data.get("message")
        or data.get("error")
        or data.get("errorMessage")
        or data.get("detail")
        or ""
    )
    out["error_code"] = str(
        data.get("errorCode") or data.get("code") or ""
    )
    out["error_type"] = str(data.get("errorType") or data.get("type") or "")
    return out


def _format_helio_failure(resp: httpx.Response, *, api_base: str) -> str:
    """Human-readable failure for logs and RuntimeError (no secrets)."""
    parsed = _parse_helio_error_body(resp)
    parts = [f"Helio charge failed ({resp.status_code})"]
    if parsed["message"]:
        parts.append(str(parsed["message"]))
    extras = []
    if parsed["error_code"]:
        extras.append(f"errorCode={parsed['error_code']}")
    if parsed["error_type"]:
        extras.append(f"errorType={parsed['error_type']}")
    extras.append(f"api_base={api_base}")
    if extras:
        parts.append(f"[{', '.join(extras)}]")
    # Include truncated body when Helio returned no message field
    if not parsed["message"] and parsed["raw_body"]:
        parts.append(f"body={_redact_secrets(parsed['raw_body'][:400])}")
    return " — ".join(parts[:2]) + ((" " + parts[2]) if len(parts) > 2 else "")


async def create_charge(
    *,
    amount_usd: float,
    metadata: Dict[str, Any],
    card_only: bool = True,
) -> Tuple[str, str]:
    """
    Create a one-time Helio charge. Returns (charge_id, checkout_url).

    Raises RuntimeError if not configured or Helio returns an error.
    On HTTP errors (esp. 401), logs Helio's exact response body/reason and
    includes a sanitized reason in the raised message.
    """
    if not helio_configured():
        raise RuntimeError(
            "Helio is not configured. Set HELIO_API_KEY, HELIO_SECRET_KEY, "
            "and HELIO_PAYLINK_ID on the backend."
        )

    api_key = _env_strip("HELIO_API_KEY")
    secret = _env_strip("HELIO_SECRET_KEY")
    paylink_id = _env_strip("HELIO_PAYLINK_ID")
    api_base = resolve_helio_api_base()
    network = _env_strip("HELIO_NETWORK").lower() or "main"

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

    # OpenAPI: POST /v1/charge/api-key?apiKey=… + Authorization: Bearer <secret>
    url = f"{api_base}/charge/api-key"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {secret}",
    }
    params = {"apiKey": api_key}

    log.info(
        "helio create_charge request url=%s network=%s api_key=%s secret=%s "
        "paylink=%s amount_usd=%s auth_header=Authorization:Bearer",
        url,
        network,
        _fingerprint(api_key),
        _fingerprint(secret),
        _fingerprint(paylink_id),
        f"{amount_usd:.2f}",
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, params=params, json=body)
    except httpx.TimeoutException as exc:
        log.error(
            "helio create_charge TIMEOUT url=%s network=%s error=%s",
            url,
            network,
            exc,
        )
        raise RuntimeError(
            f"Helio charge failed (timeout) contacting {api_base}"
        ) from exc
    except httpx.HTTPError as exc:
        log.error(
            "helio create_charge TRANSPORT_ERROR url=%s network=%s error=%s",
            url,
            network,
            exc,
        )
        raise RuntimeError(
            f"Helio charge failed (transport) contacting {api_base}: {exc}"
        ) from exc

    if resp.status_code >= 400:
        parsed = _parse_helio_error_body(resp)
        # Detailed catch-style logging for ops (401 body is the usual smoking gun)
        log.error(
            "helio create_charge FAILED status=%s reason=%r errorCode=%s "
            "errorType=%s api_base=%s network=%s www_authenticate=%r "
            "content_type=%r body=%s",
            resp.status_code,
            parsed["message"] or None,
            parsed["error_code"] or None,
            parsed["error_type"] or None,
            api_base,
            network,
            resp.headers.get("www-authenticate"),
            resp.headers.get("content-type"),
            _redact_secrets(parsed["raw_body"]),
        )
        if resp.status_code == 401 and network in ("test", "dev", "devnet", "sandbox"):
            if "api.dev.hel.io" not in api_base:
                log.error(
                    "helio create_charge HINT: HELIO_NETWORK=%s but api_base=%s — "
                    "dev/test keys must hit https://api.dev.hel.io/v1 "
                    "(set HELIO_API_BASE or rely on HELIO_NETWORK fallback)",
                    network,
                    api_base,
                )
        elif resp.status_code == 401 and "api.dev.hel.io" in api_base:
            log.error(
                "helio create_charge HINT: calling DEV host with keys that may "
                "belong to production (moonpay.hel.io). Rotate keys from the "
                "matching dashboard."
            )
        raise RuntimeError(_format_helio_failure(resp, api_base=api_base))

    try:
        data = resp.json()
    except Exception as exc:
        log.error(
            "helio create_charge INVALID_JSON status=%s body=%s",
            resp.status_code,
            _redact_secrets((resp.text or "")[:500]),
        )
        raise RuntimeError(
            "Helio charge response was not valid JSON"
        ) from exc

    charge_id = str(data.get("id") or "")
    page_url = str(data.get("pageUrl") or data.get("url") or "")
    if not page_url:
        log.error(
            "helio create_charge missing pageUrl keys=%s body=%s",
            list(data.keys()) if isinstance(data, dict) else type(data).__name__,
            _redact_secrets(json.dumps(data)[:500]) if isinstance(data, dict) else "",
        )
        raise RuntimeError("Helio charge response missing pageUrl")

    if card_only and "cardonly=" not in page_url:
        sep = "&" if "?" in page_url else "?"
        page_url = f"{page_url}{sep}cardonly=true"

    log.info(
        "helio create_charge OK charge_id=%s page_url_host=%s",
        charge_id or "<empty>",
        page_url.split("/")[2] if "://" in page_url else "?",
    )
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


def extract_webhook_signature(headers: Any) -> Optional[str]:
    """Pull Helio signature from common header names.

    Protocol requires ``x-helio-signature``; we also accept legacy
    ``X-Signature`` / ``x-signature`` used by earlier Helio docs.
    """
    if headers is None:
        return None
    for key in (
        "x-helio-signature",
        "X-Helio-Signature",
        "X-Signature",
        "x-signature",
    ):
        try:
            val = headers.get(key)
        except Exception:
            val = None
        if val:
            return str(val).strip()
    return None


def verify_webhook_signature(raw_body: bytes, signature: Optional[str]) -> bool:
    """HMAC-SHA256 of body with HELIO_WEBHOOK_TOKEN.

    Soft-pass only allowed in non-production when the token is unset.
    Production always requires a configured token + valid signature.
    """
    token = _env_strip("HELIO_WEBHOOK_TOKEN")
    if not token:
        if _require_webhook_auth():
            log.error("HELIO_WEBHOOK_TOKEN unset — refusing webhook in production")
            return False
        return True  # local/dev soft verify until token is provisioned
    if not signature:
        return False
    # Accept raw hex or ``sha256=<hex>`` style
    sig = signature.strip()
    if sig.lower().startswith("sha256="):
        sig = sig.split("=", 1)[1].strip()
    digest = hmac.new(token.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, sig)


def extract_payment_meta(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Best-effort extract of our metadata from Helio webhook shapes."""
    meta: Dict[str, Any] = {}

    # Direct fields + Helio payment_request_id / tx identifiers
    for key in (
        "payment_id",
        "pack_id",
        "user_id",
        "coins",
        "paymentRequestId",
        "payment_request_id",
        "transactionSignature",
        "transaction_signature",
        "txHash",
        "tx_hash",
        "transactionHash",
        "transaction_hash",
    ):
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
        for key in (
            "payment_id",
            "pack_id",
            "user_id",
            "coins",
            "paymentRequestId",
            "payment_request_id",
            "transactionSignature",
            "txHash",
            "transactionHash",
        ):
            if key in cand and key not in meta:
                meta[key] = cand[key]

    # Normalize aliases used by the Final Payment Test Protocol
    pr_id = (
        meta.get("payment_request_id")
        or meta.get("paymentRequestId")
        or payload.get("paymentRequestId")
        or payload.get("payment_request_id")
    )
    if pr_id:
        meta["payment_request_id"] = str(pr_id)

    tx_hash = (
        meta.get("transaction_hash")
        or meta.get("transactionHash")
        or meta.get("tx_hash")
        or meta.get("txHash")
        or meta.get("transaction_signature")
        or meta.get("transactionSignature")
    )
    # Nested transaction object
    tx_obj = payload.get("transaction") if isinstance(payload.get("transaction"), dict) else {}
    if not tx_hash and tx_obj:
        tx_hash = (
            tx_obj.get("signature")
            or tx_obj.get("transactionSignature")
            or tx_obj.get("txHash")
            or tx_obj.get("hash")
        )
    if not pr_id and tx_obj.get("paymentRequestId"):
        meta["payment_request_id"] = str(tx_obj["paymentRequestId"])
    if tx_hash:
        meta["transaction_hash"] = str(tx_hash)

    return meta
