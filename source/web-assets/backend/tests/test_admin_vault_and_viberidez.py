"""
Iteration 97 regression tests:
- Vault admin login (/api/admin/vault-auth) → cookie returned
- 11 core admin dashboard endpoints with vault cookie
- 6 new staff/audit/treasury endpoints with vault cookie
- Auth regression: Bearer fallback for role_level=3 user
- Auth regression: missing-auth → 401
- VibeRidez first-party rideshare flow (request, list hails, claim, double-claim)
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
# Admin credentials sourced from env so dev/staging/prod can define their own.
ADMIN_PASSWORD = os.environ.get("VAULT_ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")
ADMIN_2FA = os.environ.get("VAULT_ADMIN_2FA_CODE", "000000")


# ─────────────────────────────────────────────────────────────────────────────
# Shared fixtures
# ─────────────────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def vault_session():
    """Login as vault founder and return a requests.Session with cookie."""
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/vault-auth", json={
        "password": ADMIN_PASSWORD,
        "code": ADMIN_2FA,
    }, timeout=30)
    assert r.status_code == 200, f"Vault login failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert body.get("success") is True or body.get("authenticated") is True or "session" in body or body.get("status") == "authenticated", f"Unexpected body: {body}"
    # admin_session cookie must be present
    assert any(c.name == "admin_session" for c in s.cookies), f"No admin_session cookie set. Cookies: {s.cookies.get_dict()}"
    return s


@pytest.fixture(scope="module")
def bearer_user():
    """Insert a role_level=3 user directly into Mongo via test seed; yields user_id."""
    # We can't write to Mongo from outside, so we hit a public endpoint that creates a user.
    # Fall back: use direct mongo via motor if env available.
    import motor.motor_asyncio
    import asyncio

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    user_id = f"TEST_admin_user_{uuid.uuid4().hex[:8]}"

    async def _seed():
        client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        await db.users.insert_one({
            "id": user_id,
            "email": f"{user_id}@test.local",
            "username": user_id,
            "role_level": 3,
            "role_name": "God-Mode (Founder)",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        client.close()

    async def _cleanup():
        client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        await db.users.delete_one({"id": user_id})
        client.close()

    asyncio.get_event_loop().run_until_complete(_seed())
    yield user_id
    asyncio.get_event_loop().run_until_complete(_cleanup())


# ─────────────────────────────────────────────────────────────────────────────
# 1. Vault login basic
# ─────────────────────────────────────────────────────────────────────────────
class TestVaultLogin:
    def test_vault_login_success(self):
        r = requests.post(f"{BASE_URL}/api/admin/vault-auth", json={
            "password": ADMIN_PASSWORD,
            "code": ADMIN_2FA,
        }, timeout=30)
        assert r.status_code == 200, r.text[:300]
        # cookie present
        assert "admin_session" in r.cookies, f"Cookies: {dict(r.cookies)}"

    def test_vault_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/admin/vault-auth", json={
            "password": "wrong",
            "code": ADMIN_2FA,
        }, timeout=30)
        assert r.status_code in (401, 403), r.text[:300]


# ─────────────────────────────────────────────────────────────────────────────
# 2. 11 Core admin endpoints with vault cookie
# ─────────────────────────────────────────────────────────────────────────────
CORE_ENDPOINTS = [
    "/api/admin/master-stats",
    "/api/admin/token-velocity",
    "/api/admin/live-activity",
    "/api/admin/high-value-alerts",
    "/api/admin/system-health",
    "/api/admin/all-users",
    "/api/admin/financial-overview",
    "/api/admin/activity-feed",
    "/api/admin/streamer-leaderboard",
    "/api/admin/pending-payouts",
    "/api/admin/announcements",
]


class TestCoreAdminEndpoints:
    @pytest.mark.parametrize("endpoint", CORE_ENDPOINTS)
    def test_core_endpoint_with_vault_cookie(self, vault_session, endpoint):
        r = vault_session.get(f"{BASE_URL}{endpoint}", timeout=30)
        assert r.status_code == 200, f"{endpoint} → {r.status_code}: {r.text[:200]}"
        # Validate response is JSON
        try:
            data = r.json()
        except Exception:
            pytest.fail(f"{endpoint} returned non-JSON: {r.text[:200]}")
        assert data is not None


# ─────────────────────────────────────────────────────────────────────────────
# 3. 6 new staff/audit/treasury endpoints with vault cookie
# ─────────────────────────────────────────────────────────────────────────────
NEW_V1_ENDPOINTS = [
    "/api/v1/admin/staff-list",
    "/api/v1/admin/audit-logs",
    "/api/v1/admin/audit-stats",
    "/api/v1/admin/pending-payouts",
    "/api/v1/admin/revenue-summary",
    "/api/v1/admin/payout-history",
]


class TestNewV1AdminEndpoints:
    @pytest.mark.parametrize("endpoint", NEW_V1_ENDPOINTS)
    def test_v1_endpoint_with_vault_cookie(self, vault_session, endpoint):
        r = vault_session.get(f"{BASE_URL}{endpoint}", timeout=30)
        assert r.status_code == 200, f"{endpoint} → {r.status_code}: {r.text[:200]}"
        try:
            data = r.json()
        except Exception:
            pytest.fail(f"{endpoint} returned non-JSON: {r.text[:200]}")
        assert data is not None


# ─────────────────────────────────────────────────────────────────────────────
# 4. Auth regression — Bearer token fallback
# ─────────────────────────────────────────────────────────────────────────────
class TestBearerAuthRegression:
    def test_bearer_user_can_access_v1_staff_list(self, bearer_user):
        headers = {"Authorization": f"Bearer {bearer_user}"}
        r = requests.get(f"{BASE_URL}/api/v1/admin/staff-list", headers=headers, timeout=30)
        assert r.status_code == 200, f"Bearer auth failed: {r.status_code} {r.text[:200]}"


# ─────────────────────────────────────────────────────────────────────────────
# 5. Auth regression — no auth at all → 401
# ─────────────────────────────────────────────────────────────────────────────
class TestNoAuth:
    @pytest.mark.parametrize("endpoint", NEW_V1_ENDPOINTS)
    def test_no_auth_returns_401(self, endpoint):
        r = requests.get(f"{BASE_URL}{endpoint}", timeout=30)
        # 401 expected; some routes may return 403 — both indicate guarded.
        assert r.status_code in (401, 403), f"{endpoint} should be 401/403 without auth, got {r.status_code}"


# ─────────────────────────────────────────────────────────────────────────────
# 6. VibeRidez first-party flow
# ─────────────────────────────────────────────────────────────────────────────
class TestVibeRidezFlow:
    def _mint_handshake(self, user_id, session_id):
        r = requests.post(f"{BASE_URL}/api/vr/handshake-token", json={
            "user_id": user_id,
            "vr_session_id": session_id,
        }, timeout=30)
        assert r.status_code == 200, r.text[:200]
        return r.json()["handshake_token"]

    def test_request_ride_creates_hail(self):
        user_id = f"TEST_vr_user_{uuid.uuid4().hex[:6]}"
        session_id = f"TEST_session_{uuid.uuid4().hex[:6]}"
        token = self._mint_handshake(user_id, session_id)

        r = requests.post(f"{BASE_URL}/api/vr/request-ride", json={
            "user_id": user_id,
            "target_location": f"TEST_destination_{uuid.uuid4().hex[:6]}",
            "pickup_location": "TEST_pickup",
            "vr_session_id": session_id,
            "handshake_token": token,
            "context": "GlobalVibez_Test",
        }, timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("status") == "Ride Dispatched"
        assert body.get("eta") == "searching for driver"
        assert "ride_id" in body

    def test_list_pending_hails(self):
        # create one first
        user_id = f"TEST_vr_user_{uuid.uuid4().hex[:6]}"
        session_id = f"TEST_session_{uuid.uuid4().hex[:6]}"
        token = self._mint_handshake(user_id, session_id)
        requests.post(f"{BASE_URL}/api/vr/request-ride", json={
            "user_id": user_id,
            "target_location": f"TEST_dest_{uuid.uuid4().hex[:6]}",
            "pickup_location": "TEST_pickup",
            "vr_session_id": session_id,
            "handshake_token": token,
        }, timeout=30)

        r = requests.get(f"{BASE_URL}/api/vibe-ridez/hails?limit=5", timeout=30)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert "count" in body and "hails" in body
        assert isinstance(body["hails"], list)
        assert body["count"] == len(body["hails"])

    def test_claim_hail_and_double_claim(self):
        # 1. create hail
        user_id = f"TEST_vr_user_{uuid.uuid4().hex[:6]}"
        session_id = f"TEST_session_{uuid.uuid4().hex[:6]}"
        token = self._mint_handshake(user_id, session_id)
        requests.post(f"{BASE_URL}/api/vr/request-ride", json={
            "user_id": user_id,
            "target_location": f"TEST_unique_dest_{uuid.uuid4().hex[:8]}",
            "pickup_location": "TEST_pickup",
            "vr_session_id": session_id,
            "handshake_token": token,
        }, timeout=30)

        # 2. fetch list & locate ours (newest first; first should be one we just made or close to it)
        r = requests.get(f"{BASE_URL}/api/vibe-ridez/hails?limit=25", timeout=30)
        hails = r.json()["hails"]
        # find our hail by user_id
        ours = next((h for h in hails if h.get("user_id") == user_id), None)
        assert ours is not None, f"Our hail not found in {len(hails)} hails"
        hail_id = ours["hail_id"]

        # 3. claim
        driver_id = f"TEST_driver_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/vibe-ridez/hails/{hail_id}/claim", json={
            "driver_id": driver_id,
            "driver_username": "test_driver",
        }, timeout=30)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert body.get("status") == "claimed"
        assert body.get("claimed_by_driver_id") == driver_id

        # 4. re-claim → 404
        r2 = requests.post(f"{BASE_URL}/api/vibe-ridez/hails/{hail_id}/claim", json={
            "driver_id": driver_id,
            "driver_username": "test_driver",
        }, timeout=30)
        assert r2.status_code == 404, f"Expected 404 on double-claim, got {r2.status_code}"

    def test_provider_is_vibe_ridez_not_mock(self):
        """Validate the underlying dispatch returns provider='vibe_ridez' (no Uber/Lyft/mock)."""
        user_id = f"TEST_vr_user_{uuid.uuid4().hex[:6]}"
        session_id = f"TEST_session_{uuid.uuid4().hex[:6]}"
        token = self._mint_handshake(user_id, session_id)
        # Sniff via Mongo — easier than scraping response since route omits provider.
        import motor.motor_asyncio
        import asyncio
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")

        requests.post(f"{BASE_URL}/api/vr/request-ride", json={
            "user_id": user_id,
            "target_location": f"TEST_dest_provider_{uuid.uuid4().hex[:6]}",
            "pickup_location": "TEST_pickup",
            "vr_session_id": session_id,
            "handshake_token": token,
        }, timeout=30)

        async def _check():
            client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            doc = await db.vr_rides.find_one({"user_id": user_id}, {"_id": 0})
            client.close()
            return doc

        doc = asyncio.get_event_loop().run_until_complete(_check())
        assert doc is not None, "vr_rides record not persisted"
        assert doc.get("provider") == "vibe_ridez", f"Expected provider='vibe_ridez', got {doc.get('provider')}"
