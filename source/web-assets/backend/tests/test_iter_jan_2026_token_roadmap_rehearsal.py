"""Regression + new-feature tests for the Jan 2026 TokenRoadmap +
MainnetSignRehearsal session.

Covers:
  - NEW: GET /api/treasury/public-status (no auth, lean payload, no leaks)
  - REGRESSION: GET /api/admin/treasury/squads-status (auth gate + corrected
    squad address ud2btD6BPdif...)
  - REGRESSION: GET /api/admin/treasury/dashboard (squads block + buckets)
  - REGRESSION: solana-indexer status, perf-snapshot, sweep-balance,
    sweep-instructions, vault-auth login.
"""
from __future__ import annotations

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")
ADMIN_2FA = os.environ.get("ADMIN_2FA", "000000")

CORRECTED_SQUAD_ADDR = "ud2btD6BPdifFppQhLFkJjpwXe5Y4ab9FfArrixFkh2"


# ─────────────────────── fixtures
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/admin/vault-auth",
        json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"admin vault-auth failed ({r.status_code}): {r.text[:200]}")
    return s


# ─────────────────────── NEW: /api/treasury/public-status
class TestPublicTreasuryStatus:
    def test_no_auth_required_200(self, api):
        r = api.get(f"{BASE_URL}/api/treasury/public-status", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # Required shape
        for key in ("configured", "network", "is_mainnet", "vault_balance_sol", "rpc_ok"):
            assert key in data, f"missing key {key} in {data}"

    def test_payload_values_when_configured(self, api):
        r = api.get(f"{BASE_URL}/api/treasury/public-status", timeout=20)
        data = r.json()
        assert data["configured"] is True
        assert data["network"] == "mainnet"
        assert data["is_mainnet"] is True
        assert data["rpc_ok"] is True
        # mainnet balance — at least 0.001 SOL per spec
        bal = data["vault_balance_sol"]
        assert isinstance(bal, (int, float)), f"bal not numeric: {bal!r}"
        assert bal >= 0.001 - 1e-9, f"vault under-funded: {bal}"

    def test_no_cosigner_leakage(self, api):
        """Public endpoint MUST NOT leak any address fields."""
        r = api.get(f"{BASE_URL}/api/treasury/public-status", timeout=20)
        data = r.json()
        forbidden = (
            "phantom_cosigner",
            "founder_cosigner",
            "vault_pda",
            "squad_address",
            "members",
        )
        for f in forbidden:
            assert f not in data, f"leaked forbidden field: {f}"


# ─────────────────────── REGRESSION: admin squads-status
class TestAdminSquadsStatus:
    def test_requires_admin_cookie(self, api):
        r = api.get(f"{BASE_URL}/api/admin/treasury/squads-status", timeout=10)
        assert r.status_code == 401

    def test_with_admin_returns_corrected_address(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/admin/treasury/squads-status", timeout=20
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("configured") is True
        assert data.get("network") == "mainnet"
        # corrected squad address (was 5jtHu... before this session)
        assert data.get("squad_address") == CORRECTED_SQUAD_ADDR, (
            f"squad_address mismatch: got {data.get('squad_address')!r}"
        )
        # cosigners present (admin-only fields)
        assert "phantom_cosigner" in data
        assert "founder_cosigner" in data


# ─────────────────────── REGRESSION: admin dashboard still healthy
class TestAdminDashboard:
    def test_requires_admin(self, api):
        r = api.get(f"{BASE_URL}/api/admin/treasury/dashboard", timeout=10)
        assert r.status_code == 401

    def test_dashboard_includes_squads_block(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/admin/treasury/dashboard", timeout=25
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # core sections
        assert "config" in data
        assert "all_time" in data
        assert "month_to_date" in data
        assert "squads" in data
        squads = data["squads"]
        assert squads.get("configured") is True


# ─────────────────────── REGRESSION: solana indexer + perf
class TestRegressionEndpoints:
    def test_solana_indexer_status(self, api):
        # public endpoint
        r = api.get(f"{BASE_URL}/api/admin/solana-indexer/status", timeout=15)
        assert r.status_code in (200, 401)
        if r.status_code == 401:
            pytest.skip("solana-indexer/status now auth-gated; skipping")

    def test_solana_indexer_status_authed(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/admin/solana-indexer/status", timeout=15
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "treasury_wallet" in data or "wallet" in data or "configured" in data

    def test_sweep_balance_requires_auth(self, api):
        r = api.get(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-balance",
            params={"old_wallet": "8fn1G5eUxvUxz1KfQ7yxFkJkB5o91Cej76xq2Tx58mph"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_sweep_balance_authed(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-balance",
            params={"old_wallet": "8fn1G5eUxvUxz1KfQ7yxFkJkB5o91Cej76xq2Tx58mph"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "balance_sol" in data or "balance_lamports" in data

    def test_sweep_instructions_same_wallet_400(self, admin_session):
        same = "8fn1G5eUxvUxz1KfQ7yxFkJkB5o91Cej76xq2Tx58mph"
        r = admin_session.post(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-instructions",
            params={"old_wallet": same, "new_wallet": same},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_sweep_instructions_valid(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-instructions",
            params={
                "old_wallet": "5jtHuHRJxoYBVyVuAok7gkStf53HjKdN3CA9AdWC8J9r",
                "new_wallet": "8fn1G5eUxvUxz1KfQ7yxFkJkB5o91Cej76xq2Tx58mph",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "instructions" in data or "memo" in data

    def test_perf_snapshot_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/admin/perf-snapshot", timeout=10)
        assert r.status_code == 401

    def test_perf_snapshot_authed_sorted(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/perf-snapshot", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        rows = data.get("rows") or data.get("routes") or []
        # If we have multiple rows, ensure p95 desc
        if len(rows) > 1:
            p95s = [r.get("p95_ms") or r.get("p95") or 0 for r in rows]
            assert p95s == sorted(p95s, reverse=True), f"not p95-desc: {p95s[:5]}"

    def test_vault_auth_login_works(self, api):
        r = api.post(
            f"{BASE_URL}/api/admin/vault-auth",
            json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA},
            timeout=15,
        )
        assert r.status_code == 200, r.text
