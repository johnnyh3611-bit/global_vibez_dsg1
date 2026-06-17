"""DSG TV Expansion endpoint smoke tests (P0 plan)."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
DEMO_EMAIL = "betatester1@globalvibez.com"
DEMO_PASSWORD = "BetaTester2026!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    r = session.post(f"{BASE}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed status={r.status_code} body={r.text[:200]}")
    data = r.json()
    token = data.get("token") or data.get("access_token")
    if not token:
        pytest.skip(f"no token returned: {data}")
    return token


@pytest.fixture(scope="module")
def authed(session, auth_token):
    session.headers.update({"Authorization": f"Bearer {auth_token}"})
    return session


# ─── Public endpoints ───
def test_constants_endpoint(session):
    r = session.get(f"{BASE}/api/dsg-tv/constants", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["stools_per_chair"] == 100
    ps = d["predict_split"]
    assert ps["broadcaster_pct"] == 0.05
    assert ps["treasury_pct"] == 0.01
    assert ps["winners_pct"] == 0.94
    assert ps["burn_pct"] == 0.0
    assert isinstance(d["prestige_tiers"], list) and "standard" in d["prestige_tiers"]
    assert isinstance(d["upgrade_costs_coins"], dict) and len(d["upgrade_costs_coins"]) >= 2


def test_predict_open_public(session):
    r = session.get(f"{BASE}/api/dsg-tv/predict/open", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "rows" in d and "count" in d
    assert isinstance(d["rows"], list)


# ─── Auth guards ───
def test_prestige_me_requires_auth():
    r = requests.get(f"{BASE}/api/dsg-tv/prestige/me", timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


def test_stools_me_requires_auth():
    r = requests.get(f"{BASE}/api/dsg-tv/stools/me", timeout=15)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


# ─── Authed endpoints ───
def test_prestige_me_authed(authed):
    r = authed.get(f"{BASE}/api/dsg-tv/prestige/me", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert "chair" in d and "tiers" in d and "upgrade_costs_coins" in d


def test_stools_me_authed(authed):
    r = authed.get(f"{BASE}/api/dsg-tv/stools/me", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["stools_per_chair"] == 100


def test_predict_create_authed(authed):
    r = authed.post(
        f"{BASE}/api/dsg-tv/predict/create",
        json={"prompt": "TEST_pool_will_x_win_match?", "options": ["Yes", "No"]},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("ok") is True
    assert "pool_id" in d
    # verify list endpoint includes the new pool
    list_r = authed.get(f"{BASE}/api/dsg-tv/predict/open", timeout=15)
    assert list_r.status_code == 200
    pool_ids = [p["pool_id"] for p in list_r.json()["rows"]]
    assert d["pool_id"] in pool_ids


# ─── Admin guards ───
def test_admin_grant_rejects_non_admin(authed):
    r = authed.post(
        f"{BASE}/api/admin/dsg-tv/stools/grant",
        json={"user_id": "nonexistent", "count": 5, "reason": "TEST"},
        timeout=15,
    )
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}: {r.text[:200]}"


def test_admin_resolve_rejects_non_admin(authed):
    r = authed.post(
        f"{BASE}/api/admin/dsg-tv/predict/resolve",
        json={"pool_id": "pred_doesnotexist", "outcome": "Yes"},
        timeout=15,
    )
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}: {r.text[:200]}"
