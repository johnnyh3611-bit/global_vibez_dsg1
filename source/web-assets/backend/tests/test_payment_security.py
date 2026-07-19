"""Payment security unit tests — beta gate, sanitize, Helio fail-closed."""
from __future__ import annotations

import os

import pytest


def test_sanitize_stripe_object_strips_pan_fields():
    from services.payment_hub import sanitize_stripe_object

    raw = {
        "id": "ch_123",
        "amount": 500,
        "payment_method_details": {
            "type": "card",
            "card": {
                "brand": "visa",
                "last4": "4242",
                "number": "4242424242424242",
                "cvc": "123",
                "checks": {"cvc_check": "pass", "address_postal_code_check": "pass"},
            },
        },
        "metadata": {"user_id": "u1"},
    }
    clean = sanitize_stripe_object(raw)
    assert clean["id"] == "ch_123"
    assert "number" not in clean["payment_method_details"]["card"]
    assert "cvc" not in clean["payment_method_details"]["card"]
    assert clean["payment_method_details"]["card"]["last4"] == "4242"
    assert clean["payment_method_details"]["card"]["checks"]["cvc_check"] == "pass"


def test_payments_audit_metadata_strips_sensitive_keys():
    from services.payments_audit import _sanitize_metadata

    clean = _sanitize_metadata(
        {
            "pack_id": "starter",
            "cvv": "999",
            "card_number": "4111111111111111",
            "ok": "yes",
        }
    )
    assert clean == {"pack_id": "starter", "ok": "yes"}


def test_payment_beta_gate_allowlist(monkeypatch):
    from services import payment_beta_gate as gate

    monkeypatch.setenv("PAYMENT_BETA_MODE", "true")
    monkeypatch.setenv("PAYMENT_BETA_ALLOWLIST", "founder@example.com,uid_abc")
    assert gate.payment_beta_mode_enabled() is True
    assert gate.user_is_payment_beta_allowed({"email": "founder@example.com"}) is True
    assert gate.user_is_payment_beta_allowed({"user_id": "uid_abc"}) is True
    assert gate.user_is_payment_beta_allowed({"email": "rando@example.com"}) is False
    assert gate.user_is_payment_beta_allowed({"is_beta_tester": True}) is True
    assert gate.user_is_payment_beta_allowed({"is_founding_member": True}) is True


def test_payment_beta_gate_off(monkeypatch):
    from services import payment_beta_gate as gate
    from fastapi import HTTPException

    monkeypatch.setenv("PAYMENT_BETA_MODE", "false")
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    assert gate.payment_beta_mode_enabled() is False
    # Should not raise
    gate.require_payment_beta_access({"email": "anyone@example.com"})

    monkeypatch.setenv("PAYMENT_BETA_MODE", "true")
    with pytest.raises(HTTPException) as exc:
        gate.require_payment_beta_access({"email": "blocked@example.com"})
    assert exc.value.status_code == 403
    assert exc.value.detail["error"] == "payment_beta_restricted"


def test_helio_verify_fails_closed_in_production(monkeypatch):
    from services import helio_client as helio

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("HELIO_WEBHOOK_TOKEN", raising=False)
    monkeypatch.delenv("PAYMENTS_REQUIRE_WEBHOOK_AUTH", raising=False)
    assert helio.verify_webhook_signature(b"{}", None) is False


def test_helio_verify_soft_pass_in_dev(monkeypatch):
    from services import helio_client as helio

    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("PAYMENTS_REQUIRE_WEBHOOK_AUTH", "0")
    monkeypatch.delenv("HELIO_WEBHOOK_TOKEN", raising=False)
    assert helio.verify_webhook_signature(b"{}", None) is True


def test_checkout_request_requires_amount_or_line_items():
    from services.payment_hub import CheckoutSessionRequest, StripeCheckout

    sc = StripeCheckout(api_key="sk_test_x")
    with pytest.raises(ValueError):
        sc._build_session_kwargs(CheckoutSessionRequest(currency="usd"))


def test_checkout_builds_fraud_controls():
    from services.payment_hub import CheckoutSessionRequest, StripeCheckout

    sc = StripeCheckout(api_key="sk_test_x")
    kwargs = sc._build_session_kwargs(
        CheckoutSessionRequest(
            amount=9.0,
            currency="usd",
            success_url="https://example.com/ok",
            cancel_url="https://example.com/cancel",
            metadata={"pack_id": "popular"},
        )
    )
    assert kwargs["billing_address_collection"] == "required"
    assert (
        kwargs["payment_intent_data"]["payment_method_options"]["card"][
            "request_three_d_secure"
        ]
        == "automatic"
    )
    assert kwargs["line_items"][0]["price_data"]["unit_amount"] == 900
