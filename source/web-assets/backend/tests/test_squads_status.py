"""Squads multi-sig read-only status — Phase A backend tests.

Covers:
  * Auth gate on /api/admin/treasury/squads-status (401 without admin cookie)
  * Live Helius mainnet RPC call returns rpc_ok + sol balance
  * /api/admin/treasury/dashboard now embeds a `squads` block alongside
    existing config / all_time / month_to_date keys (no regression).
  * services/squads_status.is_configured() helper logic.
"""
import os
import importlib

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")
ADMIN_2FA = os.environ.get("ADMIN_2FA", "000000")

VAULT_PDA = "ud2btD6BPdifFppQhLFkJjpwXe5Y4ab9FfArrixFkh2"
SQUAD_ADDR = "5jtHuHRJxoYBVyVuAok7gkStf53HjKdN3CA9AdWC8J9r"
PHANTOM_COSIGNER = "p46P9aVGLW6fXyRngVPRunVHkYk9DgXF5JAx4Se9pyL"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/admin/vault-auth",
        json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return s


# ─────────────────────────────────────── auth gate
class TestSquadsAuthGate:
    def test_squads_status_requires_admin_cookie(self):
        r = requests.get(f"{BASE_URL}/api/admin/treasury/squads-status", timeout=10)
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_dashboard_requires_admin_cookie(self):
        r = requests.get(f"{BASE_URL}/api/admin/treasury/dashboard", timeout=10)
        assert r.status_code in (401, 403)


# ─────────────────────────────────────── live RPC contract
class TestSquadsStatusLive:
    def test_squads_status_shape_and_values(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/treasury/squads-status", timeout=20)
        assert r.status_code == 200, r.text[:300]
        d = r.json()

        assert d["configured"] is True
        assert d["network"] == "mainnet"
        assert d["is_mainnet"] is True
        assert d["vault_pda"] == VAULT_PDA
        assert d["squad_address"] == SQUAD_ADDR
        assert d["phantom_cosigner"] == PHANTOM_COSIGNER
        assert d["threshold"] == 2
        assert d["member_count"] == 2

        # rpc_ok should be true since Helius mainnet is verified working.
        assert d["rpc_ok"] is True, f"rpc_ok false; payload={d}"
        assert isinstance(d["vault_balance_lamports"], int)
        assert d["vault_balance_lamports"] >= 1_000_000, "vault should hold ≥ 0.001 SOL"
        assert d["vault_balance_sol"] >= 0.001

    def test_squads_status_endpoint_no_500_on_repeat(self, admin_session):
        # quick stability check — three back-to-back calls should all succeed.
        for _ in range(3):
            r = admin_session.get(
                f"{BASE_URL}/api/admin/treasury/squads-status", timeout=20
            )
            assert r.status_code == 200


# ─────────────────────────────────────── dashboard regression + embed
class TestDashboardSquadsBlock:
    def test_dashboard_keeps_existing_keys(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/treasury/dashboard", timeout=20)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("config", "all_time", "month_to_date", "squads"):
            assert k in d, f"missing key {k}; got keys={list(d.keys())}"

    def test_dashboard_squads_matches_endpoint(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/treasury/dashboard", timeout=20)
        sq = r.json()["squads"]
        assert sq["configured"] is True
        assert sq["network"] == "mainnet"
        assert sq["is_mainnet"] is True
        assert sq["vault_pda"] == VAULT_PDA
        assert sq["squad_address"] == SQUAD_ADDR
        assert sq["phantom_cosigner"] == PHANTOM_COSIGNER
        assert sq["threshold"] == 2
        assert sq["member_count"] == 2
        assert sq["rpc_ok"] is True
        assert sq["vault_balance_sol"] >= 0.001


# ─────────────────────────────────────── unit-level helper
class TestIsConfiguredHelper:
    """Verify the env-driven gate logic in services.squads_status.

    NOTE: monkeypatch must hit `os.environ` directly because the helper
    reads via `os.environ.get` on every call (no module-level cache).
    """

    def test_is_configured_true_with_mainnet_env(self, monkeypatch):
        monkeypatch.setenv("SQUADS_VAULT_PDA", "abc")
        monkeypatch.setenv("SQUADS_NETWORK", "mainnet")
        monkeypatch.setenv("SOLANA_MAINNET_RPC", "https://example/rpc")
        mod = importlib.import_module("services.squads_status")
        assert mod.is_configured() is True

    def test_is_configured_false_without_pda(self, monkeypatch):
        monkeypatch.delenv("SQUADS_VAULT_PDA", raising=False)
        monkeypatch.setenv("SQUADS_NETWORK", "mainnet")
        monkeypatch.setenv("SOLANA_MAINNET_RPC", "https://example/rpc")
        mod = importlib.import_module("services.squads_status")
        assert mod.is_configured() is False

    def test_is_configured_false_without_rpc(self, monkeypatch):
        monkeypatch.setenv("SQUADS_VAULT_PDA", "abc")
        monkeypatch.setenv("SQUADS_NETWORK", "mainnet")
        monkeypatch.delenv("SOLANA_MAINNET_RPC", raising=False)
        mod = importlib.import_module("services.squads_status")
        assert mod.is_configured() is False

    @pytest.mark.asyncio
    async def test_get_squads_status_unconfigured_returns_dict(self, monkeypatch):
        """Graceful degradation — must NOT raise when env missing."""
        monkeypatch.delenv("SQUADS_VAULT_PDA", raising=False)
        monkeypatch.delenv("SOLANA_MAINNET_RPC", raising=False)
        monkeypatch.delenv("VIBEZ_SOLANA_RPC", raising=False)
        mod = importlib.import_module("services.squads_status")
        out = await mod.get_squads_status()
        assert out["configured"] is False
        assert out["rpc_ok"] is False

    @pytest.mark.asyncio
    async def test_get_squads_status_bad_rpc_returns_rpc_ok_false(self, monkeypatch):
        """Bad RPC URL must NOT 500 — it must still return env-derived fields."""
        monkeypatch.setenv("SQUADS_VAULT_PDA", VAULT_PDA)
        monkeypatch.setenv("SQUADS_NETWORK", "mainnet")
        monkeypatch.setenv("SOLANA_MAINNET_RPC", "https://invalid.localdomain.invalid/")
        monkeypatch.setenv("SQUADS_THRESHOLD", "2")
        monkeypatch.setenv("SQUADS_MEMBER_COUNT", "2")
        mod = importlib.import_module("services.squads_status")
        out = await mod.get_squads_status()
        assert out["configured"] is True
        assert out["rpc_ok"] is False
        assert out["vault_pda"] == VAULT_PDA
        assert out["threshold"] == 2
