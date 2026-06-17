"""v11/v12 Sovereign Ops — Bridge Queue + Inactivity Reap + Burn-Slide tests.

Hits the live service via REACT_APP_BACKEND_URL. Admin ops are gated behind
the admin_session cookie from /api/admin/vault-auth. Solana writes must stay
blocked (403) until the safe phrase is pulled.
"""
from __future__ import annotations

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
ADMIN_PASSWORD = "GlobalVibez_Founder_2025!"


@pytest.fixture(scope="module")
def admin_session() -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/vault-auth", json={"password": ADMIN_PASSWORD, "code": "000000"}, timeout=15)
    assert r.status_code == 200, f"admin auth failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def demo_bearer() -> str:
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", timeout=15)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("session_token")
    assert tok, f"no token in demo-login response: {r.json()}"
    return tok


# ── 1) Burn schedule (public) ──────────────────────────────────────────────
class TestBurnSchedule:
    def test_public_schedule_returns_v12_values(self):
        r = requests.get(f"{BASE_URL}/api/burn/schedule", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["circulating_supply"] == 750_000_000
        assert d["burn_rate"] == 0.05
        assert d["ceiling"] == 0.05
        assert d["floor_supply"] == 350_000_000
        assert d["wallet_caps"]["standard"] == 2_000_000
        assert d["wallet_caps"]["chair_holder"] == 5_000_000


# ── 2) Burn execute admin gating ───────────────────────────────────────────
class TestBurnExecute:
    def test_no_cookie_returns_401_or_403(self):
        r = requests.post(f"{BASE_URL}/api/admin/burn/execute", json={"amount": 1000}, timeout=10)
        assert r.status_code in (401, 403)

    def test_dry_run_true_success(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/burn/execute", json={"amount": 1_000_000, "dry_run": True}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["supply_before"] == 750_000_000
        assert d["supply_after"] == 749_000_000
        assert d["tx_sig"].startswith("dryrun_")
        assert d["dry_run"] is True

    def test_live_burn_is_blocked(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/burn/execute", json={"amount": 1000, "dry_run": False}, timeout=10)
        assert r.status_code == 403


# ── 3) Bridge request (user) ───────────────────────────────────────────────
class TestBridgeRequest:
    def test_unauth_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/bridge/request", json={"coins": 100}, timeout=10)
        assert r.status_code == 401

    def test_request_debits_and_stages(self, demo_bearer):
        h = {"Authorization": f"Bearer {demo_bearer}", "Content-Type": "application/json"}
        r = requests.post(f"{BASE_URL}/api/bridge/request", json={"coins": 100}, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["tokens_out_preview"] == 25.0  # 100 / 4
        assert d["status"] == "pending"
        assert "Founder queue" in d["note"]
        pytest.bridge_request_id = d["request_id"]

    def test_insufficient_balance_returns_402(self, demo_bearer):
        h = {"Authorization": f"Bearer {demo_bearer}", "Content-Type": "application/json"}
        r = requests.post(f"{BASE_URL}/api/bridge/request", json={"coins": 999_000_000}, headers=h, timeout=10)
        assert r.status_code == 402


# ── 4) Bridge admin lifecycle ──────────────────────────────────────────────
class TestBridgeAdminLifecycle:
    def test_queue_lists_rows_and_counts(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/bridge/queue", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "rows" in d and isinstance(d["rows"], list)
        assert set(d["counts"].keys()) == {"pending", "approved", "broadcast", "rejected"}
        assert d["dry_run_default"] is True

    def test_approve_then_broadcast_dry(self, admin_session):
        rid = getattr(pytest, "bridge_request_id", None)
        assert rid, "earlier bridge_request test must have created this id"
        # approve
        r = admin_session.post(f"{BASE_URL}/api/admin/bridge/{rid}/approve", timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "approved"
        # broadcast dry (explicit)
        r = admin_session.post(
            f"{BASE_URL}/api/admin/bridge/{rid}/broadcast", json={"dry_run": True}, timeout=15
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["tx_sig"].startswith("dryrun_")
        assert d["dry_run"] is True

    def test_broadcast_live_is_blocked(self, admin_session, demo_bearer):
        # Create a fresh request, approve it, then try live broadcast (should 403).
        h = {"Authorization": f"Bearer {demo_bearer}", "Content-Type": "application/json"}
        r = requests.post(f"{BASE_URL}/api/bridge/request", json={"coins": 50}, headers=h, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"could not seed bridge request: {r.status_code}")
        rid2 = r.json()["request_id"]
        admin_session.post(f"{BASE_URL}/api/admin/bridge/{rid2}/approve", timeout=10)
        r = admin_session.post(
            f"{BASE_URL}/api/admin/bridge/{rid2}/broadcast", json={"dry_run": False}, timeout=10
        )
        assert r.status_code == 403

    def test_reject_refunds_coins(self, admin_session, demo_bearer):
        h = {"Authorization": f"Bearer {demo_bearer}", "Content-Type": "application/json"}
        r = requests.post(f"{BASE_URL}/api/bridge/request", json={"coins": 25}, headers=h, timeout=15)
        if r.status_code != 200:
            pytest.skip(f"could not seed bridge request: {r.status_code}")
        rid = r.json()["request_id"]
        rr = admin_session.post(f"{BASE_URL}/api/admin/bridge/{rid}/reject", json={"reason": "test"}, timeout=10)
        assert rr.status_code == 200, rr.text
        assert rr.json()["refunded_coins"] == 25


# ── 5) Inactivity Reap ─────────────────────────────────────────────────────
class TestInactivityReap:
    def test_candidates_returns_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/inactivity/candidates", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("cutoff_iso", "rows", "count", "total_coins_to_reap", "giveaway_share_coins", "leadership_share_coins"):
            assert k in d, f"missing field {k}"
        assert d["dry_run_default"] is True

    def test_run_dry_logs_no_coin_movement(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/inactivity/run", json={"dry_run": True, "limit": 10}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["dry_run"] is True

    def test_run_live_allowed_off_chain(self, admin_session):
        # User-facing reap is off-chain (no SPL) so live is allowed per spec.
        r = admin_session.post(f"{BASE_URL}/api/admin/inactivity/run", json={"dry_run": False, "limit": 1}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["dry_run"] is False


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
