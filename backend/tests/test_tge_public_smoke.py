"""Public URL smoke tests for TGE + Voice Mirror routes (iteration 102)."""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/vault-auth", json={"password": ADMIN_PW, "code": "000000"}, timeout=15)
    assert r.status_code == 200, r.text
    return s


def test_tge_config_public():
    r = requests.get(f"{BASE_URL}/api/tge/config", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] in ("mock", "devnet", "mainnet-beta")
    assert "supported_networks" in body
    assert "min_eligible_vibez" in body


def test_tge_admin_cohort_requires_admin():
    r = requests.get(f"{BASE_URL}/api/tge/admin/cohort", timeout=15)
    assert r.status_code == 403


def test_tge_admin_dry_run_requires_admin():
    r = requests.get(f"{BASE_URL}/api/tge/admin/dry-run", timeout=15)
    assert r.status_code == 403


def test_tge_admin_execute_mint_requires_admin():
    r = requests.post(f"{BASE_URL}/api/tge/admin/execute-mint", json={"confirm": True}, timeout=15)
    assert r.status_code == 403


def test_tge_admin_batches_requires_admin():
    r = requests.get(f"{BASE_URL}/api/tge/admin/batches", timeout=15)
    assert r.status_code == 403


def test_tge_admin_dry_run_with_session(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/tge/admin/dry-run", timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "eligible_count" in body
    assert "pending_opt_in_count" in body
    assert "total_vibez_to_mint" in body
    assert body["mode"] == "mock"


def test_tge_admin_cohort_with_session(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/tge/admin/cohort", timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "cohort_size" in body
    assert "rows" in body
    assert isinstance(body["rows"], list)


def test_tge_admin_execute_rejects_without_confirm(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/tge/admin/execute-mint", json={"confirm": False}, timeout=20)
    assert r.status_code == 400


def test_tge_admin_execute_creates_simulated_batch(admin_session):
    r = admin_session.post(
        f"{BASE_URL}/api/tge/admin/execute-mint",
        json={"min_vibez": 10, "confirm": True},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    batch = body["batch"]
    assert batch["status"] == "SIMULATED"
    assert batch["mode"] == "mock"
    assert "batch_id" in batch

    # Verify it appears in batches list
    r2 = admin_session.get(f"{BASE_URL}/api/tge/admin/batches", timeout=20)
    assert r2.status_code == 200
    ids = [b["batch_id"] for b in r2.json()["batches"]]
    assert batch["batch_id"] in ids


def test_tge_me_opt_in_rejects_invalid_wallet():
    uid = f"pytest_smoke_{uuid.uuid4().hex[:8]}"
    r = requests.post(
        f"{BASE_URL}/api/tge/me/opt-in",
        json={"wallet": "tooShort", "opt_in": True},
        headers={"x-user-id": uid},
        timeout=15,
    )
    assert r.status_code == 400


def test_tge_me_opt_in_accepts_valid_wallet():
    uid = f"pytest_smoke_{uuid.uuid4().hex[:8]}"
    # First provision user via /api/users or just opt-in; server upserts? Check update_one with upsert=False.
    # Create user via demo-login then set x-user-id? Simpler: use users collection direct — but we don't have DB.
    # Use x-user-id header; set_user_tge_opt_in does update_one with upsert=False so user must exist.
    # Register via /api/auth/demo-login which creates a user.
    s = requests.Session()
    dl = s.post(f"{BASE_URL}/api/auth/demo-login", timeout=15)
    assert dl.status_code == 200, dl.text
    valid_wallet = "9wFFFfghi9vVvWwiHnQxKhs5x7sG7bAXbvTeQFhDkpbH"
    r = s.post(
        f"{BASE_URL}/api/tge/me/opt-in",
        json={"wallet": valid_wallet, "opt_in": True},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["user"]["tge_opt_in"] is True
    assert body["user"]["solana_wallet_address"] == valid_wallet


def test_tge_me_status_returns_totals():
    s = requests.Session()
    dl = s.post(f"{BASE_URL}/api/auth/demo-login", timeout=15)
    assert dl.status_code == 200
    r = s.get(f"{BASE_URL}/api/tge/me/status", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "user" in body
    assert "total_vibez" in body
    assert "config" in body
    assert isinstance(body["total_vibez"], (int, float))


def test_tge_me_status_requires_auth():
    r = requests.get(f"{BASE_URL}/api/tge/me/status", timeout=15)
    assert r.status_code == 401


def test_voice_mirror_transcribe_endpoint_exists():
    # Expect 4xx/422 without audio (validation failure), NOT 404.
    r = requests.post(
        f"{BASE_URL}/api/voice-mirror/transcribe-and-translate",
        json={},
        timeout=20,
    )
    assert r.status_code != 404, f"Endpoint should exist, got: {r.status_code} {r.text[:200]}"
    # Should be a validation error (422) or similar
    assert r.status_code in (400, 422, 500), f"Unexpected status {r.status_code}: {r.text[:200]}"
