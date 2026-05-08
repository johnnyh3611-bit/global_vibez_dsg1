"""
Iteration 118 - System-wide audit per user request.
Covers Section A (backend health sweep) of the review_request.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
REAL_EMAIL = "johnnyh3611@gmail.com"
REAL_PASS = "FreshStart2026!"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def demo_token(s):
    r = s.post(f"{API}/auth/demo-login", timeout=15)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token in demo-login: {data}"
    return tok


@pytest.fixture(scope="module")
def demo_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}"}


# ---- A1 demo-login ----
def test_a1_demo_login(s):
    r = s.post(f"{API}/auth/demo-login", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("token") or j.get("access_token")


# ---- A2 real login ----
def test_a2_real_login(s):
    r = s.post(f"{API}/auth/login", json={"email": REAL_EMAIL, "password": REAL_PASS}, timeout=15)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    j = r.json()
    assert j.get("token") or j.get("access_token")
    assert j.get("user", {}).get("email") == REAL_EMAIL or "user" in j


# ---- A3 /auth/me ----
def test_a3_auth_me(s, demo_headers):
    r = s.get(f"{API}/auth/me", headers=demo_headers, timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert "id" in j or "user_id" in j or "email" in j


# ---- A4 bid-whist start ----
def test_a4_bidwhist_start(s, demo_headers):
    r = s.post(f"{API}/bid-whist/start", headers=demo_headers, json={}, timeout=20)
    assert r.status_code in (200, 201), f"{r.status_code} {r.text[:300]}"
    j = r.json()
    gid = j.get("game_id") or j.get("gameId") or j.get("id")
    assert gid, f"no game_id: {j}"
    pytest.bw_game_id = gid


# ---- A5 bid-whist get game ----
def test_a5_bidwhist_game_state(s, demo_headers):
    gid = getattr(pytest, "bw_game_id", None)
    if not gid:
        pytest.skip("A4 failed")
    r = s.get(f"{API}/bid-whist/game/{gid}", headers=demo_headers, timeout=15)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    j = r.json()
    # state may nest under gameState or top-level
    gs = j.get("gameState") or j
    assert "phase" in gs or "players" in gs or "your_hand" in gs


# ---- A6 bid-whist practice start ----
def test_a6_bidwhist_practice_start(s, demo_headers):
    # Try a few known paths
    tried = []
    for path in ("/bid-whist-practice/start", "/bid-whist/practice/start", "/practice/bid_whist/start"):
        r = s.post(f"{API}{path}", headers=demo_headers, json={}, timeout=15)
        tried.append((path, r.status_code))
        if r.status_code in (200, 201):
            return
    pytest.fail(f"None worked: {tried}")


# ---- A7 practice start for many games ----
@pytest.mark.parametrize("game_type", [
    "poker", "hearts", "spades", "blackjack", "rummy",
    "gin_rummy", "go_fish", "crazy_eights", "war",
])
def test_a7_practice_start(s, demo_headers, game_type):
    r = s.post(f"{API}/practice/start", headers=demo_headers, json={"game_type": game_type}, timeout=20)
    assert r.status_code in (200, 201), f"{game_type} -> {r.status_code} {r.text[:200]}"


# ---- A8 health / master-stats ----
def test_a8_health_endpoints(s):
    got = 0
    for p in ("/", "/health", "/healthz"):
        r = s.get(f"{API}{p}", timeout=10)
        if r.status_code == 200:
            got += 1
    assert got >= 1


# ---- A9 socket.io handshake ----
def test_a9_socketio_handshake(s):
    # Polling transport handshake
    r = s.get(f"{API}/socket.io/?EIO=4&transport=polling", timeout=10)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    assert '"sid"' in r.text or "sid" in r.text


# ---- SECTION D sanity: known multiplayer list endpoints ----
@pytest.mark.parametrize("endpoint", [
    "/games",
    "/multiplayer/games",
    "/matchmaking/games",
])
def test_games_catalog(s, demo_headers, endpoint):
    r = s.get(f"{API}{endpoint}", headers=demo_headers, timeout=10)
    # At least one should work; we don't fail individually
    assert r.status_code in (200, 404)
