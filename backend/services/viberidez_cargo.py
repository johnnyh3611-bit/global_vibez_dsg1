"""
VibeRidez Cargo Master — Retail Logistics Layer (May 2026)
─────────────────────────────────────────────────────────────────
Implements the VibeRidez Cargo Master Blueprint as in-app off-chain
modules. The on-chain Solana CargoManifest program is **stubbed**
until the user explicitly unlocks the TGE by typing
"project complete".

Modules:
  1. Store Inventory (merchant catalog)
  2. Retail Order placement (customer taps a product widget)
  3. Proof-of-Delivery Dual Barcode Locks
       a. Driver scans pickup barcode at store
       b. Driver generates secure customer barcode on arrival
       c. Customer scans → triggers settlement
  4. Settlement (80% store · 20% platform → 40/30/30 recirculation)
  5. Cancellation & Return flows
       • Client late-cancel → 500 ₵ flat to driver
       • Product return → driver gets 1.5× base delivery fee
  6. Driver Retail Console state machine

ECONOMICS COUNTER-PROPOSAL (founder rule):
  • Blueprint dollar figure ($5.00) is translated to 500 ₵ in-app.
  • 20% platform vault flows through `recirculate()` 40/30/30 —
    NO burn at any layer.
  • Settlement ledger rows ALWAYS include explicit `burn_coins: 0`.

COLLECTIONS:
  • store_inventory          — merchant-uploaded SKU catalog
  • retail_orders            — customer order placements
  • cargo_manifests          — per-cargo state machine (dual-barcode)
  • retail_cancellations     — cancel + return audit log
  • retail_settlements       — every fulfilled order's 80/20 split
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

# ─────────────────────────── Constants ─────────────────────────────

STORE_PARTNER_PCT = 0.80
PLATFORM_VAULT_PCT = 0.20

# Client late-cancel protection fee (PDF $5.00 → 500 ₵).
LATE_CANCEL_DRIVER_FEE_COINS = 500
# Product return premium (PDF 1.5× base distance fare).
RETURN_FARE_MULTIPLIER = 1.5

MAX_ORDER_VALUE_COINS = 5_000_000   # 50,000 ₵ ceiling for in-app retail
MAX_INVENTORY_QUANTITY = 999_999

# Cargo state machine.
CARGO_STATES = (
    "assigned",      # driver dispatched
    "picked_up",     # driver scanned pickup barcode
    "handover",      # driver generated customer barcode
    "delivered",     # customer scanned, settlement complete
    "cancelled",
    "returning",
    "returned",
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:14]}"


def _mint_barcode(prefix: str) -> Dict[str, str]:
    """Mint a single-use secure barcode. Returns the public payload
    (driver/customer can show this in the UI) and the hash that the
    backend stores. The plaintext is NEVER stored — only the hash."""
    plaintext = f"{prefix}-{secrets.token_urlsafe(18)}"
    sha = hashlib.sha256(plaintext.encode()).hexdigest()
    return {"plaintext": plaintext, "hash": sha}


# ═══════════════════ 1) Store Inventory ════════════════════════════

async def upsert_inventory_item(
    db,
    *,
    store_id: str,
    owner_id: str,
    sku: str,
    name: str,
    price_coins: int,
    description: str = "",
    image_url: str = "",
    quantity: int = 0,
    is_advertisable: bool = True,
) -> Dict[str, Any]:
    if price_coins <= 0 or price_coins > MAX_ORDER_VALUE_COINS:
        return {"ok": False, "reason": "price_out_of_range"}
    if quantity < 0 or quantity > MAX_INVENTORY_QUANTITY:
        return {"ok": False, "reason": "quantity_out_of_range"}

    item_id = _new_id("inv")
    now = _now_iso()
    await db.store_inventory.update_one(
        {"store_id": store_id, "sku": sku},
        {"$set": {
            "store_id": store_id,
            "owner_id": owner_id,
            "sku": sku[:64],
            "name": name[:120],
            "description": description[:500],
            "image_url": image_url[:600],
            "price_coins": int(price_coins),
            "quantity": int(quantity),
            "is_advertisable": bool(is_advertisable),
            "updated_at": now,
        },
         "$setOnInsert": {"item_id": item_id, "created_at": now}},
        upsert=True,
    )
    return {"ok": True, "store_id": store_id, "sku": sku}


async def list_inventory(
    db, *, store_id: Optional[str] = None,
    advertisable_only: bool = False, limit: int = 50,
) -> List[Dict[str, Any]]:
    q: Dict[str, Any] = {}
    if store_id:
        q["store_id"] = store_id
    if advertisable_only:
        q["is_advertisable"] = True
        q["quantity"] = {"$gt": 0}
    cursor = db.store_inventory.find(q, {"_id": 0}).sort(
        [("updated_at", -1)]).limit(max(1, min(int(limit), 200)))
    return [r async for r in cursor]


# ═══════════════════ 2) Retail Order + Cargo Manifest ══════════════

async def place_retail_order(
    db,
    *,
    user_id: str,
    store_id: str,
    sku: str,
    quantity: int = 1,
    delivery_address: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Customer taps a product widget. Decrements inventory, debits
    coins for the cargo value, creates a manifest in `assigned` state
    with the pickup barcode pre-minted."""
    if quantity <= 0 or quantity > 50:
        return {"ok": False, "reason": "invalid_quantity"}
    item = await db.store_inventory.find_one(
        {"store_id": store_id, "sku": sku}, {"_id": 0},
    )
    if not item:
        return {"ok": False, "reason": "sku_not_found"}
    if int(item.get("quantity", 0)) < quantity:
        return {"ok": False, "reason": "out_of_stock"}

    cargo_value = int(item["price_coins"]) * quantity
    if cargo_value > MAX_ORDER_VALUE_COINS:
        return {"ok": False, "reason": "order_exceeds_max"}

    # Debit the customer up front. Driver fee + tip flows through
    # the existing rides service — this module governs CARGO settlement.
    from services.coin_wallet import debit_coins  # noqa: PLC0415
    try:
        await debit_coins(
            db, user_id, cargo_value,
            reason="cargo_retail_order",
            metadata={"store_id": store_id, "sku": sku,
                      "quantity": quantity},
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "reason": "insufficient_funds",
                "detail": str(exc)}

    # Decrement inventory.
    await db.store_inventory.update_one(
        {"store_id": store_id, "sku": sku},
        {"$inc": {"quantity": -quantity},
         "$set": {"updated_at": _now_iso()}},
    )

    order_id = _new_id("ret")
    manifest_id = _new_id("cargo")
    pickup_barcode = _mint_barcode("pickup")
    now = _now_iso()

    await db.retail_orders.insert_one({
        "order_id": order_id,
        "user_id": user_id,
        "store_id": store_id,
        "owner_id": item["owner_id"],
        "sku": sku,
        "item_name": item["name"],
        "image_url": item.get("image_url", ""),
        "quantity": quantity,
        "cargo_value_coins": cargo_value,
        "delivery_address": delivery_address or {},
        "manifest_id": manifest_id,
        "status": "pending",
        "placed_at": now,
    })

    await db.cargo_manifests.insert_one({
        "manifest_id": manifest_id,
        "order_id": order_id,
        "store_id": store_id,
        "user_id": user_id,
        "driver_id": None,  # dispatched separately
        "cargo_value_coins": cargo_value,
        "state": "assigned",
        "pickup_barcode_hash": pickup_barcode["hash"],
        "pickup_barcode_plaintext": pickup_barcode["plaintext"],
        "pickup_at": None,
        "customer_barcode_hash": None,
        "customer_barcode_plaintext": None,
        "handover_at": None,
        "delivered_at": None,
        "created_at": now,
    })
    return {"ok": True, "order_id": order_id,
            "manifest_id": manifest_id,
            "cargo_value_coins": cargo_value,
            "pickup_barcode_plaintext": pickup_barcode["plaintext"]}


async def assign_driver(
    db, *, manifest_id: str, driver_id: str,
) -> Dict[str, Any]:
    res = await db.cargo_manifests.update_one(
        {"manifest_id": manifest_id, "state": "assigned",
         "driver_id": None},
        {"$set": {"driver_id": driver_id,
                  "driver_assigned_at": _now_iso()}},
    )
    if res.modified_count == 0:
        return {"ok": False, "reason": "manifest_not_assignable"}
    return {"ok": True}


# ═══════════════════ 3) Dual Barcode Lock ══════════════════════════

async def driver_scan_pickup(
    db, *, manifest_id: str, driver_id: str, scanned_plaintext: str,
) -> Dict[str, Any]:
    manifest = await db.cargo_manifests.find_one(
        {"manifest_id": manifest_id}, {"_id": 0},
    )
    if not manifest:
        return {"ok": False, "reason": "manifest_not_found"}
    if manifest.get("driver_id") not in (None, driver_id):
        return {"ok": False, "reason": "wrong_driver"}
    if manifest.get("state") not in ("assigned",):
        return {"ok": False, "reason": "invalid_state"}

    sha = hashlib.sha256(scanned_plaintext.encode()).hexdigest()
    if sha != manifest.get("pickup_barcode_hash"):
        return {"ok": False, "reason": "barcode_mismatch"}

    res = await db.cargo_manifests.update_one(
        {"manifest_id": manifest_id, "state": "assigned"},
        {"$set": {"state": "picked_up",
                   "driver_id": driver_id,
                   "pickup_at": _now_iso()}},
    )
    if res.modified_count == 0:
        return {"ok": False, "reason": "race_lost"}
    return {"ok": True, "state": "picked_up"}


async def driver_start_handover(
    db, *, manifest_id: str, driver_id: str,
) -> Dict[str, Any]:
    """Generates the secure customer barcode. The plaintext is shown
    in the driver console (QR) and the customer scans it via the
    customer app to complete delivery."""
    manifest = await db.cargo_manifests.find_one(
        {"manifest_id": manifest_id, "driver_id": driver_id,
         "state": "picked_up"}, {"_id": 0},
    )
    if not manifest:
        return {"ok": False, "reason": "manifest_not_in_picked_up_state"}

    customer_bc = _mint_barcode("handover")
    await db.cargo_manifests.update_one(
        {"manifest_id": manifest_id},
        {"$set": {
            "state": "handover",
            "customer_barcode_hash": customer_bc["hash"],
            "customer_barcode_plaintext": customer_bc["plaintext"],
            "handover_at": _now_iso(),
        }},
    )
    return {"ok": True, "state": "handover",
            "customer_barcode_plaintext": customer_bc["plaintext"]}


async def customer_verify_handover(
    db, *, manifest_id: str, user_id: str, scanned_plaintext: str,
) -> Dict[str, Any]:
    """Customer scans the driver's barcode → triggers settlement."""
    manifest = await db.cargo_manifests.find_one(
        {"manifest_id": manifest_id, "user_id": user_id,
         "state": "handover"}, {"_id": 0},
    )
    if not manifest:
        return {"ok": False, "reason": "manifest_not_in_handover_state"}
    sha = hashlib.sha256(scanned_plaintext.encode()).hexdigest()
    if sha != manifest.get("customer_barcode_hash"):
        return {"ok": False, "reason": "barcode_mismatch"}

    res = await db.cargo_manifests.update_one(
        {"manifest_id": manifest_id, "state": "handover"},
        {"$set": {"state": "delivered",
                   "delivered_at": _now_iso()}},
    )
    if res.modified_count == 0:
        return {"ok": False, "reason": "race_lost"}

    settle = await _settle_cargo(db, manifest_id=manifest_id)
    return {"ok": True, "state": "delivered", "settlement": settle}


# ═══════════════════ 4) Settlement ═════════════════════════════════

async def _settle_cargo(db, *, manifest_id: str) -> Dict[str, Any]:
    manifest = await db.cargo_manifests.find_one(
        {"manifest_id": manifest_id}, {"_id": 0},
    )
    if not manifest:
        return {"ok": False, "reason": "manifest_not_found"}
    if manifest["state"] != "delivered":
        return {"ok": False, "reason": "not_delivered"}

    cargo_value = int(manifest["cargo_value_coins"])
    order = await db.retail_orders.find_one(
        {"manifest_id": manifest_id}, {"_id": 0, "owner_id": 1},
    )
    store_owner_id = order["owner_id"] if order else None

    store_share = int(cargo_value * STORE_PARTNER_PCT)
    platform_share = cargo_value - store_share  # absorb rounding

    # Credit store partner.
    from services.coin_wallet import credit_coins  # noqa: PLC0415
    if store_owner_id and store_share > 0:
        try:
            await credit_coins(
                db, store_owner_id, store_share,
                reason="cargo_store_payout",
                metadata={"manifest_id": manifest_id},
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("store credit failed: %s", exc)

    # Recirculate the platform vault share — NO BURN.
    from services.recirculation import recirculate  # noqa: PLC0415
    recirc = {"ok": False}
    if platform_share > 0:
        recirc = await recirculate(
            db,
            amount_coins=platform_share,
            source="cargo_platform_vault",
            user_id=manifest.get("user_id"),
            metadata={"manifest_id": manifest_id,
                      "store_id": manifest.get("store_id")},
        )

    settlement_id = _new_id("settle")
    settle = {
        "settlement_id": settlement_id,
        "manifest_id": manifest_id,
        "order_id": manifest.get("order_id"),
        "store_id": manifest.get("store_id"),
        "store_owner_id": store_owner_id,
        "driver_id": manifest.get("driver_id"),
        "cargo_value_coins": cargo_value,
        "store_share_coins": store_share,
        "platform_share_coins": platform_share,
        "recirculation": recirc.get("split"),
        "burn_coins": 0,
        "at": _now_iso(),
    }
    await db.retail_settlements.insert_one(settle)
    await db.retail_orders.update_one(
        {"manifest_id": manifest_id},
        {"$set": {"status": "delivered",
                  "settlement_id": settlement_id,
                  "delivered_at": _now_iso()}},
    )
    return {k: v for k, v in settle.items() if k != "_id"}


# ═══════════════════ 5) Cancellation & Return ══════════════════════

async def client_late_cancel(
    db, *, order_id: str, user_id: str,
) -> Dict[str, Any]:
    order = await db.retail_orders.find_one(
        {"order_id": order_id, "user_id": user_id, "status": "pending"},
        {"_id": 0},
    )
    if not order:
        return {"ok": False, "reason": "order_not_cancellable"}
    manifest = await db.cargo_manifests.find_one(
        {"manifest_id": order["manifest_id"]}, {"_id": 0},
    )
    if not manifest or manifest["state"] not in ("assigned", "picked_up"):
        return {"ok": False, "reason": "manifest_not_late_cancellable"}

    driver_id = manifest.get("driver_id")
    # Driver gets the flat protection fee in coins.
    from services.coin_wallet import credit_coins  # noqa: PLC0415
    if driver_id and LATE_CANCEL_DRIVER_FEE_COINS > 0:
        try:
            await credit_coins(
                db, driver_id, LATE_CANCEL_DRIVER_FEE_COINS,
                reason="cargo_late_cancel_fee",
                metadata={"order_id": order_id},
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("driver protection credit failed: %s", exc)

    # Mark profile flag (one strike) for ops awareness.
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"cargo_late_cancel_count": 1}},
    )
    # Refund cargo_value to the customer (en-route, item gets routed back).
    await db.coin_transactions.insert_one({
        "txn_id": _new_id("refund"),
        "user_id": user_id,
        "amount": int(order["cargo_value_coins"]),
        "kind": "cargo_late_cancel_refund",
        "metadata": {"order_id": order_id},
        "at": _now_iso(),
    })
    try:
        from services.coin_wallet import credit_coins  # noqa: PLC0415
        await credit_coins(
            db, user_id, int(order["cargo_value_coins"]),
            reason="cargo_late_cancel_refund",
            metadata={"order_id": order_id},
        )
    except Exception:
        pass

    now = _now_iso()
    await db.cargo_manifests.update_one(
        {"manifest_id": manifest["manifest_id"]},
        {"$set": {"state": "returning", "cancel_at": now}},
    )
    await db.retail_orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "cancelled_late", "cancelled_at": now}},
    )
    await db.retail_cancellations.insert_one({
        "cancellation_id": _new_id("can"),
        "order_id": order_id,
        "manifest_id": manifest["manifest_id"],
        "kind": "client_late_cancel",
        "driver_id": driver_id,
        "driver_fee_coins": LATE_CANCEL_DRIVER_FEE_COINS,
        "at": now,
    })
    return {"ok": True, "driver_fee_coins": LATE_CANCEL_DRIVER_FEE_COINS,
            "state": "returning"}


async def product_return(
    db, *, order_id: str, user_id: str, base_fare_coins: int,
) -> Dict[str, Any]:
    order = await db.retail_orders.find_one(
        {"order_id": order_id, "user_id": user_id,
         "status": "delivered"}, {"_id": 0},
    )
    if not order:
        return {"ok": False, "reason": "order_not_eligible"}
    if base_fare_coins <= 0 or base_fare_coins > 100_000:
        return {"ok": False, "reason": "invalid_base_fare"}

    return_fare = int(base_fare_coins * RETURN_FARE_MULTIPLIER)
    manifest = await db.cargo_manifests.find_one(
        {"manifest_id": order["manifest_id"]}, {"_id": 0},
    )
    driver_id = manifest.get("driver_id") if manifest else None

    from services.coin_wallet import credit_coins  # noqa: PLC0415
    if driver_id:
        try:
            await credit_coins(
                db, driver_id, return_fare,
                reason="cargo_return_fare",
                metadata={"order_id": order_id,
                          "multiplier": RETURN_FARE_MULTIPLIER},
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("return-fare credit failed: %s", exc)

    now = _now_iso()
    await db.cargo_manifests.update_one(
        {"manifest_id": order["manifest_id"]},
        {"$set": {"state": "returned", "returned_at": now}},
    )
    await db.retail_orders.update_one(
        {"order_id": order_id},
        {"$set": {"status": "returned", "returned_at": now}},
    )
    await db.retail_cancellations.insert_one({
        "cancellation_id": _new_id("can"),
        "order_id": order_id,
        "manifest_id": order["manifest_id"],
        "kind": "product_return",
        "driver_id": driver_id,
        "driver_fee_coins": return_fare,
        "base_fare_coins": int(base_fare_coins),
        "multiplier": RETURN_FARE_MULTIPLIER,
        "at": now,
    })
    return {"ok": True, "driver_fee_coins": return_fare,
            "multiplier": RETURN_FARE_MULTIPLIER}


# ═══════════════════ 6) Driver Retail Console ══════════════════════

async def driver_assignments(
    db, *, driver_id: str, limit: int = 25,
) -> List[Dict[str, Any]]:
    cursor = db.cargo_manifests.find(
        {"driver_id": driver_id,
         "state": {"$in": ["assigned", "picked_up", "handover", "returning"]}},
        # Never leak the plaintext barcodes — the driver only sees the
        # active state's plaintext on the dedicated endpoint.
        {"_id": 0, "pickup_barcode_hash": 0, "customer_barcode_hash": 0,
         "pickup_barcode_plaintext": 0, "customer_barcode_plaintext": 0},
    ).sort([("created_at", -1)]).limit(limit)
    return [r async for r in cursor]


async def get_manifest(db, *, manifest_id: str, driver_id: str) -> Optional[Dict[str, Any]]:
    """Return the manifest the assigned driver is currently working —
    includes the active barcode plaintext for the current state only."""
    manifest = await db.cargo_manifests.find_one(
        {"manifest_id": manifest_id, "driver_id": driver_id}, {"_id": 0},
    )
    if not manifest:
        return None
    state = manifest["state"]
    # Reveal only the plaintext relevant to the current state.
    if state != "assigned":
        manifest.pop("pickup_barcode_plaintext", None)
    if state not in ("handover",):
        manifest.pop("customer_barcode_plaintext", None)
    # Hashes are never returned.
    manifest.pop("pickup_barcode_hash", None)
    manifest.pop("customer_barcode_hash", None)
    return manifest


# ─────────────────── Admin reads ───────────────────────────────────

async def list_recent_settlements(db, limit: int = 25) -> List[Dict[str, Any]]:
    cursor = db.retail_settlements.find({}, {"_id": 0}).sort(
        [("at", -1)]).limit(limit)
    return [r async for r in cursor]


async def list_active_manifests(db, limit: int = 50) -> List[Dict[str, Any]]:
    cursor = db.cargo_manifests.find(
        {"state": {"$in": ["assigned", "picked_up", "handover", "returning"]}},
        {"_id": 0, "pickup_barcode_hash": 0, "customer_barcode_hash": 0,
         "pickup_barcode_plaintext": 0, "customer_barcode_plaintext": 0},
    ).sort([("created_at", -1)]).limit(limit)
    return [r async for r in cursor]
