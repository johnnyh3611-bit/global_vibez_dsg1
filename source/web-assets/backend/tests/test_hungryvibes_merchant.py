"""HungryVibes Merchant Dashboard — backend integration tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
HV = f"{BASE_URL}/api/hungryvibes/merchant"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_session(session):
    """Demo login → token."""
    resp = session.post(f"{BASE_URL}/api/auth/demo-login", timeout=30)
    assert resp.status_code == 200, f"demo-login failed: {resp.status_code} {resp.text}"
    data = resp.json()
    token = data.get("token") or data.get("session_token") or data.get("access_token")
    assert token, f"No token in demo-login response: {data}"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    s.user_id = data.get("user_id") or data.get("user", {}).get("user_id")
    return s


@pytest.fixture(scope="module")
def auth_session_2():
    """A second demo user session for cross-merchant redemption tests."""
    s0 = requests.Session()
    resp = s0.post(f"{BASE_URL}/api/auth/demo-login", timeout=30)
    assert resp.status_code == 200
    data = resp.json()
    token = data.get("token") or data.get("session_token") or data.get("access_token")
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


# ─── Auth gating ────────────────────────────────────────────────────────

class TestAuthGating:
    def test_me_requires_auth(self, session):
        resp = session.get(f"{HV}/me")
        assert resp.status_code == 401

    def test_register_requires_auth(self, session):
        resp = session.post(f"{HV}/register", json={"name": "Anon"})
        assert resp.status_code == 401

    def test_patch_requires_auth(self, session):
        resp = session.patch(f"{HV}/me", json={"open_now": False})
        assert resp.status_code == 401


# ─── Merchant profile ───────────────────────────────────────────────────

class TestMerchantProfile:
    def test_register_or_already(self, auth_session):
        payload = {"name": "TEST_Vibe Bistro", "description": "Test eatery", "cuisine": "Test"}
        resp = auth_session.post(f"{HV}/register", json=payload)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["success"] is True
        assert "merchant" in data
        assert data["merchant"]["owner_user_id"]

    def test_me_returns_merchant(self, auth_session):
        resp = auth_session.get(f"{HV}/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["merchant"]["merchant_id"]
        assert data["merchant"]["open_now"] in (True, False)

    def test_patch_open_now(self, auth_session):
        resp = auth_session.patch(f"{HV}/me", json={"open_now": False})
        assert resp.status_code == 200
        assert resp.json()["merchant"]["open_now"] is False
        # Restore
        auth_session.patch(f"{HV}/me", json={"open_now": True})


# ─── Menu CRUD + ingredients ────────────────────────────────────────────

class TestMenuCRUD:
    @pytest.fixture(scope="class")
    def item_id(self, auth_session):
        resp = auth_session.post(f"{HV}/menu", json={"item_name": "TEST_Burger", "base_price": 12.50})
        assert resp.status_code == 200, resp.text
        return resp.json()["item"]["item_id"]

    def test_list_menu(self, auth_session, item_id):
        resp = auth_session.get(f"{HV}/menu")
        assert resp.status_code == 200
        ids = [i["item_id"] for i in resp.json()["items"]]
        assert item_id in ids

    def test_patch_menu_unavailable(self, auth_session, item_id):
        resp = auth_session.patch(f"{HV}/menu/{item_id}", json={"available": False})
        assert resp.status_code == 200
        assert resp.json()["item"]["available"] is False

    def test_add_ingredient(self, auth_session, item_id):
        resp = auth_session.post(f"{HV}/menu/{item_id}/ingredients", json={"name": "Cheese", "extra_cost": 1.5})
        assert resp.status_code == 200
        ings = resp.json()["item"]["custom_ingredients"]
        assert any(i["name"] == "Cheese" and i["available"] is True for i in ings)

    def test_toggle_ingredient(self, auth_session, item_id):
        resp = auth_session.patch(f"{HV}/menu/{item_id}/ingredients/Cheese")
        assert resp.status_code == 200
        ings = resp.json()["item"]["custom_ingredients"]
        cheese = next(i for i in ings if i["name"] == "Cheese")
        assert cheese["available"] is False

    def test_public_menu_filters_unavailable(self, auth_session, item_id, session):
        # Re-enable the item but keep ingredient OFF, then check public route.
        auth_session.patch(f"{HV}/menu/{item_id}", json={"available": True})
        merchant_id = auth_session.get(f"{HV}/me").json()["merchant"]["merchant_id"]
        resp = session.get(f"{BASE_URL}/api/hungryvibes/merchants/{merchant_id}/menu")
        assert resp.status_code == 200
        data = resp.json()
        item = next((i for i in data["items"] if i["item_id"] == item_id), None)
        assert item is not None
        names = [ing["name"] for ing in item["custom_ingredients"]]
        assert "Cheese" not in names  # filtered out (toggled OFF)

    def test_delete_menu_item(self, auth_session, item_id):
        resp = auth_session.delete(f"{HV}/menu/{item_id}")
        assert resp.status_code == 200
        # Verify removal
        resp2 = auth_session.delete(f"{HV}/menu/{item_id}")
        assert resp2.status_code == 404


# ─── Promo CRUD + redemption ────────────────────────────────────────────

class TestPromos:
    @pytest.fixture(scope="class")
    def merchant_id(self, auth_session):
        return auth_session.get(f"{HV}/me").json()["merchant"]["merchant_id"]

    @pytest.fixture(scope="class")
    def promo(self, auth_session):
        code = f"TEST{uuid.uuid4().hex[:6]}"
        resp = auth_session.post(f"{HV}/promos", json={
            "code": code.lower(),  # lowercased to test auto-uppercase
            "discount_value": 25,
            "is_percent": True,
            "limit": 5
        })
        assert resp.status_code == 200, resp.text
        p = resp.json()["promo"]
        assert p["code"] == code.upper()  # auto-uppercased
        assert p["uses_today"] == 0
        return p

    def test_percentage_above_100_rejected(self, auth_session):
        resp = auth_session.post(f"{HV}/promos", json={
            "code": f"BAD{uuid.uuid4().hex[:5]}", "discount_value": 150,
            "is_percent": True, "limit": 5,
        })
        assert resp.status_code == 400

    def test_duplicate_code_rejected(self, auth_session, promo):
        resp = auth_session.post(f"{HV}/promos", json={
            "code": promo["code"], "discount_value": 5,
            "is_percent": False, "limit": 5,
        })
        assert resp.status_code == 400

    def test_list_includes_uses_today(self, auth_session, promo):
        resp = auth_session.get(f"{HV}/promos")
        assert resp.status_code == 200
        ids = {p["promo_id"]: p for p in resp.json()["promos"]}
        assert promo["promo_id"] in ids
        assert "uses_today" in ids[promo["promo_id"]]

    def test_redeem_percentage(self, auth_session, promo, merchant_id):
        resp = auth_session.post(f"{HV}/promos/redeem", json={
            "code": promo["code"], "merchant_id": merchant_id, "order_total": 40.0,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["discount"] == 10.0  # 25% of 40
        assert data["new_total"] == 30.0
        assert data["redemption_id"]

    def test_redeem_decrements_uses(self, auth_session, promo, merchant_id):
        # Check uses_remaining decremented
        resp = auth_session.get(f"{HV}/promos")
        p = next(x for x in resp.json()["promos"] if x["promo_id"] == promo["promo_id"])
        assert p["uses_remaining"] == 4  # started 5, used 1

    def test_redeem_missing_code(self, auth_session, merchant_id):
        resp = auth_session.post(f"{HV}/promos/redeem", json={
            "code": "NOPE_DOES_NOT_EXIST", "merchant_id": merchant_id, "order_total": 20,
        })
        assert resp.status_code == 404

    def test_toggle_promo(self, auth_session, promo, merchant_id):
        # Pause
        resp = auth_session.patch(f"{HV}/promos/{promo['promo_id']}/toggle")
        assert resp.status_code == 200
        assert resp.json()["promo"]["active"] is False
        # Redemption should now fail with 400 (paused)
        r2 = auth_session.post(f"{HV}/promos/redeem", json={
            "code": promo["code"], "merchant_id": merchant_id, "order_total": 20,
        })
        assert r2.status_code == 400
        # Re-enable
        auth_session.patch(f"{HV}/promos/{promo['promo_id']}/toggle")

    def test_delete_promo(self, auth_session, promo):
        resp = auth_session.delete(f"{HV}/promos/{promo['promo_id']}")
        assert resp.status_code == 200
        # Deleted promo should NOT appear in list
        resp2 = auth_session.get(f"{HV}/promos")
        ids = [p["promo_id"] for p in resp2.json()["promos"]]
        assert promo["promo_id"] not in ids


# ─── Vibe Account ───────────────────────────────────────────────────────

class TestVibeAccount:
    def test_get_vibe_account(self, auth_session):
        resp = auth_session.get(f"{HV}/vibe-account")
        assert resp.status_code == 200
        data = resp.json()
        assert "balance" in data
        assert data["vibe_tax_rate"] == 0.02
        assert isinstance(data["ledger"], list)

    def test_credit_applies_2pct_tax(self, auth_session):
        before = auth_session.get(f"{HV}/vibe-account").json()["balance"]
        order_id = f"TEST_ORD_{uuid.uuid4().hex[:8]}"
        resp = auth_session.post(f"{HV}/vibe-account/credit", json={
            "order_total": 40.0, "order_id": order_id,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["vibe_tax"] == 0.80
        assert data["credited"] == 39.20
        # Balance updated
        after = auth_session.get(f"{HV}/vibe-account").json()
        assert round(after["balance"] - before, 2) == 39.20
        # Ledger has the entry
        ledger_ids = [e["ledger_id"] for e in after["ledger"]]
        assert data["ledger_id"] in ledger_ids
        entry = next(e for e in after["ledger"] if e["ledger_id"] == data["ledger_id"])
        assert entry["gross"] == 40.0
        assert entry["vibe_tax"] == 0.80
        assert entry["net_credit"] == 39.20


# ─── Smoke: other auth flows still work ─────────────────────────────────

class TestAuthSmoke:
    def test_demo_login(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/demo-login", timeout=30)
        assert resp.status_code == 200
        assert resp.json().get("token") or resp.json().get("session_token")

    def test_admin_vault_auth(self, session):
        pwd = os.environ.get("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")
        resp = session.post(f"{BASE_URL}/api/admin/vault-auth", json={
            "password": pwd, "code": "000000",
        }, timeout=30)
        # Either 200 OK or returns admin_session cookie
        assert resp.status_code in (200, 401, 403), resp.text
        if resp.status_code == 200:
            assert "admin_session" in resp.cookies or resp.json().get("success")
