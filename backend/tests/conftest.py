"""
Shared pytest config + secret-handling for backend test suites.

Why this file exists
--------------------
Several legacy test modules used to hard-code the God-Mode admin credentials
inline (e.g. ``ADMIN_PASSWORD = "GlobalVibez_Founder_2025!"``) which is
flagged by code-quality scanners as a security risk on commit. We centralise
those values here and pull them from the environment so:

  - secrets are no longer pinned in version-controlled test files,
  - tests that require admin credentials skip cleanly when the env is not
    configured (e.g. CI without admin access), instead of failing loudly,
  - we have ONE place to rotate creds.

Environment variables consumed
------------------------------
- ``REACT_APP_BACKEND_URL`` (required) — public preview URL of the backend.
- ``ADMIN_PASSWORD`` — God-Mode dashboard password.
- ``ADMIN_2FA`` — 6-digit 2FA code (sample value: ``000000`` for the demo
  admin account).

For local + preview pods these are pre-populated by the platform. The full
list of canonical values lives in ``/app/memory/test_credentials.md``.
"""
from __future__ import annotations

import os

import pytest


def _env(name: str) -> str | None:
    val = os.environ.get(name)
    return val.strip() if val else None


# ─────────────────────────────────────────────────────────── public fixtures

@pytest.fixture(scope="session")
def base_url() -> str:
    """Public preview URL for the backend (no trailing slash)."""
    url = _env("REACT_APP_BACKEND_URL")
    if not url:
        pytest.skip("REACT_APP_BACKEND_URL is not configured")
    return url.rstrip("/")


@pytest.fixture(scope="session")
def api_base(base_url: str) -> str:
    """Convenience: ``{base_url}/api``."""
    return f"{base_url}/api"


@pytest.fixture(scope="session")
def admin_password() -> str:
    """God-Mode admin password (skips test if unset)."""
    pw = _env("ADMIN_PASSWORD")
    if not pw:
        pytest.skip("ADMIN_PASSWORD env var is not set — admin tests skipped")
    return pw


@pytest.fixture(scope="session")
def admin_2fa() -> str:
    """God-Mode admin 2FA code (skips test if unset)."""
    code = _env("ADMIN_2FA")
    if not code:
        pytest.skip("ADMIN_2FA env var is not set — admin tests skipped")
    return code


# ─────────────────────────────────────────────────── module-level accessors
#
# Some legacy tests use module-level constants (``BASE_URL = ...``) at import
# time, before fixtures resolve. The helpers below let those modules pull
# from env without re-implementing the parsing dance.

def get_base_url() -> str:
    return (_env("REACT_APP_BACKEND_URL") or "").rstrip("/")


def get_admin_password() -> str | None:
    return _env("ADMIN_PASSWORD")


def get_admin_2fa() -> str | None:
    return _env("ADMIN_2FA")
