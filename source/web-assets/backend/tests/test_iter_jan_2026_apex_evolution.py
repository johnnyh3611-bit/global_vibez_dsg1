"""
Apex Evolution + per-user Preferences regression suite (Jan 2026).

CRITICAL CLEANUP: Apex activation is destructive (permanently bumps every
chair_purchase weight by +1.0). The session-level fixture
`_apex_cleanup_after_run` resets the platform_state.apex doc and reverts
the weight bump on chair_purchases & profit_share_balances at session end.
"""
import os
import time
import requests
import pytest
from typing import Optional
from pymongo import MongoClient

# Test credentials are pulled from env to keep secrets out of source.
# See /app/backend/tests/conftest.py and /app/memory/test_credentials.md.
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
ADMIN_2FA = os.environ.get("ADMIN_2FA", "")

if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)


# ────────────────────────────────────────────── Mongo helpers (cleanup)


def _mongo_db():
    """Direct mongo handle for cleanup. Uses local mongod (test_database)."""
    cli = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
    return cli["test_database"], cli


def _reset_apex_state():
    """Tear down the apex state + revert weight bumps. Idempotent."""
    db, cli = _mongo_db()
    try:
        # 1) Revert weight bumps on rows that were pumped.
        pumped = list(db.chair_purchases.find({"apex_pump_added": True}, {"_id": 1, "user_id": 1, "quantity": 1, "weight": 1}))
        if pumped:
            user_qty = {}
            for p in pumped:
                uid = p.get("user_id")
                qty = int(p.get("quantity") or 0)
                if uid and qty:
                    user_qty[uid] = user_qty.get(uid, 0) + qty
            db.chair_purchases.update_many(
                {"apex_pump_added": True},
                {"$inc": {"weight": -1.0}, "$unset": {"apex_pump_added": ""}},
            )
            # Recompute weighted_units = qty * new_weight
            for r in db.chair_purchases.find({}, {"_id": 1, "quantity": 1, "weight": 1}):
                qty = int(r.get("quantity") or 0)
                w = float(r.get("weight") or 0.0)
                db.chair_purchases.update_one({"_id": r["_id"]}, {"$set": {"weighted_units": round(qty * w, 4)}})
            for uid, qty in user_qty.items():
                db.profit_share_balances.update_one(
                    {"user_id": uid},
                    {"$inc": {"weighted_chairs": -float(qty)}},
                )
        # 2) Delete the apex platform_state doc so race_started_at re-inits.
        db.platform_state.delete_one({"_id": "apex"})
    finally:
        cli.close()


# ────────────────────────────────────────────── Fixtures


@pytest.fixture(scope="session")
def admin_session() -> requests.Session:
    s = requests.Session()
    r = s.post(f"{API}/admin/vault-auth", json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def demo_session():
    """Demo user — returns (session-with-cookie, bearer_token, user_id)."""
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", timeout=15)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token") or data.get("session_token")
    user = data.get("user") or {}
    user_id = user.get("user_id") or user.get("id") or data.get("user_id")
    return s, token, user_id


@pytest.fixture(scope="session", autouse=True)
def _apex_cleanup_after_run():
    """Ensure environment is clean before AND after the run."""
    _reset_apex_state()
    yield
    _reset_apex_state()


# ────────────────────────────────────────────── 1. /api/apex/status shape


class TestApexStatus:
    def test_status_shape_default(self):
        r = requests.get(f"{API}/apex/status", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in [
            "evolution_at", "seconds_until_evolution", "apex_unlocked",
            "pump_applied", "race_started_at", "activated_at",
            "race_bonuses_awarded", "next_pump", "apex_phase",
        ]:
            assert k in d, f"missing key {k}"
        # APEX_EVOLUTION_TIMESTAMP env unset by default
        assert d["evolution_at"] is None
        assert d["seconds_until_evolution"] is None
        assert d["apex_unlocked"] is False
        assert d["pump_applied"] is False
        # Lazy-init: race_started_at is a non-empty ISO string
        assert isinstance(d["race_started_at"], str) and len(d["race_started_at"]) > 10
        # next_pump shape
        np = d["next_pump"]
        for tier in ["Genesis", "Vanguard", "Global", "Stellar", "Celestial", "Apex"]:
            assert tier in np
            assert "old" in np[tier] and "new" in np[tier]
        assert np["Genesis"] == {"old": 3.0, "new": 4.0}
        assert np["Apex"] == {"old": None, "new": 1.0}
        # apex_phase shape
        ap = d["apex_phase"]
        assert ap["name"] == "Apex"
        assert ap["price_usd"] == 50.00
        assert ap["weight"] == 1.0
        assert ap["capacity"] == 250000


# ────────────────────────────────────────────── 2. Race leaderboard


class TestApexRaceLeaders:
    def test_race_leaders_shape(self):
        r = requests.get(f"{API}/apex/race/leaders?limit=10", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["prize_count"] == 100
        assert "race_started_at" in d
        assert isinstance(d["leaders"], list)
        assert len(d["leaders"]) <= 10

        for leader in d["leaders"]:
            assert "rank" in leader and "anon_id" in leader
            assert "race_invites" in leader and "qualifies_for_bonus" in leader
            assert isinstance(leader["race_invites"], int)
            # anon_id MUST be masked when source uid is long enough
            if len(leader["anon_id"]) > 10:
                assert "…" in leader["anon_id"], "anon_id should be masked"
            assert leader["qualifies_for_bonus"] is True  # rank<=100

    def test_race_leaders_limit_capped(self):
        # limit > 100 should cap at 100
        r = requests.get(f"{API}/apex/race/leaders?limit=500", timeout=10)
        assert r.status_code == 200
        assert len(r.json()["leaders"]) <= 100


# ────────────────────────────────────────────── 3. Admin auth gates


class TestAdminAuthGates:
    def test_activate_now_401(self):
        r = requests.post(f"{API}/admin/apex/activate-now", timeout=10)
        assert r.status_code in (401, 403), r.text

    def test_award_bonuses_401(self):
        r = requests.post(f"{API}/admin/apex/award-bonuses", timeout=10)
        assert r.status_code in (401, 403)

    def test_reset_race_401(self):
        r = requests.post(f"{API}/admin/apex/reset-race", timeout=10)
        assert r.status_code in (401, 403)


# ────────────────────────────────────────────── 4. Reset race (must be BEFORE activate)


class TestResetRace:
    def test_reset_race_before_activation(self, admin_session):
        before = requests.get(f"{API}/apex/status", timeout=10).json()["race_started_at"]
        time.sleep(1.1)  # ensure timestamp differs
        r = admin_session.post(f"{API}/admin/apex/reset-race", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["race_started_at"] != before
        # Verify state reflects in status
        s = requests.get(f"{API}/apex/status", timeout=10).json()
        assert s["race_started_at"] == d["race_started_at"]


# ────────────────────────────────────────────── 5. Award bonuses pre-activation


class TestAwardBonusesPreActivation:
    def test_award_bonuses_400_before_activation(self, admin_session):
        # Make sure not yet activated (cleanup ran)
        s = requests.get(f"{API}/apex/status", timeout=10).json()
        if s["apex_unlocked"]:
            pytest.skip("apex already activated")
        r = admin_session.post(f"{API}/admin/apex/award-bonuses", timeout=10)
        assert r.status_code == 400, r.text
        body = r.json()
        msg = body.get("detail") or body.get("message") or ""
        assert "Apex must be activated" in msg or "activated" in msg.lower()


# ────────────────────────────────────────────── 6. Preferences (auth gates + round trip)


def _bearer_headers(token: Optional[str]) -> dict:
    return {"Authorization": f"Bearer {token}"} if token else {}


class TestPreferences:
    def test_table_style_401_unauth(self):
        r = requests.get(f"{API}/preferences/table-style", timeout=10)
        assert r.status_code in (401, 403)

    def test_table_style_get_default(self, demo_session):
        sess, token, _ = demo_session
        r = sess.get(f"{API}/preferences/table-style", headers=_bearer_headers(token), timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["available"] == ["celestial", "neon", "cherry", "midnight", "royal"]
        assert d["style"] in d["available"]

    def test_table_style_put_round_trip(self, demo_session):
        sess, token, _ = demo_session
        r = sess.put(
            f"{API}/preferences/table-style",
            json={"style": "royal"},
            headers=_bearer_headers(token),
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True, "style": "royal"}
        # Verify persistence
        r2 = sess.get(f"{API}/preferences/table-style", headers=_bearer_headers(token), timeout=10)
        assert r2.json()["style"] == "royal"

    def test_table_style_put_bad_value(self, demo_session):
        sess, token, _ = demo_session
        r = sess.put(
            f"{API}/preferences/table-style",
            json={"style": "not_a_style"},
            headers=_bearer_headers(token),
            timeout=10,
        )
        assert r.status_code == 400, r.text

    def test_wallet_memo_401_unauth(self):
        r = requests.get(f"{API}/preferences/wallet-memo", timeout=10)
        assert r.status_code in (401, 403)

    def test_wallet_memo_round_trip(self, demo_session):
        sess, token, _ = demo_session
        # Get default
        r = sess.get(f"{API}/preferences/wallet-memo", headers=_bearer_headers(token), timeout=10)
        assert r.status_code == 200
        # Set
        r2 = sess.put(
            f"{API}/preferences/wallet-memo",
            json={"memo": "hello world"},
            headers=_bearer_headers(token),
            timeout=10,
        )
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2 == {"ok": True, "memo": "hello world", "saved_len": 11}
        # Read back
        r3 = sess.get(f"{API}/preferences/wallet-memo", headers=_bearer_headers(token), timeout=10)
        assert r3.json()["memo"] == "hello world"

    def test_wallet_memo_truncates_at_500(self, demo_session):
        sess, token, _ = demo_session
        big = "x" * 800
        r = sess.put(
            f"{API}/preferences/wallet-memo",
            json={"memo": big},
            headers=_bearer_headers(token),
            timeout=10,
        )
        # Pydantic max_length=500 → likely 422; if it accepts then must truncate.
        if r.status_code == 200:
            d = r.json()
            assert d["saved_len"] == 500
        else:
            assert r.status_code in (400, 422), r.text


# ────────────────────────────────────────────── 7. ACTIVATE-NOW flow (DESTRUCTIVE — cleanup at end)


class TestActivateNowAndPump:
    """Full destructive flow. Order matters; relies on session cleanup."""

    def test_z1_seed_chair_for_demo_user(self, demo_session):
        """Ensure demo user has at least one chair so we can verify pump."""
        sess, token, _ = demo_session
        # Try test-buy 1 chair
        r = sess.post(
            f"{API}/chairs/test-buy",
            json={"quantity": 1, "payment_ref": f"apex_test_seed_{int(time.time())}"},
            headers=_bearer_headers(token),
            timeout=15,
        )
        # Either succeeds, or already has chairs (idempotent ref). Accept 200/201.
        assert r.status_code in (200, 201), f"chair seed failed: {r.status_code} {r.text}"
        # Snapshot pre-activation state
        me = sess.get(f"{API}/chairs/me", headers=_bearer_headers(token), timeout=10)
        assert me.status_code == 200, me.text
        pytest.pre_activation_chairs_me = me.json()  # type: ignore[attr-defined]

    def test_z2_activate_now_first_call(self, admin_session):
        r = admin_session.post(f"{API}/admin/apex/activate-now", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d.get("already_active") is False
        assert "sold_at_unlock" in d
        assert isinstance(d["sold_at_unlock"], int)
        pump = d.get("pump", {})
        assert pump.get("already_applied") is False
        assert pump.get("rows_bumped", 0) >= 1
        assert pump.get("users_affected", 0) >= 1

    def test_z3_status_reflects_activation(self):
        s = requests.get(f"{API}/apex/status", timeout=10).json()
        assert s["apex_unlocked"] is True
        assert s["pump_applied"] is True
        assert isinstance(s["activated_at"], str) and len(s["activated_at"]) > 10

    def test_z4_activate_now_idempotent(self, admin_session):
        r = admin_session.post(f"{API}/admin/apex/activate-now", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d.get("already_active") is True

    def test_z5_chairs_phase_returns_apex_shape(self):
        r = requests.get(f"{API}/chairs/phase", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("phase") == "Apex" or d.get("phase", {}).get("name") == "Apex" or d.get("phase_name") == "Apex"
        # Inspect price/weight regardless of nesting
        flat = d if "price_usd" in d else d.get("phase", {})
        assert flat.get("price_usd") == 50.0
        assert flat.get("weight") == 1.0
        rem = d.get("remaining_in_phase") or flat.get("remaining_in_phase")
        if rem is not None:
            assert rem <= 250_000

    def test_z6_chairs_me_reflects_pump(self, demo_session):
        sess, token, _ = demo_session
        before = getattr(pytest, "pre_activation_chairs_me", None)
        if not before:
            pytest.skip("no pre-activation snapshot")
        after = sess.get(f"{API}/chairs/me", headers=_bearer_headers(token), timeout=10).json()
        locked_before = int(before.get("locked_chairs") or before.get("total_chairs") or 0)
        if locked_before < 1:
            pytest.skip("demo user has no locked chairs to verify pump")
        wb = float(before.get("weighted_chairs") or 0.0)
        wa = float(after.get("weighted_chairs") or 0.0)
        assert wa - wb >= float(locked_before) - 0.001, (
            f"weighted_chairs not pumped: before={wb} after={wa} locked={locked_before}"
        )
        # average_earn_multiplier should rise by 1.0 (per chair) if present
        mb = before.get("average_earn_multiplier")
        ma = after.get("average_earn_multiplier")
        if mb is not None and ma is not None:
            assert float(ma) - float(mb) >= 0.999, f"avg multiplier didn't pump: {mb}->{ma}"

    def test_z7_pump_idempotent_on_db_rows(self):
        """Direct DB check — every pumped row has apex_pump_added=true and
        weighted_units == quantity * weight (post-pump)."""
        db, cli = _mongo_db()
        try:
            tagged = list(db.chair_purchases.find({"apex_pump_added": True},
                                                  {"_id": 0, "quantity": 1, "weight": 1, "weighted_units": 1}))
            assert len(tagged) >= 1
            for r in tagged:
                qty = int(r.get("quantity") or 0)
                w = float(r.get("weight") or 0.0)
                wu = float(r.get("weighted_units") or 0.0)
                # Rounding tolerance
                assert abs(wu - qty * w) < 0.01, f"weighted_units mismatch: {r}"
        finally:
            cli.close()

    def test_z8_award_bonuses_after_activation(self, admin_session):
        r = admin_session.post(f"{API}/admin/apex/award-bonuses", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "winners" in d
        assert d.get("already_awarded") in (False, True)
        # Second call — idempotency depends on whether the FIRST call
        # actually granted any chairs. With zero invites in the race
        # window the flag is intentionally NOT flipped (so the founder
        # can retry once invites land); the endpoint stays repeatable.
        r2 = admin_session.post(f"{API}/admin/apex/award-bonuses", timeout=10)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        if d.get("winners", 0) > 0:
            # Real wins → flag flipped → second call is the locked no-op.
            assert d2["already_awarded"] is True
            assert d2["winners"] == 0
        else:
            # No wins → flag stayed open → endpoint remains retryable.
            assert d2.get("already_awarded") in (False, True)
            assert d2.get("winners", 0) == 0

    def test_z9_reset_race_after_activation_400(self, admin_session):
        r = admin_session.post(f"{API}/admin/apex/reset-race", timeout=10)
        assert r.status_code == 400, r.text
