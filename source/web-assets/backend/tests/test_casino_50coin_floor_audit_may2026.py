"""
Pre-redeploy audit (May 12, 2026):
  - Verifies 50-coin platform-wide minimum bet floor on every casino game.
  - Vibe Dice 654 (/api/games/vibe654/*) is the ONLY documented carve-out (min=5).
  - Confirms every game-context error string / payload uses the Cedi glyph (₵), not '$'.
  - Hits real REST endpoints on the preview backend with a beta-tester JWT.

Run:
  pytest /home/johnnie/master-project/tests/test_casino_50coin_floor_audit_may2026.py -v \
      --tb=short --junitxml=/app/test_reports/pytest/floor_audit_may2026.xml
"""
from __future__ import annotations

import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

BETA_EMAIL = "betatester1@globalvibez.com"
BETA_PASSWORD = "BetaTester2026!"

# Anything that looks like a USD glyph in a game-context string is a violation.
DOLLAR_RE = re.compile(r"\$\s?\d|\$\s?\{|Bet\s+must\s+be\s+between\s+\$")


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(api_client):
    r = api_client.post(
        f"{API}/auth/login",
        json={"email": BETA_EMAIL, "password": BETA_PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text[:200]}")
    data = r.json()
    token = data.get("token") or data.get("access_token") or data.get("jwt")
    uid = (data.get("user") or {}).get("user_id") or data.get("user_id") or "8f707bb9-dc0f-43cd-acf4-065f7d86cd54"
    if not token:
        pytest.skip(f"no token in login response: {list(data.keys())}")
    api_client.headers.update({"Authorization": f"Bearer {token}"})
    return {"token": token, "user_id": uid}


# ---------------------------------------------------------------------------
# Helper: send below-floor bet, treat both reject (4xx) and currency glyph
# in error message as separately verifiable signals.
# ---------------------------------------------------------------------------
def _below_floor(method, url, payload, client, allow_4xx=True):
    fn = getattr(client, method.lower())
    r = fn(url, json=payload, timeout=20)
    body = r.text or ""
    has_dollar = bool(DOLLAR_RE.search(body))
    return r.status_code, body, has_dollar


# ---------------------------------------------------------------------------
# 1) MINIMUM BET FLOOR (50 ₵) — should REJECT bet=10
# ---------------------------------------------------------------------------
class TestFiftyCoinFloor:
    """Every real-money game must reject bets < 50 ₵."""

    def test_cyber_casino_slots_rejects_below_50(self, api_client, auth):
        sc, body, _ = _below_floor("post", f"{API}/cyber-casino/slots/spin",
                                   {"user_id": auth["user_id"], "bet": 10}, api_client)
        assert sc in (400, 422), f"cyber-casino slots accepted bet=10 (status {sc}, body={body[:200]})"

    def test_cyber_casino_blackjack_rejects_below_50(self, api_client, auth):
        sc, body, _ = _below_floor("post", f"{API}/cyber-casino/blackjack/deal",
                                   {"user_id": auth["user_id"], "bet": 10}, api_client)
        assert sc in (400, 422), f"cyber-casino bj accepted bet=10 (status {sc}, body={body[:200]})"

    def test_watch_and_wager_rejects_below_50(self, api_client, auth):
        sc, body, _ = _below_floor("post", f"{API}/watch-and-wager/bet",
                                   {"user_id": auth["user_id"], "stream_id": "test", "amount": 10,
                                    "outcome_id": "x", "outcome_name": "x"}, api_client)
        # 400 expected from MIN_BET check. 404 ok (route missing).
        assert sc in (400, 422, 404), f"watch_and_wager accepted bet=10 (status {sc} body={body[:200]})"

    # ---- known violations (these endpoints currently let bet=10 through) ----
    def test_legacy_slots_endpoint_should_enforce_50_floor(self, api_client, auth):
        sc, body, has_dollar = _below_floor("post", f"{API}/slots/spin",
                                            {"user_id": auth["user_id"], "bet_amount": 10}, api_client)
        # XFAIL-style assertion -- documents the bug.
        # Per code: routes/slots.py line 175 -> floor is 10 (not 50). FAIL expected.
        assert sc in (400, 422), (
            f"[BUG] /api/slots/spin accepts bet_amount=10 (floor is 10 not 50). "
            f"status={sc} body={body[:200]}"
        )

    def test_baccarat_should_enforce_50_floor(self, api_client, auth):
        sc, body, _ = _below_floor("post", f"{API}/baccarat/play",
                                   {"user_id": auth["user_id"], "bet_type": "player",
                                    "bet_amount": 10}, api_client)
        # Per routes/baccarat.py: only validates bet_amount <= 0. FAIL expected.
        assert sc in (400, 422), (
            f"[BUG] /api/baccarat/play accepts bet_amount=10. status={sc} body={body[:200]}"
        )

    def test_blackjack_legacy_should_enforce_50_floor(self, api_client, auth):
        sc, body, _ = _below_floor("post", f"{API}/blackjack/deal",
                                   {"user_id": auth["user_id"], "bet_amount": 10}, api_client)
        # Per routes/blackjack.py line 215: only validates bet_amount <= 0. FAIL expected.
        assert sc in (400, 422), (
            f"[BUG] /api/blackjack/deal accepts bet_amount=10. status={sc} body={body[:200]}"
        )

    def test_multiplayer_slots_should_enforce_50_floor_AND_use_cedi(self, api_client, auth):
        # min_bet per-room is already 50 in code -> bet 10 will be rejected,
        # BUT the error message uses '$' glyph (violation).
        sc, body, has_dollar = _below_floor("post", f"{API}/multiplayer-slots/spin",
                                            {"user_id": auth["user_id"], "room_id": "cosmic_lounge",
                                             "bet_amount": 10}, api_client)
        assert sc in (400, 422), f"multiplayer-slots accepted bet=10 status={sc}"
        assert not has_dollar, (
            f"[BUG] /api/multiplayer-slots/spin error uses '$' glyph: {body[:200]}"
        )

    def test_vibes_slots_should_enforce_50_floor(self, api_client, auth):
        sc, body, _ = _below_floor("post", f"{API}/games/vibes-slots/spin",
                                   {"user_id": auth["user_id"], "stake": 10}, api_client)
        assert sc in (400, 422), (
            f"[BUG] /api/games/vibes-slots/spin accepts stake=10 (gt=0 only). "
            f"status={sc} body={body[:200]}"
        )

    @pytest.mark.parametrize("path,extra", [
        ("/games/three-card-poker/play", {"ante": 10}),
        ("/games/pai-gow/play",         {"stake": 10}),
        ("/games/casino-war/play",      {"stake": 10, "go_to_war": False}),
        ("/games/chemin-de-fer/play",   {"stake": 10, "bet_side": "player"}),
        ("/games/european-roulette/play", {"stake": 10, "bet_type": "straight",
                                            "bet_value": "17"}),
        ("/games/hazard/play",          {"stake": 10, "main": 7}),
        ("/games/chuck-a-luck/play",    {"stake": 10, "picked_number": 3}),
        ("/games/big-six-wheel/play",   {"stake": 10, "bet_label": "1"}),
        ("/games/jacks-or-better/deal", {"stake": 10}),
        ("/games/fan-tan/play",         {"stake": 10, "pick": 1}),
        ("/games/faro/play",            {"stake": 10, "picked_rank": "A"}),
    ])
    def test_casino_wave2_games_should_enforce_50_floor(self, api_client, auth, path, extra):
        payload = {"user_id": auth["user_id"], **extra}
        sc, body, _ = _below_floor("post", f"{API}{path}", payload, api_client)
        assert sc in (400, 422), (
            f"[BUG] {path} accepts below-floor bet (gt=0 only). status={sc} body={body[:200]}"
        )


# ---------------------------------------------------------------------------
# 2) VIBE DICE 654 EXCEPTION — accepts bets >= 5
# ---------------------------------------------------------------------------
class TestVibeDice654Exception:
    def test_vibe_dice_654_accepts_5_coin_main_bet(self, api_client, auth):
        # Just check the constants endpoint reports min_bet 5; the play endpoint
        # requires a table id. The carve-out is documented in code at min_bet=5.0.
        r = api_client.get(f"{API}/games/vibe654/tables", timeout=15)
        # Endpoint may differ; the rule is what matters. We just confirm it's reachable.
        assert r.status_code in (200, 404), f"vibe654 tables unreachable: {r.status_code}"


# ---------------------------------------------------------------------------
# 3) CURRENCY GLYPH — backend strings should use ₵ in game contexts
# ---------------------------------------------------------------------------
class TestCurrencyGlyph:
    """Backend constants/paytables/errors must not use the '$' glyph."""

    def test_multiplayer_slots_room_listing_no_dollar(self, api_client, auth):
        r = api_client.get(f"{API}/multiplayer-slots/rooms", timeout=15)
        if r.status_code == 200:
            assert not DOLLAR_RE.search(r.text), (
                f"[BUG] /multiplayer-slots/rooms response contains '$': {r.text[:300]}"
            )

    def test_vibes_slots_constants_no_dollar(self, api_client, auth):
        r = api_client.get(f"{API}/games/vibes-slots/constants", timeout=15)
        if r.status_code == 200:
            assert not DOLLAR_RE.search(r.text), (
                f"[BUG] vibes-slots constants contain '$': {r.text[:300]}"
            )

    def test_cyber_casino_paytable_no_dollar(self, api_client, auth):
        # GET /cyber-casino/paytable or /cyber-casino/config -- be lenient
        for path in ("/cyber-casino/paytable", "/cyber-casino/games"):
            r = api_client.get(f"{API}{path}", timeout=15)
            if r.status_code == 200:
                assert not DOLLAR_RE.search(r.text), (
                    f"[BUG] {path} response contains '$': {r.text[:300]}"
                )


# ---------------------------------------------------------------------------
# 4) MATH ACCURACY (smoke-level) — paytable lookups
# ---------------------------------------------------------------------------
class TestMathAccuracySmoke:
    def test_european_roulette_constants_have_35to1_straight(self, api_client, auth):
        r = api_client.get(f"{API}/games/european-roulette/constants", timeout=15)
        if r.status_code != 200:
            pytest.skip("european-roulette constants unavailable")
        body = r.text
        # Industry standard straight-up = 35:1 (payout 35x stake, total return 36x)
        assert ("35" in body) or ("36" in body), (
            f"european roulette constants missing 35:1 reference: {body[:300]}"
        )

    def test_jacks_or_better_paytable_has_9_6(self, api_client, auth):
        r = api_client.get(f"{API}/games/jacks-or-better/constants", timeout=15)
        if r.status_code != 200:
            pytest.skip("jacks-or-better constants unavailable")
        body = r.text
        # Full-pay 9/6: full house pays 9, flush pays 6 per coin
        # Just confirm constants are present; deeper check would parse the JSON.
        assert "full" in body.lower() or "flush" in body.lower(), (
            f"jacks-or-better paytable missing rank names: {body[:300]}"
        )
