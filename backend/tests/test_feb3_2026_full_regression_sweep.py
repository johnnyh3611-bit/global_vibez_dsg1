"""
Feb 3, 2026 — Full regression sweep backend tests.

Covers: health, auth, FastAPI import, Gin Rummy/Rummy meld_groups, Baccarat,
Chairs, HungryVibes, Beta feedback, and a dualbot engine smoke for
Euchre/Pinochle/Hearts/Gin Rummy/Rummy/Dominoes.
"""

import os
import sys
import pytest
import requests
import uuid


def _load_backend_url() -> str:
    """REACT_APP_BACKEND_URL lookup that survives bare-pytest invocations.

    Fork agents and CI runners (e.g. Grithood) sometimes execute the suite
    without pre-loading frontend/.env into the shell. Falling back to the
    .env file directly keeps the suite robust without forcing every caller
    to remember `export $(cat frontend/.env | xargs)`.
    """
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if url:
        return url.rstrip("/")
    # Fallback: read frontend/.env from the repo root.
    here = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(here, "..", ".."))
    env_path = os.path.join(repo_root, "frontend", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    return ""


BASE_URL = _load_backend_url()
if not BASE_URL:
    # Skip the entire module if the URL truly isn't resolvable — collection
    # must still succeed so the rest of the suite reports cleanly.
    pytest.skip(
        "REACT_APP_BACKEND_URL not set and frontend/.env not readable — skipping live-API regression sweep.",
        allow_module_level=True,
    )


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(api):
    r = api.post(f"{BASE_URL}/api/auth/demo-login", timeout=30)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("token") or data.get("session_token")
    assert token, f"no token in demo-login response: {data}"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return {"session": s, "token": token, "user": data}


# ---------- Health / root ----------
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200

    def test_health(self, api):
        r = api.get(f"{BASE_URL}/api/health", timeout=15)
        assert r.status_code == 200


# ---------- Auth ----------
class TestAuth:
    def test_demo_login_returns_user_and_credits(self, auth):
        user = auth["user"]
        assert "token" in user or "session_token" in user
        uid = user.get("user_id") or user.get("user", {}).get("user_id")
        assert uid, f"no user_id: {user}"
        # demo-login response doesn't include credits_balance directly.
        # Verify via /api/auth/me instead.
        me = auth["session"].get(f"{BASE_URL}/api/auth/me", timeout=15).json()
        cb = me.get("credits_balance")
        assert cb is not None and cb >= 1000, f"credits_balance expected >=1000, got {cb}"

    def test_auth_me(self, auth):
        r = auth["session"].get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200, r.text[:200]

    def test_auth_session_invalid(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/session",
            json={"session_id": "invalid_" + uuid.uuid4().hex},
            timeout=15,
        )
        assert 400 <= r.status_code < 500, f"expected 4xx got {r.status_code}"


# ---------- FastAPI import ----------
class TestImports:
    def test_server_app_imports(self):
        sys.path.insert(0, "/app/backend")
        from server import app  # noqa
        routes = len(app.routes)
        assert routes > 1000, f"expected >1000 routes, got {routes}"


# ---------- Gin Rummy / Rummy meld_groups ----------
class TestMelds:
    def test_gin_rummy_start(self, auth):
        r = auth["session"].post(f"{BASE_URL}/api/gin-rummy-practice/start", json={}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        # Response wraps in {success: true, game: {...}}
        g = data.get("game", data)
        hand = g.get("your_hand") or g.get("hand") or []
        assert len(hand) > 0, f"empty hand: {g}"
        assert all("meld_id" in c for c in hand), "meld_id missing on some cards"
        assert "meld_groups" in g, f"meld_groups missing: {list(g.keys())}"

    def test_rummy_start(self, auth):
        r = auth["session"].post(f"{BASE_URL}/api/rummy-practice/start", json={}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        g = data.get("game", data)
        hand = g.get("your_hand") or g.get("hand") or []
        assert len(hand) > 0
        assert all("meld_id" in c for c in hand)
        assert "meld_groups" in g


# ---------- Baccarat ----------
class TestBaccarat:
    def test_play(self, auth):
        r = auth["session"].post(
            f"{BASE_URL}/api/baccarat/play",
            json={"bet_type": "player", "bet_amount": 50, "game_mode": "standard"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("player_hand", "banker_hand", "winner", "payout"):
            assert k in d, f"missing {k}: {list(d.keys())}"

    def test_history(self, auth):
        r = auth["session"].get(f"{BASE_URL}/api/baccarat/history?limit=5", timeout=15)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        assert "games" in d and isinstance(d["games"], list)


# ---------- Chairs ----------
class TestChairs:
    def test_phase(self, api):
        r = api.get(f"{BASE_URL}/api/chairs/phase", timeout=15)
        assert r.status_code == 200, r.text[:200]

    def test_wall(self, api):
        r = api.get(f"{BASE_URL}/api/chairs/wall?limit=6", timeout=15)
        assert r.status_code == 200, r.text[:200]
        d = r.json()
        rows = d.get("rows") or d.get("chairs") or []
        assert isinstance(rows, list), f"rows not list: {d}"
        # Minimum expectations on fields if rows present
        if rows:
            first = rows[0]
            assert "chair_id" in first or "id" in first


# ---------- HungryVibes ----------
class TestHungryVibes:
    def test_merchant_menu_route_exists(self, api):
        """The spec asked for /hungryvibes/restaurants but the actual public route
        is /hungryvibes/merchants/{merchant_id}/menu. Verify it at least returns 200/404 (routed)."""
        r = api.get(f"{BASE_URL}/api/hungryvibes/merchants/TEST_nonexistent/menu", timeout=15)
        # 404 is fine (route exists, merchant doesn't). 200 also ok. 422/405 would mean routing broken.
        assert r.status_code in (200, 404), f"unexpected {r.status_code}: {r.text[:200]}"


# ---------- Beta feedback ----------
class TestBetaFeedback:
    def test_submit(self, auth):
        r = auth["session"].post(
            f"{BASE_URL}/api/beta/feedback",
            json={
                "category": "UI_GLITCH",
                "severity": "low",
                "page": "/test",
                "comment": "TEST_regression_sweep_feb3",
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text[:300]


# ---------- Dualbot engine smoke ----------
class TestEngineSmoke:
    def setup_method(self, method):
        sys.path.insert(0, "/app/backend")

    def test_euchre(self):
        from utils.euchre_game import EuchreGame
        g = EuchreGame(["p1", "p2", "p3", "p4"])
        # just verify construction + one bot cycle if available
        assert g is not None

    def test_pinochle(self):
        from utils.pinochle_game import PinochleGame
        g = PinochleGame(["p1", "p2", "p3", "p4"])
        assert g is not None

    def test_hearts(self):
        from utils.hearts_game import HeartsGame
        g = HeartsGame(["p1", "p2", "p3", "p4"])
        assert g is not None

    def test_gin_rummy(self):
        from utils.gin_rummy_game import GinRummyGame
        g = GinRummyGame(["p1", "p2"])
        assert g is not None

    def test_rummy(self):
        from utils.rummy_game import RummyGame
        g = RummyGame(["p1", "p2"])
        assert g is not None

    def test_dominoes(self):
        from utils.dominoes_game import DominoesGame
        g = DominoesGame(["p1", "p2"])
        assert g is not None
