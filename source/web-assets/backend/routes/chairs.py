"""
Founder Chairs — Phase-priced loyalty seats with quarterly distributions.

User's "Master Deployment Plan" requested a 3-phase, scarcity-priced
buy-in system ("Chairs") where members park their loyalty seat in a
"Vault" and receive quarterly distributions weighted by chair count.

────────────────────────────────────────────────────────────────────
LEGAL FRAMING (READ BEFORE EDITING)
────────────────────────────────────────────────────────────────────

This MUST stay on the legal side of "loyalty program" and OFF the side
of "unregistered securities offering". Howey-test posture:

  ✗ NO COMMON ENTERPRISE — chair payment buys utility (perks + reward
    eligibility), not pooled investment.
  ✗ NO EXPECTATION OF CAPITAL APPRECIATION — we DO NOT show "valuation"
    or "current value" to users. We show "Lifetime contribution: $X" as
    a historical record only.
  ✗ NO TRANSFERABILITY — chairs are bound to the user_id, no resale.
  ✗ NO GUARANTEED RETURN — distributions are DISCRETIONARY quarterly
    bonuses, payable in ₵ Vibez Coins (utility token), and may be
    paused or adjusted with notice.
  ✓ Premium-membership gate makes the perks UTILITY-driven (similar to
    Costco lifetime, Patreon Founding Patron, Discord Nitro).
  ✓ Phase-based pricing is "early-bird founder pricing" (Netflix-style),
    NOT a market price discovery curve.

Same legal lane as: Patreon Founding Patron, Discord Nitro lifetime,
Costco Executive lifetime, OnlyFans Lifetime tier.

────────────────────────────────────────────────────────────────────
Endpoints (all under /api):
  GET  /api/chairs/phase                  (public)  current phase + price
  GET  /api/chairs/me                     (auth)    my chair count + perks
  POST /api/chairs/checkout               (auth)    Stripe session
  POST /api/chairs/test-buy               (auth)    preview-only bypass
  GET  /api/chairs/leaders                (public)  invite leaderboard
  GET  /api/admin/chairs/health           (admin)   Vibe Health Index
  POST /api/admin/chairs/run-quarter      (admin)   manual chair payout
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin_dashboard import verify_admin_cookie
from routes.god_mode_audit import record_god_event

logger = logging.getLogger(__name__)
router = APIRouter()


# ────────────────────────────────────────────── Phase configuration
#
# 5 marketing brand names, 5 price bands, 5 earn-rate multipliers.
# **Genius** (the first 50K) earn at 3× the rate of standard chairs forever —
# rewards the believers who showed up first. Pre-existing chairs (the 985
# bought before Apr 27 2026) are migrated into Genius @ 3× as well.
# **Genesis** is Phase 2 ($15 / 2×) — the next wave that joined right
# after Genius, locked in for 2× earn rate.
#
# Multiplier is LOCKED at purchase time on chair_purchases.weight, so a
# Genius buyer keeps their 3× even after Genius sells out and the public
# price moves to $15 / $20.

PHASES = [
    # name       cumulative_limit  price  weight  tagline
    #
    # Final 3-tier ladder confirmed 2026-05-04 by Founder. Compact,
    # dramatic progression — no more $5-step 10-tier sprawl.
    #   • Genius:  $20 × 50,000 chairs  ($1,000,000 max raise)
    #   • Genesis: $100 × 100,000 chairs ($10,000,000 max raise)
    #   • Apex:    $250 × 50,000 chairs ($12,500,000 max raise)
    # Total active circulation = 200,000 chairs, matching the v12
    # Founder Vault 50,000-chair unlock gate + 200M DSG reserve.
    #
    # Weights are LOCKED AT PURCHASE on `chair_purchases.weight` so
    # this config can never retroactively rewrite a holder's rate.
    {"name": "Genius",  "limit":  50_000, "price_usd":  20.00, "weight": 3.0,
     "tagline": "First-believer seats — 3× earn rate, 100-chair cap per wallet, locked for life."},
    {"name": "Genesis", "limit": 150_000, "price_usd": 100.00, "weight": 2.0,
     "tagline": "Expansion seats — 2× earn rate, open to all, no per-wallet cap."},
    {"name": "Apex",    "limit": 200_000, "price_usd": 250.00, "weight": 1.0,
     "tagline": "Apex seats — 1× earn rate, the final 50K of the active supply."},
]

# Genius Phase Implementation PDF directive — per-user cap during Genius.
GENIUS_PER_USER_CAP = 100

# Discretionary loyalty bonus when an invite converts into a chair purchase.
INVITE_LOYALTY_REWARD = 10  # stakes credited to the inviter

# Hard cap per single transaction so a single accidental click can't
# vault someone past two phase boundaries at once.
MAX_CHAIRS_PER_PURCHASE = 100

# ────────────────────────────────────────────── Genius Phase per-user cap
#
# During the opening "Genius" phase (first 50K chairs, 3× earn rate),
# we enforce a **per-user lifetime cap of 100 chairs** to keep the
# first-believer pool decentralized and prevent a single whale from
# hoarding the 3× rewards. Once Genius sells out (total_sold >= 50K)
# the cap auto-lifts — Genesis+ phases have no per-user limit.
#
# Admins can ALSO manually lift the cap early by flipping
# `platform_state.genius_cap_lifted=True` via
# POST /api/admin/chairs/genius-cap/toggle. This is the "flip the
# switch" pro-tip from the GeniusPhase Implementation spec — useful
# if a trusted market-maker needs a larger allocation before Genius
# organically fills.
GENIUS_PER_USER_CAP = 100


async def _genius_cap_active(db, phase_name: str) -> bool:
    """True iff the Genius per-user cap should be enforced right now.
    Active only when the CURRENT phase is Genius AND an admin hasn't
    manually lifted the cap."""
    if phase_name != "Genius":
        return False
    state = await db.platform_state.find_one(
        {"_id": "chair_genius_cap"}, {"_id": 0, "lifted": 1},
    )
    return not (state and state.get("lifted"))


async def _genius_cap_remaining(db, user_id: str) -> Optional[int]:
    """How many more chairs a given user can still buy before hitting
    the Genius cap. Returns None when the cap isn't active. Uses
    `user_id_lookup` (8-char plaintext prefix) to count against the
    encrypted `chair_purchases.user_id`."""
    phase = await _current_phase(db)
    if not await _genius_cap_active(db, phase.get("phase", "")):
        return None
    lookup = (user_id or "")[:8]
    rows = await db.chair_purchases.find(
        {"user_id_lookup": lookup},
        {"_id": 0, "quantity": 1, "phase_at_purchase": 1},
    ).to_list(length=10_000)
    genius_qty = sum(
        int(r.get("quantity") or 0) for r in rows
        if r.get("phase_at_purchase") == "Genius"
    )
    return max(0, GENIUS_PER_USER_CAP - genius_qty)


# ────────────────────────────────────────────── Helpers


async def _total_chairs_sold(db) -> int:
    """Backward-compatible alias — the canonical implementation lives in
    `shared/chair_counters.py` so `apex_evolution.py` can call it
    without re-introducing the historical chairs.py↔apex_evolution.py
    circular dependency."""
    from shared.chair_counters import total_chairs_sold  # noqa: PLC0415
    return await total_chairs_sold(db)


def _phase_for(total_sold: int) -> Optional[Dict[str, Any]]:
    """Returns the active phase dict, or None if every chair is sold."""
    for p in PHASES:
        if total_sold < p["limit"]:
            return p
    return None


async def _current_phase(db) -> Dict[str, Any]:
    # When Apex evolution has fired, every legacy phase is frozen.
    # Apex is the ONLY buyable phase and the entire counter pool now
    # tracks against Apex's 250K capacity.
    try:
        from routes.apex_evolution import apex_state_for_phase  # noqa: PLC0415
        apex = await apex_state_for_phase(db)
        if apex is not None:
            return apex
    except Exception:
        # Apex module not mounted yet (e.g. unit tests) — fall through.
        pass

    sold = await _total_chairs_sold(db)
    p = _phase_for(sold)
    if p is None:
        return {
            "phase": "Sold Out",
            "price_usd": None,
            "weight": None,
            "limit": PHASES[-1]["limit"],
            "remaining_in_phase": 0,
            "total_sold": sold,
        }
    # Compute remaining in THIS phase (not lifetime remaining).
    prev_limit = 0
    for prior in PHASES:
        if prior["name"] == p["name"]:
            break
        prev_limit = prior["limit"]
    in_phase_capacity = p["limit"] - prev_limit
    in_phase_sold = sold - prev_limit
    return {
        "phase": p["name"],
        "price_usd": p["price_usd"],
        "weight": p["weight"],
        "limit": p["limit"],
        "in_phase_capacity": in_phase_capacity,
        "in_phase_sold": in_phase_sold,
        "remaining_in_phase": max(0, in_phase_capacity - in_phase_sold),
        "tagline": p["tagline"],
        "total_sold": sold,
    }


async def _user_chair_record(db, user_id: str) -> Dict[str, Any]:
    rec = await db.profit_share_balances.find_one(
        {"user_id": user_id},
        {"_id": 0, "locked_chairs": 1, "lifetime_chairs": 1,
         "weighted_chairs": 1,
         "lifetime_contribution_usd": 1, "current_stakes": 1, "lifetime_stakes": 1},
    ) or {}
    return {
        "locked_chairs": int(rec.get("locked_chairs") or 0),
        "lifetime_chairs": int(rec.get("lifetime_chairs") or 0),
        "weighted_chairs": float(rec.get("weighted_chairs") or 0.0),
        "lifetime_contribution_usd": float(rec.get("lifetime_contribution_usd") or 0.0),
        "current_stakes": int(rec.get("current_stakes") or 0),
        "lifetime_stakes": int(rec.get("lifetime_stakes") or 0),
    }


async def _is_premium(db, user_id: str) -> bool:
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "subscription_tier": 1}) or {}
    return (u.get("subscription_tier") or "free").lower() in {"premium", "diamond", "gold"}


# ────────────────────────────────────────────── Chair grant (idempotent)


async def _grant_chairs(
    db,
    user_id: str,
    quantity: int,
    price_per_chair_usd: float,
    payment_ref: str,
    invite_code: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Idempotent on `payment_ref`. Atomically:
      • bumps profit_share_counters.global_chairs by qty
      • bumps profit_share_balances.locked_chairs + lifetime tracker
      • locks weight + phase_name on the purchase row (forever)
      • marks the inviter's loyalty bonus (if invite_code present)
      • writes audit + ledger entries
    """
    # Idempotency
    existing = await db.chair_purchases.find_one(
        {"payment_ref": payment_ref}, {"_id": 0}
    )
    if existing:
        return {**existing, "idempotent_replay": True}

    qty = int(quantity)
    if qty < 1 or qty > MAX_CHAIRS_PER_PURCHASE:
        raise HTTPException(400, f"Quantity must be between 1 and {MAX_CHAIRS_PER_PURCHASE}.")

    # Lock the phase + weight at purchase time. A Genius buyer keeps
    # their 3× even when Genius sells out and the public price moves.
    phase_at_purchase = await _current_phase(db)
    weight = float(phase_at_purchase.get("weight") or 1.0)
    phase_name = phase_at_purchase.get("phase", "Standard")

    # POWER HOUR — Master Plan v4 (2026-02-06):
    # 5pm-9pm America/New_York → +10% weight bonus, locked at purchase.
    # Lazy import to avoid circular dependency on registry boot order.
    from routes.power_hour_sponsors import is_power_hour_active, POWER_HOUR_MULT  # noqa: PLC0415
    power_hour_bonus = is_power_hour_active()
    if power_hour_bonus:
        weight = round(weight * POWER_HOUR_MULT, 4)

    # Genius per-user cap (100 chairs/user) — enforced only when the
    # current phase is Genius and admin hasn't lifted the cap. Once
    # Genius sells out, Genesis+ phases are uncapped per user.
    if await _genius_cap_active(db, phase_name):
        remaining = await _genius_cap_remaining(db, user_id)
        if remaining is not None and qty > remaining:
            raise HTTPException(
                400,
                f"Genius Phase allows up to {GENIUS_PER_USER_CAP} chairs "
                f"per user. You can still buy {remaining} — "
                f"requested {qty}.",
            )

    contribution_usd = round(price_per_chair_usd * qty, 2)
    weighted_units = round(qty * weight, 4)
    now = datetime.now(timezone.utc).isoformat()

    # 1. Counter bump (atomic; defines the chair phase consistently).
    #    Capture the new count so we can carve out a sequential
    #    `chair_ids` block for THIS purchase. Each chair gets a unique
    #    permanent ID stamped at buy-time — never re-issued, displayed
    #    on the public Chair Wall and the holder's personal carousel.
    counter_after = await db.profit_share_counters.find_one_and_update(
        {"_id": "global_chairs"},
        {"$inc": {"count": qty}},
        upsert=True,
        return_document=True,
    )
    new_total = int((counter_after or {}).get("count") or qty)
    # IDs are 1-indexed and contiguous: e.g. if new_total=12 and qty=3
    # this purchase gets [10, 11, 12]. Chair IDs are NEVER reused even
    # if a chair is somehow refunded — that would just leave a gap.
    chair_ids = list(range(new_total - qty + 1, new_total + 1))

    # 2. Member balance — also bumps `weighted_chairs` so the quarterly
    #    payout job has a fast pre-aggregated value.
    await db.profit_share_balances.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "locked_chairs": qty,
                "lifetime_chairs": qty,
                "weighted_chairs": weighted_units,
                "lifetime_contribution_usd": contribution_usd,
            },
            "$set": {
                "first_chair_at": now,
                "updated_at": now,
            },
        },
        upsert=True,
    )

    # 3. Audit row (locked phase + weight forever).
    # PII fields (user_id, payment_ref) encrypted at rest per manifesto §3
    # via application-layer Fernet — see services/field_encryption.py.
    from services.field_encryption import enc  # noqa: PLC0415
    purchase_doc = {
        "user_id": enc(user_id),
        "user_id_lookup": user_id[:8],  # short prefix for indexed lookups
        "quantity": qty,
        "chair_ids": chair_ids,  # permanent per-chair sequential IDs
        "price_per_chair_usd": price_per_chair_usd,
        "contribution_usd": contribution_usd,
        "payment_ref": enc(payment_ref) if payment_ref else None,
        "invite_code": invite_code,
        "phase_at_purchase": phase_name,
        "weight": weight,
        "weighted_units": weighted_units,
        "power_hour_bonus": power_hour_bonus,  # v4 master plan flag
        "purchased_at": now,
    }
    await db.chair_purchases.insert_one(dict(purchase_doc))

    # 4. Inviter bonus — fires ONLY on the purchase, never on raw invite use.
    inviter_bonus = None
    if invite_code:
        invite = await db.invites.find_one({"code": invite_code.upper()}, {"_id": 0})
        if invite and invite.get("owner_user_id") and invite["owner_user_id"] != user_id:
            try:
                from routes.profit_share import accrue_stake
                await accrue_stake(
                    invite["owner_user_id"],
                    "manual_admin_grant",
                    amount=INVITE_LOYALTY_REWARD,
                    meta={"reason": "invite_conversion", "invitee": user_id, "code": invite_code},
                )
                await db.invites.update_one(
                    {"code": invite_code.upper()},
                    {"$set": {
                        "converted_at": now,
                        "converted_to_purchase_ref": payment_ref,
                        "loyalty_reward_granted": INVITE_LOYALTY_REWARD,
                    }},
                )
                inviter_bonus = {
                    "owner_user_id": invite["owner_user_id"],
                    "loyalty_stakes_awarded": INVITE_LOYALTY_REWARD,
                }
            except Exception as e:
                logger.warning(f"[chairs] inviter loyalty grant failed: {e}")

    # 5. God-mode audit.
    await record_god_event(
        user_id, "CHAIR_PURCHASE", contribution_usd,
        meta={
            "qty": qty,
            "price": price_per_chair_usd,
            "ref": payment_ref,
            "invite_code": invite_code,
        },
    )

    logger.info(
        f"[chairs] {user_id} bought {qty} chairs "
        f"@ ${price_per_chair_usd:.2f} = ${contribution_usd:.2f} "
        f"(ref={payment_ref}, invite={invite_code})"
    )

    return {**purchase_doc, "idempotent_replay": False, "inviter_bonus": inviter_bonus}


# ────────────────────────────────────────────── Public read endpoints


@router.get("/chairs/phase")
async def get_phase() -> Dict[str, Any]:
    """Public — current phase + price + scarcity counters."""
    db = get_database()
    return await _current_phase(db)


@router.get("/chairs/expansion-plan")
async def get_expansion_plan_endpoint() -> Dict[str, Any]:
    """Public — the 10-tier supply expansion ladder ($10 → $55, +$5
    every 50k chairs, 500k active circulation + 500k reserve vault).

    Source-of-truth lives in `services.chair_expansion`; we pass the
    current live total-sold count so the response can highlight where
    the economy is on the future ladder. NOTE: until the live pricing
    engine is flipped to this ladder, this endpoint is purely
    informational — the legacy 5-phase pricing in PHASES[] above
    remains the source of truth for active checkout.
    """
    from services.chair_expansion import get_expansion_plan  # noqa: PLC0415
    db = get_database()
    sold = await _total_chairs_sold(db)
    return get_expansion_plan(active_chairs_sold=sold)


@router.get("/chairs/economics")
async def chair_economics() -> Dict[str, Any]:
    """Public — live economics snapshot used by the /how-chairs-work
    interactive ROI calculator.

    Returns:
      • tiers           — current pricing ladder + multiplier per tier
      • chair_pool_pct  — what slice of platform revenue flows to the
                          chair pool each quarter (PROFIT_SHARE_RATIO ×
                          CHAIR_POOL_RATIO, i.e. 0.20 × 0.70 = 0.14).
      • total_weighted  — current total weighted-chairs in circulation
                          (sum across all locked buyers of
                          chairs × tier_multiplier). The denominator
                          for any "your share" calculation.
      • total_chairs    — raw count of locked chairs.
      • usd_to_coins    — multiplier applied when converting USD payout
                          to Vibez Coins (₵).

    Strict no-leak contract: never returns user IDs, never returns
    individual buyer payouts, never returns admin-only fields.
    """
    from routes.profit_share import (  # noqa: PLC0415
        PROFIT_SHARE_RATIO,
        CHAIR_POOL_RATIO_PRE_EV,
        CHAIR_POOL_RATIO_POST_EV,
        _current_chair_pool_ratio,
        USD_TO_VIBEZ_COINS,
    )
    db = get_database()

    # Tier definitions echoed from PHASES so the frontend has a single
    # source of truth — keeps the calculator honest if PHASES changes.
    tiers = [
        {
            "name": p["name"],
            "price_usd": p["price_usd"],
            "weight": p["weight"],
            "limit": p["limit"],
            "tagline": p["tagline"],
        }
        for p in PHASES
    ]

    # Total weighted denominator across all locked buyers.
    agg = await db.chair_purchases.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {
            "_id": None,
            "total_weighted": {"$sum": "$weight"},
            "total_chairs": {"$sum": 1},
        }},
    ]).to_list(length=1)
    total_weighted = float(agg[0]["total_weighted"]) if agg else 0.0
    total_chairs = int(agg[0]["total_chairs"]) if agg else 0

    # Resolve the live chair-pool ratio against the Escape Velocity flag
    # so the calculator + UI show the exact slice that will be paid out
    # this quarter. Pre-EV: 14%. Post-EV: 30%. Same lever flips both.
    live_chair_pool_ratio = await _current_chair_pool_ratio(db)
    pre_ev_pct = round(PROFIT_SHARE_RATIO * CHAIR_POOL_RATIO_PRE_EV, 4)
    post_ev_pct = round(PROFIT_SHARE_RATIO * CHAIR_POOL_RATIO_POST_EV, 4)
    live_pct = round(PROFIT_SHARE_RATIO * live_chair_pool_ratio, 4)
    escape_velocity_fired = live_chair_pool_ratio >= CHAIR_POOL_RATIO_POST_EV

    return {
        "tiers": tiers,
        # `chair_pool_pct` reflects the LIVE pool slice (auto-flips at EV).
        "chair_pool_pct": live_pct,
        "chair_pool_pct_pre_ev": pre_ev_pct,    # 0.14
        "chair_pool_pct_post_ev": post_ev_pct,  # 0.30
        "escape_velocity_fired": escape_velocity_fired,
        "profit_share_ratio": PROFIT_SHARE_RATIO,
        "chair_pool_ratio": live_chair_pool_ratio,
        "total_weighted": round(total_weighted, 4),
        "total_chairs": total_chairs,
        "usd_to_coins": USD_TO_VIBEZ_COINS,
        # Genius per-user cap — frontend progress bar + "can I buy N?"
        # math reads from these fields so the UI stays consistent with
        # backend enforcement.
        "genius_user_cap": GENIUS_PER_USER_CAP,
        "genius_cap_active": await _genius_cap_active(db, (await _current_phase(db)).get("phase", "")),
        "genius_phase_limit": 50_000,
        "total_supply": 1_000_000,
    }


@router.get("/chairs/genius-cap")
async def chairs_genius_cap(http_request: Request) -> Dict[str, Any]:
    """Public-ish — returns the Genius cap state for the current
    caller (auth optional). Response shape drives the
    `<ChairProgress />` + purchase-form gating. Fields:
      - cap_active: is the 100/user cap currently enforced?
      - per_user_cap: 100
      - genius_phase_limit: 50000 (system-wide Genius cap)
      - genius_sold: how many Genius chairs have shipped so far
      - genius_remaining_total: 50000 - genius_sold
      - user_remaining: max additional chairs this caller can buy in
        Genius (null if not logged in or not in Genius phase).
    """
    db = get_database()
    phase = await _current_phase(db)
    current_name = phase.get("phase", "")
    cap_active = await _genius_cap_active(db, current_name)

    # Genius-specific sold count — sum the `quantity` on every
    # `chair_purchases` row where `phase_at_purchase == "Genius"`.
    # (Deliberately NO status filter — `_grant_chairs` never writes a
    # status field, and chairs are immutable once granted — refunds /
    # voids are not a schema concept yet.)
    agg = await db.chair_purchases.aggregate([
        {"$match": {"phase_at_purchase": "Genius"}},
        {"$group": {"_id": None, "sold": {"$sum": "$quantity"}}},
    ]).to_list(length=1)
    genius_sold = int(agg[0]["sold"]) if agg else 0

    user_remaining: Optional[int] = None
    user = await get_current_user(http_request)
    if user and cap_active:
        user_remaining = await _genius_cap_remaining(db, user.user_id)

    return {
        "current_phase": current_name,
        "cap_active": cap_active,
        "per_user_cap": GENIUS_PER_USER_CAP,
        "genius_phase_limit": 50_000,
        "genius_sold": genius_sold,
        "genius_remaining_total": max(0, 50_000 - genius_sold),
        "user_remaining": user_remaining,
        "total_supply": 1_000_000,
    }


@router.post("/admin/chairs/genius-cap/toggle")
async def admin_toggle_genius_cap(
    payload: Dict[str, Any], _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Admin 'flip the switch' — lift (or re-engage) the 100/user cap
    manually. The cap also auto-lifts once the current phase naturally
    rolls past Genius, so this is only needed if you want to open the
    floodgates while Genius still has remaining supply.

    Payload: {lifted: bool}
    """
    lifted = bool(payload.get("lifted"))
    await db_from_request().platform_state.update_one(
        {"_id": "chair_genius_cap"},
        {"$set": {
            "lifted": lifted,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}, upsert=True,
    )
    return {"ok": True, "lifted": lifted}


def db_from_request():
    """Small helper so the admin toggle can reach the db without
    threading a Request through the signature — the admin cookie
    dependency already guards the route."""
    return get_database()


@router.get("/chairs/me")
async def my_chairs(http_request: Request) -> Dict[str, Any]:
    """Caller's chair holding + reward eligibility."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()

    rec = await _user_chair_record(db, user.user_id)
    is_prem = await _is_premium(db, user.user_id)
    phase = await _current_phase(db)

    # Compute the user's effective earn-rate multiplier from their actual
    # purchase history (per-purchase weight is locked at buy time).
    # chair_purchases.user_id is stored encrypted (fern::…) with a
    # non-deterministic IV, so direct equality match is impossible —
    # we use the `user_id_lookup` indexed short prefix instead.
    # Collision risk is negligible: 8 chars of user_id yields
    # >10^12 unique values; on a match we don't need to re-verify
    # because the loyalty payout downstream already trusts this key.
    user_id_lookup = (user.user_id or "")[:8]
    purchases = await db.chair_purchases.find(
        {"user_id_lookup": user_id_lookup},
        {"_id": 0, "quantity": 1, "weight": 1, "phase_at_purchase": 1},
    ).to_list(length=10_000)
    total_qty = sum(int(p.get("quantity") or 0) for p in purchases)
    total_weighted = sum(
        int(p.get("quantity") or 0) * float(p.get("weight") or 1.0)
        for p in purchases
    )
    avg_weight = (total_weighted / total_qty) if total_qty else 1.0
    phase_breakdown: Dict[str, Dict[str, Any]] = {}
    for p in purchases:
        nm = p.get("phase_at_purchase") or "Standard"
        slot = phase_breakdown.setdefault(nm, {
            "chairs": 0, "weight": float(p.get("weight") or 1.0),
        })
        slot["chairs"] += int(p.get("quantity") or 0)

    # We INTENTIONALLY do NOT return a "valuation" or "current_value" field.
    # The closest we get is "lifetime_contribution_usd" — historical record
    # only, no implied resale price.
    # Flatten chair_ids across purchases — the personal carousel labels
    # each chair with its real permanent ID instead of placeholder #01-#06.
    chair_ids: List[int] = []
    full_purchases = await db.chair_purchases.find(
        {"user_id_lookup": user_id_lookup},
        {"_id": 0, "chair_ids": 1, "phase_at_purchase": 1},
    ).to_list(length=10_000)
    for p in full_purchases:
        ids = p.get("chair_ids") or []
        if isinstance(ids, list):
            chair_ids.extend(int(x) for x in ids if isinstance(x, (int, float)))
    chair_ids.sort()

    return {
        "locked_chairs": rec["locked_chairs"],
        "lifetime_chairs": rec["lifetime_chairs"],
        "weighted_chairs": rec["weighted_chairs"],
        "average_earn_multiplier": round(avg_weight, 2),
        "phase_breakdown": [
            {"phase": k, **v} for k, v in phase_breakdown.items()
        ],
        "lifetime_contribution_usd": rec["lifetime_contribution_usd"],
        "is_premium": is_prem,
        "rewards_active": is_prem and rec["locked_chairs"] > 0,
        "perks_paused_reason": (
            None if is_prem else "premium_subscription_required"
        ) if rec["locked_chairs"] > 0 else None,
        "current_phase": phase,
        "loyalty_stakes": rec["current_stakes"],
        "lifetime_stakes": rec["lifetime_stakes"],
        "chair_ids": chair_ids,
    }


@router.get("/chairs/perks")
async def chairs_perks(http_request: Request) -> Dict[str, Any]:
    """Roadmap PDF §3 — Seated Ownership UI unlock.

    Returns the caller's chair-holder perk payload so the frontend can
    color chat usernames, glow profile rings, and surface the +10%
    $VIBEZ generation badge. Non-holders get a fallback payload (no
    auth required to fail through cleanly — caller decides how to
    render).

    The +10% boost mirrors the value `vibez_rewards.py:_calculate_reward`
    already applies on match-end when `chair_id` is owned. All color/
    badge logic lives in `services.chair_perks_service` so any surface
    (chat broadcast, profile ring, badge renderer) can stamp messages
    without re-implementing the rules.
    """
    user = await get_current_user(http_request)
    db = get_database()
    from services.chair_perks_service import get_chair_perks_for_user  # noqa: PLC0415
    return await get_chair_perks_for_user(db, getattr(user, "user_id", None) if user else None)


@router.get("/chairs/wall")
async def chair_wall(
    phase: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> Dict[str, Any]:
    """Public Chair Wall — paginated list of every parked chair with the
    holder's display handle. Privacy-safe: no user_id, no email, no
    payment data — only `chair_id`, `phase`, `weight`, `parked_at`,
    `holder_handle` (or "Anonymous Founder" if user opted out via
    `users.public_chair_holder = false`), and `holder_chair_count`.

    Sorted by chair_id ascending so the wall reads like a chronological
    history of believers. Filterable by phase (e.g. ?phase=Genius).
    """
    db = get_database()

    # Cap pagination at 500/page so we never accidentally serve a 5MB
    # JSON to a casual visitor scrolling the wall.
    limit = max(1, min(500, int(limit or 200)))
    offset = max(0, int(offset or 0))

    match: Dict[str, Any] = {"chair_ids": {"$exists": True, "$ne": []}}
    if phase:
        match["phase_at_purchase"] = phase

    purchases = await db.chair_purchases.find(
        match,
        {
            "_id": 0,
            "user_id": 1,
            "chair_ids": 1,
            "phase_at_purchase": 1,
            "weight": 1,
            "purchased_at": 1,
        },
    ).to_list(length=10_000)

    # Decrypt user_ids in-memory (chair_purchases.user_id is encrypted via
    # services.field_encryption.enc()) so we can look up display handles.
    from services.field_encryption import dec  # noqa: PLC0415
    user_ids: set[str] = set()
    for p in purchases:
        try:
            uid = dec(p.get("user_id")) if p.get("user_id") else None
        except Exception:  # noqa: BLE001 — bad ciphertext shouldn't break public wall
            uid = None
        p["_uid_decoded"] = uid
        if uid:
            user_ids.add(uid)

    # Bulk fetch user display profiles. Only public-safe fields.
    handles: Dict[str, Dict[str, Any]] = {}
    if user_ids:
        user_docs = await db.users.find(
            {"user_id": {"$in": list(user_ids)}},
            {
                "_id": 0,
                "user_id": 1,
                "name": 1,
                "username": 1,
                "public_chair_holder": 1,
            },
        ).to_list(length=len(user_ids))
        for u in user_docs:
            handle = (
                u.get("username")
                or u.get("name")
                or "Anonymous Founder"
            )
            # Default to public unless user explicitly opted out.
            is_public = u.get("public_chair_holder") is not False
            handles[u["user_id"]] = {
                "handle": handle if is_public else "Anonymous Founder",
                "is_public": is_public,
            }

    # Per-holder chair count (used in the click-through modal to show
    # "this person owns N chairs total"). Aggregate from balances rather
    # than re-counting purchases, so it matches the user's own dashboard.
    chair_counts: Dict[str, int] = {}
    if user_ids:
        bal_rows = await db.profit_share_balances.find(
            {"user_id": {"$in": list(user_ids)}},
            {"_id": 0, "user_id": 1, "locked_chairs": 1},
        ).to_list(length=len(user_ids))
        for b in bal_rows:
            chair_counts[b["user_id"]] = int(b.get("locked_chairs") or 0)

    # Explode each purchase into individual chair rows.
    rows: List[Dict[str, Any]] = []
    for p in purchases:
        uid = p.get("_uid_decoded") or ""
        info = handles.get(uid, {"handle": "Anonymous Founder", "is_public": False})
        for cid in p.get("chair_ids") or []:
            rows.append({
                "chair_id": int(cid),
                "phase": p.get("phase_at_purchase") or "Standard",
                "weight": float(p.get("weight") or 1.0),
                "parked_at": p.get("purchased_at"),
                "holder_handle": info["handle"],
                "holder_chair_count": chair_counts.get(uid, 0),
            })

    rows.sort(key=lambda r: r["chair_id"])
    total = len(rows)
    page = rows[offset : offset + limit]

    return {
        "rows": page,
        "total": total,
        "offset": offset,
        "limit": limit,
        "phase_filter": phase,
    }


@router.get("/chairs/wall/{chair_id}")
async def chair_wall_detail(chair_id: int) -> Dict[str, Any]:
    """Detail view for a single chair — used by the click-through
    modal on the public Chair Wall. Same privacy invariants as
    /chairs/wall (no user_id, no email).
    """
    db = get_database()
    purchase = await db.chair_purchases.find_one(
        {"chair_ids": int(chair_id)},
        {
            "_id": 0,
            "user_id": 1,
            "chair_ids": 1,
            "phase_at_purchase": 1,
            "weight": 1,
            "purchased_at": 1,
            "contribution_usd": 1,
            "quantity": 1,
        },
    )
    if not purchase:
        raise HTTPException(404, f"Chair #{chair_id} not found")

    from services.field_encryption import dec  # noqa: PLC0415
    try:
        uid = dec(purchase.get("user_id")) if purchase.get("user_id") else None
    except Exception:  # noqa: BLE001
        uid = None

    holder_handle = "Anonymous Founder"
    holder_chair_count = 0
    is_public = False
    if uid:
        u = await db.users.find_one(
            {"user_id": uid},
            {
                "_id": 0,
                "name": 1,
                "username": 1,
                "public_chair_holder": 1,
            },
        )
        if u:
            is_public = u.get("public_chair_holder") is not False
            handle = u.get("username") or u.get("name") or "Anonymous Founder"
            holder_handle = handle if is_public else "Anonymous Founder"
        bal = await db.profit_share_balances.find_one(
            {"user_id": uid}, {"_id": 0, "locked_chairs": 1},
        )
        holder_chair_count = int((bal or {}).get("locked_chairs") or 0)

    return {
        "chair_id": chair_id,
        "phase": purchase.get("phase_at_purchase") or "Standard",
        "weight": float(purchase.get("weight") or 1.0),
        "parked_at": purchase.get("purchased_at"),
        "holder_handle": holder_handle,
        "holder_chair_count": holder_chair_count,
        "is_public": is_public,
    }


@router.get("/chairs/leaders")
async def invite_leaders() -> Dict[str, Any]:
    """Public, anonymized leaderboard of invite recruiters."""
    db = get_database()
    pipeline = [
        {"$match": {"status": "used"}},
        {"$group": {"_id": "$owner_user_id", "successful_invites": {"$sum": 1}}},
        {"$sort": {"successful_invites": -1}},
        {"$limit": 10},
    ]
    rows = await db.invites.aggregate(pipeline).to_list(length=10)
    out = []
    for r in rows:
        uid = r["_id"]
        anon = (uid[:6] + "…" + uid[-2:]) if len(uid) > 10 else uid
        wins = int(r["successful_invites"])
        rank = "Executive Recruiter" if wins >= 20 else "Team Builder" if wins >= 5 else "Connector"
        out.append({"anon_id": anon, "successful_invites": wins, "rank_title": rank})
    return {"leaders": out}


# ────────────────────────────────────────────── Checkout


class ChairCheckoutPayload(BaseModel):
    quantity: int = Field(..., ge=1, le=MAX_CHAIRS_PER_PURCHASE)
    invite_code: Optional[str] = Field(None, min_length=4, max_length=40)


@router.post("/chairs/checkout")
async def chair_checkout(payload: ChairCheckoutPayload, http_request: Request) -> Dict[str, Any]:
    """
    Creates a Stripe checkout session for `quantity` chairs at the current
    phase price. Requires:
      • Authenticated user.
      • Either an active invite code OR a flag on user record from a prior
        invite redemption OR an existing chair holder (re-buying).

    Stripe metadata stamps `purchase_type='chair_park'` so the webhook
    branch in server.py can call `_grant_chairs` idempotently.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()

    # Invite gate — chair holders skip this so they can re-up.
    existing_chairs = await _user_chair_record(db, user.user_id)
    if existing_chairs["locked_chairs"] == 0:
        u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "invite_accepted": 1}) or {}
        accepted = bool(u.get("invite_accepted"))
        if payload.invite_code:
            invite = await db.invites.find_one(
                {"code": payload.invite_code.upper()}, {"_id": 0}
            )
            if not invite or invite.get("status") not in ("pending", "used"):
                raise HTTPException(403, "Invalid or unknown invite code.")
            if invite.get("status") == "used" and invite.get("used_by_user_id") != user.user_id:
                raise HTTPException(409, "That invite was used by someone else.")
        elif not accepted:
            raise HTTPException(
                403,
                "You must be invited to the table to buy your first chair. "
                "Get an invite code from an existing chair holder.",
            )

    # Phase + capacity
    phase = await _current_phase(db)
    if phase["phase"] == "Sold Out" or phase["price_usd"] is None:
        raise HTTPException(410, "All Founder Chairs have been claimed.")
    if payload.quantity > phase["remaining_in_phase"]:
        raise HTTPException(
            409,
            f"Only {phase['remaining_in_phase']} chairs left in the "
            f"{phase['phase']} phase. Buy {phase['remaining_in_phase']} or fewer.",
        )

    # Genius Phase per-wallet cap — 100 chairs max while phase == Genius,
    # per `GlobalVibez_GeniusPhase_Implementation.pdf`. After Genius ends
    # the cap is lifted automatically (the check only fires while phase
    # name == "Genius"). This protects Genius equity from whale consolidation.
    if phase["phase"] == "Genius":
        already_owned = existing_chairs["locked_chairs"]
        if already_owned + payload.quantity > GENIUS_PER_USER_CAP:
            remaining = max(0, GENIUS_PER_USER_CAP - already_owned)
            raise HTTPException(
                409,
                f"Genius Phase per-wallet cap is {GENIUS_PER_USER_CAP} chairs. "
                f"You already own {already_owned}. You can buy up to {remaining} more "
                f"in Genius. The cap lifts automatically when Genius ends.",
            )

    # Stripe
    try:
        from services.payment_hub import (
            StripeCheckout, CheckoutSessionRequest,
        )
    except ImportError as e:
        raise HTTPException(503, f"Stripe library unavailable: {e}")

    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        raise HTTPException(
            503,
            "Stripe not configured. Use /api/chairs/test-buy for preview, "
            "or set STRIPE_API_KEY in backend/.env.",
        )

    origin = http_request.headers.get("origin") or http_request.headers.get("referer") or ""
    origin = origin.rstrip("/")
    if not origin:
        raise HTTPException(400, "Origin header required.")

    success_url = f"{origin}/chair-vault/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/chair-vault"

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    sc = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)

    line_total = round(payload.quantity * phase["price_usd"], 2)
    metadata = {
        "user_id": user.user_id,
        "purchase_type": "chair_park",
        "quantity": str(payload.quantity),
        "price_per_chair_usd": str(phase["price_usd"]),
        "invite_code": (payload.invite_code or "").upper(),
        "email": user.email,
    }

    session = await sc.create_checkout_session(CheckoutSessionRequest(
        amount=line_total,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    ))

    await db.chair_pending.insert_one({
        "session_id": session.session_id,
        "user_id": user.user_id,
        "quantity": payload.quantity,
        "price_per_chair_usd": phase["price_usd"],
        "amount_usd": line_total,
        "invite_code": (payload.invite_code or "").upper() or None,
        "phase_at_creation": phase["phase"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "checkout_url": session.url,
        "session_id": session.session_id,
        "quantity": payload.quantity,
        "price_per_chair_usd": phase["price_usd"],
        "total_usd": line_total,
        "phase": phase["phase"],
    }


@router.get("/chairs/checkout-status/{session_id}")
async def chair_checkout_status(session_id: str, http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    pending = await db.chair_pending.find_one(
        {"session_id": session_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not pending:
        raise HTTPException(404, "Checkout session not found.")
    if pending.get("status") == "activated":
        return {"status": "activated", "quantity": pending["quantity"]}

    try:
        from services.payment_hub import StripeCheckout
    except ImportError as e:
        raise HTTPException(503, f"Stripe library unavailable: {e}")
    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        raise HTTPException(503, "Stripe not configured.")

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    sc = StripeCheckout(api_key=stripe_key, webhook_url=webhook_url)
    status = await sc.get_checkout_status(session_id)

    if status.payment_status == "paid":
        await _grant_chairs(
            db, user.user_id,
            quantity=int(pending["quantity"]),
            price_per_chair_usd=float(pending["price_per_chair_usd"]),
            payment_ref=session_id,
            invite_code=pending.get("invite_code"),
        )
        await db.chair_pending.update_one(
            {"session_id": session_id},
            {"$set": {"status": "activated",
                       "activated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {"status": "activated", "quantity": pending["quantity"]}
    return {"status": status.payment_status, "quantity": pending["quantity"]}


# ────────────────────────────────────────────── Test / dev bypass


class TestBuyPayload(BaseModel):
    quantity: int = Field(..., ge=1, le=MAX_CHAIRS_PER_PURCHASE)
    invite_code: Optional[str] = Field(None, min_length=4, max_length=40)
    payment_ref: str = Field(..., min_length=3, max_length=200)


@router.post("/chairs/test-buy")
async def test_buy_chairs(payload: TestBuyPayload, http_request: Request) -> Dict[str, Any]:
    """
    Preview-only bypass. DOUBLE-GATED:
      • CHAIRS_TEST_MODE=1 (or FOUNDERS_PASS_TEST_MODE=1 — same toggle)
      • ENV != "production"
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    env_name = (os.environ.get("ENV") or os.environ.get("ENVIRONMENT") or "").lower()
    if env_name == "production":
        raise HTTPException(503, "Test buy permanently disabled in production.")
    if (os.environ.get("CHAIRS_TEST_MODE")
            or os.environ.get("FOUNDERS_PASS_TEST_MODE", "0")) != "1":
        raise HTTPException(503, "Test buy disabled. Set CHAIRS_TEST_MODE=1 in backend/.env.")

    db = get_database()
    phase = await _current_phase(db)
    if phase["phase"] == "Sold Out":
        raise HTTPException(410, "All chairs claimed.")

    return await _grant_chairs(
        db, user.user_id,
        quantity=payload.quantity,
        price_per_chair_usd=phase["price_usd"],
        payment_ref=payload.payment_ref,
        invite_code=(payload.invite_code or None),
    )


# ────────────────────────────────────────────── Admin endpoints


@router.get("/admin/chairs/health")
async def vibe_health_index(_: bool = Depends(verify_admin_cookie)) -> Dict[str, Any]:
    """Vibe Health Index — the admin dashboard the user spec'd in the PDF."""
    db = get_database()

    # Lifetime payouts (chair pool + legacy stake pool both flow through
    # profit_share_payouts).
    paid_agg = await db.profit_share_payouts.aggregate([
        {"$group": {"_id": None, "total_coins": {"$sum": "$payout_coins"},
                    "total_usd": {"$sum": "$payout_usd"}, "n": {"$sum": 1}}},
    ]).to_list(length=1)
    total_paid = paid_agg[0] if paid_agg else {"total_coins": 0, "total_usd": 0, "n": 0}

    sold = await _total_chairs_sold(db)

    # Active stakeholders = premium + has chairs.
    active_chair_holders = await db.users.aggregate([
        {"$match": {"subscription_tier": {"$in": ["premium", "diamond", "gold"]}}},
        {"$lookup": {
            "from": "profit_share_balances",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "bal",
        }},
        {"$match": {"bal.locked_chairs": {"$gt": 0}}},
        {"$count": "n"},
    ]).to_list(length=1)
    active_count = int((active_chair_holders or [{}])[0].get("n", 0))

    phase = await _current_phase(db)

    return {
        "lifetime_payouts": {
            "total_coins": int(total_paid["total_coins"]),
            "total_usd": round(float(total_paid["total_usd"]), 2),
            "payout_count": int(total_paid["n"]),
        },
        "chair_inventory": {
            "total_sold": sold,
            "remaining_lifetime": max(0, PHASES[-1]["limit"] - sold),
            "current_phase": phase,
            "phase_breakdown": [
                {"phase": p["name"], "limit": p["limit"],
                 "price_usd": p["price_usd"], "weight": p["weight"]}
                for p in PHASES
            ],
        },
        "active_stakeholders": active_count,
    }


class RunChairQuarterPayload(BaseModel):
    quarter_key: Optional[str] = Field(None, pattern=r"^\d{4}-Q[1-4]$")


@router.post("/admin/chairs/run-quarter")
async def admin_run_chair_quarter(
    payload: RunChairQuarterPayload,
    _: bool = Depends(verify_admin_cookie),
):
    """Manual chair-pool payout. Idempotent on quarter_key."""
    from routes.profit_share import _run_quarter_chair_payout, _quarter_key
    qk = payload.quarter_key or _quarter_key(datetime.now(timezone.utc))
    return await _run_quarter_chair_payout(qk)


# ────────────────────────────────────────────── Grandfather migration


async def _grandfather_genesis_holders():
    """
    One-time backfill (Apr 27 2026): every chair purchased BEFORE the
    multi-phase weight system existed gets stamped as Genius @ 3.0×.
    Idempotent: only touches purchases without a `weight` field.
    """
    db = get_database()
    cur = db.chair_purchases.find(
        {"weight": {"$exists": False}}, {"_id": 1, "user_id": 1, "quantity": 1}
    )
    touched_users: Dict[str, int] = {}
    n_purchases = 0
    async for row in cur:
        n_purchases += 1
        uid = row["user_id"]
        qty = int(row.get("quantity") or 0)
        await db.chair_purchases.update_one(
            {"_id": row["_id"]},
            {"$set": {
                "weight": 3.0,
                "weighted_units": qty * 3.0,
                "phase_at_purchase": "Genius",
                "grandfathered_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        touched_users[uid] = touched_users.get(uid, 0) + qty

    for uid, total_qty in touched_users.items():
        bal = await db.profit_share_balances.find_one(
            {"user_id": uid}, {"_id": 0, "weighted_chairs": 1}
        ) or {}
        cur_weighted = float(bal.get("weighted_chairs") or 0.0)
        target_weighted = total_qty * 3.0
        if cur_weighted < target_weighted:
            await db.profit_share_balances.update_one(
                {"user_id": uid},
                {
                    "$inc": {"weighted_chairs": target_weighted - cur_weighted},
                    "$set": {
                        "grandfathered_genesis": True,
                        "grandfathered_at": datetime.now(timezone.utc).isoformat(),
                    },
                },
            )

    if n_purchases:
        logger.info(
            f"[chairs] Grandfathered {n_purchases} legacy purchases "
            f"({len(touched_users)} unique holders) into Genius @ 3×."
        )
    return {
        "purchases_migrated": n_purchases,
        "users_migrated": len(touched_users),
    }


@router.post("/admin/chairs/grandfather-now")
async def admin_grandfather_now(_: bool = Depends(verify_admin_cookie)) -> Dict[str, Any]:
    """Manual re-run trigger from the dashboard."""
    return await _grandfather_genesis_holders()

