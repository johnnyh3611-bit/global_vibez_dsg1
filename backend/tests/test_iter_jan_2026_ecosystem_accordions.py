"""
Iteration Jan 2026 — Ecosystem Mechanics + WhatsNext accordions + PrivyAuthProvider error-boundary fix.

Backend regression coverage:
  1. /api/health up.
  2. /api/auth/demo-login returns 200 + token (guest auto-provision still working after DB wipe).
  3. /api/chairs/economics first two tier names are 'Genius' / 'Genesis' (phase rename regression).
  4. /api/chairs/expansion-plan first two tier names are 'Genius Phase' / 'Genesis Phase'.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- health -----------------------------------------------------------------
def test_api_health(api):
    r = api.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") in ("ok", "healthy", "OK")


# --- demo login -------------------------------------------------------------
def test_demo_login_returns_token(api):
    r = api.post(f"{BASE_URL}/api/auth/demo-login", json={}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
    assert "user_id" in data
    assert "name" in data


# --- phase rename regression ------------------------------------------------
def test_chairs_economics_tier_names(api):
    r = api.get(f"{BASE_URL}/api/chairs/economics", timeout=15)
    assert r.status_code == 200
    tiers = r.json().get("tiers", [])
    assert len(tiers) >= 2
    assert tiers[0]["name"] == "Genius", f"tier0 was {tiers[0]['name']}"
    assert tiers[1]["name"] == "Genesis", f"tier1 was {tiers[1]['name']}"


def test_chairs_expansion_plan_tier_names(api):
    r = api.get(f"{BASE_URL}/api/chairs/expansion-plan", timeout=15)
    assert r.status_code == 200
    tiers = r.json().get("tiers", [])
    assert len(tiers) >= 2
    assert tiers[0]["name"] == "Genius Phase", f"tier0 was {tiers[0]['name']}"
    assert tiers[1]["name"] == "Genesis Phase", f"tier1 was {tiers[1]['name']}"
