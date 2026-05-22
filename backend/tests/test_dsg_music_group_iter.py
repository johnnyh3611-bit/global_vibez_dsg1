"""Integration tests for DSG Music Group module (Jan 2026 iteration).

Covers:
  - /api/music-group/constants (public)
  - rights ledger set/get/can-play (authed; owner enforcement)
  - collaborator splits (authed; bps invariant)
  - royalty/me (authed)
  - admin guards on /api/admin/music-group/*
  - admin dsg-logistics guards
  - sandbox firewall presence
"""
from __future__ import annotations

import os
import uuid
import pytest
import requests
from pathlib import Path

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # Try frontend/.env
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE}/api"


@pytest.fixture(scope="module")
def beta_session():
    s = requests.Session()
    # try beta tester login
    r = s.post(f"{API}/auth/login", json={
        "email": "betatester1@globalvibez.com",
        "password": "BetaTester2026!",
    }, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"beta tester login failed: {r.status_code} {r.text[:200]}")
    return s


# ─── Constants (public) ───
def test_constants_public():
    r = requests.get(f"{API}/music-group/constants", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["bps_total"] == 10000
    assert d["platform_split"]["artist_collective"] == 0.80
    assert d["platform_split"]["treasury"] == 0.15
    assert d["platform_split"]["tournament"] == 0.05
    assert d["platform_split"]["burn"] == 0.0
    assert "tv_sync" in d["sync_contexts"]
    assert "casino_background" in d["sync_contexts"]
    assert "commercial_use" in d["sync_contexts"]


# ─── Auth guards (no session → 401/403) ───
def test_rights_set_requires_auth():
    r = requests.post(f"{API}/music-group/rights/set", json={
        "track_id": "fake", "allow_tv_sync": True,
    }, timeout=15)
    assert r.status_code in (401, 403), r.text[:200]


def test_splits_set_requires_auth():
    r = requests.post(f"{API}/music-group/splits/set", json={
        "track_id": "fake",
        "splits": [{"user_id": "u1", "basis_points": 10000}],
    }, timeout=15)
    assert r.status_code in (401, 403), r.text[:200]


def test_royalty_me_requires_auth():
    r = requests.get(f"{API}/music-group/royalty/me", timeout=15)
    assert r.status_code in (401, 403)


# ─── Admin guards ───
def test_admin_disburse_requires_admin():
    r = requests.post(f"{API}/admin/music-group/royalty/disburse", json={
        "track_id": "fake", "payout_coins": 100,
    }, timeout=15)
    assert r.status_code in (401, 403)


def test_admin_recent_royalty_requires_admin():
    r = requests.get(f"{API}/admin/music-group/royalty/recent", timeout=15)
    assert r.status_code in (401, 403)


def test_admin_dsg_logistics_incidents_requires_admin():
    r = requests.get(f"{API}/admin/dsg-logistics/incidents/active", timeout=15)
    assert r.status_code in (401, 403)


def test_admin_dsg_logistics_cancellation_recent_requires_admin():
    r = requests.get(f"{API}/admin/dsg-logistics/cancellation/recent", timeout=15)
    assert r.status_code in (401, 403)


# ─── Authed flows (beta tester) ───
def test_royalty_me_authed_returns_rows(beta_session):
    r = beta_session.get(f"{API}/music-group/royalty/me", timeout=15)
    assert r.status_code == 200, r.text[:200]
    d = r.json()
    assert "rows" in d and "count" in d
    assert isinstance(d["rows"], list)


def test_rights_set_non_owner_returns_reason(beta_session):
    # random fake track id user does not own
    fake_id = f"track_{uuid.uuid4().hex[:8]}"
    r = beta_session.post(f"{API}/music-group/rights/set", json={
        "track_id": fake_id,
        "allow_tv_sync": True,
    }, timeout=15)
    assert r.status_code == 200, r.text[:200]
    d = r.json()
    assert d.get("ok") is False
    assert d.get("reason") == "track_not_found_or_not_owner"


def test_rights_get_default_for_unknown_track():
    fake_id = f"track_{uuid.uuid4().hex[:8]}"
    r = requests.get(f"{API}/music-group/rights/{fake_id}", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["track_id"] == fake_id
    assert d["allow_tv_sync"] is False
    assert d["allow_casino_background"] is False
    assert d["allow_commercial_use"] is False
    assert d.get("default") is True


def test_can_play_default_false():
    fake_id = f"track_{uuid.uuid4().hex[:8]}"
    r = requests.get(f"{API}/music-group/rights/{fake_id}/can-play",
                     params={"context": "tv_sync"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["allowed"] is False
    assert d["context"] == "tv_sync"


def test_splits_get_empty_for_unknown_track():
    fake_id = f"track_{uuid.uuid4().hex[:8]}"
    r = requests.get(f"{API}/music-group/splits/{fake_id}", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["rows"] == []
    assert d["count"] == 0
    assert d["total_basis_points"] == 0
    assert d["valid"] is False


def test_splits_set_invalid_bps_sum_returns_reason(beta_session):
    """Even if track is fake, the BPS validation order matters; bps invariant
    is validated AFTER ownership in current impl — so we expect either
    track_not_found_or_not_owner OR invalid_basis_points_split."""
    fake_id = f"track_{uuid.uuid4().hex[:8]}"
    r = beta_session.post(f"{API}/music-group/splits/set", json={
        "track_id": fake_id,
        "splits": [{"user_id": "u1", "basis_points": 5000},
                   {"user_id": "u2", "basis_points": 3000}],  # 8000, not 10000
    }, timeout=15)
    assert r.status_code == 200, r.text[:200]
    d = r.json()
    assert d.get("ok") is False
    assert d.get("reason") in (
        "track_not_found_or_not_owner",
        "invalid_basis_points_split",
    )


# ─── Sandbox firewall refactor verification ───
def test_sandbox_firewall_extracted():
    server = Path("/app/backend/server.py").read_text()
    assert "from utils.sandbox_firewall import install" in server
    assert "_install_sandbox_firewall(app, db, logger)" in server
    # The inline definition must NOT exist anymore in server.py
    assert "async def _sandbox_firewall(request: Request, exc: Exception)" not in server, \
        "inline _sandbox_firewall handler must be removed from server.py"

    fw = Path("/app/backend/utils/sandbox_firewall.py").read_text()
    assert "def install(app" in fw
    assert "internal error" in fw
    assert "security_events" in fw
