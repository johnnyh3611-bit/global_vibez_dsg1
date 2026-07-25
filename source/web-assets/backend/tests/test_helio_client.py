"""Unit tests for Helio client helpers (no network)."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from services.helio_client import (
    create_charge,
    extract_payment_meta,
    helio_configured,
    helio_status,
    resolve_helio_api_base,
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


def test_helio_configured_strips_whitespace_and_quotes(monkeypatch):
    monkeypatch.setenv("HELIO_API_KEY", '  "pk_test"  ')
    monkeypatch.setenv("HELIO_SECRET_KEY", "  sk_test  ")
    monkeypatch.setenv("HELIO_PAYLINK_ID", "'paylink_123'")
    assert helio_configured() is True


def test_resolve_api_base_defaults_to_prod(monkeypatch):
    monkeypatch.delenv("HELIO_API_BASE", raising=False)
    monkeypatch.delenv("HELIO_NETWORK", raising=False)
    assert resolve_helio_api_base() == "https://api.hel.io/v1"


def test_resolve_api_base_test_network_uses_dev_host(monkeypatch):
    monkeypatch.delenv("HELIO_API_BASE", raising=False)
    monkeypatch.setenv("HELIO_NETWORK", "test")
    assert resolve_helio_api_base() == "https://api.dev.hel.io/v1"


def test_resolve_api_base_explicit_override(monkeypatch):
    monkeypatch.setenv("HELIO_NETWORK", "test")
    monkeypatch.setenv("HELIO_API_BASE", "https://custom.example/v1/")
    assert resolve_helio_api_base() == "https://custom.example/v1"


def test_helio_status_exposes_auth_shape(monkeypatch):
    monkeypatch.setenv("HELIO_API_KEY", "pk")
    monkeypatch.setenv("HELIO_SECRET_KEY", "sk")
    monkeypatch.setenv("HELIO_PAYLINK_ID", "pl")
    monkeypatch.setenv("HELIO_NETWORK", "test")
    monkeypatch.delenv("HELIO_API_BASE", raising=False)
    status = helio_status()
    assert status["api_base"] == "https://api.dev.hel.io/v1"
    assert status["api_base_is_dev"] is True
    assert status["auth"]["query_param"] == "apiKey"
    assert "Bearer" in status["auth"]["header"]


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
    monkeypatch.delenv("PAYMENTS_REQUIRE_WEBHOOK_AUTH", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("ENV", raising=False)
    assert verify_webhook_signature(b"{}", None) is True


@pytest.mark.asyncio
async def test_create_charge_sends_bearer_and_api_key_query(monkeypatch):
    monkeypatch.setenv("HELIO_API_KEY", "  pk_live_abc  ")
    monkeypatch.setenv("HELIO_SECRET_KEY", "sk_live_secret")
    monkeypatch.setenv("HELIO_PAYLINK_ID", "paylink_xyz")
    monkeypatch.setenv("HELIO_NETWORK", "main")
    monkeypatch.delenv("HELIO_API_BASE", raising=False)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "id": "charge_1",
        "pageUrl": "https://app.hel.io/charge/tok-1",
    }
    mock_resp.text = json.dumps(mock_resp.json.return_value)
    mock_resp.headers = {}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("services.helio_client.httpx.AsyncClient", return_value=mock_client):
        charge_id, page_url = await create_charge(
            amount_usd=9.99,
            metadata={"payment_id": "coin_pay_1", "user_id": "u1"},
            card_only=True,
        )

    assert charge_id == "charge_1"
    assert "cardonly=true" in page_url

    kwargs = mock_client.post.await_args.kwargs
    assert kwargs["params"] == {"apiKey": "pk_live_abc"}
    assert kwargs["headers"]["Authorization"] == "Bearer sk_live_secret"
    assert kwargs["headers"]["Content-Type"] == "application/json"
    assert mock_client.post.await_args.args[0] == "https://api.hel.io/v1/charge/api-key"
    assert kwargs["json"]["paymentRequestId"] == "paylink_xyz"
    assert kwargs["json"]["requestAmount"] == "9.99"


@pytest.mark.asyncio
async def test_create_charge_401_includes_helio_message(monkeypatch, caplog):
    monkeypatch.setenv("HELIO_API_KEY", "pk_test")
    monkeypatch.setenv("HELIO_SECRET_KEY", "sk_test")
    monkeypatch.setenv("HELIO_PAYLINK_ID", "paylink_xyz")
    monkeypatch.setenv("HELIO_NETWORK", "test")
    monkeypatch.delenv("HELIO_API_BASE", raising=False)

    body = {
        "message": "Api key or token is invalid",
        "code": 401,
        "errorCode": "UNAUTHORIZED",
        "errorType": "auth",
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.json.return_value = body
    mock_resp.text = json.dumps(body)
    mock_resp.headers = {
        "content-type": "application/json",
        "www-authenticate": "Bearer",
    }

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("services.helio_client.httpx.AsyncClient", return_value=mock_client):
        with caplog.at_level("ERROR"):
            with pytest.raises(RuntimeError) as excinfo:
                await create_charge(
                    amount_usd=5.0,
                    metadata={"payment_id": "x"},
                )

    msg = str(excinfo.value)
    assert "401" in msg
    assert "Api key or token is invalid" in msg
    assert "api.dev.hel.io" in msg
    assert "Api key or token is invalid" in caplog.text
    assert "UNAUTHORIZED" in caplog.text
    # request went to the dev host for HELIO_NETWORK=test
    assert mock_client.post.await_args.args[0] == (
        "https://api.dev.hel.io/v1/charge/api-key"
    )


@pytest.mark.asyncio
async def test_create_charge_transport_error(monkeypatch):
    monkeypatch.setenv("HELIO_API_KEY", "pk")
    monkeypatch.setenv("HELIO_SECRET_KEY", "sk")
    monkeypatch.setenv("HELIO_PAYLINK_ID", "pl")
    monkeypatch.delenv("HELIO_API_BASE", raising=False)
    monkeypatch.setenv("HELIO_NETWORK", "main")

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=httpx.ConnectError("boom"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("services.helio_client.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(RuntimeError) as excinfo:
            await create_charge(amount_usd=1.0, metadata={})

    assert "transport" in str(excinfo.value).lower()
