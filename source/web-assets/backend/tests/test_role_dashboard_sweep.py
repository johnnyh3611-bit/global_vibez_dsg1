"""
Role-Dashboard Backend API smoke (Jan 2026 pre-redeploy)
Validates the /api/* endpoints powering driver / merchant / customer / streamer
dashboards plus the previously-fixed season-pass/me 500→401 regression.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    r = session.post(f"{API}/auth/login", json={
        "email": "betatester1@globalvibez.com",
        "password": "BetaTester2026!"
    }, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Login failed {r.status_code}: {r.text[:200]}")
    data = r.json()
    token = data.get("token") or data.get("access_token")
    user_id = (data.get("user") or {}).get("user_id") or data.get("user_id")
    return {"token": token, "user_id": user_id, "session": session}


# ---------------- season-pass/me regression (500 → 401) ----------------
def test_season_pass_me_unauth_returns_401(session):
    r = session.get(f"{API}/just-for-the-night/season-pass/me", timeout=15)
    assert r.status_code == 401, f"Expected 401 unauth, got {r.status_code}: {r.text[:200]}"


def test_season_pass_me_auth_returns_200(auth):
    r = auth["session"].get(
        f"{API}/just-for-the-night/season-pass/me",
        headers={"Authorization": f"Bearer {auth['token']}"},
        timeout=15,
    )
    assert r.status_code == 200
    body = r.json()
    assert "active" in body


# ---------------- Vibe Ridez Driver dashboard endpoints ----------------
RIDE_ENDPOINTS = [
    "/ride/driver-online",
    "/ride/driver/earnings",
    "/ride/driver/wallet",
    "/ride/driver/active",
]


@pytest.mark.parametrize("path", RIDE_ENDPOINTS)
def test_ride_endpoints_respond(auth, path):
    r = auth["session"].get(f"{API}{path}",
                            headers={"Authorization": f"Bearer {auth['token']}"},
                            timeout=15)
    # Either ok or known-empty (404/204) — must not 500
    assert r.status_code < 500, f"{path} → {r.status_code}: {r.text[:200]}"


# ---------------- HungryVibes merchant endpoints ----------------
HV_ENDPOINTS = [
    "/hungryvibes/merchant/menu",
    "/hungryvibes/merchant/promos",
    "/hungryvibes/merchant/orders",
    "/hungryvibes/restaurants",
]


@pytest.mark.parametrize("path", HV_ENDPOINTS)
def test_hungryvibes_endpoints_respond(auth, path):
    r = auth["session"].get(f"{API}{path}",
                            headers={"Authorization": f"Bearer {auth['token']}"},
                            timeout=15)
    assert r.status_code < 500, f"{path} → {r.status_code}: {r.text[:200]}"


# ---------------- StreamFlow / Streamer dashboard ----------------
STREAM_ENDPOINTS = [
    "/streamflow/driver/payouts",
    "/streamflow/streamer/payouts",
    "/streamflow/streamer/stats",
]


@pytest.mark.parametrize("path", STREAM_ENDPOINTS)
def test_streamflow_endpoints_respond(auth, path):
    r = auth["session"].get(f"{API}{path}",
                            headers={"Authorization": f"Bearer {auth['token']}"},
                            timeout=15)
    assert r.status_code < 500, f"{path} → {r.status_code}: {r.text[:200]}"


# ---------------- Auth smoke ----------------
def test_login_betatester(session):
    r = session.post(f"{API}/auth/login", json={
        "email": "betatester1@globalvibez.com",
        "password": "BetaTester2026!"
    }, timeout=15)
    assert r.status_code == 200
    assert (r.json().get("token") or r.json().get("access_token"))
