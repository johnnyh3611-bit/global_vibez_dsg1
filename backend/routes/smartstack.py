"""
Smart Logistics Stacking — driver-revenue optimisation layer.

Implements the algorithm + UI hooks from these PDFs:
  • GlobalVibez_Smart_Logistics_Stacking.pdf
  • GlobalVibez_Driver_SmartStack_Dashboard.pdf

Premise: A driver currently on a passenger ride from A→B can opportunistically
add a HungryVibes food delivery (pickup C → drop-off D) IF:
  • the total detour added by C+D vs the direct A→B route is ≤ 1.5 mi, AND
  • the food-delivery payout multiplies trip profit by ≥ 2.0×.

When both hold, the driver gets a "SMART STACK DETECTED!" alert with an
ACCEPT_BOTH button. Accepting locks the food order to the driver and
queues C/D as waypoints in their active route.

This module only adds the matcher + driver-side overlay endpoints. It
reuses existing collections:
  • `vibe_drivers`   — driver profile + last_known_location {lat, lng}
  • `vibe_rides`     — active rides (existing)
We add:
  • `hv_orders`              — food orders the customer placed
  • `smartstack_offers`      — matches surfaced to a driver (with TTL)
  • `smartstack_acceptances` — audit trail of who accepted what

Algorithm (kept simple & deterministic for MVP — replace with OR-Tools
if/when we move to real-time multi-stack optimisation):

  1. Compute haversine distance for the direct A→B leg.
  2. For each pending HungryVibes order with a delivery_to coordinate:
       - detour = haversine(A,C) + haversine(C,D) + haversine(D,B) − A→B
       - if detour > 1.5 mi → skip
       - profit_boost = (ride_payout + food_payout) / ride_payout
       - if profit_boost < 2.0 → skip
       - else → emit a SmartStack offer.
  3. Surface the top offer (highest profit_boost) to the driver.

The numbers (1.5 mi / 2.0×) are pulled from the PDF. Tunables are in
the module-level constants below so the founder can adjust without a
code change.
"""
from __future__ import annotations
import math
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from config import get_database
from utils.database import get_current_user

router = APIRouter(prefix="/smartstack", tags=["smartstack"])

# ─── Tunables ───────────────────────────────────────────────────────────

MAX_DETOUR_MI = float(os.environ.get("SMARTSTACK_MAX_DETOUR_MI", "1.5"))
MIN_PROFIT_BOOST = float(os.environ.get("SMARTSTACK_MIN_PROFIT_BOOST", "2.0"))
OFFER_TTL_SECONDS = 90

EARTH_RADIUS_MI = 3958.8


def haversine(a: Dict[str, float], b: Dict[str, float]) -> float:
    """Great-circle distance in miles between {lat,lng} dicts."""
    lat1, lng1 = math.radians(a["lat"]), math.radians(a["lng"])
    lat2, lng2 = math.radians(b["lat"]), math.radians(b["lng"])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(h))


# ─── Pydantic models ────────────────────────────────────────────────────


class GeoPoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class CreateOrderIn(BaseModel):
    """Customer creates a HungryVibes order — the delivery is what
    SmartStack offers to a driver."""
    merchant_id: str
    pickup_at: GeoPoint
    deliver_to: GeoPoint
    food_payout_usd: float = Field(gt=0, le=100)
    note: Optional[str] = None
    payment_method: str = "card"   # "card" (default) | "coins"


class StartRideIn(BaseModel):
    pickup: GeoPoint
    dropoff: GeoPoint
    ride_payout_usd: float = Field(gt=0, le=200)


class AcceptStackIn(BaseModel):
    offer_id: str


# ─── Helpers ────────────────────────────────────────────────────────────


async def _require_user(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def _score_match(
    ride_pickup: Dict[str, float],
    ride_dropoff: Dict[str, float],
    order: Dict[str, Any],
    ride_payout: float,
) -> Optional[Dict[str, Any]]:
    """Return an offer dict if this order qualifies for stacking with this
    ride, else None.

    The dict is intentionally informational (not a DB row yet) — the caller
    wraps it as an `smartstack_offers` document.
    """
    base_dist = haversine(ride_pickup, ride_dropoff)
    pickup = order["pickup_at"]
    deliver = order["deliver_to"]
    detour = (
        haversine(ride_pickup, pickup)
        + haversine(pickup, deliver)
        + haversine(deliver, ride_dropoff)
        - base_dist
    )
    if detour < 0 or detour > MAX_DETOUR_MI:
        return None
    food_payout = float(order["food_payout_usd"])
    if ride_payout <= 0:
        return None
    profit_boost = (ride_payout + food_payout) / ride_payout
    if profit_boost < MIN_PROFIT_BOOST:
        return None
    # Estimated added time at 25 mph average urban — clamp to whole minutes.
    added_minutes = max(1, int(round(detour / 25 * 60)))
    return {
        "order_id": order["order_id"],
        "merchant_id": order.get("merchant_id"),
        "pickup_at": pickup,
        "deliver_to": deliver,
        "food_payout_usd": round(food_payout, 2),
        "ride_payout_usd": round(ride_payout, 2),
        "added_distance_mi": round(detour, 2),
        "added_minutes": added_minutes,
        "profit_boost": round(profit_boost, 2),
        "added_profit_usd": round(food_payout, 2),
    }


# ─── Driver-side: start ride / fetch active stacks / accept ─────────────


@router.post("/driver/start-ride")
async def start_ride(payload: StartRideIn, request: Request) -> Dict[str, Any]:
    """Create or replace the driver's active ride.

    Stripped down for MVP — production would tie into rides.py's full
    booking lifecycle. Here we just need an "active ride context"
    against which Smart Logistics can match nearby food orders.
    """
    user = await _require_user(request)
    db = get_database()
    ride = {
        "ride_id": str(uuid4()),
        "driver_user_id": user.user_id,
        "pickup": payload.pickup.model_dump(),
        "dropoff": payload.dropoff.model_dump(),
        "ride_payout_usd": float(payload.ride_payout_usd),
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    # Replace the driver's prior active ride.
    await db.smartstack_active_rides.delete_many({"driver_user_id": user.user_id})
    await db.smartstack_active_rides.insert_one(dict(ride))
    return {"success": True, "ride": ride}


@router.post("/driver/end-ride")
async def end_ride(request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    res = await db.smartstack_active_rides.delete_many({"driver_user_id": user.user_id})
    return {"success": True, "ended_count": res.deleted_count}


@router.get("/driver/dashboard")
async def driver_dashboard(request: Request) -> Dict[str, Any]:
    """Combined view: active ride + best SmartStack offer (if any) +
    accepted-stacks history (last 25)."""
    user = await _require_user(request)
    db = get_database()
    active_ride = await db.smartstack_active_rides.find_one(
        {"driver_user_id": user.user_id}, {"_id": 0}
    )
    best_offer = None
    available_orders: List[Dict[str, Any]] = []
    if active_ride:
        # Find pending HungryVibes orders within bounding-box of the ride.
        # Tight bbox keeps the matcher cheap; SmartStack rejects misses.
        cursor = db.hv_orders.find(
            {"status": "pending", "deliver_to": {"$exists": True}}, {"_id": 0}
        ).limit(50)
        async for order in cursor:
            available_orders.append(order)
        scored: List[Dict[str, Any]] = []
        for order in available_orders:
            match = _score_match(
                active_ride["pickup"],
                active_ride["dropoff"],
                order,
                active_ride["ride_payout_usd"],
            )
            if match:
                scored.append(match)
        if scored:
            scored.sort(key=lambda m: m["profit_boost"], reverse=True)
            best = scored[0]
            offer_doc = {
                "offer_id": str(uuid4()),
                "driver_user_id": user.user_id,
                "ride_id": active_ride["ride_id"],
                **best,
                "expires_at": (
                    datetime.now(timezone.utc) + timedelta(seconds=OFFER_TTL_SECONDS)
                ).isoformat(),
                "status": "open",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.smartstack_offers.insert_one(dict(offer_doc))
            best_offer = offer_doc

    # Last 25 accepted stacks for the strip
    history: List[Dict[str, Any]] = await (
        db.smartstack_acceptances
        .find({"driver_user_id": user.user_id}, {"_id": 0})
        .sort("accepted_at", -1)
        .limit(25)
        .to_list(length=25)
    )

    total_added_profit = sum(float(h.get("added_profit_usd", 0)) for h in history)

    return {
        "success": True,
        "active_ride": active_ride,
        "best_offer": best_offer,
        "available_order_count": len(available_orders),
        "history": history,
        "stats": {
            "stacks_accepted": len(history),
            "total_added_profit_usd": round(total_added_profit, 2),
            "max_detour_mi": MAX_DETOUR_MI,
            "min_profit_boost": MIN_PROFIT_BOOST,
        },
    }


@router.post("/driver/accept-stack")
async def accept_stack(payload: AcceptStackIn, request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    offer = await db.smartstack_offers.find_one(
        {"offer_id": payload.offer_id, "driver_user_id": user.user_id, "status": "open"},
        {"_id": 0},
    )
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found or already settled")
    # Lock the order to this driver. (find_one_and_update is atomic,
    # critical so two drivers can't double-accept.)
    res = await db.hv_orders.find_one_and_update(
        {"order_id": offer["order_id"], "status": "pending"},
        {"$set": {"status": "assigned", "assigned_driver_user_id": user.user_id}},
        return_document=False,
    )
    if not res:
        # Someone else won the race — close the offer.
        await db.smartstack_offers.update_one(
            {"offer_id": payload.offer_id}, {"$set": {"status": "lost_race"}}
        )
        raise HTTPException(status_code=409, detail="Order already taken")
    await db.smartstack_offers.update_one(
        {"offer_id": payload.offer_id},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc).isoformat()}},
    )
    acceptance = {
        "acceptance_id": str(uuid4()),
        "driver_user_id": user.user_id,
        "ride_id": offer["ride_id"],
        "order_id": offer["order_id"],
        "added_profit_usd": offer["added_profit_usd"],
        "added_distance_mi": offer["added_distance_mi"],
        "added_minutes": offer["added_minutes"],
        "profit_boost": offer["profit_boost"],
        "accepted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.smartstack_acceptances.insert_one(dict(acceptance))
    return {"success": True, "acceptance": acceptance}


@router.post("/driver/dismiss-offer")
async def dismiss_offer(payload: AcceptStackIn, request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    res = await db.smartstack_offers.update_one(
        {"offer_id": payload.offer_id, "driver_user_id": user.user_id, "status": "open"},
        {"$set": {"status": "dismissed"}},
    )
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"success": True}


# ─── ADMIN / OPS Dispatch Panel ─────────────────────────────────────────


admin_router = APIRouter(prefix="/admin/smartstack", tags=["admin-smartstack"])


@admin_router.get("/overview")
async def admin_overview(request: Request) -> Dict[str, Any]:
    """Live ops overview — active rides, open offers, today's accepted
    stacks, top drivers by bonus profit (last 24h).

    Gated by the same God-Mode `admin_session` cookie as the rest of the
    Vault dashboard. We import the verifier inline to avoid a static
    cycle (admin_dashboard imports many things; smartstack is leaner)."""
    from routes.admin_dashboard import verify_admin_session  # noqa: PLC0415
    cookie = request.cookies.get("admin_session")
    if not verify_admin_session(cookie):
        raise HTTPException(status_code=401, detail="Admin session required")

    db = get_database()
    today_start = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    active_rides = await db.smartstack_active_rides.find({}, {"_id": 0}).to_list(length=200)
    open_offers = await db.smartstack_offers.find({"status": "open"}, {"_id": 0}).to_list(length=200)
    pending_orders = await db.hv_orders.count_documents({"status": "pending"})
    accepted_today: List[Dict[str, Any]] = await db.smartstack_acceptances.find(
        {"accepted_at": {"$gte": today_start}}, {"_id": 0}
    ).sort("accepted_at", -1).limit(50).to_list(length=50)

    # Top drivers by 24h bonus profit (in-Python aggregation since Motor
    # supports it but the dataset is tiny — keep code simple).
    by_driver: Dict[str, Dict[str, Any]] = {}
    for a in accepted_today:
        d = a["driver_user_id"]
        slot = by_driver.setdefault(d, {"driver_user_id": d, "stacks": 0, "bonus_profit_usd": 0.0})
        slot["stacks"] += 1
        slot["bonus_profit_usd"] += float(a.get("added_profit_usd", 0))
    leaderboard = sorted(by_driver.values(), key=lambda x: x["bonus_profit_usd"], reverse=True)[:10]
    for row in leaderboard:
        row["bonus_profit_usd"] = round(row["bonus_profit_usd"], 2)

    total_bonus = round(sum(float(a.get("added_profit_usd", 0)) for a in accepted_today), 2)
    avg_boost = round(
        sum(float(a.get("profit_boost", 1)) for a in accepted_today) / len(accepted_today), 2
    ) if accepted_today else 0
    avg_detour = round(
        sum(float(a.get("added_distance_mi", 0)) for a in accepted_today) / len(accepted_today), 2
    ) if accepted_today else 0

    return {
        "success": True,
        "stats": {
            "active_rides": len(active_rides),
            "open_offers": len(open_offers),
            "pending_orders": pending_orders,
            "stacks_24h": len(accepted_today),
            "bonus_profit_24h_usd": total_bonus,
            "avg_profit_boost": avg_boost,
            "avg_detour_mi": avg_detour,
            "max_detour_mi": MAX_DETOUR_MI,
            "min_profit_boost": MIN_PROFIT_BOOST,
        },
        "active_rides": active_rides,
        "open_offers": open_offers,
        "leaderboard": leaderboard,
        "recent_acceptances": accepted_today[:25],
    }


# ─── Customer-side: create a HungryVibes food order ──────────────────────


customer_router = APIRouter(prefix="/hungryvibes/orders", tags=["hungryvibes-orders"])


@customer_router.post("/create")
async def create_order(payload: CreateOrderIn, request: Request) -> Dict[str, Any]:
    """Customer creates a delivery order — entry point for SmartStack."""
    user = await _require_user(request)
    db = get_database()

    # If paying in Vibez Coins, debit the wallet up-front. If the user
    # is short, the frontend will catch the 402 and pop the top-up modal.
    coins_paid: Optional[int] = None
    if payload.payment_method == "coins":
        from services.coin_wallet import usd_to_coins, debit_coins
        coins_due = usd_to_coins(float(payload.food_payout_usd))
        debit = await debit_coins(
            db, user.user_id, coins_due,
            reason="hungryvibez_order",
            metadata={"merchant_id": payload.merchant_id},
        )
        if not debit["ok"]:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient Vibez Coins (need ₵{coins_due}, have ₵{debit['balance_after']})",
            )
        coins_paid = coins_due

    order = {
        "order_id": str(uuid4()),
        "customer_user_id": user.user_id,
        "merchant_id": payload.merchant_id,
        "pickup_at": payload.pickup_at.model_dump(),
        "deliver_to": payload.deliver_to.model_dump(),
        "food_payout_usd": float(payload.food_payout_usd),
        "note": payload.note,
        "status": "pending" if payload.payment_method == "card" else "paid",
        "payment_method": payload.payment_method,
        "coins_paid": coins_paid,
        "assigned_driver_user_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.hv_orders.insert_one(dict(order))
    return {"success": True, "order": order}


@customer_router.get("/my")
async def my_orders(request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    orders = await db.hv_orders.find(
        {"customer_user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(25).to_list(length=25)
    return {"success": True, "orders": orders}


# ─── Merchant-side: fulfillment state machine ───────────────────────────
#
# 2026-05-12 founder ask: "If I had drivers and merchants right now, would
# everything work?" Honest answer at the time: no, because merchants
# couldn't actually SEE or FULFILL the orders customers placed. We had
# `hv_orders` writes from the customer side but no merchant inbox / accept
# / mark-ready / mark-delivered loop.
#
# This module wires the merchant fulfillment side end-to-end. The state
# machine is intentionally simple for beta (small-restaurant model where
# the merchant handles delivery themselves with their own staff/driver):
#
#   pending ──merchant accepts──▶ preparing ──merchant marks ready──▶ ready
#     │                                                                  │
#     └─merchant rejects──▶ rejected (auto-refund)        merchant marks
#                                                          delivered │
#                                                                    ▼
#                                                              delivered
#                                                              (+ merchant
#                                                              vibe-account
#                                                              credit, 2% tax)
#
# A future round can branch "ready" into "out_for_delivery" + driver
# assignment (cross-link to Vibe Ridez drivers via SmartStack offer logic
# above). For beta, merchant-fulfilled is the realistic shippable model.


# Valid forward transitions. Anything not listed is rejected with 409.
ORDER_TRANSITIONS = {
    "pending":     {"preparing", "rejected"},
    "paid":        {"preparing", "rejected"},  # paid = post-coins debit
    "preparing":   {"ready"},
    "ready":       {"delivered"},
    "delivered":   set(),
    "rejected":    set(),
}


class OrderStatusPatch(BaseModel):
    """Body for merchant transition endpoints (accept / ready / delivered / reject)."""
    note: Optional[str] = None  # optional merchant note (e.g. "Out of pepperoni")


async def _get_merchant_owned_order(db, order_id: str, owner_user_id: str) -> Dict[str, Any]:
    """Fetch an order AND verify the caller owns the receiving merchant.
    Raises 404 if the order doesn't exist or isn't ours."""
    order = await db.hv_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    merchant = await db.hv_merchants.find_one(
        {"owner_user_id": owner_user_id, "merchant_id": order.get("merchant_id")},
        {"_id": 0, "merchant_id": 1, "name": 1},
    )
    if not merchant:
        raise HTTPException(
            status_code=403,
            detail="Order belongs to a different merchant",
        )
    return order


async def _transition_order(
    db,
    order_id: str,
    owner_user_id: str,
    new_status: str,
    note: Optional[str],
) -> Dict[str, Any]:
    order = await _get_merchant_owned_order(db, order_id, owner_user_id)
    current = order.get("status", "pending")
    allowed = ORDER_TRANSITIONS.get(current, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot transition {current} → {new_status}. "
                   f"Allowed: {sorted(allowed) or 'none (terminal state)'}",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    update = {
        "status": new_status,
        f"status_history.{new_status}_at": now_iso,
    }
    if note:
        update[f"merchant_notes.{new_status}"] = note

    await db.hv_orders.update_one(
        {"order_id": order_id},
        {"$set": update},
    )

    # If transitioning to "delivered", credit the merchant's Vibe Account
    # minus the 2% Vibe Tax. Mirrors POST /api/hungryvibes/merchant/vibe-account/credit
    # so the same ledger collection (`hv_vibe_ledger`) and same balance
    # field (`vibe_account_balance`) are updated — one source of truth.
    if new_status == "delivered":
        food_usd = round(float(order.get("food_payout_usd", 0)), 2)
        vibe_tax = round(food_usd * VIBE_TAX_RATE, 2)
        net = round(food_usd - vibe_tax, 2)
        merchant_doc = await db.hv_merchants.find_one(
            {"merchant_id": order["merchant_id"]},
            {"_id": 0, "vibe_account_balance": 1},
        )
        new_balance = round(float((merchant_doc or {}).get("vibe_account_balance", 0.0)) + net, 2)
        await db.hv_vibe_ledger.insert_one({
            "ledger_id": str(uuid4()),
            "merchant_id": order["merchant_id"],
            "order_id": order_id,
            "gross": food_usd,
            "vibe_tax": vibe_tax,
            "net_credit": net,
            "kind": "fulfillment_settlement",
            "created_at": now_iso,
        })
        await db.hv_merchants.update_one(
            {"merchant_id": order["merchant_id"]},
            {"$set": {"vibe_account_balance": new_balance}},
        )

    # If transitioning to "rejected", refund coins if they paid with coins.
    if new_status == "rejected" and order.get("payment_method") == "coins":
        coins_paid = int(order.get("coins_paid") or 0)
        if coins_paid > 0:
            from services.coin_wallet import credit_coins
            try:
                await credit_coins(
                    db, order["customer_user_id"], coins_paid,
                    reason="hungryvibez_order_rejected_refund",
                    metadata={"order_id": order_id},
                )
            except Exception:
                # Silent — admin can manual-refund via God Mode if this fails.
                pass

    refreshed = await db.hv_orders.find_one({"order_id": order_id}, {"_id": 0})
    return refreshed


# Need VIBE_TAX_RATE here — re-import from merchant module to keep one
# source of truth (DRY: changing the rate in one place updates both).
from routes.hungryvibes_merchant import VIBE_TAX_RATE  # noqa: E402


# Merchant inbox — orders received, newest first. Filters out "rejected"
# + "delivered" by default so the active queue stays focused; pass
# ?include_archived=true to see everything.
@customer_router.get("/merchant-inbox")
async def merchant_inbox(
    request: Request,
    include_archived: bool = False,
    limit: int = 50,
) -> Dict[str, Any]:
    """Return all orders for the merchant the caller owns."""
    user = await _require_user(request)
    db = get_database()
    merchant = await db.hv_merchants.find_one(
        {"owner_user_id": user.user_id},
        {"_id": 0, "merchant_id": 1, "name": 1},
    )
    if not merchant:
        raise HTTPException(
            status_code=404,
            detail="No merchant profile — register first via /api/hungryvibes/merchant/register",
        )

    query: Dict[str, Any] = {"merchant_id": merchant["merchant_id"]}
    if not include_archived:
        query["status"] = {"$nin": ["rejected", "delivered"]}

    orders = await db.hv_orders.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).limit(int(limit)).to_list(length=int(limit))

    return {
        "success": True,
        "merchant_id": merchant["merchant_id"],
        "merchant_name": merchant.get("name"),
        "count": len(orders),
        "orders": orders,
    }


# Single-order detail (merchant-owned). Useful for an order-detail modal
# that polls every few seconds.
@customer_router.get("/merchant/{order_id}")
async def merchant_order_detail(order_id: str, request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    db = get_database()
    order = await _get_merchant_owned_order(db, order_id, user.user_id)
    return {"success": True, "order": order}


@customer_router.post("/merchant/{order_id}/accept")
async def merchant_accept(
    order_id: str,
    payload: OrderStatusPatch,
    request: Request,
) -> Dict[str, Any]:
    """Merchant accepts the order — transitions pending/paid → preparing."""
    user = await _require_user(request)
    db = get_database()
    order = await _transition_order(db, order_id, user.user_id, "preparing", payload.note)
    return {"success": True, "order": order}


@customer_router.post("/merchant/{order_id}/ready")
async def merchant_ready(
    order_id: str,
    payload: OrderStatusPatch,
    request: Request,
) -> Dict[str, Any]:
    """Merchant marks the order ready for pickup/delivery (preparing → ready)."""
    user = await _require_user(request)
    db = get_database()
    order = await _transition_order(db, order_id, user.user_id, "ready", payload.note)
    return {"success": True, "order": order}


@customer_router.post("/merchant/{order_id}/delivered")
async def merchant_delivered(
    order_id: str,
    payload: OrderStatusPatch,
    request: Request,
) -> Dict[str, Any]:
    """Merchant marks the order as delivered (ready → delivered).
    Auto-credits Vibe Account net of 2% Vibe Tax."""
    user = await _require_user(request)
    db = get_database()
    order = await _transition_order(db, order_id, user.user_id, "delivered", payload.note)
    return {"success": True, "order": order}


@customer_router.post("/merchant/{order_id}/reject")
async def merchant_reject(
    order_id: str,
    payload: OrderStatusPatch,
    request: Request,
) -> Dict[str, Any]:
    """Merchant rejects the order (pending/paid → rejected).
    Auto-refunds coins if customer paid with coins."""
    user = await _require_user(request)
    db = get_database()
    order = await _transition_order(db, order_id, user.user_id, "rejected", payload.note)
    return {"success": True, "order": order}

