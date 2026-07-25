"""
Startup security checks for secrets that must not use weak defaults.

In production (ENVIRONMENT/ENV ∈ production|prod|live), weak JWT_SECRET
or ELD_SIGNING_KEY causes startup failure (SystemExit) so the process
never serves traffic with insecure defaults.
"""
from __future__ import annotations

import logging
import os
from typing import List, Tuple

logger = logging.getLogger(__name__)

_WEAK_JWT = {
    "",
    "change-me",
    "changeme",
    "secret",
    "jwt-secret",
    "your-super-secret-jwt-key-change-in-production",
    "your-secret-key",
    "dev",
    "test",
    "test-secret",
}

_WEAK_ELD = {
    "",
    "dev-eld-signing-key-change-in-production",
    "change-me-eld-signing-key-production",
    "changeme",
    "eld-signing-key",
}


def _is_production() -> bool:
    env = (
        os.environ.get("ENVIRONMENT")
        or os.environ.get("ENV")
        or ""
    ).strip().lower()
    return env in ("production", "prod", "live")


def audit_secret_strength() -> Tuple[List[str], bool]:
    """Return (messages, ok). ok is False when any secret fails entropy checks."""
    warnings: List[str] = []
    ok = True

    jwt_secret = (os.environ.get("JWT_SECRET") or "").strip()
    if not jwt_secret or jwt_secret.lower() in _WEAK_JWT or len(jwt_secret) < 24:
        ok = False
        warnings.append(
            "SECURITY: JWT_SECRET is missing or uses a weak/default value. "
            "Set a long random secret (e.g. openssl rand -hex 32) on the backend."
        )

    eld_key = (os.environ.get("ELD_SIGNING_KEY") or "").strip()
    if not eld_key or eld_key in _WEAK_ELD or len(eld_key) < 24:
        ok = False
        warnings.append(
            "SECURITY: ELD_SIGNING_KEY is missing or uses a weak/default value. "
            "Set a strong secret so the ELD hash chain is tamper-evident in production."
        )

    return warnings, ok


def warn_insecure_secrets(log: logging.Logger | None = None) -> List[str]:
    """
    Log clear warnings (and fail-loud messages in production) when
    JWT_SECRET or ELD_SIGNING_KEY are missing or still on known-weak defaults.
    Returns the list of warning strings emitted.

    Prefer ``enforce_secure_secrets`` at startup — this helper remains for
    health probes and non-blocking callers.
    """
    log = log or logger
    warnings, _ok = audit_secret_strength()
    prod = _is_production()
    for msg in warnings:
        if prod:
            log.error(msg)
        else:
            log.warning(msg)
    return warnings


def enforce_secure_secrets(log: logging.Logger | None = None) -> List[str]:
    """Warn always; in production, abort startup on weak secrets.

    Set ``ALLOW_WEAK_SECRETS=1`` only for emergency break-glass (logged).
    """
    log = log or logger
    warnings, ok = audit_secret_strength()
    prod = _is_production()
    for msg in warnings:
        if prod:
            log.error(msg)
        else:
            log.warning(msg)

    if ok or not prod:
        return warnings

    allow = (os.environ.get("ALLOW_WEAK_SECRETS") or "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    if allow:
        log.error(
            "SECURITY: ALLOW_WEAK_SECRETS=1 — continuing with weak secrets "
            "(break-glass only; rotate immediately)."
        )
        return warnings

    log.error(
        "SECURITY: Refusing to start with weak JWT_SECRET / ELD_SIGNING_KEY "
        "in production. Fix Railway secrets, then redeploy."
    )
    raise SystemExit(2)
