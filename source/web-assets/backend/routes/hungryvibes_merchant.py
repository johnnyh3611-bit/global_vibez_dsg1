"""
HungryVibes Merchant Dashboard — backend.

Per `GlobalVibez_HungryVibes_Merchant_Dashboard.pdf` and
`GlobalVibez_Merchant_Promo_System.pdf` (Feb 2026 uploads):

  • A restaurant owner manages their digital presence + menu + promos
    via a self-serve dashboard. Sponsorship is **$29.99/month flat**
    (Stripe checkout in /sponsorship/checkout below; webhook in
    /sponsorship/verify flips `sponsorship_active` and pushes the
    next renewal 30 days out).
  • Menu & Ingredient Builder: each menu item has a base price plus
    customisable ingredient extras with their own up-charges. Inventory
    Toggle flips an ingredient on/off so it stops appearing on the
    dynamic customer price view.
  • VIBE PROMOS Hub: owner generates codes (e.g. "VIBE50") with either
    fixed-dollar or percentage discount, plus a uses-remaining limit.
    A Flash Sale Toggle activates/deactivates a code instantly.
    A Live Tracker shows uses-today.
  • Revenue Pipeline: customer pays → app processes → instant credit
    to the merchant's Vibe Account, MINUS a 2% Vibe Tax.
  • Customer-side: at HungryVibes checkout the customer enters a code,
    we validate & apply the discount, decrement uses_remaining.

Sponsorship gate: `require_active_sponsorship` is exposed so frontend
admin tooling can check whether to gate premium tabs (currently the
dashboard renders for all merchants — the field is informational; gate
in a follow-up PR if you want hard gating).

Endpoints (all prefixed `/api/hungryvibes/merchant`):
  POST /register                                — create merchant profile
  GET  /me                                      — current merchant
  PATCH /me                                     — update profile

  GET  /menu                                    — list my menu items
  POST /menu                                    — add menu item
  PATCH /menu/{item_id}                         — edit base_price / available
  POST /menu/{item_id}/ingredients              — add an ingredient
  PATCH /menu/{item_id}/ingredients/{name}      — toggle on/off (inventory)
  DELETE /menu/{item_id}                        — remove item

  GET  /promos                                  — list my promos + uses-today
  POST /promos                                  — create promo
  PATCH /promos/{promo_id}/toggle               — flash-sale on/off
  DELETE /promos/{promo_id}                     — soft-delete

  POST /promos/redeem                           — customer-side redemption
                                                  body: {code, order_total, merchant_id}
                                                  → {discount, new_total, redemption_id}

  GET  /vibe-account                            — balance + recent ledger
  POST /vibe-account/credit                     — internal: order settlement
                                                  body: {order_total, order_id}
                                                  applies 2% Vibe Tax, returns net.

  POST /sponsorship/checkout                    — Stripe Checkout for $29.99/mo
                                                  → {checkout_url, session_id}
  POST /sponsorship/verify                      — verify session & flip flag
                                                  body: {session_id}
                                                  → {sponsorship_active, renews_at}
"""
from __future__ import annotations
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from config import get_database
from utils.database import get_current_user

SPONSORSHIP_PRICE_USD = 29.99

router = APIRouter(prefix="/hungryvibes/merchant", tags=["hungryvibes-merchant"])


# ─── Pydantic models ────────────────────────────────────────────────────

class MerchantRegisterIn(BaseModel):
    name: str
    description: Optional[str] = None
    cuisine: Optional[str] = None
    address: Optional[str] = None


class MerchantProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cuisine: Optional[str] = None
    address: Optional[str] = None
    open_now: Optional[bool] = None


class MenuItemIn(BaseModel):
    item_name: str
    base_price: float = Field(ge=0)


class MenuItemPatch(BaseModel):
    base_price: Optional[float] = Field(default=None, ge=0)
    available: Optional[bool] = None


class IngredientIn(BaseModel):
    name: str
    extra_cost: float = Field(ge=0)


class PromoIn(BaseModel):
    code: str  # auto-uppercased
    discount_value: float = Field(gt=0)
    is_percent: bool
    limit: int = Field(gt=0, le=100000)


class PromoRedeemIn(BaseModel):
    code: str
    merchant_id: str
    order_total: float = Field(gt=0)


class VibeAccountCreditIn(BaseModel):
    order_total: float = Field(gt=0)
    order_id: str


# ─── Helpers ────────────────────────────────────────────────────────────

VIBE_TAX_RATE = 0.02  # 2% per the PDF Revenue Pipeline.


async def _require_user(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def _get_merchant_or_404(db, owner_user_id: str) -> Dict[str, Any]:
    merchant = await db.hv_merchants.find_one(
        {"owner_user_id": owner_user_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(
            status_code=404,
            detail="No merchant profile — call POST /register first",
        )
    return merchant


def _start_of_today_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


# ─── Merchant profile ───────────────────────────────────────────────────

@router.post("/register")
async def register(payload: MerchantRegisterIn, request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    existing = await db.hv_merchants.find_one(
        {"owner_user_id": user.user_id}, {"_id": 0}
    )
    if existing:
        return {"success": True, "merchant": existing, "message": "Already registered"}
    merchant = {
        "merchant_id": str(uuid4()),
        "owner_user_id": user.user_id,
        "name": payload.name.strip(),
        "description": payload.description,
        "cuisine": payload.cuisine,
        "address": payload.address,
        "open_now": True,
        "sponsorship_active": False,
        "sponsorship_renews_at": None,
        "vibe_account_balance": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.hv_merchants.insert_one(dict(merchant))
    return {"success": True, "merchant": merchant}


@router.get("/me")
async def me(request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    return {"success": True, "merchant": merchant}


@router.patch("/me")
async def patch_me(
    payload: MerchantProfileUpdate, request: Request
) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.hv_merchants.update_one(
            {"merchant_id": merchant["merchant_id"]}, {"$set": updates}
        )
        merchant.update(updates)
    return {"success": True, "merchant": merchant}


# ─── Menu & Ingredient Builder ──────────────────────────────────────────

@router.get("/menu")
async def list_menu(request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    items_cursor = db.hv_menu_items.find(
        {"merchant_id": merchant["merchant_id"]}, {"_id": 0}
    )
    items: List[Dict[str, Any]] = await items_cursor.to_list(length=500)
    return {"success": True, "items": items}


@router.post("/menu")
async def add_menu_item(payload: MenuItemIn, request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    item = {
        "item_id": str(uuid4()),
        "merchant_id": merchant["merchant_id"],
        "item_name": payload.item_name.strip(),
        "base_price": float(payload.base_price),
        "custom_ingredients": [],
        "available": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.hv_menu_items.insert_one(dict(item))
    return {"success": True, "item": item}


@router.patch("/menu/{item_id}")
async def patch_menu_item(
    item_id: str, payload: MenuItemPatch, request: Request
) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.hv_menu_items.update_one(
        {"item_id": item_id, "merchant_id": merchant["merchant_id"]},
        {"$set": updates},
    )
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Menu item not found")
    item = await db.hv_menu_items.find_one({"item_id": item_id}, {"_id": 0})
    return {"success": True, "item": item}


@router.post("/menu/{item_id}/ingredients")
async def add_ingredient(
    item_id: str, payload: IngredientIn, request: Request
) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    ingredient = {
        "name": payload.name.strip(),
        "price": float(payload.extra_cost),
        "available": True,
    }
    res = await db.hv_menu_items.update_one(
        {"item_id": item_id, "merchant_id": merchant["merchant_id"]},
        {"$push": {"custom_ingredients": ingredient}},
    )
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Menu item not found")
    item = await db.hv_menu_items.find_one({"item_id": item_id}, {"_id": 0})
    return {"success": True, "item": item}


@router.patch("/menu/{item_id}/ingredients/{ingredient_name}")
async def toggle_ingredient(
    item_id: str, ingredient_name: str, request: Request
) -> Dict[str, Any]:
    """Inventory Toggle — flip an ingredient's `available` flag instantly."""
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    item = await db.hv_menu_items.find_one(
        {"item_id": item_id, "merchant_id": merchant["merchant_id"]}, {"_id": 0}
    )
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    ingredients = item.get("custom_ingredients") or []
    found = False
    for ing in ingredients:
        if ing.get("name") == ingredient_name:
            ing["available"] = not ing.get("available", True)
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    await db.hv_menu_items.update_one(
        {"item_id": item_id}, {"$set": {"custom_ingredients": ingredients}}
    )
    item["custom_ingredients"] = ingredients
    return {"success": True, "item": item}


@router.delete("/menu/{item_id}")
async def delete_menu_item(item_id: str, request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    res = await db.hv_menu_items.delete_one(
        {"item_id": item_id, "merchant_id": merchant["merchant_id"]}
    )
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Menu item not found")
    return {"success": True}


# ─── VIBE PROMOS Hub ─────────────────────────────────────────────────────

async def _promo_with_uses_today(db, promo: Dict[str, Any]) -> Dict[str, Any]:
    """Decorate a promo with a live `uses_today` count for the Live Tracker."""
    cutoff = _start_of_today_utc().isoformat()
    uses_today = await db.hv_promo_redemptions.count_documents(
        {"promo_id": promo["promo_id"], "created_at": {"$gte": cutoff}}
    )
    promo = dict(promo)
    promo["uses_today"] = uses_today
    return promo


@router.get("/promos")
async def list_promos(request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    promos: List[Dict[str, Any]] = await db.hv_promos.find(
        {"merchant_id": merchant["merchant_id"], "deleted": {"$ne": True}},
        {"_id": 0},
    ).to_list(length=200)
    decorated = [await _promo_with_uses_today(db, p) for p in promos]
    return {"success": True, "promos": decorated}


@router.post("/promos")
async def create_promo(payload: PromoIn, request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    code = payload.code.strip().upper()
    if len(code) < 3 or len(code) > 24:
        raise HTTPException(status_code=400, detail="Code must be 3-24 chars")
    # Reject duplicate active codes per merchant.
    existing = await db.hv_promos.find_one(
        {
            "merchant_id": merchant["merchant_id"],
            "code": code,
            "deleted": {"$ne": True},
        },
        {"_id": 0},
    )
    if existing:
        raise HTTPException(status_code=400, detail="Code already exists")
    if payload.is_percent and payload.discount_value > 100:
        raise HTTPException(
            status_code=400, detail="Percentage discount must be ≤ 100"
        )
    promo = {
        "promo_id": str(uuid4()),
        "merchant_id": merchant["merchant_id"],
        "code": code,
        "discount_value": float(payload.discount_value),
        "is_percent": bool(payload.is_percent),
        "limit": int(payload.limit),
        "uses_remaining": int(payload.limit),
        "active": True,
        "deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.hv_promos.insert_one(dict(promo))
    return {"success": True, "promo": await _promo_with_uses_today(db, promo)}


@router.patch("/promos/{promo_id}/toggle")
async def toggle_promo(promo_id: str, request: Request) -> Dict[str, Any]:
    """Flash-Sale Toggle — instant on/off."""
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    promo = await db.hv_promos.find_one(
        {"promo_id": promo_id, "merchant_id": merchant["merchant_id"]}, {"_id": 0}
    )
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
    new_active = not promo.get("active", True)
    await db.hv_promos.update_one(
        {"promo_id": promo_id}, {"$set": {"active": new_active}}
    )
    promo["active"] = new_active
    return {"success": True, "promo": await _promo_with_uses_today(db, promo)}


@router.delete("/promos/{promo_id}")
async def soft_delete_promo(promo_id: str, request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    res = await db.hv_promos.update_one(
        {"promo_id": promo_id, "merchant_id": merchant["merchant_id"]},
        {"$set": {"deleted": True, "active": False}},
    )
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Promo not found")
    return {"success": True}


@router.post("/promos/redeem")
async def redeem_promo(
    payload: PromoRedeemIn, request: Request
) -> Dict[str, Any]:
    """Customer-side redemption at HungryVibes checkout.

    Auth required so we can audit who redeemed what — but the merchant_id
    is taken from the body (the customer is redeeming against a different
    merchant than themselves).
    """
    user = await _require_user(request)
    db = get_database()
    code = payload.code.strip().upper()
    promo = await db.hv_promos.find_one(
        {
            "merchant_id": payload.merchant_id,
            "code": code,
            "deleted": {"$ne": True},
        },
        {"_id": 0},
    )
    if not promo:
        raise HTTPException(status_code=404, detail="Code not found")
    if not promo.get("active"):
        raise HTTPException(status_code=400, detail="Code is paused")
    if promo.get("uses_remaining", 0) <= 0:
        raise HTTPException(status_code=400, detail="Code is exhausted")

    # Compute discount.
    if promo["is_percent"]:
        discount = round(payload.order_total * (promo["discount_value"] / 100.0), 2)
    else:
        discount = min(round(promo["discount_value"], 2), payload.order_total)
    new_total = round(max(payload.order_total - discount, 0), 2)

    redemption = {
        "redemption_id": str(uuid4()),
        "promo_id": promo["promo_id"],
        "merchant_id": payload.merchant_id,
        "redeemer_user_id": user.user_id,
        "order_total": payload.order_total,
        "discount_applied": discount,
        "new_total": new_total,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.hv_promo_redemptions.insert_one(dict(redemption))
    await db.hv_promos.update_one(
        {"promo_id": promo["promo_id"]}, {"$inc": {"uses_remaining": -1}}
    )

    return {
        "success": True,
        "discount": discount,
        "new_total": new_total,
        "redemption_id": redemption["redemption_id"],
        "code": code,
    }


# ─── Vibe Account (Revenue Pipeline) ────────────────────────────────────

@router.get("/vibe-account")
async def vibe_account(request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)
    ledger: List[Dict[str, Any]] = await db.hv_vibe_ledger.find(
        {"merchant_id": merchant["merchant_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(length=50)
    return {
        "success": True,
        "balance": round(float(merchant.get("vibe_account_balance", 0.0)), 2),
        "vibe_tax_rate": VIBE_TAX_RATE,
        "ledger": ledger,
    }


@router.post("/vibe-account/credit")
async def vibe_account_credit(
    payload: VibeAccountCreditIn, request: Request
) -> Dict[str, Any]:
    """Internal: settle a paid order to the merchant's Vibe Account.

    Per the Revenue Pipeline: Customer Payment → App Processing → Instant
    Merchant Credit (minus 2% Vibe Tax). Production callers should be
    the order-completion webhook; for now we expose it auth'd so the
    merchant can simulate against the dashboard's "Test Settlement" CTA.
    """
    user = await _require_user(request)
    db = get_database()
    merchant = await _get_merchant_or_404(db, user.user_id)

    # Idempotent settlement — same (merchant_id, order_id) never credits twice.
    existing = await db.hv_vibe_ledger.find_one(
        {
            "merchant_id": merchant["merchant_id"],
            "order_id": payload.order_id,
            "kind": "settlement",
        },
        {"_id": 0},
    )
    if existing:
        return {
            "success": True,
            "already": True,
            "balance": float(merchant.get("vibe_account_balance", 0.0)),
            "credited": float(existing.get("net_credit") or 0),
            "vibe_tax": float(existing.get("vibe_tax") or 0),
            "ledger_id": existing.get("ledger_id"),
        }

    gross = round(float(payload.order_total), 2)
    vibe_tax = round(gross * VIBE_TAX_RATE, 2)
    net = round(gross - vibe_tax, 2)

    entry = {
        "ledger_id": str(uuid4()),
        "merchant_id": merchant["merchant_id"],
        "order_id": payload.order_id,
        "gross": gross,
        "vibe_tax": vibe_tax,
        "net_credit": net,
        "kind": "settlement",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.hv_vibe_ledger.insert_one(dict(entry))
    except Exception as exc:
        # Unique index race — treat as already settled
        if "Duplicate" in type(exc).__name__ or getattr(exc, "code", None) == 11000:
            again = await db.hv_vibe_ledger.find_one(
                {
                    "merchant_id": merchant["merchant_id"],
                    "order_id": payload.order_id,
                    "kind": "settlement",
                },
                {"_id": 0},
            )
            return {
                "success": True,
                "already": True,
                "balance": float(merchant.get("vibe_account_balance", 0.0)),
                "credited": float((again or {}).get("net_credit") or 0),
                "ledger_id": (again or {}).get("ledger_id"),
            }
        raise
    new_balance = round(
        float(merchant.get("vibe_account_balance", 0.0)) + net, 2
    )
    await db.hv_merchants.update_one(
        {"merchant_id": merchant["merchant_id"]},
        {"$set": {"vibe_account_balance": new_balance}},
    )
    return {
        "success": True,
        "balance": new_balance,
        "credited": net,
        "vibe_tax": vibe_tax,
        "ledger_id": entry["ledger_id"],
    }


# ─── Sponsorship checkout ($29.99/mo) ───────────────────────────────────

class SponsorshipVerifyIn(BaseModel):
    session_id: str


_STRIPE_RETIRED_DETAIL = {
    "error": "stripe_retired",
    "message": (
        "Stripe sponsorship checkout is retired. Use Helio or Solana deposit "
        "for HungryVibes merchant sponsorship."
    ),
    "use": "/api/coins/topup/helio",
}


@router.post("/sponsorship/checkout")
async def sponsorship_checkout(request: Request) -> Dict[str, Any]:
    """Retired — Stripe sponsorship checkout is no longer supported."""
    raise HTTPException(status_code=410, detail=_STRIPE_RETIRED_DETAIL)


@router.post("/sponsorship/verify")
async def sponsorship_verify(
    payload: SponsorshipVerifyIn, request: Request
) -> Dict[str, Any]:
    """Retired — Stripe sponsorship verification is no longer supported."""
    raise HTTPException(status_code=410, detail=_STRIPE_RETIRED_DETAIL)


@router.post("/sponsorship/webhook")
async def sponsorship_webhook(request: Request) -> Dict[str, Any]:
    """Retired — Stripe sponsorship webhooks are no longer processed."""
    raise HTTPException(status_code=410, detail=_STRIPE_RETIRED_DETAIL)



# ─── PUBLIC / customer-side menu view ───────────────────────────────────

public_router = APIRouter(prefix="/hungryvibes", tags=["hungryvibes-public"])


@public_router.get("/merchants/{merchant_id}/menu")
async def public_menu(merchant_id: str) -> Dict[str, Any]:
    """Customer-facing dynamic price view. Filters out unavailable
    ingredients so the UI matches what the customer can actually order."""
    db = get_database()
    merchant = await db.hv_merchants.find_one(
        {"merchant_id": merchant_id}, {"_id": 0}
    )
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    items = await db.hv_menu_items.find(
        {"merchant_id": merchant_id, "available": True}, {"_id": 0}
    ).to_list(length=500)
    for item in items:
        item["custom_ingredients"] = [
            ing
            for ing in (item.get("custom_ingredients") or [])
            if ing.get("available", True)
        ]
    return {
        "success": True,
        "merchant": {
            "merchant_id": merchant["merchant_id"],
            "name": merchant.get("name"),
            "description": merchant.get("description"),
            "cuisine": merchant.get("cuisine"),
            "open_now": merchant.get("open_now", True),
        },
        "items": items,
    }
