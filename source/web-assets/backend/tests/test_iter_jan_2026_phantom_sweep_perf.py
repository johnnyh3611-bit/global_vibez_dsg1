"""Backend tests for Phantom + Sweep + PerfSparkline iteration (Jan 2026).

Covers:
- GET /api/admin/solana-indexer/sweep-balance (auth, validation, 200 happy)
- POST /api/admin/solana-indexer/sweep-instructions (auth, validation, 200 happy)
- GET /api/admin/perf-snapshot (auth, shape, sort by p95_ms desc)
- GET /api/admin/solana-indexer/status (treasury_wallet correct)
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")
ADMIN_2FA = os.environ.get("ADMIN_2FA", "000000")

EXPECTED_TREASURY = "8fn1G5eUxvUxz1KfQ7yxFkJkB5o91Cej76xq2Tx58mph"
DIFFERENT_VALID_WALLET = "5jtHuHRJxoYBVyVuAok7gkStf53HjKdN3CA9AdWC8J9r"
INVALID_WALLET = "not_a_real_wallet_!@#"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/admin/vault-auth",
        json={"password": ADMIN_PW, "code": ADMIN_2FA},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin vault-auth failed: {r.status_code} {r.text[:200]}")
    return s


@pytest.fixture(scope="module")
def anon_session():
    return requests.Session()


# ------------- sweep-balance -------------

class TestSweepBalance:
    def test_401_without_admin(self, anon_session):
        r = anon_session.get(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-balance",
            params={"old_wallet": EXPECTED_TREASURY},
            timeout=15,
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_400_invalid_address(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-balance",
            params={"old_wallet": INVALID_WALLET},
            timeout=15,
        )
        assert r.status_code == 400

    def test_200_valid_address(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-balance",
            params={"old_wallet": EXPECTED_TREASURY},
            timeout=30,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        data = r.json()
        for key in (
            "old_wallet",
            "current_treasury",
            "balance_lamports",
            "balance_sol",
            "sweepable_lamports",
            "sweepable_sol",
            "fee_buffer_lamports",
        ):
            assert key in data, f"missing key {key} in {data}"
        assert data["old_wallet"] == EXPECTED_TREASURY
        assert data["current_treasury"] == EXPECTED_TREASURY
        assert isinstance(data["balance_lamports"], int)
        assert isinstance(data["balance_sol"], (int, float))
        assert isinstance(data["fee_buffer_lamports"], int)


# ------------- sweep-instructions -------------

class TestSweepInstructions:
    def test_401_without_admin(self, anon_session):
        r = anon_session.post(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-instructions",
            params={"old_wallet": DIFFERENT_VALID_WALLET},
            timeout=15,
        )
        assert r.status_code in (401, 403)

    def test_400_when_old_equals_current(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-instructions",
            params={"old_wallet": EXPECTED_TREASURY},
            timeout=15,
        )
        assert r.status_code == 400

    def test_400_invalid_address(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-instructions",
            params={"old_wallet": INVALID_WALLET},
            timeout=15,
        )
        assert r.status_code == 400

    def test_200_valid_different_wallet(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/admin/solana-indexer/sweep-instructions",
            params={"old_wallet": DIFFERENT_VALID_WALLET},
            timeout=30,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        data = r.json()
        for key in ("from", "to", "amount_lamports", "amount_sol", "memo", "instructions"):
            assert key in data, f"missing key {key}"
        assert data["from"] == DIFFERENT_VALID_WALLET
        assert data["to"] == EXPECTED_TREASURY
        assert isinstance(data["instructions"], list) and len(data["instructions"]) > 0
        # memo format: GVZ-SWEEP-YYYYMMDD
        assert re.match(r"^GVZ-SWEEP-\d{8}$", data["memo"]), f"bad memo {data['memo']}"


# ------------- perf-snapshot -------------

class TestPerfSnapshot:
    def test_401_without_admin(self, anon_session):
        r = anon_session.get(f"{BASE_URL}/api/admin/perf-snapshot", timeout=15)
        assert r.status_code in (401, 403)

    def test_200_with_admin_and_sort(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/perf-snapshot", timeout=15)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        data = r.json()
        for key in ("success", "tracked_routes", "total_samples", "samples_per_route_cap", "rows"):
            assert key in data, f"missing {key} in {data}"
        assert data["success"] is True
        assert isinstance(data["rows"], list)
        # Verify rows sorted by p95_ms desc (when there are 2+ rows)
        for row in data["rows"]:
            for k in ("route", "samples", "p50_ms", "p95_ms", "p99_ms", "max_ms", "avg_ms"):
                assert k in row, f"row missing {k}: {row}"
        if len(data["rows"]) >= 2:
            p95s = [row["p95_ms"] for row in data["rows"]]
            assert p95s == sorted(p95s, reverse=True), f"rows not sorted by p95_ms desc: {p95s}"


# ------------- solana-indexer/status -------------

class TestSolanaIndexerStatus:
    def test_treasury_wallet_in_env(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/solana-indexer/status", timeout=15)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("treasury_wallet") == EXPECTED_TREASURY, (
            f"treasury_wallet={data.get('treasury_wallet')}, expected {EXPECTED_TREASURY}"
        )
