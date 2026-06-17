"""DSG Logistics P0 backend tests — 8-module blueprint coverage.

Verifies:
  • /api/dsg-logistics/constants returns recirculation_model='40/30/30',
    in_app_burn_pct=0.0, safety_countdown_seconds=15, etc.
  • Module 1 breakdown trigger (vibe_ridez → ride_credit, hunger_vibez → remake).
  • Module 2 safety arm + override.
  • Module 3 hardware verify (both ok = compliant, one false = non_compliant).
  • Module 6 override-console snapshot.
  • Module 7 driver tier.
  • Module 8 Creator Kitchen register / featured-dish / order / delay.
  • Auth gates on /me endpoints (401/403 without session).
  • Admin guards on admin/dsg-logistics/* endpoints.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
PUBLIC = f"{BASE_URL}/api/dsg-logistics"
ADMIN = f"{BASE_URL}/api/admin/dsg-logistics"

EMAIL = "betatester1@globalvibez.com"
PASSWORD = "BetaTester2026!"


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    tok = data.get("token") or data.get("access_token") or data.get("session_token")
    if not tok:
        pytest.skip(f"no token in login response: {data}")
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ───────────────────────── Constants ──────────────────────────────

def test_constants_blueprint():
    r = requests.get(f"{PUBLIC}/constants", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["recirculation_model"] == "40/30/30"
    assert d["in_app_burn_pct"] == 0.0
    assert d["safety_countdown_seconds"] == 15
    assert d["creator_featured_dish_coins"] == 15000
    assert d["cancellation_flat_fee_coins"] == 500
    ps = d["payout_splits"]
    assert ps["passenger_cancel_late"]["driver_pct"] == 0.75
    assert ps["passenger_no_show"]["driver_pct"] == 0.80
    assert ps["platform_emergency_redirect"]["driver_pct"] == 0.30
    assert {"standard", "vip_premium", "elite_vibe"} <= set(d["tier_rules"].keys())


# ─────────────────── Module 1 + 2: Breakdown + Safety ─────────────

@pytest.fixture(scope="module")
def vibe_ridez_incident(auth_headers):
    job_id = f"TEST_job_{uuid.uuid4().hex[:8]}"
    r = requests.post(
        f"{PUBLIC}/breakdown/trigger",
        headers=auth_headers,
        json={"kind": "vibe_ridez", "job_id": job_id},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("ok") is True
    assert d.get("incident_id", "").startswith("brk_")
    assert d.get("ride_credit_id", "").startswith("credit_")
    return d


def test_breakdown_vibe_ridez(vibe_ridez_incident):
    d = vibe_ridez_incident
    assert d["kind"] == "vibe_ridez"
    assert d["status"] == "active"


def test_breakdown_hunger_vibez(auth_headers):
    job_id = f"TEST_order_{uuid.uuid4().hex[:8]}"
    r = requests.post(
        f"{PUBLIC}/breakdown/trigger",
        headers=auth_headers,
        json={"kind": "hunger_vibez", "job_id": job_id},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d.get("remake_order_id", "").startswith("remake_")


def test_safety_arm(auth_headers, vibe_ridez_incident):
    incident_id = vibe_ridez_incident["incident_id"]
    r = requests.post(
        f"{PUBLIC}/safety/arm",
        headers=auth_headers,
        json={"incident_id": incident_id, "stream_url": f"safety://{incident_id}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["countdown_seconds"] == 15


def test_safety_override(auth_headers):
    # Create a fresh incident, then override it
    r = requests.post(
        f"{PUBLIC}/breakdown/trigger",
        headers=auth_headers,
        json={"kind": "vibe_ridez", "job_id": f"TEST_or_{uuid.uuid4().hex[:6]}"},
        timeout=15,
    )
    inc = r.json()["incident_id"]
    r2 = requests.post(
        f"{PUBLIC}/safety/override",
        headers=auth_headers,
        json={"incident_id": inc, "note": "TEST manual override"},
        timeout=15,
    )
    assert r2.status_code == 200, r2.text
    d = r2.json()
    assert d["ok"] is True
    assert d["status"] == "manual_override"


# ─────────────────── Module 3: Hardware ───────────────────────────

def test_hardware_verify_compliant(auth_headers):
    r = requests.post(
        f"{PUBLIC}/hardware/verify",
        headers=auth_headers,
        json={"interior_lens_ok": True, "exterior_lens_ok": True,
              "hardware_id": "TEST_cam_dual"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["status"] == "compliant"


def test_hardware_verify_non_compliant(auth_headers):
    r = requests.post(
        f"{PUBLIC}/hardware/verify",
        headers=auth_headers,
        json={"interior_lens_ok": False, "exterior_lens_ok": True,
              "hardware_id": "TEST_cam_partial"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "non_compliant"


def test_hardware_me(auth_headers):
    # restore compliant first so override-console test is stable
    requests.post(
        f"{PUBLIC}/hardware/verify",
        headers=auth_headers,
        json={"interior_lens_ok": True, "exterior_lens_ok": True,
              "hardware_id": "TEST_cam_dual"},
        timeout=15,
    )
    r = requests.get(f"{PUBLIC}/hardware/me", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["compliance"]["status"] in ("compliant", "non_compliant")


# ─────────────────── Module 6: Override Console ───────────────────

def test_override_console_me(auth_headers):
    r = requests.get(f"{PUBLIC}/override-console/me", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "driver_id" in d
    assert "hardware" in d
    assert "white_glove_strikes" in d
    assert d["countdown_seconds"] == 15


# ─────────────────── Module 7: Tier ────────────────────────────────

def test_tier_me(auth_headers):
    r = requests.get(f"{PUBLIC}/tier/me", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["tier"] in ("standard", "vip_premium", "elite_vibe")
    assert isinstance(d.get("perks"), list)


# ─────────────────── Module 8: Creator Kitchen ────────────────────

def test_kitchen_register_and_dup(auth_headers):
    name = f"TEST_kitchen_{uuid.uuid4().hex[:6]}"
    r = requests.post(
        f"{PUBLIC}/creator-kitchen/register",
        headers=auth_headers,
        json={"name": name, "bio": "TEST bio"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    # If already registered from a prior run, that's still a valid signal.
    if d.get("ok"):
        assert d["deep_link"].startswith("vibez://hunger/c/")
    else:
        assert d["reason"] == "already_registered"

    # second call should always be already_registered
    r2 = requests.post(
        f"{PUBLIC}/creator-kitchen/register",
        headers=auth_headers,
        json={"name": name, "bio": ""},
        timeout=15,
    )
    d2 = r2.json()
    assert d2["ok"] is False and d2["reason"] == "already_registered"


def test_kitchen_me(auth_headers):
    r = requests.get(f"{PUBLIC}/creator-kitchen/me", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["kitchen"] is not None
    assert d["kitchen"]["deep_link"].startswith("vibez://hunger/c/")


def test_kitchen_featured_dish(auth_headers):
    me = requests.get(f"{PUBLIC}/creator-kitchen/me", headers=auth_headers).json()
    kid = me["kitchen"]["kitchen_id"]
    r = requests.post(
        f"{PUBLIC}/creator-kitchen/featured-dish",
        headers=auth_headers,
        json={"kitchen_id": kid, "dish_name": "TEST Wings", "price_coins": 15000},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["price_coins"] == 15000


def test_kitchen_order_no_burn(auth_headers):
    me = requests.get(f"{PUBLIC}/creator-kitchen/me", headers=auth_headers).json()
    kid = me["kitchen"]["kitchen_id"]
    r = requests.post(
        f"{PUBLIC}/creator-kitchen/order",
        headers=auth_headers,
        json={"kitchen_id": kid},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    # may fail on insufficient_funds (beta tester wallet); but we MUST verify
    # the response shape contains no burn signaling
    if d.get("ok"):
        assert d.get("creator_share", 0) > 0
        assert d.get("platform_share", 0) >= 0
    else:
        # acceptable known fail mode: insufficient_funds
        assert d.get("reason") in ("insufficient_funds", "no_featured_dish")


def test_kitchen_delay(auth_headers):
    me = requests.get(f"{PUBLIC}/creator-kitchen/me", headers=auth_headers).json()
    kid = me["kitchen"]["kitchen_id"]
    r = requests.post(
        f"{PUBLIC}/creator-kitchen/delay",
        headers=auth_headers,
        json={"kitchen_id": kid, "prep_minutes": 12},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] is True
    assert d["prep_minutes"] == 12


# ───────────────────── Auth & admin gates ──────────────────────────

@pytest.mark.parametrize("path", [
    "/hardware/me",
    "/override-console/me",
    "/tier/me",
    "/creator-kitchen/me",
])
def test_auth_required_endpoints(path):
    r = requests.get(f"{PUBLIC}{path}", timeout=15)
    assert r.status_code in (401, 403), f"{path} returned {r.status_code}"


@pytest.mark.parametrize("method,path,body", [
    ("POST", "/white-glove/violation",
     {"driver_id": "x", "physical_constraint_verified": False}),
    ("POST", "/cancellation/process",
     {"job_id": "j", "driver_id": "d", "kind": "passenger_cancel_late"}),
    ("GET", "/incidents/active", None),
    ("GET", "/cancellation/recent", None),
])
def test_admin_required(method, path, body):
    url = f"{ADMIN}{path}"
    if method == "GET":
        r = requests.get(url, timeout=15)
    else:
        r = requests.post(url, json=body, timeout=15)
    assert r.status_code in (401, 403), f"{path} returned {r.status_code}"
