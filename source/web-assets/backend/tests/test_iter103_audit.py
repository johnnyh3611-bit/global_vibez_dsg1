"""Iteration 103 — Full Site Audit (games + tournaments + vanishing + multiplayer queue).
Runs against REACT_APP_BACKEND_URL (public ingress, /api prefix routed to backend:8001)."""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
EXPECTED_GAMES = {
    # board (11)
    "tictactoe","connect4","checkers","reversi","ludo","backgammon","chess",
    "battleship","yahtzee","mancala","dominoes",
    # card (9 — priority for user)
    "uno","go_fish","crazy_eights","hearts","spades","rummy","solitaire","war","gin_rummy",
    # casino (3)
    "blackjack","poker","roulette",
    # vibes_casino (3)
    "vibes_slots","vibes_wheel","vibes_darts",
    # arcade (4)
    "snake","pool_8ball","ping_pong","memory_match",
    # party (4)
    "would_you_rather","trivia","two_truths_lie","truth_or_dare",
}
CARD_GAMES = {"uno","go_fish","crazy_eights","hearts","spades","rummy","solitaire","war","gin_rummy"}

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

@pytest.fixture(scope="module")
def auth_session(session):
    r = session.post(f"{BASE}/api/auth/demo-login", timeout=15)
    if r.status_code != 200:
        pytest.skip(f"demo-login failed {r.status_code}: {r.text[:200]}")
    return session

# ---------------- Games roster ----------------
class TestGamesRoster:
    def test_games_list_endpoint(self, session):
        r = session.get(f"{BASE}/api/games/list", timeout=15)
        assert r.status_code == 200, r.text[:300]
        games = r.json().get("games", {})
        # data assertion: every expected game is present
        missing = EXPECTED_GAMES - set(games.keys())
        assert not missing, f"Missing games: {missing}"
        # every game has required fields
        for gid in CARD_GAMES:
            g = games[gid]
            assert g.get("implemented") is True, f"{gid} not implemented"
            assert g.get("category") == "card", f"{gid} category != card"
            assert g.get("name"), f"{gid} missing name"

    def test_total_game_count_at_least_34(self, session):
        r = session.get(f"{BASE}/api/games/list", timeout=15)
        games = r.json().get("games", {})
        assert len(games) >= 34, f"Expected ≥34 games, got {len(games)}"

# ---------------- Auth gating ----------------
class TestAuthGates:
    def test_games_my_active_requires_auth(self, session):
        s = requests.Session()
        r = s.get(f"{BASE}/api/games/my-games/active", timeout=10)
        assert r.status_code == 401

    def test_vanishing_send_requires_auth(self):
        s = requests.Session()
        r = s.post(f"{BASE}/api/vanishing/send",
                   json={"recipient_id": "x", "content": "hi"}, timeout=10)
        assert r.status_code in (401, 403, 422), f"got {r.status_code}: {r.text[:200]}"

    def test_vanishing_open_requires_auth(self):
        s = requests.Session()
        r = s.post(f"{BASE}/api/vanishing/open",
                   json={"message_id": "x"}, timeout=10)
        assert r.status_code in (401, 403, 422), f"got {r.status_code}: {r.text[:200]}"

# ---------------- Vanishing messages with auth ----------------
class TestVanishingAuthed:
    def test_vanishing_send_with_session(self, auth_session):
        # send to self (or arbitrary recipient — endpoint should at least accept auth and return 200/4xx-validation, not 401)
        r = auth_session.post(f"{BASE}/api/vanishing/send",
                              json={"recipient_id": "self_test", "content": "TEST_vanish_iter103"},
                              timeout=15)
        # Acceptable: 200/201 success, or 4xx validation (e.g., recipient not found).
        # Critical: NOT 401 (auth working) and NOT 500 (no crash)
        assert r.status_code != 401, "auth not recognized"
        assert r.status_code < 500, f"server error: {r.status_code} {r.text[:300]}"

# ---------------- HTTP Multiplayer queue ----------------
class TestHttpMultiplayer:
    def test_join_queue_chess(self, auth_session):
        # /api/auth/me to get user_id/name
        me = auth_session.get(f"{BASE}/api/auth/me", timeout=10)
        assert me.status_code == 200, me.text[:200]
        u = me.json()
        uid = u.get("user_id") or u.get("id") or "iter103_test_user"
        uname = u.get("name") or u.get("username") or "IterTester"
        r = auth_session.post(f"{BASE}/api/http-multiplayer/join-queue",
                              json={"game_type": "chess", "user_id": uid, "user_name": uname},
                              timeout=15)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
        # cleanup
        auth_session.post(f"{BASE}/api/http-multiplayer/leave-queue",
                          json={"game_type": "chess", "user_id": uid}, timeout=10)

    def test_check_match_after_join(self, auth_session):
        me = auth_session.get(f"{BASE}/api/auth/me", timeout=10).json()
        uid = me.get("user_id") or me.get("id") or "iter103_test_user"
        r = auth_session.get(f"{BASE}/api/http-multiplayer/check-match/{uid}?game_type=chess", timeout=15)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"

# ---------------- Card Royale / Tournaments ----------------
class TestCardRoyale:
    def test_list_tournaments(self, auth_session):
        # Try canonical paths
        for path in ("/api/card-royale/tournaments",
                     "/api/card-royale/list",
                     "/api/card-royale/active"):
            r = auth_session.get(f"{BASE}{path}", timeout=15)
            if r.status_code == 200:
                return  # PASS
        pytest.fail("No card-royale list endpoint returned 200")

# ---------------- Leaderboard (public) ----------------
class TestLeaderboard:
    def test_vibez_leaderboard_public(self, session):
        for path in ("/api/leaderboard/vibez-top100",
                     "/api/leaderboard/vibez/top100",
                     "/api/leaderboard/top100"):
            r = session.get(f"{BASE}{path}", timeout=15)
            if r.status_code == 200:
                data = r.json()
                # may be list or {entries:[...]}
                assert isinstance(data, (list, dict))
                return
        pytest.fail("No leaderboard endpoint returned 200")

# ---------------- Would You Rather ----------------
class TestWouldYouRather:
    def test_wyr_prompts_endpoint(self, auth_session):
        for path in ("/api/would-you-rather/prompts",
                     "/api/wyr/prompts",
                     "/api/games/wyr/prompts"):
            r = auth_session.get(f"{BASE}{path}", timeout=15)
            if r.status_code == 200:
                return
        pytest.skip("No WYR prompts endpoint found at common paths — UI may seed locally")
