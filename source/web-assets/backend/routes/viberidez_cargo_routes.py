"""VibeRidez Cargo Master — routes.

Mounts under `/api/cargo/*` (public + authed) and
`/api/admin/cargo/*` (admin). On-chain Solana CargoManifest sync is
TGE-locked and not part of this module.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from config import db
from services.viberidez_cargo import (
    upsert_inventory_item, list_inventory,
    place_retail_order, assign_driver,
    driver_scan_pickup, driver_start_handover,
    customer_verify_handover,
    client_late_cancel, product_return,
    driver_assignments, get_manifest,
    list_recent_settlements, list_active_manifests,
    STORE_PARTNER_PCT, PLATFORM_VAULT_PCT,
    LATE_CANCEL_DRIVER_FEE_COINS, RETURN_FARE_MULTIPLIER,
    CARGO_STATES, MAX_ORDER_VALUE_COINS,
)
from utils.admin_guard import require_admin
from utils.auth_dependencies import get_current_user_from_session

router = APIRouter(prefix="/cargo", tags=["viberidez-cargo"])
admin_router = APIRouter(prefix="/admin/cargo",
                          tags=["admin-viberidez-cargo"])


@router.get("/constants")
async def constants() -> Dict[str, Any]:
    return {
        "store_partner_pct": STORE_PARTNER_PCT,
        "platform_vault_pct": PLATFORM_VAULT_PCT,
        "platform_vault_routing": "40/30/30 recirculation",
        "in_app_burn_pct": 0.0,
        "late_cancel_driver_fee_coins": LATE_CANCEL_DRIVER_FEE_COINS,
        "return_fare_multiplier": RETURN_FARE_MULTIPLIER,
        "cargo_states": list(CARGO_STATES),
        "max_order_value_coins": MAX_ORDER_VALUE_COINS,
    }


# ─── 1) Store Inventory (merchant-side) ────────────────────────────

class InventoryUpsertRequest(BaseModel):
    store_id: str = Field(..., min_length=2, max_length=80)
    sku: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=120)
    price_coins: int = Field(..., gt=0, le=5_000_000)
    description: Optional[str] = Field(default="", max_length=500)
    image_url: Optional[str] = Field(default="", max_length=600)
    quantity: int = Field(default=0, ge=0, le=999_999)
    is_advertisable: bool = True


@router.post("/inventory/upsert")
async def inventory_upsert(body: InventoryUpsertRequest,
                            current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await upsert_inventory_item(
        db, store_id=body.store_id, owner_id=current_user["user_id"],
        sku=body.sku, name=body.name, price_coins=body.price_coins,
        description=body.description or "",
        image_url=body.image_url or "",
        quantity=body.quantity,
        is_advertisable=body.is_advertisable,
    )


@router.get("/inventory")
async def inventory_list(store_id: Optional[str] = None,
                         advertisable_only: bool = True,
                         limit: int = 50) -> Dict[str, Any]:
    rows = await list_inventory(
        db, store_id=store_id, advertisable_only=advertisable_only,
        limit=limit,
    )
    return {"rows": rows, "count": len(rows)}


# ─── 2) Place Retail Order ─────────────────────────────────────────

class PlaceOrderRequest(BaseModel):
    store_id: str
    sku: str
    quantity: int = Field(default=1, ge=1, le=50)
    delivery_address: Optional[Dict[str, Any]] = None


@router.post("/order")
async def order_place(body: PlaceOrderRequest,
                       current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await place_retail_order(
        db, user_id=current_user["user_id"],
        store_id=body.store_id, sku=body.sku, quantity=body.quantity,
        delivery_address=body.delivery_address,
    )


class AssignDriverRequest(BaseModel):
    manifest_id: str
    driver_id: str


@admin_router.post("/assign-driver")
async def admin_assign_driver(body: AssignDriverRequest,
                               admin=Depends(require_admin)) -> Dict[str, Any]:
    return await assign_driver(
        db, manifest_id=body.manifest_id, driver_id=body.driver_id,
    )


# ─── 3) Dual Barcode Lock ──────────────────────────────────────────

class PickupRequest(BaseModel):
    manifest_id: str
    scanned_plaintext: str = Field(..., min_length=8, max_length=200)


@router.post("/pickup")
async def cargo_pickup(body: PickupRequest,
                        current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await driver_scan_pickup(
        db, manifest_id=body.manifest_id,
        driver_id=current_user["user_id"],
        scanned_plaintext=body.scanned_plaintext,
    )


class HandoverRequest(BaseModel):
    manifest_id: str


@router.post("/handover")
async def cargo_handover(body: HandoverRequest,
                          current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await driver_start_handover(
        db, manifest_id=body.manifest_id,
        driver_id=current_user["user_id"],
    )


class VerifyHandoverRequest(BaseModel):
    manifest_id: str
    scanned_plaintext: str = Field(..., min_length=8, max_length=200)


@router.post("/verify-handover")
async def cargo_verify(body: VerifyHandoverRequest,
                        current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await customer_verify_handover(
        db, manifest_id=body.manifest_id,
        user_id=current_user["user_id"],
        scanned_plaintext=body.scanned_plaintext,
    )


# ─── 5) Cancellation + Return ──────────────────────────────────────

class CancelRequest(BaseModel):
    order_id: str


@router.post("/cancel")
async def cargo_cancel(body: CancelRequest,
                        current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await client_late_cancel(
        db, order_id=body.order_id, user_id=current_user["user_id"],
    )


class ReturnRequest(BaseModel):
    order_id: str
    base_fare_coins: int = Field(..., gt=0, le=100_000)


@router.post("/return")
async def cargo_return(body: ReturnRequest,
                        current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    return await product_return(
        db, order_id=body.order_id, user_id=current_user["user_id"],
        base_fare_coins=body.base_fare_coins,
    )


# ─── 6) Driver Retail Console ──────────────────────────────────────

@router.get("/driver/me/assignments")
async def driver_me_assignments(current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    rows = await driver_assignments(db, driver_id=current_user["user_id"])
    return {"rows": rows, "count": len(rows)}


@router.get("/driver/manifest/{manifest_id}")
async def driver_manifest(manifest_id: str,
                            current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    m = await get_manifest(db, manifest_id=manifest_id,
                            driver_id=current_user["user_id"])
    if not m:
        return {"ok": False, "reason": "not_found_or_not_assigned"}
    return {"ok": True, "manifest": m}


# ─── Customer order history ────────────────────────────────────────

@router.get("/me/orders")
async def my_orders(current_user=Depends(get_current_user_from_session)) -> Dict[str, Any]:
    cursor = db.retail_orders.find(
        {"user_id": current_user["user_id"]}, {"_id": 0},
    ).sort([("placed_at", -1)]).limit(25)
    rows = [r async for r in cursor]
    return {"rows": rows, "count": len(rows)}


# ─── Admin ─────────────────────────────────────────────────────────

@admin_router.get("/settlements/recent")
async def admin_recent_settlements(admin=Depends(require_admin)) -> Dict[str, Any]:
    rows = await list_recent_settlements(db, limit=25)
    return {"rows": rows, "count": len(rows)}


@admin_router.get("/manifests/active")
async def admin_active_manifests(admin=Depends(require_admin)) -> Dict[str, Any]:
    rows = await list_active_manifests(db, limit=50)
    return {"rows": rows, "count": len(rows)}
