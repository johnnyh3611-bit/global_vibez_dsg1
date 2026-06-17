"""
Regression tests for Jan 2026 backlog items A-E:
  A) Big Wheel Lounge sub-route: /api/spades/big-wheel/{stats,lobbies,leaderboard}
  B) Apex Pre-Sale Wishlist: POST /api/apex/wishlist + count + admin dump
  C) Milestone Recap: GET /api/admin/milestones/recap
  D) Solana Gas Monitor + TPS: /api/solana/network/{fees,tps}  (admin only)
  E) Lifespan refactor — spread test of 10 routes to ensure no route was lost.

All tests use the public REACT_APP_BACKEND_URL (preview ingress).
"""
import os
import uuid
import pytest
import requests

# Test credentials are pulled from env to keep secrets out of source.
# See /app/backend/tests/conftest.py and /app/memory/test_credentials.md.
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)


# ---------------------------------------------------------------- Fixtures
@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_session(http):
    """Admin (vault) cookie session."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(
        f"{BASE_URL}/api/admin/vault-auth",
        json={"password": ADMIN_PASSWORD, "code": "000000"},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return s


@pytest.fixture(scope="module")
def demo_session():
    """Demo (logged-in regular user) session via /api/auth/demo-login."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/demo-login", timeout=15)
    if r.status_code not in (200, 201):
        pytest.skip(f"Demo login failed: {r.status_code} {r.text[:200]}")
    return s


# ============================================================== ITEM A: Big Wheel
class TestBigWheelLounge:
    def test_stats_public_baseline(self, http):
        r = http.get(f"{BASE_URL}/api/spades/big-wheel/stats", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "tables_active" in data and "total_pot" in data
        assert isinstance(data["tables_active"], int)
        assert isinstance(data["total_pot"], int)
        assert data["tables_active"] >= 0
        assert data["total_pot"] >= 0

    def test_lobbies_public_shape(self, http):
        r = http.get(f"{BASE_URL}/api/spades/big-wheel/lobbies?limit=5", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "count" in data and "lobbies" in data
        assert isinstance(data["lobbies"], list)
        assert data["count"] == len(data["lobbies"])
        for lobby in data["lobbies"]:
            for k in ("game_id", "wager", "pot", "phase", "seat_count",
                       "team1_points", "team2_points", "spectate_url"):
                assert k in lobby, f"missing {k} in lobby"
            assert lobby["spectate_url"].startswith("/spades-aaa/")
            assert lobby["spectate_url"].endswith(lobby["game_id"])

    def test_leaderboard_public_shape_empty_safe(self, http):
        # Empty must not 500
        r = http.get(
            f"{BASE_URL}/api/spades/big-wheel/leaderboard?period_days=7&limit=10",
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("period_days", "since", "count", "leaders"):
            assert k in data
        assert data["period_days"] == 7
        assert isinstance(data["leaders"], list)
        assert data["count"] == len(data["leaders"])

    def test_leaderboard_period_days_bounds(self, http):
        # ge=1, le=90
        r = http.get(f"{BASE_URL}/api/spades/big-wheel/leaderboard?period_days=0", timeout=15)
        assert r.status_code == 422
        r = http.get(f"{BASE_URL}/api/spades/big-wheel/leaderboard?period_days=91", timeout=15)
        assert r.status_code == 422
        r = http.get(f"{BASE_URL}/api/spades/big-wheel/leaderboard?period_days=30&limit=0", timeout=15)
        assert r.status_code == 422
        r = http.get(f"{BASE_URL}/api/spades/big-wheel/leaderboard?period_days=30&limit=101", timeout=15)
        assert r.status_code == 422

    def test_create_big_wheel_game_updates_stats(self, demo_session, http):
        """Create a BIG_WHEEL game → verify stats reflect it → cleanup."""
        # Snapshot before
        before = http.get(f"{BASE_URL}/api/spades/big-wheel/stats", timeout=15).json()
        before_active = before["tables_active"]
        before_pot = before["total_pot"]

        # Start game
        payload = {
            "partner_id": "AI_PARTNER",
            "opponent1_id": "AI_OPP1",
            "opponent2_id": "AI_OPP2",
            "wager": 10,
            "ruleset": "BIG_WHEEL",
        }
        r = demo_session.post(f"{BASE_URL}/api/spades/start", json=payload, timeout=20)
        assert r.status_code == 200, f"spades start failed: {r.status_code} {r.text[:400]}"
        gd = r.json()
        game_id = gd.get("game_id")
        assert game_id and gd.get("ruleset") == "BIG_WHEEL"

        try:
            # Stats should reflect new active game
            after = http.get(f"{BASE_URL}/api/spades/big-wheel/stats", timeout=15).json()
            assert after["tables_active"] >= before_active + 1
            assert after["total_pot"] >= before_pot + 10  # wager*4 = 40, but at least +wager

            # Lobbies should include this game
            lr = http.get(f"{BASE_URL}/api/spades/big-wheel/lobbies?limit=50", timeout=15).json()
            game_ids = [lb["game_id"] for lb in lr["lobbies"]]
            assert game_id in game_ids
            target = next(lb for lb in lr["lobbies"] if lb["game_id"] == game_id)
            assert target["wager"] == 10
            assert target["pot"] == 40  # wager * 4
            assert target["spectate_url"] == f"/spades-aaa/{game_id}"
        finally:
            # Cleanup: mark the test game as finished/deleted via direct DB
            # The route doesn't expose a delete; use admin DB directly via a helper
            # endpoint if available, otherwise leave it (idempotent). We'll attempt
            # via Mongo through the MONGO_URL env (only works locally to backend).
            try:
                from pymongo import MongoClient
                mongo_url = os.environ.get("MONGO_URL")
                if mongo_url:
                    cli = MongoClient(mongo_url, serverSelectionTimeoutMS=2000)
                    db = cli[os.environ.get("DB_NAME", "test_database")]
                    db.spades_games.delete_one({"game_id": game_id})
                    cli.close()
            except Exception as e:
                print(f"[cleanup] could not remove game {game_id}: {e}")


# ============================================================== ITEM B: Apex Wishlist
TEST_EMAIL = f"pytest_{uuid.uuid4().hex[:8]}@example.test"


class TestApexWishlist:
    def test_400_when_neither_user_nor_email(self, http):
        # Anonymous + no email → 400
        r = http.post(f"{BASE_URL}/api/apex/wishlist", json={"chairs_wanted": 2}, timeout=15)
        assert r.status_code == 400, r.text

    def test_anonymous_with_email_creates_row(self, http):
        r = http.post(
            f"{BASE_URL}/api/apex/wishlist",
            json={"email": TEST_EMAIL, "chairs_wanted": 3},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert data.get("chairs_wanted") == 3

    def test_count_reflects_new_row(self, http):
        r = http.get(f"{BASE_URL}/api/apex/wishlist/count", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "count" in data and "chairs_reserved" in data
        assert data["count"] >= 1
        assert data["chairs_reserved"] >= 3

    def test_idempotent_update_on_repeat(self, http):
        # Snapshot
        before = http.get(f"{BASE_URL}/api/apex/wishlist/count", timeout=15).json()
        # Update chairs_wanted from 3 → 5
        r = http.post(
            f"{BASE_URL}/api/apex/wishlist",
            json={"email": TEST_EMAIL, "chairs_wanted": 5},
            timeout=15,
        )
        assert r.status_code == 200
        after = http.get(f"{BASE_URL}/api/apex/wishlist/count", timeout=15).json()
        assert after["count"] == before["count"]  # no new row
        assert after["chairs_reserved"] == before["chairs_reserved"] + 2  # 3→5

    def test_chairs_wanted_bounds(self, http):
        r = http.post(
            f"{BASE_URL}/api/apex/wishlist",
            json={"email": f"bounds_{uuid.uuid4().hex[:6]}@test.test", "chairs_wanted": 0},
            timeout=15,
        )
        assert r.status_code == 422
        r = http.post(
            f"{BASE_URL}/api/apex/wishlist",
            json={"email": f"bounds_{uuid.uuid4().hex[:6]}@test.test", "chairs_wanted": 101},
            timeout=15,
        )
        assert r.status_code == 422

    def test_admin_wishlist_unauth_401(self, http):
        r = http.get(f"{BASE_URL}/api/admin/apex/wishlist", timeout=15)
        assert r.status_code == 401, r.text

    def test_admin_wishlist_authed(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/apex/wishlist", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "count" in data and "rows" in data
        assert data["count"] == len(data["rows"])
        # Find our test entry
        emails = [row.get("email") for row in data["rows"]]
        assert TEST_EMAIL.lower() in emails
        # Verify schema
        my_row = next(r for r in data["rows"] if r.get("email") == TEST_EMAIL.lower())
        assert "chairs_wanted" in my_row
        assert "joined_at" in my_row
        assert my_row["chairs_wanted"] == 5  # last update value

    @classmethod
    def teardown_class(cls):
        """Cleanup wishlist test entries."""
        try:
            from pymongo import MongoClient
            mongo_url = os.environ.get("MONGO_URL")
            if mongo_url:
                cli = MongoClient(mongo_url, serverSelectionTimeoutMS=2000)
                db = cli[os.environ.get("DB_NAME", "test_database")]
                # Match emails starting with 'pytest_' or 'bounds_' from test suite
                res = db.apex_wishlist.delete_many({"email": {"$regex": r"^(pytest_|bounds_)"}})
                print(f"[cleanup] removed {res.deleted_count} wishlist test rows")
                cli.close()
        except Exception as e:
            print(f"[cleanup] wishlist teardown failed: {e}")


# ============================================================== ITEM C: Milestone Recap
class TestMilestoneRecap:
    def test_unauth_401(self, http):
        r = http.get(f"{BASE_URL}/api/admin/milestones/recap", timeout=15)
        assert r.status_code == 401

    def test_recap_authed_default(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/milestones/recap", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("period_days", "since", "counts", "post_rate_pct", "recent_posted"):
            assert k in data
        for k in ("posted", "skipped", "queued", "total"):
            assert k in data["counts"]
        assert data["period_days"] == 7  # default
        assert data["counts"]["total"] == (
            data["counts"]["posted"] + data["counts"]["skipped"] + data["counts"]["queued"]
        )
        assert isinstance(data["recent_posted"], list)

    def test_recap_period_days_bounds(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/milestones/recap?period_days=0", timeout=15)
        # The route clamps internally rather than 422 (max(1, min(...)))
        assert r.status_code == 200
        assert r.json()["period_days"] == 1

        r = admin_session.get(f"{BASE_URL}/api/admin/milestones/recap?period_days=999", timeout=15)
        assert r.status_code == 200
        assert r.json()["period_days"] == 90


# ============================================================== ITEM D: Solana Network
class TestSolanaNetwork:
    def test_fees_unauth_401(self, http):
        r = http.get(f"{BASE_URL}/api/solana/network/fees", timeout=15)
        assert r.status_code == 401

    def test_tps_unauth_401(self, http):
        r = http.get(f"{BASE_URL}/api/solana/network/tps", timeout=15)
        assert r.status_code == 401

    def test_fees_authed_devnet(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/solana/network/fees", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("rpc_url", "is_mainnet", "samples", "low", "med", "high",
                   "low_sol", "med_sol", "high_sol"):
            assert k in data, f"missing {k} in fees"
        # Devnet expected: is_mainnet False, samples 150, all fees zero
        assert data["is_mainnet"] is False
        # Devnet typically returns 150 samples but allow anything >=0
        assert data["samples"] >= 0
        # On devnet low/med/high all zero
        assert data["low"] == 0 and data["med"] == 0 and data["high"] == 0

    def test_tps_authed_devnet_real_data(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/solana/network/tps?samples=10", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("rpc_url", "is_mainnet", "samples", "avg_tps", "peak_tps", "series"):
            assert k in data
        assert data["is_mainnet"] is False
        assert isinstance(data["series"], list)
        if data["series"]:
            for sample in data["series"]:
                for k in ("slot", "n_transactions", "period_secs", "tps"):
                    assert k in sample
            # Devnet has real (low) traffic - just verify TPS is non-negative
            assert data["avg_tps"] >= 0
            assert data["peak_tps"] >= 0

    def test_tps_samples_clamped(self, admin_session):
        # Internal clamp 1..60, not 422
        r = admin_session.get(f"{BASE_URL}/api/solana/network/tps?samples=200", timeout=30)
        assert r.status_code == 200
        # series length <= 60
        assert len(r.json()["series"]) <= 60


# ============================================================== ITEM E: Lifespan Refactor — Spread Test
class TestLifespanSpreadTest:
    """Hit 10 different route categories to ensure no route was lost in
    the lifespan refactor. We only check 'no 500' / expected status."""

    @pytest.mark.parametrize("path,expected_codes", [
        ("/api/health", {200}),
        ("/api/chairs/phase", {200}),
        ("/api/economy/health", {200}),
        ("/api/founders-pass/tiers", {200}),
        ("/api/multiplayer/stats", {200}),
        ("/api/spades/rulesets", {200}),
        ("/api/apex/status", {200}),
        ("/api/admin/audit/feed", {401}),  # requires admin
        ("/api/preferences/table-style", {401, 403}),  # requires auth
        ("/api/coins/leaderboard", {200}),
    ])
    def test_route_lives(self, http, path, expected_codes):
        r = http.get(f"{BASE_URL}{path}", timeout=15)
        assert r.status_code in expected_codes, (
            f"{path} → {r.status_code} (expected {expected_codes}), body={r.text[:200]}"
        )
        # Definitely never 500
        assert r.status_code != 500

    def test_backend_health_responsive(self, http):
        """Quick canary that schedulers + indexes init didn't kill backend."""
        r = http.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "healthy"
