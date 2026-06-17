"""Final pre-redeploy smoke verification — Jan 2026.
Covers: health, auth, dashboards, stripe connect, unified earnings, JFTN, smoke probes.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def demo_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": "demo@globalvibez.com", "password": "FreshStart2026!"})
    assert r.status_code == 200, f"demo login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in response: {data}"
    return token


@pytest.fixture(scope="module")
def beta_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": "betatester1@globalvibez.com", "password": "BetaTester2026!"})
    assert r.status_code == 200, f"beta login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    return data.get("access_token") or data.get("token")


# Health
def test_health(session):
    r = session.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200


# Auth — demo + beta
def test_demo_login(demo_token):
    assert demo_token and len(demo_token) > 10


def test_beta_login(beta_token):
    assert beta_token and len(beta_token) > 10


# Stripe Connect — auth required, configured=false acceptable
def test_connect_status_unauth(session):
    r = session.get(f"{BASE_URL}/api/connect/status")
    assert r.status_code in (401, 403)


def test_connect_status_auth(session, demo_token):
    r = session.get(f"{BASE_URL}/api/connect/status", headers={"Authorization": f"Bearer {demo_token}"})
    assert r.status_code == 200
    data = r.json()
    assert "configured" in data


# JFTN rooms
def test_jftn_rooms(session):
    r = session.get(f"{BASE_URL}/api/just-for-the-night/rooms")
    assert r.status_code == 200
    data = r.json()
    # accept dict with rooms or list
    if isinstance(data, dict):
        assert "rooms" in data or "data" in data or len(data) > 0
    else:
        assert isinstance(data, list)


# Live activity recent (public)
def test_live_activity_recent(session):
    r = session.get(f"{BASE_URL}/api/live-activity/recent")
    assert r.status_code == 200


# JFTN season pass — unauth 401
def test_jftn_season_pass_unauth(session):
    r = session.get(f"{BASE_URL}/api/just-for-the-night/season-pass/me")
    assert r.status_code in (401, 403)


# Unified earnings — unauth 401
def test_unified_earnings_unauth(session):
    r = session.get(f"{BASE_URL}/api/me/unified-earnings")
    assert r.status_code in (401, 403)


def test_unified_earnings_auth(session, beta_token):
    r = session.get(f"{BASE_URL}/api/me/unified-earnings", headers={"Authorization": f"Bearer {beta_token}"})
    assert r.status_code == 200
    data = r.json()
    # Should have total + per-role breakdown
    assert isinstance(data, dict)


# Admin pulse — unauth 401/403
def test_admin_pulse_unauth(session):
    r = session.get(f"{BASE_URL}/api/live-activity/admin-pulse")
    assert r.status_code in (401, 403)


# HungryVibes merchant orders — auth required
def test_hungryvibes_merchant_orders(session, beta_token):
    r = session.get(f"{BASE_URL}/api/smartstack/merchant/orders", headers={"Authorization": f"Bearer {beta_token}"})
    # 200 if user is merchant, 403 if not
    assert r.status_code in (200, 403, 404)


# HungryVibes customer orders
def test_hungryvibes_customer_orders(session, beta_token):
    r = session.get(f"{BASE_URL}/api/smartstack/orders/me", headers={"Authorization": f"Bearer {beta_token}"})
    assert r.status_code in (200, 404)


# Vibe Venues host dashboard
def test_vibe_venues_host_dashboard(session, beta_token):
    r = session.get(f"{BASE_URL}/api/vibe-venues/host/dashboard", headers={"Authorization": f"Bearer {beta_token}"})
    assert r.status_code in (200, 403, 404)
