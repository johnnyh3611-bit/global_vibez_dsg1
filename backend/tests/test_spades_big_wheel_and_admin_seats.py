"""
Backend tests for:
  - /api/spades/rulesets (public)
  - /api/spades/start w/ ruleset field (BIG_WHEEL + CLASSIC + INVALID)
  - /api/preferences/spades-ruleset (GET/PUT, auth)
  - /api/admin/live-seats (admin-cookie)
  - SpadesGame internals (deck composition, trick-winner ordering)

Cleans up any spades_games doc it creates at teardown.
"""
import os
import sys
import pytest
import requests

# Ensure backend modules are importable for unit tests of SpadesGame.
sys.path.insert(0, "/app/backend")

# Test credentials are pulled from env to keep secrets out of source.
# See /app/backend/tests/conftest.py and /app/memory/test_credentials.md.
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
ADMIN_2FA = os.environ.get("ADMIN_2FA", "")

if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)


# ────────────────────────────────────────────── Fixtures

@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def demo_user_1(api_client):
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", timeout=20)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    user = data.get("user") or {}
    uid = user.get("user_id") or user.get("id") or data.get("user_id")
    return {"token": token, "user_id": uid, "cookies": r.cookies}


@pytest.fixture(scope="module")
def demo_user_n():
    """Spin up 3 more demo users to serve as partner + 2 opponents."""
    users = []
    for _ in range(3):
        r = requests.post(f"{BASE_URL}/api/auth/demo-login", timeout=20)
        assert r.status_code == 200
        d = r.json()
        uid = (d.get("user") or {}).get("user_id") or d.get("user_id") or (d.get("user") or {}).get("id")
        users.append({"user_id": uid, "token": d.get("token") or d.get("access_token")})
    return users


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/admin/vault-auth",
        json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA},
        timeout=20,
    )
    assert r.status_code == 200, f"admin auth failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def created_game_ids():
    ids = []
    yield ids
    # Teardown — best-effort cleanup so DB stays clean
    try:
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        client = MongoClient(mongo_url)
        if ids:
            client[db_name].spades_games.delete_many({"game_id": {"$in": ids}})
        client.close()
    except Exception as e:
        print(f"[teardown] cleanup failed: {e}")


# ────────────────────────────────────────────── /api/spades/rulesets

class TestSpadesRulesets:
    def test_rulesets_public(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/spades/rulesets", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "rulesets" in data
        by_id = {rs["id"]: rs for rs in data["rulesets"]}
        assert "CLASSIC" in by_id and "BIG_WHEEL" in by_id

        classic = by_id["CLASSIC"]
        assert classic["deck_size"] == 52
        assert classic["house_cut_pct"] == 5.0
        assert classic["has_jokers"] is False
        assert classic["promoted_trumps"] == []

        bw = by_id["BIG_WHEEL"]
        assert bw["deck_size"] == 54
        assert bw["house_cut_pct"] == 7.0
        assert bw["has_jokers"] is True
        assert set(bw["promoted_trumps"]) == {
            "BIG_JOKER", "LITTLE_JOKER", "2_SPADES", "2_DIAMONDS"
        }


# ────────────────────────────────────────────── /api/spades/start

class TestSpadesStart:
    def _start_body(self, demo_user_n, ruleset=None):
        body = {
            "partner_id": demo_user_n[0]["user_id"],
            "opponent1_id": demo_user_n[1]["user_id"],
            "opponent2_id": demo_user_n[2]["user_id"],
            "wager": 10,
        }
        if ruleset is not None:
            body["ruleset"] = ruleset
        return body

    def test_start_bigwheel(self, demo_user_1, demo_user_n, created_game_ids):
        body = self._start_body(demo_user_n, ruleset="BIG_WHEEL")
        r = requests.post(
            f"{BASE_URL}/api/spades/start",
            json=body,
            headers={"Authorization": f"Bearer {demo_user_1['token']}"},
            cookies=demo_user_1["cookies"],
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data["ruleset"] == "BIG_WHEEL"
        assert data["ruleset_label"] == "Big Wheel"
        assert data["house_cut_pct"] == 7.0
        assert "game_id" in data
        created_game_ids.append(data["game_id"])
        hand = data["your_hand"]
        assert 13 <= len(hand) <= 14, f"hand size should be 13 or 14, got {len(hand)}"

    def test_start_bigwheel_hands_collectively_have_promoted(
        self, demo_user_1, demo_user_n, created_game_ids
    ):
        """Re-try a few starts; at least one game MUST have a promoted card
        somewhere. Caller's hand alone may not have it, so peek at the DB."""
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        client = MongoClient(mongo_url)
        try:
            body = self._start_body(demo_user_n, ruleset="BIG_WHEEL")
            r = requests.post(
                f"{BASE_URL}/api/spades/start",
                json=body,
                headers={"Authorization": f"Bearer {demo_user_1['token']}"},
                cookies=demo_user_1["cookies"],
                timeout=20,
            )
            assert r.status_code == 200
            gid = r.json()["game_id"]
            created_game_ids.append(gid)
            doc = client[db_name].spades_games.find_one({"game_id": gid})
            all_cards = []
            for pos in ["north", "east", "south", "west"]:
                all_cards.extend(doc["players_data"][pos]["hand"])
            promoted = [c for c in all_cards if c.get("promoted")]
            assert len(promoted) == 4, f"expected 4 promoted cards in deck, got {len(promoted)}"
            assert len(all_cards) == 54
            promoted_ids = {c.get("promoted_id") for c in promoted}
            assert promoted_ids == {"BIG_JOKER", "LITTLE_JOKER", "2_SPADES", "2_DIAMONDS"}
        finally:
            client.close()

    def test_start_invalid_ruleset(self, demo_user_1, demo_user_n):
        body = self._start_body(demo_user_n, ruleset="INVALID")
        r = requests.post(
            f"{BASE_URL}/api/spades/start",
            json=body,
            headers={"Authorization": f"Bearer {demo_user_1['token']}"},
            cookies=demo_user_1["cookies"],
            timeout=20,
        )
        assert r.status_code == 400
        assert "Unknown ruleset" in r.json().get("detail", "")

    def test_start_default_classic(self, demo_user_1, demo_user_n, created_game_ids):
        body = self._start_body(demo_user_n, ruleset=None)
        r = requests.post(
            f"{BASE_URL}/api/spades/start",
            json=body,
            headers={"Authorization": f"Bearer {demo_user_1['token']}"},
            cookies=demo_user_1["cookies"],
            timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["ruleset"] == "CLASSIC"
        assert data["house_cut_pct"] == 5.0
        created_game_ids.append(data["game_id"])
        # Caller hand size is 13 for CLASSIC and no card should be promoted
        assert len(data["your_hand"]) == 13
        assert not any(c.get("promoted") for c in data["your_hand"])


# ────────────────────────────────────────────── SpadesGame internals

class TestSpadesGameInternals:
    def test_classic_deck_52(self):
        from utils.spades_game import SpadesGame
        g = SpadesGame(ruleset="CLASSIC")
        g.create_deck()
        assert len(g.deck) == 52
        assert not any(c.get("promoted") for c in g.deck)

    def test_bigwheel_deck_54_no_standard_2s_4_promoted(self):
        from utils.spades_game import SpadesGame
        g = SpadesGame(ruleset="BIG_WHEEL")
        g.create_deck()
        assert len(g.deck) == 54
        # No standard 2♠ / 2♦ (they're promoted out)
        std_2s = [c for c in g.deck if not c.get("promoted") and c["rank"] == "2" and c["suit"] in {"spades", "diamonds"}]
        assert std_2s == []
        promoted = [c for c in g.deck if c.get("promoted")]
        assert len(promoted) == 4
        score_by_id = {c["promoted_id"]: c["value"] for c in promoted}
        assert score_by_id == {
            "BIG_JOKER": 100,
            "LITTLE_JOKER": 99,
            "2_SPADES": 98,
            "2_DIAMONDS": 97,
        }
        # Each promoted card's suit must be 'spades' (always trump)
        assert all(c["suit"] == "spades" for c in promoted)

    def test_trick_winner_bigwheel_ordering(self):
        from utils.spades_game import SpadesGame
        g = SpadesGame(ruleset="BIG_WHEEL")
        # Build cards by tag
        def mk(suit, rank, value, promoted=False, pid=None):
            c = {"suit": suit, "rank": rank, "value": value, "promoted": promoted}
            if pid:
                c["promoted_id"] = pid
            return c

        big_joker = mk("spades", "BIG_JOKER", 100, True, "BIG_JOKER")
        little_joker = mk("spades", "LITTLE_JOKER", 99, True, "LITTLE_JOKER")
        two_spades = mk("spades", "2_SPADES", 98, True, "2_SPADES")
        two_diamonds = mk("spades", "2_DIAMONDS", 97, True, "2_DIAMONDS")
        ace_spades = mk("spades", "A", 14)

        # Case 1: Big Joker vs A♠ — Big Joker wins
        g.current_trick = [
            {"position": "north", "card": ace_spades},
            {"position": "east", "card": big_joker},
            {"position": "south", "card": mk("hearts", "K", 13)},
            {"position": "west", "card": mk("clubs", "A", 14)},
        ]
        g.led_suit = "spades"
        assert g.determine_trick_winner() == "east"

        # Case 2: 2♠ vs A♠ — 2♠ (promoted, 98) wins
        g.current_trick = [
            {"position": "north", "card": ace_spades},
            {"position": "east", "card": two_spades},
            {"position": "south", "card": mk("hearts", "K", 13)},
            {"position": "west", "card": mk("clubs", "A", 14)},
        ]
        g.led_suit = "spades"
        assert g.determine_trick_winner() == "east"

        # Case 3: 2♠ vs 2♦ — 2♠ (98) > 2♦ (97) wins
        g.current_trick = [
            {"position": "north", "card": two_diamonds},
            {"position": "east", "card": two_spades},
            {"position": "south", "card": mk("hearts", "K", 13)},
            {"position": "west", "card": mk("clubs", "A", 14)},
        ]
        g.led_suit = "hearts"
        assert g.determine_trick_winner() == "east"

        # Case 4: Big Joker vs Little Joker — Big wins
        g.current_trick = [
            {"position": "north", "card": little_joker},
            {"position": "east", "card": big_joker},
            {"position": "south", "card": two_spades},
            {"position": "west", "card": two_diamonds},
        ]
        g.led_suit = "spades"
        assert g.determine_trick_winner() == "east"


# ────────────────────────────────────────────── /api/preferences/spades-ruleset

class TestSpadesRulesetPref:
    def test_get_unauth_401(self, api_client):
        # No auth token, no cookie
        r = requests.get(f"{BASE_URL}/api/preferences/spades-ruleset", timeout=20)
        assert r.status_code == 401

    def test_get_default(self, demo_user_1):
        r = requests.get(
            f"{BASE_URL}/api/preferences/spades-ruleset",
            headers={"Authorization": f"Bearer {demo_user_1['token']}"},
            cookies=demo_user_1["cookies"],
            timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["ruleset"] in ["CLASSIC", "BIG_WHEEL"]
        assert set(data["available"]) == {"CLASSIC", "BIG_WHEEL"}

    def test_put_big_wheel_persists(self, demo_user_1):
        r = requests.put(
            f"{BASE_URL}/api/preferences/spades-ruleset",
            json={"ruleset": "BIG_WHEEL"},
            headers={"Authorization": f"Bearer {demo_user_1['token']}"},
            cookies=demo_user_1["cookies"],
            timeout=20,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True and data["ruleset"] == "BIG_WHEEL"

        # GET back
        r = requests.get(
            f"{BASE_URL}/api/preferences/spades-ruleset",
            headers={"Authorization": f"Bearer {demo_user_1['token']}"},
            cookies=demo_user_1["cookies"],
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json()["ruleset"] == "BIG_WHEEL"

    def test_put_bad_400(self, demo_user_1):
        r = requests.put(
            f"{BASE_URL}/api/preferences/spades-ruleset",
            json={"ruleset": "NOPE"},
            headers={"Authorization": f"Bearer {demo_user_1['token']}"},
            cookies=demo_user_1["cookies"],
            timeout=20,
        )
        assert r.status_code == 400
        assert "Unknown ruleset" in r.json().get("detail", "")


# ────────────────────────────────────────────── /api/admin/live-seats

class TestAdminLiveSeats:
    def test_unauth_401(self, api_client):
        r = requests.get(f"{BASE_URL}/api/admin/live-seats", timeout=20)
        assert r.status_code == 401

    def test_with_active_bigwheel_game(
        self, admin_session, demo_user_1, demo_user_n, created_game_ids
    ):
        # Ensure at least one BIG_WHEEL game is active
        body = {
            "partner_id": demo_user_n[0]["user_id"],
            "opponent1_id": demo_user_n[1]["user_id"],
            "opponent2_id": demo_user_n[2]["user_id"],
            "wager": 10,
            "ruleset": "BIG_WHEEL",
        }
        r = requests.post(
            f"{BASE_URL}/api/spades/start",
            json=body,
            headers={"Authorization": f"Bearer {demo_user_1['token']}"},
            cookies=demo_user_1["cookies"],
            timeout=20,
        )
        assert r.status_code == 200
        gid = r.json()["game_id"]
        created_game_ids.append(gid)

        r = admin_session.get(f"{BASE_URL}/api/admin/live-seats?limit=96", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "count" in data and "seats" in data
        assert data["count"] >= 4, f"expected at least 4 seats, got {data['count']}"
        # Validate required fields on each seat
        sample = data["seats"][0]
        for k in ["seat_id", "table_id", "seat_number", "position",
                  "is_live", "game_type", "ruleset", "spectate_url",
                  "wager", "pot", "session_earnings", "username",
                  "chair_phase", "chair_multiplier"]:
            assert k in sample, f"missing key '{k}' in seat"

        # At least one seat should be BIG_WHEEL and match spectate_url format
        bw_seats = [s for s in data["seats"] if s.get("ruleset") == "BIG_WHEEL"]
        assert len(bw_seats) >= 4
        for s in bw_seats:
            assert s["spectate_url"].startswith("/spades-aaa/spades_")
            assert s["table_id"] in s["spectate_url"]


# ────────────────────────────────────────────── admin/live-seats empty state

class TestAdminLiveSeatsEmpty:
    def test_no_active_games_returns_empty(self, admin_session):
        """After marking all active spades games complete, endpoint must
        return count=0 (not 500). Uses DB directly to flip status so we
        don't disturb actively-running real games (none expected in
        preview env)."""
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        client = MongoClient(mongo_url)
        db = client[db_name]
        # Snapshot current active so we can restore
        active_ids = [d["game_id"] for d in db.spades_games.find(
            {"status": "active"}, {"game_id": 1, "_id": 0})]
        try:
            if active_ids:
                db.spades_games.update_many(
                    {"game_id": {"$in": active_ids}},
                    {"$set": {"status": "completed_TEST_TEMP"}},
                )
            r = admin_session.get(f"{BASE_URL}/api/admin/live-seats", timeout=20)
            assert r.status_code == 200
            data = r.json()
            assert data["count"] == 0
            assert data["seats"] == []
        finally:
            # Restore
            if active_ids:
                db.spades_games.update_many(
                    {"game_id": {"$in": active_ids}, "status": "completed_TEST_TEMP"},
                    {"$set": {"status": "active"}},
                )
            client.close()
