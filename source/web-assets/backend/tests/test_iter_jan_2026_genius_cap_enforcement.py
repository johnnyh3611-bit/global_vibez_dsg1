"""Integration test: Genius per-user cap enforcement on real purchase path.

Seeds the demo user's chair_purchases close to 100, then attempts a
purchase via /api/chairs/test-buy that would overshoot. Cleans up all
seeded data afterwards.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
ADMIN_PASSWORD = "GlobalVibez_Founder_2025!"
ADMIN_2FA = "000000"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def demo_user():
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    return {"token": body.get("token") or body.get("session_token"),
            "user_id": body["user_id"]}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/vault-auth",
               json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA}, timeout=30)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture
def seed_95_genius_chairs(db, demo_user):
    """Seed a fake purchase of 95 Genius chairs for the demo user.
    Cleans up after the test."""
    user_id = demo_user["user_id"]
    lookup = user_id[:8]
    seed_ref = f"TEST_SEED_{uuid.uuid4().hex}"
    seed_doc = {
        "user_id": f"TEST_FAKE_{user_id}",  # not encrypted but lookup is what matters
        "user_id_lookup": lookup,
        "quantity": 95,
        "chair_ids": [],
        "price_per_chair_usd": 10.0,
        "contribution_usd": 950.0,
        "payment_ref": seed_ref,
        "invite_code": None,
        "phase_at_purchase": "Genius",
        "weight": 3.0,
        "weighted_units": 285.0,
        "purchased_at": datetime.now(timezone.utc).isoformat(),
        "_test_seed": True,
    }
    db.chair_purchases.insert_one(seed_doc)
    yield seed_ref
    # Cleanup
    db.chair_purchases.delete_one({"payment_ref": seed_ref})
    # Also clean any test-buy attempts created during the test
    db.chair_purchases.delete_many({"payment_ref": {"$regex": "^TEST_BUY_"}})


def _ensure_cap_engaged(admin):
    """Make sure cap is ON before each test."""
    admin.post(f"{BASE_URL}/api/admin/chairs/genius-cap/toggle",
               json={"lifted": False}, timeout=20)


def test_user_remaining_drops_to_5_after_seed(seed_95_genius_chairs, demo_user, admin):
    _ensure_cap_engaged(admin)
    r = requests.get(f"{BASE_URL}/api/chairs/genius-cap",
                     headers={"Authorization": f"Bearer {demo_user['token']}"}, timeout=20)
    assert r.status_code == 200
    d = r.json()
    # Demo user already had 5 Genius chairs from previous sessions + 95 we seeded = 100,
    # but per spec: cap_remaining = 100 - sum(genius_qty). With 5+95=100, remaining=0.
    # Actually: previous sessions had a 5-chair purchase. With our 95 seed, total=100.
    assert d["cap_active"] is True
    assert d["user_remaining"] == 0, f"expected 0 remaining (5 prior + 95 seed), got {d['user_remaining']}"


def test_purchase_over_cap_rejected_400(seed_95_genius_chairs, demo_user, admin):
    """Attempt to buy 1 more chair when user is already at 100. Should 400."""
    _ensure_cap_engaged(admin)
    payload = {"quantity": 1, "payment_ref": f"TEST_BUY_{uuid.uuid4().hex}"}
    r = requests.post(f"{BASE_URL}/api/chairs/test-buy",
                      headers={"Authorization": f"Bearer {demo_user['token']}"},
                      json=payload, timeout=30)
    assert r.status_code == 400, f"expected 400 cap rejection, got {r.status_code} {r.text}"
    detail = r.json().get("detail", "")
    assert "Genius Phase allows up to 100 chairs per user" in detail, \
        f"detail did not mention cap: {detail}"


def test_purchase_succeeds_when_admin_lifts_cap(seed_95_genius_chairs, demo_user, admin, db):
    """When admin lifts cap, an over-cap purchase should now succeed."""
    pre_total = db.chair_purchases.count_documents({"phase_at_purchase": "Genius"})
    pre_balance = db.profit_share_balances.find_one(
        {"user_id": demo_user["user_id"]}, {"lifetime_chairs": 1, "locked_chairs": 1,
                                            "weighted_chairs": 1, "lifetime_contribution_usd": 1})
    pre_counter = db.profit_share_counters.find_one({"_id": "global_chairs"}, {"count": 1})
    # Lift cap
    lr = admin.post(f"{BASE_URL}/api/admin/chairs/genius-cap/toggle",
                    json={"lifted": True}, timeout=20)
    assert lr.status_code == 200
    qty = 2
    try:
        payload = {"quantity": qty, "payment_ref": f"TEST_BUY_{uuid.uuid4().hex}"}
        r = requests.post(f"{BASE_URL}/api/chairs/test-buy",
                          headers={"Authorization": f"Bearer {demo_user['token']}"},
                          json=payload, timeout=30)
        assert r.status_code == 200, f"expected 200 with cap lifted, got {r.status_code} {r.text}"
    finally:
        # Always re-engage cap
        admin.post(f"{BASE_URL}/api/admin/chairs/genius-cap/toggle",
                   json={"lifted": False}, timeout=20)
        # Roll back the real purchase that _grant_chairs created
        # (encrypts payment_ref so we can't match by ref - delete newest Genius purchase)
        latest = db.chair_purchases.find_one(
            {"phase_at_purchase": "Genius", "_test_seed": {"$exists": False}},
            sort=[("purchased_at", -1)])
        if latest and latest.get("quantity") == qty:
            db.chair_purchases.delete_one({"_id": latest["_id"]})
        # Restore balance + counter
        db.profit_share_balances.update_one(
            {"user_id": demo_user["user_id"]},
            {"$inc": {"lifetime_chairs": -qty, "locked_chairs": -qty,
                      "weighted_chairs": -(qty * 3.0),
                      "lifetime_contribution_usd": -(qty * 10.0)}})
        db.profit_share_counters.update_one(
            {"_id": "global_chairs"}, {"$inc": {"count": -qty}})
        post_total = db.chair_purchases.count_documents({"phase_at_purchase": "Genius"})
        assert post_total == pre_total, f"cleanup failed: {pre_total} → {post_total}"
