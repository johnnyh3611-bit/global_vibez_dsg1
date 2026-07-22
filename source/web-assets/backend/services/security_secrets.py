"""
Startup security checks for secrets that must not use weak defaults.
"""
from __future__ import annotations

import logging
import os
from typing import List

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


def warn_insecure_secrets(log: logging.Logger | None = None) -> List[str]:
    """
    Log clear warnings (and fail-loud messages in production) when
    JWT_SECRET or ELD_SIGNING_KEY are missing or still on known-weak defaults.
    Returns the list of warning strings emitted.
    """
    log = log or logger
    warnings: List[str] = []
    prod = _is_production()

    jwt_secret = (os.environ.get("JWT_SECRET") or "").strip()
    if not jwt_secret or jwt_secret.lower() in _WEAK_JWT or len(jwt_secret) < 24:
        msg = (
            "SECURITY: JWT_SECRET is missing or uses a weak/default value. "
            "Set a long random secret (e.g. openssl rand -hex 32) on the backend."
        )
        warnings.append(msg)
        if prod:
            log.error(msg)
        else:
            log.warning(msg)

    eld_key = (os.environ.get("ELD_SIGNING_KEY") or "").strip()
    if not eld_key or eld_key in _WEAK_ELD or len(eld_key) < 24:
        msg = (
            "SECURITY: ELD_SIGNING_KEY is missing or uses a weak/default value. "
            "Set a strong secret so the ELD hash chain is tamper-evident in production."
        )
        warnings.append(msg)
        if prod:
            log.error(msg)
        else:
            log.warning(msg)

    return warnings
