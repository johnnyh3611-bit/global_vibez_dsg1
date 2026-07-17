"""Unit tests for Helio client helpers (no network)."""
from __future__ import annotations

import hashlib
import hmac
import json
import os

import pytest

from services.helio_client import (
    extract_payment_meta,
    helio_configured,
    helio_status,
    verify_webhook_signature,
)


def test_helio_not_configured_by_default(monkeypatch):
    for key in ("HELIO_API_KEY", "HELIO_SECRET_KEY", "HELIO_PAYLINK_ID"):
        monkeypatch.delenv(key, raising=False)
    assert helio_configured() is False
    status = helio_status()
    assert status["configured"] is False
    assert status["provider"] == "helio"


def test_helio_configured_when_env_set(monkeypatch):
    monkeypatch.setenv("HELIO_API_KEY", "pk_test")
    monkeypatch.setenv("HELIO_SECRET_KEY", "sk_test")
    monkeypatch.setenv("HELIO_PAYLINK_ID", "paylink_123")
    assert helio_configured() is True


def test_extract_payment_meta_from_additional_json():
    payload = {
        "event": "SUCCESS",
        "customerDetails": {
            "additionalJSON": json.dumps(
                {
                    "payment_id": "coin_pay_abc",
                    "pack_id": "popular",
                    "user_id": "u1",
                    "coins": 10000,
                }
            )
        },
    }
    meta = extract_payment_meta(payload)
    assert meta["payment_id"] == "coin_pay_abc"
    assert meta["pack_id"] == "popular"
    assert meta["user_id"] == "u1"


def test_verify_webhook_signature_roundtrip(monkeypatch):
    token = "shared-secret-token"
    monkeypatch.setenv("HELIO_WEBHOOK_TOKEN", token)
    body = b'{"event":"SUCCESS","payment_id":"x"}'
    sig = hmac.new(token.encode(), body, hashlib.sha256).hexdigest()
    assert verify_webhook_signature(body, sig) is True
    assert verify_webhook_signature(body, "deadbeef") is False


def test_verify_webhook_passes_when_token_unset(monkeypatch):
    monkeypatch.delenv("HELIO_WEBHOOK_TOKEN", raising=False)
    assert verify_webhook_signature(b"{}", None) is True
