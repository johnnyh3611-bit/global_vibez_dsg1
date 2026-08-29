"""
Founding Member / payment beta rollout gate.

When ``PAYMENT_BETA_MODE=1`` (or ``true``), fiat/card checkout endpoints
only accept a small cohort so live wallet credits can be verified
before opening payments to 100% of beta users.

Allow if ANY of:
  • user email or user_id is in ``PAYMENT_BETA_ALLOWLIST`` (comma-separated)
  • user has ``is_beta_tester`` / ``is_founding_member`` / active founders pass
  • user is admin (``is_admin`` or founder email via admin_guard)

Solana crypto deposits are NOT gated — they don't touch card rails.
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional, Set

from fastapi import HTTPException


def payment_beta_mode_enabled() -> bool:
    raw = (os.environ.get("PAYMENT_BETA_MODE") or "").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    # Default: gate card rails in production until explicitly opened.
    env = (os.environ.get("ENVIRONMENT") or os.environ.get("ENV") or "").strip().lower()
    return env in ("production", "prod", "live")


def payment_support_email() -> str:
    return (
        os.environ.get("PAYMENT_SUPPORT_EMAIL")
        or os.environ.get("SUPPORT_EMAIL")
        or "payments-beta@globalvibezdsg.com"
    ).strip()


def payment_support_discord() -> str:
    return (
        os.environ.get("PAYMENT_SUPPORT_DISCORD")
        or os.environ.get("SUPPORT_DISCORD_URL")
        or "https://discord.gg/globalvibez"
    ).strip()


def _allowlist() -> Set[str]:
    raw = os.environ.get("PAYMENT_BETA_ALLOWLIST") or ""
    return {p.strip().lower() for p in raw.split(",") if p.strip()}


def user_is_payment_beta_allowed(user: Optional[Dict[str, Any]]) -> bool:
    if not user:
        return False

    allow = _allowlist()
    email = str(user.get("email") or "").strip().lower()
    uid = str(user.get("user_id") or user.get("id") or "").strip().lower()
    if email and email in allow:
        return True
    if uid and uid in allow:
        return True

    if user.get("is_beta_tester") or user.get("is_founding_member"):
        return True
    if user.get("founders_pass_active") or user.get("founders_pass_tier"):
        return True
    if user.get("is_admin") or user.get("role") == "admin":
        return True

    # Founder emails — same convention as admin_guard
    if email.endswith("@globalvibez.com") or email.endswith("@globalvibezdsg.com"):
        return True

    return False


def require_payment_beta_access(user: Optional[Dict[str, Any]]) -> None:
    """Raise 403 if card/fiat checkout is beta-gated and user is outside cohort."""
    if not payment_beta_mode_enabled():
        return
    if user_is_payment_beta_allowed(user):
        return
    raise HTTPException(
        status_code=403,
        detail={
            "error": "payment_beta_restricted",
            "message": (
                "Helio card payments are limited to Founding Members during the "
                "Beta Payment Environment. Solana deposits remain open for everyone."
            ),
            "support_email": payment_support_email(),
            "support_discord": payment_support_discord(),
        },
    )


def require_open_market_beta_access(user: Optional[Dict[str, Any]]) -> None:
    """Raise 503 if open-market P2P trading (beat auctions, marketplace,
    chair/venue-sponsorship resale) is beta-gated and the user is outside
    the Founding Member cohort.

    Reuses the same ``PAYMENT_BETA_MODE`` flag + allowlist as
    ``require_payment_beta_access`` — open-market trading is production
    pre-flight-hardened the same way card rails are, just surfaced as a
    503 (feature temporarily unavailable) instead of a 403, since these
    are marketplace features rather than a specific checkout attempt.
    """
    if not payment_beta_mode_enabled():
        return
    if user_is_payment_beta_allowed(user):
        return
    raise HTTPException(
        status_code=503,
        detail={
            "error": "open_market_beta_restricted",
            "message": (
                "Open-market P2P trading (beat auctions, marketplace listings, "
                "chair/venue-sponsorship resale) is restricted to Founding "
                "Members until live tester reconciliation is signed off."
            ),
            "support_email": payment_support_email(),
            "support_discord": payment_support_discord(),
        },
    )


def payment_beta_public_status() -> Dict[str, Any]:
    """Safe fields for GET /coins/topup/providers (no allowlist contents)."""
    return {
        "beta_mode": payment_beta_mode_enabled(),
        "label": "Beta Payment Environment",
        "support_email": payment_support_email(),
        "support_discord": payment_support_discord(),
        "note": (
            "Card rails are limited to Founding Members while we verify "
            "live credits. Contact support if a purchase succeeds but coins "
            "do not appear."
        ),
    }
