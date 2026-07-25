"""Integrations health — Helio/Solana rails; Stripe must not appear."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_integrations_health_omits_stripe(monkeypatch):
    monkeypatch.setenv("AGORA_APP_ID", "a")
    monkeypatch.setenv("AGORA_APP_CERTIFICATE", "b")
    monkeypatch.setenv("GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET", "Sol111")
    monkeypatch.setenv("HELIO_API_KEY", "k")
    monkeypatch.setenv("HELIO_SECRET_KEY", "s")
    monkeypatch.setenv("HELIO_PAYLINK_ID", "p")
    monkeypatch.setenv("HELIO_WEBHOOK_TOKEN", "w")
    monkeypatch.setenv("RESEND_API_KEY", "r")
    monkeypatch.setenv("GEMINI_API_KEY", "g")
    monkeypatch.setenv("OPENAI_API_KEY", "o")
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "c")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "t")
    monkeypatch.setenv("JWT_SECRET", "unit-test-jwt-secret-key-32b")
    monkeypatch.setenv("MONGO_URL", "mongodb://localhost:27017")
    monkeypatch.setenv("DB_NAME", "test_db")
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    monkeypatch.delenv("REDIS_URL", raising=False)

    mock_client = MagicMock()
    mock_client.admin.command = AsyncMock(return_value={"ok": 1})

    with patch("utils.database.get_client", return_value=mock_client):
        from routes.integrations_health import integrations_health

        payload = await integrations_health()

    assert "stripe_legacy" not in payload["services"]
    assert "stripe" not in payload["services"]
    assert payload["card_provider"] == "helio"
    assert payload["services"]["twilio"]["optional"] is True
    assert payload["services"]["socketio_redis"]["optional"] is True
    assert payload["runtime"]["jwt"]["configured"] is True
    assert payload["runtime"]["mongodb"]["reachable"] is True
    assert payload["ok"] is True
    assert payload["ready_count"] == payload["total"]
    assert "Stripe is not used" in " ".join(payload["notes"])


@pytest.mark.asyncio
async def test_root_and_health_probes_return_200(monkeypatch):
    """Railway may probe `/` or `/health` — both must be 200 without Mongo."""
    monkeypatch.setenv("MONGO_URL", "mongodb://localhost:27017")
    monkeypatch.setenv("DB_NAME", "test_db")
    monkeypatch.setenv("JWT_SECRET", "test-secret-long-enough-value")
    monkeypatch.setenv("DISABLE_BG_SCHEDULERS", "1")

    from server import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for path in ("/", "/health", "/healthz", "/ready", "/api/health"):
            resp = await client.get(path)
            assert resp.status_code == 200, path
            assert resp.json().get("status") == "ok"
