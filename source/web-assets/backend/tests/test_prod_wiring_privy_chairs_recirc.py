"""Unit tests for prod-wiring: secrets, Privy config, chairs Helio, recirculation mount."""
from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch

import pytest

BACKEND = Path(__file__).resolve().parents[1]


def test_warn_insecure_secrets_flags_weak_jwt_and_eld(monkeypatch):
    from services.security_secrets import warn_insecure_secrets

    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("ELD_SIGNING_KEY", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "development")
    warnings = warn_insecure_secrets()
    assert any("JWT_SECRET" in w for w in warnings)
    assert any("ELD_SIGNING_KEY" in w for w in warnings)


def test_warn_insecure_secrets_accepts_strong_keys(monkeypatch):
    from services.security_secrets import warn_insecure_secrets

    monkeypatch.setenv("JWT_SECRET", "a" * 48)
    monkeypatch.setenv("ELD_SIGNING_KEY", "b" * 48)
    monkeypatch.setenv("ENVIRONMENT", "development")
    assert warn_insecure_secrets() == []


def test_privy_derives_jwks_from_app_id(monkeypatch):
    monkeypatch.setenv("PRIVY_APP_ID", "cm_test_app_id")
    monkeypatch.delenv("PRIVY_JWKS_URL", raising=False)
    # Re-import module constants by reloading helpers
    import importlib
    import routes.privy_auth as privy

    importlib.reload(privy)
    assert privy.privy_configured() is True
    assert "cm_test_app_id" in privy._resolved_jwks_url()
    assert privy._resolved_jwks_url().endswith("/jwks.json")


def test_chair_checkout_source_has_no_stripe():
    src = (BACKEND / "routes/chairs.py").read_text(encoding="utf-8")
    assert '"kind": "chair_park"' in src
    assert "activate_pending_chair_payment" in src
    assert "helio_configured" in src
    assert "create_charge" in src
    assert "StripeCheckout" not in src
    assert "STRIPE_API_KEY" not in src


def test_helio_webhook_handles_chair_park():
    src = (BACKEND / "routes/coin_topup.py").read_text(encoding="utf-8")
    assert "activate_pending_chair_payment" in src
    assert "chair_park" in src


def test_recirculation_public_summary_mounted():
    reg = (BACKEND / "routes/registry.py").read_text(encoding="utf-8")
    assert "recirculation_public" in reg
    assert "public_router" in reg
    admin = (BACKEND / "routes/admin_recirculation.py").read_text(encoding="utf-8")
    assert '@public_router.get("/public-summary")' in admin


def test_lifespan_calls_warn_insecure_secrets():
    src = (BACKEND / "lifespan.py").read_text(encoding="utf-8")
    assert "warn_insecure_secrets" in src


def test_privy_frontend_reads_react_app_privy_app_id():
    root = BACKEND.parent / "frontend/src/components/web3"
    provider = (root / "PrivyAuthProvider.tsx").read_text(encoding="utf-8")
    buttons = (root / "SocialAuthButtons.tsx").read_text(encoding="utf-8")
    assert "REACT_APP_PRIVY_APP_ID" in provider
    assert "REACT_APP_PRIVY_APP_ID" in buttons
    assert "process.env.REACT_APP_PRIVY_APP_ID" in provider
