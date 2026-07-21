"""Integrations health scoring — optional rails must not ding readiness."""
import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_integrations_health_excludes_optional_stripe(monkeypatch):
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
    monkeypatch.delenv("STRIPE_API_KEY", raising=False)
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)

    from routes.integrations_health import integrations_health

    payload = await integrations_health()
    assert payload["services"]["stripe_legacy"]["configured"] is False
    assert payload["services"]["stripe_legacy"]["optional"] is True
    assert payload["services"]["twilio"]["optional"] is True
    assert payload["ok"] is True
    assert payload["ready_count"] == payload["total"]
    assert "Stripe is optional" in " ".join(payload["notes"])


@pytest.mark.asyncio
async def test_root_and_health_probes_return_200(monkeypatch):
    """Railway may probe `/` or `/health` — both must be 200 without Mongo."""
    monkeypatch.setenv("MONGO_URL", "mongodb://localhost:27017")
    monkeypatch.setenv("DB_NAME", "test_db")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("DISABLE_BG_SCHEDULERS", "1")

    # Import after env so settings pick up test values.
    from server import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for path in ("/", "/health", "/healthz", "/ready", "/api/health"):
            resp = await client.get(path)
            assert resp.status_code == 200, path
            assert resp.json().get("status") == "ok"
