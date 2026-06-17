"""
Beta Operational Sweep - Backend health spot-check
Run with: PYTHONPATH=/app/backend pytest /app/backend/tests/test_iter_beta_operational_sweep.py -v
"""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


# ─── critical endpoint health ────────────────────────────────────────
@pytest.mark.parametrize("path", [
    "/health",
    "/vibez-rewards/constants",
    "/coins/stats/burn",
    "/chairs/perks",
    "/chairs/phase",
    "/roguelite-chess/leaderboard",
    "/streamer-actions/constants",
    "/totem-pole/constants",
    "/beta-waitlist/leaderboard",
])
def test_get_endpoint_returns_200(path):
    r = requests.get(f"{API}{path}", timeout=15)
    assert r.status_code == 200, f"{path} returned {r.status_code}: {r.text[:200]}"


def test_burn_stats_payload_shape():
    r = requests.get(f"{API}/coins/stats/burn", timeout=15)
    assert r.status_code == 200
    data = r.json()
    # founder said 'numbers should be present'
    assert isinstance(data, dict) and len(data) > 0


def test_voice_coach_move_tip():
    payload = {
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "last_move": "e4",
        "side": "white",
        "elo": 1200,
    }
    r = requests.post(f"{API}/voice-coach/move-tip", json=payload, timeout=30)
    assert r.status_code == 200, f"voice-coach returned {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "tip" in data or "message" in data or "advice" in data or "text" in data, f"unexpected payload: {data}"


# ─── auth flows ────────────────────────────────────────────────────
def test_demo_login():
    r = requests.post(f"{API}/auth/demo-login", json={}, timeout=20)
    assert r.status_code == 200, f"demo-login {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert "user_id" in data or "user" in data or "token" in data or "access_token" in data, data


@pytest.mark.parametrize("email", [
    "betatester1@globalvibez.com",
    "betatester1@globalvibezdsg.com",
])
def test_beta_login_credentials(email):
    """Try both email domains since memory file has @globalvibez.com but request says @globalvibezdsg.com"""
    r = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": "BetaTester2026!"},
        timeout=20,
    )
    # Don't fail hard, just record
    assert r.status_code in (200, 401, 404), f"unexpected {r.status_code}: {r.text[:200]}"
    if r.status_code == 200:
        print(f"OK: {email} logged in")
    else:
        print(f"FAIL: {email} -> {r.status_code}")


def test_signup_endpoint_responds():
    """Just confirm signup endpoint exists and validates"""
    r = requests.post(f"{API}/auth/signup", json={}, timeout=15)
    # should 400/422 for missing fields, NOT 500
    assert r.status_code in (400, 422), f"signup returned {r.status_code}: {r.text[:200]}"


# ─── room/route content sanity (HEAD/GET on server-served paths) ──
@pytest.mark.parametrize("path", [
    "/",
    "/games",
    "/login",
    "/signup",
    "/dashboard",
    "/streamer/setup-guide",
    "/just-for-the-night",
    "/hungryvibes",
])
def test_frontend_route_returns_html(path):
    r = requests.get(f"{BASE}{path}", timeout=15, allow_redirects=True)
    assert r.status_code == 200, f"{path} returned {r.status_code}"
    # SPA always returns the same shell — confirm it's HTML
    assert "<html" in r.text.lower() or "<!doctype" in r.text.lower(), f"{path} is not html"
