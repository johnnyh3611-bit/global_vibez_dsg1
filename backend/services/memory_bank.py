"""
Vibe Memory Bank — v6.5 Phase 4.

Source: Global_Vibez_OMNI_MASTER_v6_5.pdf §Memory Bank.

Digital cinema marketplace where users purchase movies / exclusive video
content. Files are LOCKED to the buyer's account (anti-piracy).

Mechanics:
  - 70% to creator, 30% to platform on every sale
  - On buy → MemoryBankLicense issued, locked to buyer_id
  - Playback URL is a short-lived signed link that includes the license_id
    so the same URL handed to a different account is rejected
  - License lifecycle: ACTIVE → optionally REVOKED (chargeback) — never EXPIRED
    (lifetime ownership per founder spec)

Deterministic, dependency-free engine. DB persistence wired via the
HTTP route layer.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional

from services.pricing_master_vault import SOVEREIGN_TAX_RATE


MEMORY_BANK_CREATOR_SHARE: float = 0.70
MEMORY_BANK_PLATFORM_SHARE: float = 0.30
PLAYBACK_URL_TTL_SECONDS: int = 3600   # 1 hour signed URLs

# Internal HMAC secret for signed playback URLs (NOT a JWT secret —
# this is a separate non-auth signing key scoped to the Memory Bank).
# In production this would be loaded from env; for v6.5 Phase 4 we
# derive it deterministically per-process.
_PLAYBACK_SIGNING_KEY: bytes = secrets.token_bytes(32)


# ──────────────────────────────────────────────────────────────────────────
# 1. CONTENT REGISTRY
# ──────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class MemoryBankContent:
    content_id: str
    creator_id: str
    title: str
    price: float                    # $ at point of sale
    duration_minutes: int
    genre: str
    rating: str = "PG-13"           # "G" | "PG" | "PG-13" | "R" | "NC-17"
    cover_art_url: Optional[str] = None
    is_active: bool = True


# ──────────────────────────────────────────────────────────────────────────
# 2. SALE / LICENSE
# ──────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class MemoryBankLicense:
    license_id: str
    content_id: str
    buyer_id: str
    purchased_at: str
    purchase_price: float
    creator_payout: float
    platform_share: float
    sovereign_tax: float
    status: Literal["ACTIVE", "REVOKED"] = "ACTIVE"

    def to_dict(self) -> Dict:
        return asdict(self)


def settle_memory_bank_sale(
    content: MemoryBankContent, buyer_id: str,
) -> MemoryBankLicense:
    """Run the 70/30 split + Sovereign Tax + issue a license bound to the
    buyer. The license is the SOLE thing that grants playback access."""
    if not content.is_active:
        raise ValueError("content is no longer for sale")
    if content.price <= 0:
        raise ValueError("content price must be positive")
    if not buyer_id:
        raise ValueError("buyer_id required")

    gross = content.price
    creator_payout = round(gross * MEMORY_BANK_CREATOR_SHARE, 4)
    platform_share = round(gross * MEMORY_BANK_PLATFORM_SHARE, 4)
    sovereign_tax = round(gross * SOVEREIGN_TAX_RATE, 4)

    return MemoryBankLicense(
        license_id=str(uuid.uuid4()),
        content_id=content.content_id,
        buyer_id=buyer_id,
        purchased_at=datetime.now(timezone.utc).isoformat(),
        purchase_price=gross,
        creator_payout=creator_payout,
        platform_share=platform_share,
        sovereign_tax=sovereign_tax,
    )


# ──────────────────────────────────────────────────────────────────────────
# 3. DRM — signed playback URLs
# ──────────────────────────────────────────────────────────────────────────
def _sign_payload(payload: str) -> str:
    sig = hmac.new(_PLAYBACK_SIGNING_KEY, payload.encode("utf-8"), hashlib.sha256)
    return sig.hexdigest()


def issue_playback_url(license: MemoryBankLicense, base_url: str) -> Dict:
    """Generate a short-lived URL that a player can hit to stream.
    The URL contains the license_id, the buyer_id, and an expiration
    timestamp. Tampering with any of these voids the signature.

    NOTE: the ISO timestamp uses 'Z' (UTC) instead of '+00:00' because the
    `+` character is URL-decoded to a space and would break HMAC validation.
    """
    if license.status != "ACTIVE":
        raise ValueError(f"license is {license.status}, cannot issue playback URL")
    expires_dt = datetime.now(timezone.utc) + timedelta(seconds=PLAYBACK_URL_TTL_SECONDS)
    expires = expires_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = f"{license.license_id}|{license.buyer_id}|{license.content_id}|{expires}"
    signature = _sign_payload(payload)
    url = (
        f"{base_url.rstrip('/')}/api/memory-bank/play"
        f"?lid={license.license_id}&buyer={license.buyer_id}"
        f"&cid={license.content_id}&exp={expires}&sig={signature}"
    )
    return {
        "url": url,
        "license_id": license.license_id,
        "expires_at": expires,
        "ttl_seconds": PLAYBACK_URL_TTL_SECONDS,
    }


def verify_playback_request(
    license_id: str, buyer_id: str, content_id: str,
    expires: str, signature: str, requesting_user_id: str,
) -> Dict:
    """Validate a playback URL hit. Returns {ok: bool, reason: str}."""
    payload = f"{license_id}|{buyer_id}|{content_id}|{expires}"
    expected = _sign_payload(payload)
    if not hmac.compare_digest(expected, signature):
        return {"ok": False, "reason": "signature_invalid"}
    try:
        # Accept Z-suffix UTC ('2026-05-04T23:42:01Z') or +00:00 form.
        norm = expires.replace("Z", "+00:00")
        exp_dt = datetime.fromisoformat(norm)
    except ValueError:
        return {"ok": False, "reason": "exp_malformed"}
    if datetime.now(timezone.utc) > exp_dt:
        return {"ok": False, "reason": "expired"}
    if requesting_user_id != buyer_id:
        return {"ok": False, "reason": "license_belongs_to_another_user"}
    return {"ok": True, "reason": "valid"}


# ──────────────────────────────────────────────────────────────────────────
# 4. LIBRARY queries
# ──────────────────────────────────────────────────────────────────────────
def filter_user_library(
    licenses: List[MemoryBankLicense], user_id: str,
) -> List[MemoryBankLicense]:
    """Return all ACTIVE licenses owned by user_id."""
    return [
        lic for lic in licenses
        if lic.buyer_id == user_id and lic.status == "ACTIVE"
    ]


__all__ = [
    "MEMORY_BANK_CREATOR_SHARE", "MEMORY_BANK_PLATFORM_SHARE",
    "PLAYBACK_URL_TTL_SECONDS",
    "MemoryBankContent", "MemoryBankLicense",
    "settle_memory_bank_sale",
    "issue_playback_url", "verify_playback_request",
    "filter_user_library",
]
