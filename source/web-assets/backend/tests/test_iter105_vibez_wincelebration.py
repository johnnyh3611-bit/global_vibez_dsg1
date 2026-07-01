"""
Iteration 105 backend tests — scoped to this review_request:

1. POST /api/http-multiplayer/end-game with 2-player flow + idempotency
2. POST /api/http-multiplayer/claim-win (404 / 400 / 403 / 200 / already_claimed)
3. GET /api/mining/my-history — auth-gated (401 w/o auth, 200 w/ demo-login)
4. POST /api/matchmaking/profile + GET /api/matchmaking/profile/{user_id}
5. POST /api/matchmaking/send-request
6. GET /api/matchmaking/find-matches/{user_id}
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


# ───────────────────────── FIXTURES ──────────────────────────

@pytest.fixture(scope="module")
def demo_session_a():
    """demo-login session + synthetic unique user_id for matchmaking (demo-login
    always returns the SAME shared demo user — so for 2-player tests we generate
    a unique user_id and pass it to join-queue directly, which doesn't require auth)."""
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", timeout=15)
    assert r.status_code == 200, f"demo-login A failed: {r.status_code} {r.text}"
    return {
        "session": s,
        "user_id": f"TEST_iter105_A_{uuid.uuid4().hex[:8]}",
        "user_name": "TEST_A",
    }


@pytest.fixture(scope="module")
def demo_session_b():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/demo-login", timeout=15)
    assert r.status_code == 200
    return {
        "session": s,
        "user_id": f"TEST_iter105_B_{uuid.uuid4().hex[:8]}",
        "user_name": "TEST_B",
    }


# ───────────── HTTP multiplayer end-game / claim-win flow ──────────────

class TestHttpMultiplayerWinFlow:
    """2-player match → end-game → claim-win (happy path + guards)."""

    @pytest.fixture(scope="class")
    def match(self, demo_session_a, demo_session_b):
        """Create a real 2-player match via join-queue twice (go_fish is 2p)."""
        game_type = "go_fish"
        # Player A joins
        r1 = demo_session_a["session"].post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"user_id": demo_session_a["user_id"], "user_name": demo_session_a["user_name"], "game_type": game_type},
            timeout=10,
        )
        assert r1.status_code == 200, r1.text
        # Player B joins — should trigger match
        r2 = demo_session_b["session"].post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"user_id": demo_session_b["user_id"], "user_name": demo_session_b["user_name"], "game_type": game_type},
            timeout=10,
        )
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert data.get("match_found") is True, f"expected match_found=True, got {data}"
        return {"game_id": data["game_id"], "game_type": game_type}

    def test_end_game_declares_winner(self, match, demo_session_a):
        r = demo_session_a["session"].post(
            f"{BASE_URL}/api/http-multiplayer/end-game",
            params={"game_id": match["game_id"], "user_id": demo_session_a["user_id"], "winner": "player1"},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("winner") == "player1"

    def test_end_game_idempotent(self, match, demo_session_a):
        """Second call must NOT change the winner even with a different value."""
        r = demo_session_a["session"].post(
            f"{BASE_URL}/api/http-multiplayer/end-game",
            params={"game_id": match["game_id"], "user_id": demo_session_a["user_id"], "winner": "player2"},
            timeout=10,
        )
        assert r.status_code == 200
        # Winner should still be player1 from first call
        assert r.json().get("winner") == "player1"

    def test_claim_win_not_winner_rejected(self, match, demo_session_b):
        """Player B (loser) can't claim."""
        r = demo_session_b["session"].post(
            f"{BASE_URL}/api/http-multiplayer/claim-win",
            params={"game_id": match["game_id"], "user_id": demo_session_b["user_id"]},
            timeout=10,
        )
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

    def test_claim_win_success(self, match, demo_session_a):
        r = demo_session_a["session"].post(
            f"{BASE_URL}/api/http-multiplayer/claim-win",
            params={"game_id": match["game_id"], "user_id": demo_session_a["user_id"]},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # mined might be 0 for SHADOW/ineligible but key must exist
        assert "mined" in body, f"expected 'mined' key, got {body}"
        assert isinstance(body.get("mined"), (int, float))
        assert body.get("game_type") == match["game_type"]

    def test_claim_win_idempotent(self, match, demo_session_a):
        r = demo_session_a["session"].post(
            f"{BASE_URL}/api/http-multiplayer/claim-win",
            params={"game_id": match["game_id"], "user_id": demo_session_a["user_id"]},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert body.get("already_claimed") is True
        assert body.get("mined") == 0.0 or body.get("mined") == 0

    def test_claim_win_404_game_missing(self, demo_session_a):
        r = demo_session_a["session"].post(
            f"{BASE_URL}/api/http-multiplayer/claim-win",
            params={"game_id": "no-such-" + uuid.uuid4().hex[:6], "user_id": demo_session_a["user_id"]},
            timeout=10,
        )
        assert r.status_code == 404

    def test_claim_win_400_game_not_completed(self, demo_session_a, demo_session_b):
        """Create a fresh match (not ended) → claim should return 400."""
        game_type = "go_fish"
        demo_session_a["session"].post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"user_id": demo_session_a["user_id"], "user_name": "A", "game_type": game_type},
            timeout=10,
        )
        r2 = demo_session_b["session"].post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"user_id": demo_session_b["user_id"], "user_name": "B", "game_type": game_type},
            timeout=10,
        )
        data = r2.json()
        if not data.get("match_found"):
            pytest.skip("could not create fresh match for 400 test")
        gid = data["game_id"]
        r = demo_session_a["session"].post(
            f"{BASE_URL}/api/http-multiplayer/claim-win",
            params={"game_id": gid, "user_id": demo_session_a["user_id"]},
            timeout=10,
        )
        assert r.status_code == 400


# ───────────── Mining /my-history ──────────────

class TestMiningMyHistory:
    def test_unauth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/mining/my-history", timeout=10)
        assert r.status_code == 401

    def test_authed_returns_schema(self, demo_session_a):
        r = demo_session_a["session"].get(
            f"{BASE_URL}/api/mining/my-history",
            params={"limit": 10},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "count" in data
        assert "rows" in data
        assert "by_game" in data
        assert isinstance(data["rows"], list)
        assert isinstance(data["by_game"], list)
        assert isinstance(data["count"], int)


# ───────────── Matchmaking (Find Your Player 2) ──────────────

class TestMatchmaking:
    @pytest.fixture(scope="class")
    def p1(self):
        return f"TEST_p2_user_{uuid.uuid4().hex[:6]}"

    @pytest.fixture(scope="class")
    def p2(self):
        return f"TEST_p2_user_{uuid.uuid4().hex[:6]}"

    def test_get_profile_404_nonexistent(self):
        r = requests.get(f"{BASE_URL}/api/matchmaking/profile/does_not_exist_" + uuid.uuid4().hex[:6], timeout=10)
        assert r.status_code == 404

    def test_upsert_profile(self, p1):
        payload = {
            "user_id": p1,
            "name": "TEST Alice",
            "age": 25,
            "bio": "Love spades",
            "favorite_games": ["spades", "uno"],
            "skill_scores": {"spades": 1200},
            "total_games_played": 10,
            "win_rate": 0.5,
            "preferences": {
                "age_min": 21,
                "age_max": 35,
                "preferred_games": ["spades"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 50,
                "looking_for": "gaming_partner",
            },
        }
        r = requests.post(f"{BASE_URL}/api/matchmaking/profile", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success") is True
        # GET to verify persistence
        g = requests.get(f"{BASE_URL}/api/matchmaking/profile/{p1}", timeout=10)
        assert g.status_code == 200
        gprofile = g.json()["profile"]
        assert gprofile["name"] == "TEST Alice"
        assert gprofile["age"] == 25
        assert "spades" in gprofile["favorite_games"]

    def test_upsert_profile_p2(self, p2):
        payload = {
            "user_id": p2,
            "name": "TEST Bob",
            "age": 27,
            "bio": "Chess fan",
            "favorite_games": ["spades", "chess"],
            "skill_scores": {"spades": 1300},
            "total_games_played": 15,
            "win_rate": 0.6,
            "preferences": {
                "age_min": 21,
                "age_max": 40,
                "preferred_games": ["spades"],
                "skill_level_min": 1,
                "skill_level_max": 10,
                "distance_max": 100,
                "looking_for": "gaming_partner",
            },
        }
        r = requests.post(f"{BASE_URL}/api/matchmaking/profile", json=payload, timeout=10)
        assert r.status_code == 200

    def test_find_matches_returns_scored_list(self, p1, p2):
        r = requests.get(f"{BASE_URL}/api/matchmaking/find-matches/{p1}", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Response shape — allow either "matches" or direct list
        matches = data.get("matches") if isinstance(data, dict) else data
        assert matches is not None
        assert isinstance(matches, list)

    def test_send_request_creates(self, p1, p2):
        # send-request uses query params (not body)
        r = requests.post(
            f"{BASE_URL}/api/matchmaking/send-request",
            params={"from_user_id": p1, "to_user_id": p2, "message": "TEST hi"},
            timeout=10,
        )
        # Accept 200 or 201
        assert r.status_code in (200, 201), r.text
