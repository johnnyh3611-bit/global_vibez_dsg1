"""
Beta-Readiness QA: Voice Coach + Roguelite Chess Trial endpoints.
Date: 2026-01 (Beta QA pass)
"""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "betatester1@globalvibez.com"
DEMO_PASS = "BetaTester2026!"  # per /app/memory/test_credentials.md


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    tok = (
        data.get("access_token")
        or data.get("token")
        or (data.get("user") or {}).get("token")
    )
    return tok


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    if not auth_token:
        return None
    return {"Authorization": f"Bearer {auth_token}"}


# ─────────────────────────────────────────────
# Voice Coach: move-tip
# ─────────────────────────────────────────────
class TestVoiceCoachMoveTip:
    def test_move_tip_starting_position(self, session):
        r = session.post(
            f"{API}/voice-coach/move-tip",
            json={
                "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                "last_move": "e2e4",
                "side": "black",
                "elo": 1200,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "tip" in data
        assert isinstance(data["tip"], str) and len(data["tip"]) > 5

    def test_move_tip_midgame(self, session):
        r = session.post(
            f"{API}/voice-coach/move-tip",
            json={
                "fen": "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
                "last_move": "Nc6",
                "side": "white",
                "elo": 1500,
            },
            timeout=30,
        )
        assert r.status_code == 200
        assert len(r.json()["tip"]) > 5


# ─────────────────────────────────────────────
# Voice Coach: voice-question multipart guards
# ─────────────────────────────────────────────
class TestVoiceCoachVoiceQuestion:
    def test_empty_audio_returns_400(self):
        r = requests.post(
            f"{API}/voice-coach/voice-question",
            files={"audio": ("empty.webm", b"", "audio/webm")},
            data={"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "side": "white"},
            timeout=15,
        )
        # Empty (<100 bytes) → 400
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:200]}"

    def test_too_large_audio_returns_413(self):
        big = b"\x00" * (26 * 1024 * 1024)  # 26 MB
        r = requests.post(
            f"{API}/voice-coach/voice-question",
            files={"audio": ("big.webm", big, "audio/webm")},
            data={"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "side": "white"},
            timeout=60,
        )
        assert r.status_code == 413, f"expected 413 got {r.status_code}: {r.text[:200]}"

    def test_undecipherable_audio_returns_422_or_502(self):
        # Random bytes (>100, <25MB) — Whisper will fail or produce empty text
        garbage = os.urandom(2048)
        r = requests.post(
            f"{API}/voice-coach/voice-question",
            files={"audio": ("noise.webm", garbage, "audio/webm")},
            data={"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "side": "white"},
            timeout=60,
        )
        # Whisper rejects bad audio (502 from upstream) OR empty transcription (422)
        assert r.status_code in (422, 502, 400), f"got {r.status_code}: {r.text[:200]}"


# ─────────────────────────────────────────────
# Roguelite Chess
# ─────────────────────────────────────────────
class TestRogueliteChess:
    def test_state_unauth_returns_401(self):
        r = requests.get(f"{API}/roguelite-chess/state", timeout=10)
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_start_authed(self, auth_headers):
        if not auth_headers:
            pytest.skip("no auth token")
        r = requests.post(f"{API}/roguelite-chess/start", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("day_key", "lives", "score", "streak", "started_at", "ends_at", "is_alive"):
            assert k in data, f"missing {k}"

    def test_state_authed(self, auth_headers):
        if not auth_headers:
            pytest.skip("no auth token")
        r = requests.get(f"{API}/roguelite-chess/state", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data["lives"], int)
        assert data["lives"] >= 0

    def test_record_result_scoring_and_lives_to_zero(self, auth_headers):
        """Test scoring math + lives-to-zero edge case + 409 on subsequent."""
        if not auth_headers:
            pytest.skip("no auth token")

        # Reset trial directly via mongo for deterministic state
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        m = MongoClient(mongo_url)
        db = m[db_name]
        # Get user_id from /api/auth/me
        me = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=10)
        if me.status_code != 200:
            pytest.skip(f"auth/me failed: {me.status_code}")
        u = me.json()
        user_id = (
            u.get("user_id") or u.get("id") or u.get("email")
            or (u.get("user") or {}).get("user_id")
            or (u.get("user") or {}).get("id")
            or (u.get("user") or {}).get("email")
        )
        from datetime import datetime, timezone
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        # Wipe today's trial
        db.roguelite_chess_trials.delete_many({"user_id": str(user_id), "day_key": day})

        # Start fresh trial
        s = requests.post(f"{API}/roguelite-chess/start", headers=auth_headers, timeout=10)
        assert s.status_code == 200, s.text
        st = s.json()
        assert st["lives"] == 3
        assert st["score"] == 0

        # Win: +100 + max(0, elo_diff=50) = +150
        r = requests.post(f"{API}/roguelite-chess/record-result",
                          headers=auth_headers,
                          json={"outcome": "win", "elo_diff": 50}, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["score"] == 150, f"expected 150 got {d['score']}"
        assert d["streak"] == 1
        assert d["lives"] == 3

        # Draw: +25
        r = requests.post(f"{API}/roguelite-chess/record-result",
                          headers=auth_headers,
                          json={"outcome": "draw", "elo_diff": 0}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["score"] == 175
        assert d["streak"] == 0  # draw resets streak per code
        assert d["lives"] == 3

        # 3 losses → lives drops 3→2→1→0, trial ends
        for expected_lives in (2, 1, 0):
            r = requests.post(f"{API}/roguelite-chess/record-result",
                              headers=auth_headers,
                              json={"outcome": "loss", "elo_diff": 0}, timeout=10)
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["lives"] == expected_lives, f"after loss expected {expected_lives} got {d['lives']}"
        # is_alive must be False now
        assert d["is_alive"] is False

        # 4th loss → 409 (trial already ended)
        r = requests.post(f"{API}/roguelite-chess/record-result",
                          headers=auth_headers,
                          json={"outcome": "loss", "elo_diff": 0}, timeout=10)
        assert r.status_code == 409, f"expected 409 got {r.status_code}: {r.text[:200]}"

        # Even win returns 409 after end
        r = requests.post(f"{API}/roguelite-chess/record-result",
                          headers=auth_headers,
                          json={"outcome": "win", "elo_diff": 100}, timeout=10)
        assert r.status_code == 409

    def test_leaderboard(self):
        r = requests.get(f"{API}/roguelite-chess/leaderboard?limit=50", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # Must respect max=200, min=1
        r2 = requests.get(f"{API}/roguelite-chess/leaderboard?limit=500", timeout=15)
        assert r2.status_code == 200
        assert len(r2.json()) <= 200

        r3 = requests.get(f"{API}/roguelite-chess/leaderboard?limit=0", timeout=15)
        assert r3.status_code == 200
        assert len(r3.json()) <= 1
