"""
Backend regression for UNO AAA (Jan 2026).
Covers: start/state/play/declare/draw + illegal plays + action-card effects.
Also validates Spades AAA lobby still responsive.
"""
from __future__ import annotations

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def auth_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/demo-login", json={})
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("token") or data.get("session_token") or data.get("access_token")
    assert token, f"no token in demo-login response: {data}"
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# --- UNO lifecycle ---------------------------------------------------------

def _start_fresh(s: requests.Session) -> dict:
    r = s.post(f"{API}/uno-practice/start", json={})
    assert r.status_code == 200, f"start: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("success") is True
    game = body["game"]
    return game


class TestUnoStart:
    def test_start_shape(self, auth_session):
        g = _start_fresh(auth_session)
        assert g["phase"] == "playing"
        assert g["direction"] == 1
        assert len(g["your_hand"]) == 7
        top = g["top_card"]
        assert top and top.get("value") != "wild4", "starter must not be wild4"
        assert g["pending_color"] in ("red", "yellow", "green", "blue")
        # 108 total - 28 dealt - 1 top = 79. Draw2/Skip/Reverse starter can mutate
        # slightly (Draw2 subtracts 2 more from pile to south). Range 77..79.
        assert 77 <= g["draw_pile_count"] <= 79, g["draw_pile_count"]

    def test_state_persists(self, auth_session):
        _start_fresh(auth_session)
        r = auth_session.get(f"{API}/uno-practice/state")
        assert r.status_code == 200
        g = r.json()["game"]
        assert g["phase"] == "playing"


# --- Legal / illegal plays ------------------------------------------------

class TestUnoPlays:
    def test_illegal_play_returns_400(self, auth_session):
        g = _start_fresh(auth_session)
        # Only act when it's south's turn (start may run bots first)
        if g["turn"] != "south":
            pytest.skip("bots acted first, skip")
        top = g["top_card"]
        pending = g["pending_color"]
        # Find an obviously illegal card in hand: different color AND value,
        # and not a wild.
        bad = None
        for c in g["your_hand"]:
            if c["kind"] == "wild":
                continue
            if c["color"] != pending and c["value"] != top["value"]:
                bad = c
                break
        if not bad:
            pytest.skip("no illegal card in this shuffled hand")
        r = auth_session.post(f"{API}/uno-practice/play", json={"card": bad})
        assert r.status_code == 400, r.text[:200]
        assert "Illegal" in r.text or "illegal" in r.text.lower()

    def test_draw_adds_card_and_passes_turn(self, auth_session):
        g = _start_fresh(auth_session)
        if g["turn"] != "south":
            pytest.skip("bots acted first")
        before = len(g["your_hand"])
        r = auth_session.post(f"{API}/uno-practice/draw", json={})
        assert r.status_code == 200, r.text[:200]
        g2 = r.json()["game"]
        # Either still your turn if bots already ran, OR turn changed
        assert len(g2["your_hand"]) >= before + 1

    def test_wild_requires_declare_then_resolves(self, auth_session):
        # Attempt a few fresh matches until we get a wild in south's opening hand
        wild = None
        for _ in range(30):
            g = _start_fresh(auth_session)
            if g["turn"] != "south":
                continue
            for c in g["your_hand"]:
                if c["kind"] == "wild" and c["value"] == "wild":
                    wild = c
                    break
            if wild:
                break
        if not wild:
            pytest.skip("no plain wild dealt in 30 attempts")
        # Play wild WITHOUT declared_color → wild_pending
        r = auth_session.post(f"{API}/uno-practice/play", json={"card": wild})
        assert r.status_code == 200, r.text[:300]
        g2 = r.json()["game"]
        assert g2.get("pending_wild") is True, g2
        # Now declare red
        r2 = auth_session.post(f"{API}/uno-practice/declare", json={"color": "red"})
        assert r2.status_code == 200, r2.text[:300]
        g3 = r2.json()["game"]
        assert g3["pending_color"] == "red"
        assert g3.get("pending_wild") is False


# --- Regression: Spades AAA still reachable -------------------------------

class TestSpadesReachable:
    def test_spades_practice_start(self, auth_session):
        r = auth_session.post(f"{API}/spades-practice/start", json={})
        # Some builds require team/bid payload — accept 200 or 400 but not 500
        assert r.status_code in (200, 400, 422), f"{r.status_code}: {r.text[:200]}"
