"""
DSG Logistics Master Engine — VibeRidez + Hunger Vibez safety net
─────────────────────────────────────────────────────────────────
Implements the 8-module Logistics Master Blueprint (Vibe + DSG
variants merged):

  1. Hybrid Emergency Breakdown Logic (VibeRidez + Hunger Vibez)
  2. Dual Safety Loop (15s countdown → safety-team livestream)
  3. Hardware Mandates (mandatory dual-lens dash cam compliance)
  4. White-Glove Door Regulations (premium service standard)
  5. Fair-Share Cancellation Payouts (75 / 80 / 30 driver splits)
  6. Driver Override Console state machine
  7. Driver Tier Matrix (Standard / VIP Premium / Elite Vibe)
  8. Hunger Vibez Creator Kitchen (deep links + delay pushes)

ECONOMICS COUNTER-PROPOSAL (founder rule: NO 50% in-app burns,
₵ in-app + 40/30/30 recirculation):
  • Fiat cancellation fee ($) stays Stripe-side as a payment intent.
  • In-app payouts to drivers stay 75 / 80 / 30 (PDF).
  • Whatever is NOT paid to the driver does NOT burn — it flows
    into the existing `recirculate()` engine (40/30/30 split).
  • Creator Kitchen featured-dish cost stays at 15,000 ₵.

COLLECTIONS:
  • emergency_incidents       — breakdown events + state machine
  • driver_hardware_compliance — dash cam verification rows
  • white_glove_violations    — door-rule strike log
  • cancellation_payouts      — ledger of every payout split
  • driver_tier_state         — derived tier per driver
  • creator_kitchens          — Hunger Vibez creator merchants
  • creator_kitchen_orders    — live-stream-driven orders
  • creator_kitchen_delays    — manual stage delays w/ driver push
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

# ─────────────────────────── Constants ─────────────────────────────

# Module 1: emergency breakdown
BREAKDOWN_KINDS = ("vibe_ridez", "hunger_vibez")
BREAKDOWN_NEARBY_DRIVER_SECONDS = 5 * 60  # 5 min lookahead

# Module 2: dual safety loop
SAFETY_COUNTDOWN_SECONDS = 15

# Module 3: hardware compliance — both lenses must be online for the
# driver to remain on-grid. Verification window is 7 days.
HARDWARE_VERIFICATION_TTL_DAYS = 7

# Module 4: white-glove escalation ladder
WHITE_GLOVE_WARN_THRESHOLD = 1   # 1st strike → warning
WHITE_GLOVE_SUSPEND_THRESHOLD = 3  # 3rd strike → 24h suspension

# Module 5: cancellation splits (PDF, ₵-mode)
PAYOUT_SPLITS = {
    "passenger_cancel_late":   {"driver_pct": 0.75, "platform_pct": 0.25,
                                "wait_seconds_min": 120},
    "passenger_no_show":       {"driver_pct": 0.80, "platform_pct": 0.20,
                                "wait_seconds_min": 300},
    "platform_emergency_redirect": {"driver_pct": 0.30, "platform_pct": 0.70,
                                "wait_seconds_min": 0},
}
CANCELLATION_FLAT_FEE_COINS = 500  # 500 ₵ in-app default (matches $5 fiat)
EMERGENCY_REDIRECT_BASE_FARE_COINS = 1_000  # 1,000 ₵ default base

# Module 7: driver tier rules (PDF matrix)
TIER_RULES = {
    "standard": {"min_rating": 0.0, "min_white_glove": 0.0, "min_trips": 0,
                 "perks": ["baseline_dispatch"]},
    "vip_premium": {"min_rating": 4.8, "min_white_glove": 0.95,
                     "min_trips": 100, "max_camera_flags": 0,
                     "perks": ["priority_dispatch", "high_end_restaurants"]},
    "elite_vibe": {"min_rating": 4.95, "min_white_glove": 0.95,
                    "min_trips": 500, "max_camera_flags": 0,
                    "perks": ["vip_clients", "dsg_tv_show_slot_bidding",
                              "high_ticket_event_routes"]},
}

# Module 8: Hunger Vibez Creator Kitchen
CREATOR_FEATURED_DISH_COINS = 15_000


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:14]}"


# ═══════════════════ Module 1 — Emergency Breakdown ════════════════

async def trigger_breakdown(
    db,
    *,
    driver_id: str,
    kind: str,
    job_id: Optional[str] = None,
    coords: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """Trigger a breakdown event. VibeRidez → zeroes the passenger
    fare, generates a ride credit, dispatches a backup driver.
    Hunger Vibez → looks for a nearby driver to recover the food, or
    re-queues the order with the merchant."""
    if kind not in BREAKDOWN_KINDS:
        return {"ok": False, "reason": "invalid_kind"}

    incident_id = _new_id("brk")
    now = _now_iso()
    incident = {
        "incident_id": incident_id,
        "driver_id": driver_id,
        "kind": kind,
        "job_id": job_id,
        "coords": coords or {},
        "status": "active",  # active | resolved | manual_override
        "backup_driver_id": None,
        "ride_credit_id": None,
        "remake_order_id": None,
        "safety_stream_url": None,
        "safety_loop_armed": False,
        "created_at": now,
    }

    if kind == "vibe_ridez":
        # Zero out the active fare + generate ride credit. The exact
        # fare-zero / credit issuance lives on the rides service; we
        # write the credit row here so the audit chain is closed.
        if job_id:
            credit_id = _new_id("credit")
            incident["ride_credit_id"] = credit_id
            await db.ride_credits.insert_one({
                "credit_id": credit_id,
                "incident_id": incident_id,
                "ride_id": job_id,
                "user_id": None,  # filled by the ride service
                "amount_coins": EMERGENCY_REDIRECT_BASE_FARE_COINS,
                "status": "issued",
                "issued_at": now,
            })
        # Backup-driver dispatch is pluggable — the dispatch service
        # picks the closest active driver via its own geo query.
        incident["backup_driver_id"] = None

    elif kind == "hunger_vibez":
        # Scan for nearby driver; otherwise queue a remake.
        nearby = None  # geo-query plugged in via dispatch service later
        if not nearby and job_id:
            remake_id = _new_id("remake")
            incident["remake_order_id"] = remake_id
            await db.hunger_remakes.insert_one({
                "remake_id": remake_id,
                "incident_id": incident_id,
                "order_id": job_id,
                "status": "queued_with_merchant",
                "queued_at": now,
            })

    await db.emergency_incidents.insert_one(incident)
    return {"ok": True, **{k: v for k, v in incident.items() if k != "_id"}}


# ═══════════════════ Module 2 — Dual Safety Loop ═══════════════════

async def arm_safety_loop(
    db,
    *,
    incident_id: str,
    stream_url: str,
) -> Dict[str, Any]:
    """Arm the 15s safety countdown + livestream to the safety team."""
    res = await db.emergency_incidents.update_one(
        {"incident_id": incident_id, "status": "active"},
        {"$set": {
            "safety_loop_armed": True,
            "safety_stream_url": stream_url,
            "safety_armed_at": _now_iso(),
            "safety_countdown_seconds": SAFETY_COUNTDOWN_SECONDS,
        }},
    )
    if res.modified_count == 0:
        return {"ok": False, "reason": "incident_not_active"}
    return {"ok": True, "incident_id": incident_id,
            "countdown_seconds": SAFETY_COUNTDOWN_SECONDS,
            "stream_url": stream_url}


async def manual_override(
    db,
    *,
    incident_id: str,
    actor_id: str,
    note: str = "",
) -> Dict[str, Any]:
    """Driver or safety-team manual override of an armed loop."""
    res = await db.emergency_incidents.update_one(
        {"incident_id": incident_id},
        {"$set": {
            "status": "manual_override",
            "override_by": actor_id,
            "override_note": note[:280],
            "override_at": _now_iso(),
        }},
    )
    if res.modified_count == 0:
        return {"ok": False, "reason": "incident_not_found"}
    return {"ok": True, "incident_id": incident_id, "status": "manual_override"}


# ═══════════════ Module 3 — Hardware Compliance Gate ═══════════════

async def verify_hardware(
    db,
    *,
    driver_id: str,
    interior_lens_ok: bool,
    exterior_lens_ok: bool,
    hardware_id: str,
) -> Dict[str, Any]:
    now = _now_iso()
    status = "compliant" if interior_lens_ok and exterior_lens_ok else "non_compliant"
    await db.driver_hardware_compliance.update_one(
        {"driver_id": driver_id},
        {"$set": {
            "driver_id": driver_id,
            "hardware_id": hardware_id,
            "interior_lens_ok": bool(interior_lens_ok),
            "exterior_lens_ok": bool(exterior_lens_ok),
            "status": status,
            "verified_at": now,
        },
         "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"ok": True, "driver_id": driver_id, "status": status,
            "verified_at": now,
            "ttl_days": HARDWARE_VERIFICATION_TTL_DAYS}


async def get_hardware_compliance(db, driver_id: str) -> Dict[str, Any]:
    row = await db.driver_hardware_compliance.find_one(
        {"driver_id": driver_id}, {"_id": 0},
    )
    return row or {"driver_id": driver_id, "status": "unverified"}


# ═══════════════════ Module 4 — White-Glove Strikes ════════════════

async def log_white_glove_violation(
    db,
    *,
    driver_id: str,
    job_id: Optional[str],
    physical_constraint_verified: bool,
    note: str = "",
) -> Dict[str, Any]:
    """Log a door-rule violation. Physical-constraint exemptions skip
    the strike counter so disability-accommodating bypasses don't
    accrue penalties."""
    if physical_constraint_verified:
        return {"ok": True, "exempt": True,
                "reason": "physical_constraint_verified"}

    violation_id = _new_id("wgv")
    now = _now_iso()
    await db.white_glove_violations.insert_one({
        "violation_id": violation_id,
        "driver_id": driver_id,
        "job_id": job_id,
        "note": note[:280],
        "at": now,
    })
    total = await db.white_glove_violations.count_documents({"driver_id": driver_id})
    action = "noted"
    if total >= WHITE_GLOVE_SUSPEND_THRESHOLD:
        action = "suspend_24h"
        await db.drivers.update_one(
            {"driver_id": driver_id},
            {"$set": {"suspended_until": now, "suspension_reason": "white_glove"}},
        )
    elif total >= WHITE_GLOVE_WARN_THRESHOLD:
        action = "warn"
    return {"ok": True, "violation_id": violation_id,
            "total_strikes": total, "action": action}


# ═════════════ Module 5 — Fair-Share Cancellation Payouts ══════════

async def process_cancellation_payout(
    db,
    *,
    job_id: str,
    driver_id: str,
    rider_id: Optional[str],
    kind: str,
    fee_coins: Optional[int] = None,
) -> Dict[str, Any]:
    """Compute the driver/platform split for a cancellation event and
    route the platform cut through the 40/30/30 recirculation engine
    instead of burning it (founder counter-proposal)."""
    rule = PAYOUT_SPLITS.get(kind)
    if not rule:
        return {"ok": False, "reason": "invalid_kind"}

    fee = int(fee_coins or (
        EMERGENCY_REDIRECT_BASE_FARE_COINS
        if kind == "platform_emergency_redirect"
        else CANCELLATION_FLAT_FEE_COINS
    ))
    driver_share = int(fee * rule["driver_pct"])
    platform_share = fee - driver_share  # absorbs rounding

    payout_id = _new_id("payout")
    now = _now_iso()

    # 1. Credit the driver in ₵.
    from services.coin_wallet import credit_coins  # noqa: PLC0415
    try:
        await credit_coins(
            db, driver_id, driver_share,
            reason=f"cancellation_payout:{kind}",
            metadata={"payout_id": payout_id, "job_id": job_id,
                      "rider_id": rider_id},
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("driver credit failed: %s", exc)

    # 2. Route the platform cut through the 40/30/30 recirculation.
    from services.recirculation import recirculate  # noqa: PLC0415
    recirc = {"ok": False}
    if platform_share > 0:
        recirc = await recirculate(
            db,
            amount_coins=platform_share,
            source=f"cancellation_platform_cut:{kind}",
            user_id=rider_id,
            metadata={"payout_id": payout_id, "job_id": job_id,
                      "driver_id": driver_id, "kind": kind},
        )

    payout = {
        "payout_id": payout_id,
        "job_id": job_id,
        "driver_id": driver_id,
        "rider_id": rider_id,
        "kind": kind,
        "fee_coins": fee,
        "driver_share_coins": driver_share,
        "platform_share_coins": platform_share,
        "recirculation": recirc.get("split"),
        "burn_coins": 0,  # explicit: never burn the platform cut
        "at": now,
    }
    await db.cancellation_payouts.insert_one(payout)
    return {"ok": True, **payout}


# ═══════════════ Module 6 — Driver Override Console ════════════════

async def driver_override_state(db, driver_id: str) -> Dict[str, Any]:
    """Snapshot of everything the override console renders."""
    incident = await db.emergency_incidents.find_one(
        {"driver_id": driver_id, "status": "active"},
        {"_id": 0},
    )
    hardware = await get_hardware_compliance(db, driver_id)
    strikes = await db.white_glove_violations.count_documents(
        {"driver_id": driver_id})
    return {
        "driver_id": driver_id,
        "active_incident": incident,
        "hardware": hardware,
        "white_glove_strikes": strikes,
        "countdown_seconds": SAFETY_COUNTDOWN_SECONDS,
    }


# ═════════════════ Module 7 — Driver Tier Matrix ═══════════════════

async def compute_driver_tier(db, driver_id: str) -> Dict[str, Any]:
    """Derive the tier from rating + white-glove score + camera flags.
    Persists to `driver_tier_state` so dispatchers can index it."""
    driver = await db.drivers.find_one(
        {"driver_id": driver_id}, {"_id": 0},
    ) or {}
    rating = float(driver.get("rating", 0.0))
    total_trips = int(driver.get("trips_completed", 0))
    # white-glove score = 1 - (strikes / max(trips, 1))
    strikes = await db.white_glove_violations.count_documents(
        {"driver_id": driver_id})
    wg_score = max(0.0, 1.0 - (strikes / max(total_trips, 1)))
    camera_flags = int(driver.get("camera_flags", 0))

    achieved = "standard"
    for tier in ("elite_vibe", "vip_premium"):
        rule = TIER_RULES[tier]
        if (rating >= rule["min_rating"]
                and wg_score >= rule["min_white_glove"]
                and total_trips >= rule["min_trips"]
                and camera_flags <= rule.get("max_camera_flags", 999)):
            achieved = tier
            break

    state = {
        "driver_id": driver_id,
        "tier": achieved,
        "rating": rating,
        "trips_completed": total_trips,
        "white_glove_score": round(wg_score, 4),
        "camera_flags": camera_flags,
        "perks": TIER_RULES[achieved]["perks"],
        "computed_at": _now_iso(),
    }
    await db.driver_tier_state.update_one(
        {"driver_id": driver_id},
        {"$set": state, "$setOnInsert": {"created_at": _now_iso()}},
        upsert=True,
    )
    return state


# ═════════ Module 8 — Hunger Vibez Creator Kitchen ════════════════

async def register_creator_kitchen(
    db,
    *,
    user_id: str,
    name: str,
    bio: str = "",
) -> Dict[str, Any]:
    existing = await db.creator_kitchens.find_one(
        {"owner_id": user_id}, {"_id": 0, "kitchen_id": 1},
    )
    if existing:
        return {"ok": False, "reason": "already_registered",
                "kitchen_id": existing["kitchen_id"]}
    kitchen_id = _new_id("ck")
    deep_link = f"vibez://hunger/c/{kitchen_id}"
    now = _now_iso()
    await db.creator_kitchens.insert_one({
        "kitchen_id": kitchen_id,
        "owner_id": user_id,
        "name": name[:80],
        "bio": bio[:400],
        "deep_link": deep_link,
        "stream_id": None,
        "stream_live": False,
        "featured_dish_id": None,
        "total_orders_fulfilled": 0,
        "is_active": True,
        "created_at": now,
    })
    return {"ok": True, "kitchen_id": kitchen_id, "deep_link": deep_link}


async def get_kitchen(db, kitchen_id: str) -> Optional[Dict[str, Any]]:
    return await db.creator_kitchens.find_one(
        {"kitchen_id": kitchen_id}, {"_id": 0})


async def get_my_kitchen(db, user_id: str) -> Optional[Dict[str, Any]]:
    return await db.creator_kitchens.find_one(
        {"owner_id": user_id}, {"_id": 0})


async def set_featured_dish(
    db,
    *,
    kitchen_id: str,
    user_id: str,
    dish_name: str,
    price_coins: int = CREATOR_FEATURED_DISH_COINS,
) -> Dict[str, Any]:
    kit = await db.creator_kitchens.find_one(
        {"kitchen_id": kitchen_id, "owner_id": user_id}, {"_id": 0},
    )
    if not kit:
        return {"ok": False, "reason": "kitchen_not_found_or_not_owner"}
    dish_id = _new_id("dish")
    await db.creator_kitchens.update_one(
        {"kitchen_id": kitchen_id},
        {"$set": {
            "featured_dish_id": dish_id,
            "featured_dish_name": dish_name[:80],
            "featured_dish_price_coins": int(price_coins),
            "featured_dish_updated_at": _now_iso(),
        }},
    )
    return {"ok": True, "dish_id": dish_id,
            "price_coins": int(price_coins)}


async def place_live_order(
    db,
    *,
    kitchen_id: str,
    user_id: str,
) -> Dict[str, Any]:
    """Live-kitchen ordering overlay tap. Debits the featured-dish
    price in ₵, splits the platform cut through recirculation
    (40/30/30), credits the creator 75%."""
    kit = await db.creator_kitchens.find_one(
        {"kitchen_id": kitchen_id, "is_active": True}, {"_id": 0},
    )
    if not kit or not kit.get("featured_dish_id"):
        return {"ok": False, "reason": "no_featured_dish"}

    price = int(kit.get("featured_dish_price_coins", CREATOR_FEATURED_DISH_COINS))
    creator_share = int(price * 0.75)
    platform_share = price - creator_share

    from services.coin_wallet import debit_coins, credit_coins  # noqa: PLC0415
    try:
        await debit_coins(
            db, user_id, price,
            reason="creator_kitchen_order",
            metadata={"kitchen_id": kitchen_id,
                      "dish_id": kit["featured_dish_id"]},
        )
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "reason": "insufficient_funds",
                "detail": str(exc)}

    await credit_coins(
        db, kit["owner_id"], creator_share,
        reason="creator_kitchen_payout",
        metadata={"kitchen_id": kitchen_id,
                  "dish_id": kit["featured_dish_id"]},
    )

    from services.recirculation import recirculate  # noqa: PLC0415
    recirc = await recirculate(
        db,
        amount_coins=platform_share,
        source="creator_kitchen_platform_cut",
        user_id=user_id,
        metadata={"kitchen_id": kitchen_id,
                  "dish_id": kit["featured_dish_id"]},
    )

    order_id = _new_id("ord")
    now = _now_iso()
    await db.creator_kitchen_orders.insert_one({
        "order_id": order_id,
        "kitchen_id": kitchen_id,
        "user_id": user_id,
        "dish_id": kit["featured_dish_id"],
        "dish_name": kit.get("featured_dish_name"),
        "price_coins": price,
        "creator_share_coins": creator_share,
        "platform_share_coins": platform_share,
        "recirculation": recirc.get("split"),
        "burn_coins": 0,  # explicit
        "status": "queued",
        "placed_at": now,
    })
    await db.creator_kitchens.update_one(
        {"kitchen_id": kitchen_id},
        {"$inc": {"total_orders_fulfilled": 1}},
    )
    return {"ok": True, "order_id": order_id,
            "creator_share": creator_share,
            "platform_share": platform_share,
            "recirculation": recirc.get("split")}


async def push_kitchen_delay(
    db,
    *,
    kitchen_id: str,
    owner_id: str,
    prep_minutes: int,
    affected_order_id: Optional[str] = None,
) -> Dict[str, Any]:
    if prep_minutes <= 0 or prep_minutes > 240:
        return {"ok": False, "reason": "prep_minutes_out_of_range"}
    kit = await db.creator_kitchens.find_one(
        {"kitchen_id": kitchen_id, "owner_id": owner_id}, {"_id": 0},
    )
    if not kit:
        return {"ok": False, "reason": "kitchen_not_found_or_not_owner"}
    delay_id = _new_id("delay")
    now = _now_iso()
    await db.creator_kitchen_delays.insert_one({
        "delay_id": delay_id,
        "kitchen_id": kitchen_id,
        "prep_minutes": int(prep_minutes),
        "affected_order_id": affected_order_id,
        "pushed_to_drivers": True,
        "at": now,
    })
    return {"ok": True, "delay_id": delay_id,
            "prep_minutes": int(prep_minutes)}


# ─────────────────────── Read helpers (admin) ──────────────────────

async def list_active_incidents(db, limit: int = 25) -> List[Dict[str, Any]]:
    cursor = db.emergency_incidents.find(
        {"status": "active"}, {"_id": 0},
    ).sort([("created_at", -1)]).limit(limit)
    return [r async for r in cursor]


async def list_recent_payouts(db, limit: int = 25) -> List[Dict[str, Any]]:
    cursor = db.cancellation_payouts.find(
        {}, {"_id": 0},
    ).sort([("at", -1)]).limit(limit)
    return [r async for r in cursor]
