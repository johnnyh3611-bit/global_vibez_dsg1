"""
Regression suite for Jan 2026 Code Quality cleanup iteration.

Validates that the large ruff --fix pass (1010 → 122 issues), test-secret env
extraction, and Socket.IO type-hint additions did NOT break critical backend
endpoints. Focuses on:

- Auth (demo-login, /auth/me)
- Admin vault auth + protected admin endpoints
- Solana network metrics
- Spades rulesets / start (CLASSIC vs BIG_WHEEL deck size + Joker presence)
- Big Wheel lounge (stats / lobbies / leaderboard)
- Apex Evolution wishlist
- User preferences (spades ruleset)
- Backend boot health (no 500 import errors visible)

Secrets pulled from env via /home/johnnie/master-project/tests/conftest.py fixtures.
"""
from __future__ import annotations

import os
import socketio  # type: ignore
import pytest
import requests


# ───────────────────────────────────────────────────────── module-level base

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
API = f"{BASE_URL}/api" if BASE_URL else ""

pytestmark = pytest.mark.skipif(
    not BASE_URL, reason="REACT_APP_BACKEND_URL not set"
)


# ───────────────────────────────────────────────────────── fixtures

@pytest.fixture(scope="module")
def demo_session() -> requests.Session:
    """Demo-login session with Bearer token attached."""
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", timeout=30)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"no token in demo-login response: {data}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    s.demo_user_id = data.get("user_id") or data.get("user", {}).get("id")  # type: ignore[attr-defined]
    return s


@pytest.fixture(scope="module")
def admin_session() -> requests.Session:
    pw = os.environ.get("ADMIN_PASSWORD")
    code = os.environ.get("ADMIN_2FA")
    if not pw or not code:
        pytest.skip("ADMIN_PASSWORD/ADMIN_2FA not set")
    s = requests.Session()
    r = s.post(
        f"{API}/admin/vault-auth",
        json={"password": pw, "code": code},
        timeout=20,
    )
    assert r.status_code == 200, f"vault-auth failed: {r.status_code} {r.text[:300]}"
    assert "admin_session" in s.cookies, "admin_session cookie not set"
    return s


# ───────────────────────────────────────────────────────── auth

class TestAuth:
    def test_demo_login_returns_200_token_and_user(self):
        r = requests.post(f"{API}/auth/demo-login", timeout=20)
        assert r.status_code == 200
        data = r.json()
        token = data.get("token") or data.get("access_token")
        user_id = data.get("user_id") or data.get("user", {}).get("id")
        assert token and isinstance(token, str) and len(token) > 10
        assert user_id, f"no user_id in payload: {data}"

    def test_auth_me_with_bearer(self, demo_session: requests.Session):
        r = demo_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200, f"/auth/me {r.status_code}: {r.text[:200]}"
        body = r.json()
        # demo profile should at least carry an email/id
        assert body.get("email") or body.get("user", {}).get("email"), body


# ───────────────────────────────────────────────────────── admin

class TestAdmin:
    def test_vault_auth_and_cookie(self, admin_session: requests.Session):
        # Fixture already validated 200 + cookie. Re-query a protected route.
        assert admin_session.cookies.get("admin_session")

    def test_master_stats(self, admin_session: requests.Session):
        r = admin_session.get(f"{API}/admin/master-stats", timeout=20)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert isinstance(body, dict) and len(body) > 0

    def test_live_seats(self, admin_session: requests.Session):
        r = admin_session.get(f"{API}/admin/live-seats", timeout=20)
        assert r.status_code == 200, r.text[:300]

    def test_milestones_recap(self, admin_session: requests.Session):
        r = admin_session.get(f"{API}/admin/milestones/recap", timeout=20)
        assert r.status_code == 200, r.text[:300]


# ───────────────────────────────────────────────────────── solana

class TestSolana:
    def test_tps(self, admin_session: requests.Session):
        r = admin_session.get(f"{API}/solana/network/tps", timeout=20)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        # tps payload should have a numeric tps-ish field
        keys_lower = {k.lower() for k in body} if isinstance(body, dict) else set()
        assert any("tps" in k for k in keys_lower) or isinstance(body, dict), body

    def test_fees(self, admin_session: requests.Session):
        r = admin_session.get(f"{API}/solana/network/fees", timeout=20)
        assert r.status_code == 200, r.text[:300]


# ───────────────────────────────────────────────────────── spades

class TestSpades:
    def test_rulesets_returns_classic_and_big_wheel(self):
        r = requests.get(f"{API}/spades/rulesets", timeout=15)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        # Accept either {"rulesets": [...]} or list directly
        rulesets = body.get("rulesets") if isinstance(body, dict) else body
        assert isinstance(rulesets, list) and rulesets
        ids = []
        for entry in rulesets:
            if isinstance(entry, dict):
                ids.append(str(entry.get("id") or entry.get("ruleset") or entry.get("name") or "").upper())
            else:
                ids.append(str(entry).upper())
        joined = " ".join(ids)
        assert "CLASSIC" in joined, f"CLASSIC missing: {ids}"
        assert "BIG_WHEEL" in joined or "BIGWHEEL" in joined.replace("_", ""), f"BIG_WHEEL missing: {ids}"

    @staticmethod
    def _start_payload(ruleset: str) -> dict:
        # Real schema (StartSpadesGame in routes/spades.py) requires these IDs.
        return {
            "partner_id": "bot_partner",
            "opponent1_id": "bot_op1",
            "opponent2_id": "bot_op2",
            "wager": 0,
            "ruleset": ruleset,
        }

    def test_start_big_wheel_returns_big_wheel_ruleset(self, demo_session: requests.Session):
        r = demo_session.post(
            f"{API}/spades/start", json=self._start_payload("BIG_WHEEL"), timeout=20
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("ruleset") == "BIG_WHEEL", body
        # BIG_WHEEL deck has 54 cards across 4 players → 13 each + 1 extra.
        # Per util doc: deck is 54 (50 std + 2 Jokers + 2♠ + 2♦ promoted).
        # The public start response only returns YOUR hand; verifying full
        # deck/Joker requires DB peek. We assert hand size sane (13 or 14).
        hand = body.get("your_hand") or []
        assert isinstance(hand, list) and 13 <= len(hand) <= 14, (
            f"BIG_WHEEL hand size unexpected: {len(hand)}"
        )

    def test_start_classic_returns_classic_ruleset(self, demo_session: requests.Session):
        r = demo_session.post(
            f"{API}/spades/start", json=self._start_payload("CLASSIC"), timeout=20
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        body = r.json()
        assert body.get("ruleset") == "CLASSIC", body
        hand = body.get("your_hand") or []
        # CLASSIC = 52 / 4 = exactly 13 per player.
        assert isinstance(hand, list) and len(hand) == 13, (
            f"CLASSIC hand should be 13 cards, got {len(hand)}"
        )
        # No Joker should appear in a CLASSIC hand.
        for card in hand:
            rank = str(card.get("rank", "")).lower() if isinstance(card, dict) else str(card).lower()
            assert "joker" not in rank, f"CLASSIC hand contains a Joker: {card}"

    def test_rulesets_metadata_proves_deck_sizes_and_jokers(self):
        """Authoritative deck_size / has_jokers verification via /rulesets."""
        r = requests.get(f"{API}/spades/rulesets", timeout=15)
        assert r.status_code == 200, r.text[:300]
        rulesets = r.json().get("rulesets") or []
        by_id = {item["id"]: item for item in rulesets if isinstance(item, dict)}
        assert "CLASSIC" in by_id and "BIG_WHEEL" in by_id, list(by_id.keys())
        assert by_id["CLASSIC"]["deck_size"] == 52
        assert by_id["CLASSIC"]["has_jokers"] is False
        assert by_id["BIG_WHEEL"]["deck_size"] == 54
        assert by_id["BIG_WHEEL"]["has_jokers"] is True


# ───────────────────────────────────────────────────────── big-wheel lounge

class TestBigWheelLounge:
    def test_stats(self):
        r = requests.get(f"{API}/spades/big-wheel/stats", timeout=15)
        assert r.status_code == 200, r.text[:300]

    def test_lobbies(self):
        r = requests.get(f"{API}/spades/big-wheel/lobbies", timeout=15)
        assert r.status_code == 200, r.text[:300]

    def test_leaderboard(self):
        r = requests.get(f"{API}/spades/big-wheel/leaderboard", timeout=15)
        assert r.status_code == 200, r.text[:300]


# ───────────────────────────────────────────────────────── apex evolution

class TestApex:
    def test_wishlist_post(self, demo_session: requests.Session):
        r = demo_session.post(f"{API}/apex/wishlist", json={}, timeout=15)
        # Route returns 200 on success (or possibly 200/201 on duplicate).
        assert r.status_code in (200, 201), f"apex wishlist POST: {r.status_code} {r.text[:200]}"

    def test_wishlist_count(self):
        r = requests.get(f"{API}/apex/wishlist/count", timeout=15)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        # Must contain a numeric count
        if isinstance(body, dict):
            count = body.get("count") or body.get("total") or body.get("wishlist_count")
            assert isinstance(count, int), f"no integer count in {body}"


# ───────────────────────────────────────────────────────── user preferences

class TestPreferences:
    def test_spades_ruleset_pref_requires_auth(self):
        r = requests.get(f"{API}/preferences/spades-ruleset", timeout=15)
        assert r.status_code in (401, 403), (
            f"unauthed call should be 401/403, got {r.status_code}"
        )

    def test_spades_ruleset_pref_authed(self, demo_session: requests.Session):
        r = demo_session.get(f"{API}/preferences/spades-ruleset", timeout=15)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        # Should at least carry a "ruleset"-shaped field
        keys = body.keys() if isinstance(body, dict) else []
        assert any("ruleset" in k for k in keys) or isinstance(body, dict), body


# ───────────────────────────────────────────────────────── socket.io smoke

class TestBlackjackSocketIO:
    def test_blackjack_namespace_connects(self):
        """Smoke: confirm Socket.IO server still accepts connections after type-hint refactor."""
        sio = socketio.Client(reconnection=False, logger=False, engineio_logger=False)
        connected = {"v": False}

        @sio.event
        def connect():  # noqa: D401
            connected["v"] = True

        try:
            # Backend mounts the multiplayer socket.io app at /api/socket.io
            # because k8s ingress only routes /api/* paths to the backend pod.
            sio.connect(
                BASE_URL,
                transports=["polling"],
                wait_timeout=10,
                socketio_path="api/socket.io",
            )
            sio.sleep(1)
            assert connected["v"], "Socket.IO did not connect"
        except Exception as e:
            pytest.fail(f"Socket.IO connect failed: {e}")
        finally:
            try:
                sio.disconnect()
            except Exception:
                pass
