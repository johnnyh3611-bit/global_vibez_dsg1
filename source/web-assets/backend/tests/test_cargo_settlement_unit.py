"""Unit-level test for cargo settlement math via the service layer.
Bypasses admin assign-driver guard by writing manifest_id directly
through the service (test of math + 80/20 + no-burn invariant)."""
from __future__ import annotations

import asyncio
import os
import sys
import uuid

import pytest

sys.path.insert(0, "/home/johnnie/master-project")

from config import db  # noqa: E402
from services.viberidez_cargo import (  # noqa: E402
    upsert_inventory_item, place_retail_order,
    assign_driver, driver_scan_pickup, driver_start_handover,
    customer_verify_handover, product_return,
    STORE_PARTNER_PCT,
)


@pytest.mark.asyncio
async def test_full_cargo_flow_settlement_80_20_no_burn():
    store_id = f"TEST_unitstore_{uuid.uuid4().hex[:6]}"
    sku = f"TEST_unitsku_{uuid.uuid4().hex[:6]}"
    owner_id = f"TEST_owner_{uuid.uuid4().hex[:8]}"
    customer_id = f"TEST_cust_{uuid.uuid4().hex[:8]}"
    driver_id = f"TEST_drv_{uuid.uuid4().hex[:8]}"

    # Seed customer with enough coins (unique email to avoid dup-key on null)
    await db.users.update_one(
        {"user_id": customer_id},
        {"$set": {"user_id": customer_id,
                  "email": f"{customer_id}@test.local",
                  "coin_balance": 10_000}},
        upsert=True,
    )

    # 1) Upsert
    res = await upsert_inventory_item(
        db, store_id=store_id, owner_id=owner_id, sku=sku,
        name="Unit Widget", price_coins=1000, quantity=5,
    )
    assert res["ok"] is True

    # 2) Place order
    placed = await place_retail_order(
        db, user_id=customer_id, store_id=store_id, sku=sku, quantity=1,
    )
    assert placed["ok"] is True, placed
    manifest_id = placed["manifest_id"]
    pickup_pt = placed["pickup_barcode_plaintext"]
    assert placed["cargo_value_coins"] == 1000

    # 3) Assign driver
    a = await assign_driver(db, manifest_id=manifest_id, driver_id=driver_id)
    assert a["ok"] is True

    # 4) Pickup with correct plaintext
    p = await driver_scan_pickup(
        db, manifest_id=manifest_id, driver_id=driver_id,
        scanned_plaintext=pickup_pt,
    )
    assert p["ok"] is True
    assert p["state"] == "picked_up"

    # 5) Start handover (mints customer barcode)
    h = await driver_start_handover(
        db, manifest_id=manifest_id, driver_id=driver_id,
    )
    assert h["ok"] is True
    customer_pt = h["customer_barcode_plaintext"]

    # 5b) Wrong plaintext fails
    bad = await customer_verify_handover(
        db, manifest_id=manifest_id, user_id=customer_id,
        scanned_plaintext="not-the-real-code-1234567",
    )
    assert bad["ok"] is False
    assert bad["reason"] == "barcode_mismatch"

    # 6) Customer verify handover (correct) → settle
    v = await customer_verify_handover(
        db, manifest_id=manifest_id, user_id=customer_id,
        scanned_plaintext=customer_pt,
    )
    assert v["ok"] is True
    assert v["state"] == "delivered"
    s = v["settlement"]
    assert s["cargo_value_coins"] == 1000
    assert s["store_share_coins"] == int(1000 * STORE_PARTNER_PCT) == 800
    assert s["platform_share_coins"] == 200
    assert s["burn_coins"] == 0   # no burn invariant

    # 7) Return → 1.5× base fare to driver
    ret = await product_return(
        db, order_id=placed["order_id"], user_id=customer_id,
        base_fare_coins=200,
    )
    assert ret["ok"] is True
    assert ret["driver_fee_coins"] == 300  # 200 × 1.5
    assert ret["multiplier"] == 1.5

    # Cleanup
    await db.store_inventory.delete_many({"store_id": store_id})
    await db.retail_orders.delete_many({"manifest_id": manifest_id})
    await db.cargo_manifests.delete_many({"manifest_id": manifest_id})
    await db.retail_settlements.delete_many({"manifest_id": manifest_id})
    await db.retail_cancellations.delete_many({"manifest_id": manifest_id})
    await db.users.delete_one({"user_id": customer_id})
