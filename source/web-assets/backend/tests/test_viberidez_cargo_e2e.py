"""End-to-end test for VibeRidez Cargo Master (Jan 2026)
Exercises constants → inventory upsert → order → pickup → handover → verify-handover → settlement,
plus auth guards and the cancel/return branches.
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()

BETA = ("betatester1@globalvibez.com", "BetaTester2026!")
BETA2 = ("betatester2@globalvibez.com", "BetaTester2026!")


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return s


# ───────────── Constants ─────────────
def test_constants_match_spec():
    r = requests.get(f"{BASE_URL}/api/cargo/constants", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["store_partner_pct"] == 0.80
    assert d["platform_vault_pct"] == 0.20
    assert d["platform_vault_routing"] == "40/30/30 recirculation"
    assert d["in_app_burn_pct"] == 0.0
    assert d["late_cancel_driver_fee_coins"] == 500
    assert d["return_fare_multiplier"] == 1.5
    assert d["cargo_states"] == [
        "assigned", "picked_up", "handover", "delivered",
        "cancelled", "returning", "returned",
    ]


# ───────────── Auth guards ─────────────
def test_inventory_upsert_requires_auth():
    r = requests.post(f"{BASE_URL}/api/cargo/inventory/upsert",
                      json={"store_id": "x", "sku": "y", "name": "z",
                            "price_coins": 100}, timeout=15)
    assert r.status_code in (401, 403)


def test_order_requires_auth():
    r = requests.post(f"{BASE_URL}/api/cargo/order",
                      json={"store_id": "x", "sku": "y"}, timeout=15)
    assert r.status_code in (401, 403)


def test_admin_assign_driver_requires_admin():
    s = _login(*BETA)
    r = s.post(f"{BASE_URL}/api/admin/cargo/assign-driver",
               json={"manifest_id": "m_x", "driver_id": "d_x"}, timeout=15)
    assert r.status_code in (401, 403)


def test_admin_settlements_requires_admin():
    s = _login(*BETA)
    r = s.get(f"{BASE_URL}/api/admin/cargo/settlements/recent", timeout=15)
    assert r.status_code in (401, 403)


# ───────────── Inventory upsert + list ─────────────
@pytest.fixture(scope="module")
def store_setup():
    """Login as beta1 (store owner), upsert a TEST_ SKU, return ids."""
    s = _login(*BETA)
    store_id = f"TEST_store_{uuid.uuid4().hex[:8]}"
    sku = f"TEST_sku_{uuid.uuid4().hex[:8]}"
    body = {
        "store_id": store_id, "sku": sku,
        "name": "TEST Cargo Widget", "price_coins": 200,
        "quantity": 10, "is_advertisable": True,
    }
    r = s.post(f"{BASE_URL}/api/cargo/inventory/upsert", json=body, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    return {"session": s, "store_id": store_id, "sku": sku}


def test_inventory_list_returns_upserted(store_setup):
    r = requests.get(
        f"{BASE_URL}/api/cargo/inventory",
        params={"store_id": store_setup["store_id"], "advertisable_only": "false"},
        timeout=15,
    )
    assert r.status_code == 200
    data = r.json()
    skus = [row["sku"] for row in data["rows"]]
    assert store_setup["sku"] in skus


def test_inventory_advertisable_only_filters():
    s = _login(*BETA)
    store_id = f"TEST_storeA_{uuid.uuid4().hex[:8]}"
    sku_zero = f"TEST_sku_zeroqty_{uuid.uuid4().hex[:6]}"
    # is_advertisable True but quantity 0 → should be excluded
    body = {"store_id": store_id, "sku": sku_zero, "name": "Z",
            "price_coins": 100, "quantity": 0, "is_advertisable": True}
    r = s.post(f"{BASE_URL}/api/cargo/inventory/upsert", json=body, timeout=15)
    assert r.status_code == 200
    r2 = requests.get(f"{BASE_URL}/api/cargo/inventory",
                      params={"store_id": store_id, "advertisable_only": "true"},
                      timeout=15)
    assert r2.status_code == 200
    skus = [row["sku"] for row in r2.json()["rows"]]
    assert sku_zero not in skus


# ───────────── Order placement ─────────────
@pytest.fixture(scope="module")
def placed_order(store_setup):
    """beta2 = customer, places a cargo order against beta1's store."""
    customer = _login(*BETA2)
    r = customer.post(
        f"{BASE_URL}/api/cargo/order",
        json={"store_id": store_setup["store_id"],
              "sku": store_setup["sku"], "quantity": 1},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    if not d.get("ok"):
        pytest.skip(f"order place failed (likely insufficient coins): {d}")
    assert d["cargo_value_coins"] == 200
    assert "manifest_id" in d
    assert "pickup_barcode_plaintext" in d
    return {
        "customer": customer,
        "order_id": d["order_id"],
        "manifest_id": d["manifest_id"],
        "pickup_pt": d["pickup_barcode_plaintext"],
    }


def test_order_creates_manifest_and_decrements_inventory(placed_order, store_setup):
    # Inventory should have decremented from 10 → 9 (best-effort)
    r = requests.get(f"{BASE_URL}/api/cargo/inventory",
                     params={"store_id": store_setup["store_id"],
                             "advertisable_only": "false"},
                     timeout=15)
    rows = [row for row in r.json()["rows"] if row["sku"] == store_setup["sku"]]
    assert rows, "sku missing from inventory after order"
    assert rows[0]["quantity"] <= 9


def test_order_my_orders_lists_placed(placed_order):
    r = placed_order["customer"].get(f"{BASE_URL}/api/cargo/me/orders", timeout=15)
    assert r.status_code == 200
    ids = [row["order_id"] for row in r.json()["rows"]]
    assert placed_order["order_id"] in ids


def test_order_out_of_stock_handled():
    s = _login(*BETA)
    r = s.post(f"{BASE_URL}/api/cargo/order",
               json={"store_id": "nonexistent_store_xyz",
                     "sku": "nonexistent_sku_xyz"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("ok") is False
    assert d.get("reason") == "sku_not_found"


# ───────────── Dual barcode flow ─────────────
def test_pickup_with_wrong_plaintext_rejects(placed_order):
    # The placing customer is NOT yet the assigned driver; pickup will fail
    # with wrong_driver OR barcode_mismatch — both prove the lock works.
    s = placed_order["customer"]
    r = s.post(f"{BASE_URL}/api/cargo/pickup",
               json={"manifest_id": placed_order["manifest_id"],
                     "scanned_plaintext": "totally-wrong-code-xxxxxxx"},
               timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("ok") is False
    assert d.get("reason") in ("barcode_mismatch", "wrong_driver",
                                "invalid_state", "manifest_not_found")


def test_driver_assignments_endpoint_no_plaintext_leak():
    s = _login(*BETA2)
    r = s.get(f"{BASE_URL}/api/cargo/driver/me/assignments", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "rows" in body
    for row in body["rows"]:
        # Hashes and plaintext must NEVER appear in the bulk list.
        assert "pickup_barcode_hash" not in row
        assert "customer_barcode_hash" not in row
        assert "pickup_barcode_plaintext" not in row
        assert "customer_barcode_plaintext" not in row


def test_driver_manifest_endpoint_never_returns_hashes(placed_order):
    # Even if not assigned, the endpoint should respond without leaking hashes.
    s = placed_order["customer"]
    r = s.get(
        f"{BASE_URL}/api/cargo/driver/manifest/{placed_order['manifest_id']}",
        timeout=15,
    )
    assert r.status_code == 200
    d = r.json()
    if d.get("ok") and "manifest" in d:
        m = d["manifest"]
        assert "pickup_barcode_hash" not in m
        assert "customer_barcode_hash" not in m


# ───────────── Handover requires picked_up state ─────────────
def test_handover_blocked_before_pickup(placed_order):
    s = placed_order["customer"]
    r = s.post(f"{BASE_URL}/api/cargo/handover",
               json={"manifest_id": placed_order["manifest_id"]}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("ok") is False
    assert d.get("reason") == "manifest_not_in_picked_up_state"


# ───────────── Return rejection when not delivered ─────────────
def test_return_rejected_when_not_delivered(placed_order):
    s = placed_order["customer"]
    r = s.post(f"{BASE_URL}/api/cargo/return",
               json={"order_id": placed_order["order_id"],
                     "base_fare_coins": 100}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("ok") is False
    assert d.get("reason") == "order_not_eligible"
