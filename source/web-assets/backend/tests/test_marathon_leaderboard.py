"""Marathon Mode leaderboard + record endpoint tests.

Covers:
- POST /api/marathon/record (anon + auth'd via demo-login)
- GET  /api/marathon/leaderboard (longest + fastest_win metrics, validation)
- GET  /api/marathon/my-stats (401 vs 200 with auth)
"""
from __future__ import annotations
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_client():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", timeout=15)
    if r.status_code not in (200, 201):
        pytest.skip(f"demo-login failed: {r.status_code} {r.text[:200]}")
    return s


# ----- /marathon/record -----

class TestRecordEndpoint:
    def test_record_anon_tictactoe(self, anon_client):
        name = f"TEST_anon_{uuid.uuid4().hex[:6]}"
        r = anon_client.post(f"{API}/marathon/record", json={
            "game_type": "tictactoe_xl",
            "moves": 42,
            "result": "win",
            "display_name": name,
        }, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["recorded"] is True
        assert d["anon"] is True

    def test_record_anon_connect4(self, anon_client):
        name = f"TEST_anon_{uuid.uuid4().hex[:6]}"
        r = anon_client.post(f"{API}/marathon/record", json={
            "game_type": "connect4_xl",
            "moves": 21,
            "result": "loss",
            "display_name": name,
        }, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

    def test_record_auth_user(self, auth_client):
        r = auth_client.post(f"{API}/marathon/record", json={
            "game_type": "tictactoe_xl",
            "moves": 30,
            "result": "win",
        }, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["anon"] is False, "authenticated record must not be tagged anon"

    def test_record_invalid_game_type(self, anon_client):
        r = anon_client.post(f"{API}/marathon/record", json={
            "game_type": "bogus",
            "moves": 10,
            "result": "win",
        }, timeout=10)
        assert r.status_code == 422, r.text

    def test_record_moves_out_of_range(self, anon_client):
        r = anon_client.post(f"{API}/marathon/record", json={
            "game_type": "tictactoe_xl",
            "moves": 0,
            "result": "win",
        }, timeout=10)
        assert r.status_code == 422
        r2 = anon_client.post(f"{API}/marathon/record", json={
            "game_type": "tictactoe_xl",
            "moves": 501,
            "result": "win",
        }, timeout=10)
        assert r2.status_code == 422

    def test_record_invalid_result(self, anon_client):
        r = anon_client.post(f"{API}/marathon/record", json={
            "game_type": "tictactoe_xl",
            "moves": 10,
            "result": "forfeit",
        }, timeout=10)
        assert r.status_code == 422


# ----- /marathon/leaderboard -----

class TestLeaderboardEndpoint:
    def test_leaderboard_shape_tictactoe_longest(self, anon_client):
        # seed first
        anon_client.post(f"{API}/marathon/record", json={
            "game_type": "tictactoe_xl",
            "moves": 77,
            "result": "draw",
            "display_name": f"TEST_lb_{uuid.uuid4().hex[:6]}",
        }, timeout=10)
        r = anon_client.get(f"{API}/marathon/leaderboard",
                            params={"game_type": "tictactoe_xl", "metric": "longest"},
                            timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["game_type"] == "tictactoe_xl"
        assert d["metric"] == "longest"
        assert d["window_days"] == 30
        assert "count" in d and "rows" in d
        assert isinstance(d["rows"], list)
        if d["rows"]:
            row = d["rows"][0]
            for k in ("user_id", "display_name", "best_moves", "rounds", "last_played"):
                assert k in row, f"row missing {k}"
            assert isinstance(row["best_moves"], int)

    def test_leaderboard_fastest_win_only_wins(self, anon_client):
        # seed a win + a loss with different move counts
        name = f"TEST_fw_{uuid.uuid4().hex[:8]}"
        anon_client.post(f"{API}/marathon/record", json={
            "game_type": "connect4_xl", "moves": 8, "result": "win", "display_name": name,
        }, timeout=10)
        anon_client.post(f"{API}/marathon/record", json={
            "game_type": "connect4_xl", "moves": 3, "result": "loss", "display_name": name,
        }, timeout=10)
        r = anon_client.get(f"{API}/marathon/leaderboard",
                            params={"game_type": "connect4_xl", "metric": "fastest_win", "limit": 50},
                            timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["metric"] == "fastest_win"
        # Find our seeded user; loss should NOT pull best_moves down to 3
        found = [row for row in d["rows"] if row["display_name"] == name]
        if found:
            assert found[0]["best_moves"] == 8, \
                f"fastest_win must only consider wins; got {found[0]}"

    def test_leaderboard_invalid_game_type_400(self, anon_client):
        r = anon_client.get(f"{API}/marathon/leaderboard",
                            params={"game_type": "bogus"},
                            timeout=10)
        assert r.status_code == 400
        assert "Unsupported" in r.text

    def test_leaderboard_limit_capped_at_50(self, anon_client):
        r = anon_client.get(f"{API}/marathon/leaderboard",
                            params={"game_type": "tictactoe_xl", "limit": 9999},
                            timeout=10)
        assert r.status_code == 200
        assert len(r.json()["rows"]) <= 50

    def test_leaderboard_window_days_clamped(self, anon_client):
        r = anon_client.get(f"{API}/marathon/leaderboard",
                            params={"game_type": "tictactoe_xl", "window_days": 99999},
                            timeout=10)
        assert r.status_code == 200
        assert r.json()["window_days"] == 365


# ----- /marathon/my-stats -----

class TestMyStats:
    def test_my_stats_unauth_401(self, anon_client):
        # fresh session with no cookie
        s = requests.Session()
        r = s.get(f"{API}/marathon/my-stats", timeout=10)
        assert r.status_code == 401, r.text

    def test_my_stats_authed(self, auth_client):
        # Ensure at least one record exists for this user
        auth_client.post(f"{API}/marathon/record", json={
            "game_type": "tictactoe_xl", "moves": 15, "result": "win",
        }, timeout=10)
        r = auth_client.get(f"{API}/marathon/my-stats", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "stats" in d
        assert isinstance(d["stats"], list)
        if d["stats"]:
            s = d["stats"][0]
            for k in ("game_type", "rounds", "wins", "longest_moves", "fastest_win"):
                assert k in s


# ----- Integration: record then see it on leaderboard -----

class TestRecordLeaderboardIntegration:
    def test_record_then_appears_on_leaderboard(self, anon_client):
        name = f"TEST_int_{uuid.uuid4().hex[:8]}"
        # Very high move count so this row likely appears on top of a 365d window
        rec = anon_client.post(f"{API}/marathon/record", json={
            "game_type": "tictactoe_xl",
            "moves": 499,
            "result": "draw",
            "display_name": name,
        }, timeout=10)
        assert rec.status_code == 200
        lb = anon_client.get(f"{API}/marathon/leaderboard",
                             params={"game_type": "tictactoe_xl",
                                     "metric": "longest",
                                     "window_days": 365,
                                     "limit": 50},
                             timeout=10)
        assert lb.status_code == 200
        names = [r["display_name"] for r in lb.json()["rows"]]
        assert name in names, f"seeded row {name} missing from leaderboard top-50: {names[:5]}..."
