"""
Final Pre-Deploy Beta Verification Sweep — Feb 18, 2026
Tests: 3 beta tester logins, demo login, signup, beta-waitlist public submit.
"""
import os
import requests
import uuid
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
BETA_PASS = "BetaTester2026!"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- BETA TESTER ACCOUNTS (auto-seeded) ----------
@pytest.mark.parametrize("email", [
    "betatester1@globalvibez.com",
    "betatester2@globalvibez.com",
    "betatester3@globalvibez.com",
])
def test_beta_tester_login(client, email):
    r = client.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": BETA_PASS})
    assert r.status_code == 200, f"{email} login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and len(data["token"]) > 0
    assert data["user"]["email"] == email
    # profile_completed should be True so they skip age verification
    assert data["user"].get("profile_completed") is True, f"{email} not pre-verified"


# ---------- DEMO LOGIN ----------
def test_demo_login(client):
    r = client.post(f"{BASE_URL}/api/auth/demo-login", json={})
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data or "user_id" in data or "user" in data


# ---------- NEW SIGNUP ----------
def test_new_signup(client):
    unique = uuid.uuid4().hex[:8]
    payload = {
        "email": f"TEST_signup_{unique}@example.com",
        "password": "Strongpass123!",
        "name": f"Test {unique}",
        "date_of_birth": "1995-06-15",
    }
    r = client.post(f"{BASE_URL}/api/auth/signup", json=payload)
    assert r.status_code in (200, 201), f"signup failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert "token" in data or "user" in data or "user_id" in data


# ---------- BETA WAITLIST PUBLIC SUBMIT ----------
def test_beta_waitlist_public_submit(client):
    unique = uuid.uuid4().hex[:8]
    payload = {
        "email": f"TEST_wl_{unique}@example.com",
        "name": f"Tester {unique}",
        "interests": ["games", "music"],
    }
    r = client.post(f"{BASE_URL}/api/beta-waitlist/signup", json=payload)
    # Some apis use /api/beta-waitlist or /api/waitlist; try fallback if 404
    if r.status_code == 404:
        r = client.post(f"{BASE_URL}/api/beta-waitlist", json=payload)
    assert r.status_code in (200, 201), f"waitlist submit failed: {r.status_code} {r.text[:200]}"


# ---------- WRONG PASSWORD GUARD ----------
def test_beta_tester_wrong_password(client):
    r = client.post(f"{BASE_URL}/api/auth/login",
                    json={"email": "betatester1@globalvibez.com", "password": "wrongpw"})
    assert r.status_code in (400, 401, 403)
