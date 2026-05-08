"""Regression tests for the /api/auth/me vault-cookie fallback.

Verifies that when a founder logs in via /api/admin/vault-auth they can then
call /api/auth/me with only the HttpOnly admin_session cookie and receive a
synthetic God-Mode user — which is what every <ProtectedRoute>-gated admin
page calls to decide whether to render.
"""
import os
import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_auth_me_accepts_vault_cookie() -> None:
    os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
    os.environ.setdefault("DB_NAME", "global_vibez_dsg_test")

    from server import app  # noqa: WPS433 — late import so env is set first

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Log in via vault — receive HttpOnly admin_session cookie
        login = await client.post(
            "/api/admin/vault-auth",
            json={"password": os.getenv("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!"), "code": "000000"},
        )
        assert login.status_code == 200, login.text
        assert "admin_session" in login.cookies

        # 2. Call /api/auth/me using the cookie (no Bearer token)
        me = await client.get("/api/auth/me")
        assert me.status_code == 200, me.text
        body = me.json()
        assert body["role_level"] == 3
        assert body["auth_source"] == "vault_cookie"
        assert body["id"] == "__vault_founder__"


@pytest.mark.asyncio
async def test_auth_me_rejects_missing_cookie() -> None:
    os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
    os.environ.setdefault("DB_NAME", "global_vibez_dsg_test")

    from server import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 401
