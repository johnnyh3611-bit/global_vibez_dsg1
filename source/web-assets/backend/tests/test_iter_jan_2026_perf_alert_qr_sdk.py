"""
Iter Jan 2026 — Backend regression for:
  • perf-alert webhook endpoints (status + test-fire)
  • squads-rpc admin endpoint (powers SDK Verifier)
  • All previously-passing endpoints stay green
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")
ADMIN_2FA = os.environ.get("ADMIN_2FA", "000000")


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/admin/vault-auth",
        json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA},
        timeout=10,
    )
    if r.status_code != 200:
        pytest.skip(f"vault-auth failed {r.status_code}: {r.text[:200]}")
    return s


# ─────────── perf-alert ───────────
class TestPerfAlert:
    def test_status_unauth_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/perf-alert/status", timeout=10)
        assert r.status_code in (401, 403), r.text

    def test_status_with_cookie(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/perf-alert/status", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["configured"] is False
        assert d["threshold_ms"] == 1000
        assert d["min_samples"] == 30
        assert d["cooldown_s"] == 600
        assert isinstance(d["active_cooldowns"], dict)

    def test_test_fire_unauth_401(self):
        r = requests.post(f"{BASE_URL}/api/admin/perf-alert/test", timeout=10)
        assert r.status_code in (401, 403)

    def test_test_fire_503_when_not_configured(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/perf-alert/test", timeout=10)
        assert r.status_code == 503
        assert "PERF_ALERT_WEBHOOK_URL" in r.text


# ─────────── squads-rpc ───────────
class TestSquadsRpc:
    def test_unauth_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/treasury/squads-rpc", timeout=10)
        assert r.status_code in (401, 403)

    def test_with_cookie_returns_rpc(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/treasury/squads-rpc", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "rpc_url" in d
        assert isinstance(d["rpc_url"], str) and len(d["rpc_url"]) > 0
        assert d["rpc_url"].startswith("http")

    def test_squads_rpc_not_in_public_surface(self):
        # Public treasury status must NOT leak rpc_url
        r = requests.get(f"{BASE_URL}/api/treasury/public-status", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "rpc_url" not in d
        assert "phantom_cosigner" not in d
        assert "founder_cosigner" not in d


# ─────────── Regression: previously-passing ───────────
class TestRegression:
    def test_public_status(self):
        r = requests.get(f"{BASE_URL}/api/treasury/public-status", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("configured", "network", "is_mainnet", "vault_balance_sol", "rpc_ok"):
            assert k in d

    def test_admin_squads_status(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/treasury/squads-status", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "phantom_cosigner" in d
        assert "founder_cosigner" in d
        assert "squad_address" in d

    def test_admin_dashboard_with_squads(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/treasury/dashboard", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "squads" in d

    def test_sweep_balance(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-balance",
            params={"old_wallet": "8fn1G5eUxvUxz1KfQ7yxFkJkB5o91Cej76xq2Tx58mph"},
            timeout=15,
        )
        assert r.status_code in (200, 400, 422), r.text

    def test_sweep_instructions(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-instructions",
            params={
                "old_wallet": "8fn1G5eUxvUxz1KfQ7yxFkJkB5o91Cej76xq2Tx58mph",
                "new_wallet": "8fn1G5eUxvUxz1KfQ7yxFkJkB5o91Cej76xq2Tx58mph",
            },
            timeout=15,
        )
        assert r.status_code in (200, 400, 422)

    def test_perf_snapshot(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/perf-snapshot", timeout=10)
        assert r.status_code == 200
