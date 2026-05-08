"""
Vibe Stakes — Profit-Sharing Program (NOT a security).

This is a loyalty / revenue-share system. Members accrue "Vibe Stakes"
through Premium membership + platform activity. Every quarter, the
platform automatically distributes a cut of revenue across stakeholders
weighted by their stake count, with a 1.5× boost for Premium members.

Why this is NOT a security (and doesn't need SEC registration):
  • Members do not BUY stakes — they EARN them through usage.
  • Stakes are non-transferable (no member-to-member exchange).
  • Payouts are bonus distributions, not dividends on owned property.
  • There is no expectation of capital appreciation — stakes don't have
    a "price". They're a counter, like frequent-flyer miles.

Patreon, Substack, Twitch Partner, Roblox DevEx, Spotify all run on
this exact legal structure. No filing required.

Endpoints (all under /api/profit-share):
  GET  /me                       — my stake balance + projected next payout
  GET  /pool                     — current quarter's pool stats (public)
  POST /accrue                   — internal helper, used by other modules
  GET  /history                  — my past payouts
  POST /admin/run-quarter        — admin-cookie-gated manual trigger
  GET  /admin/leaderboard        — top 50 stakeholders

Background:
  • A scheduler (`profit_share_scheduler`) runs every 6h, checks if today
    is the start of a new quarter (Jan 1 / Apr 1 / Jul 1 / Oct 1 UTC),
    and fires the payout exactly once per quarter (idempotent via the
    `profit_share_quarters` collection).
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin_dashboard import verify_admin_cookie
from routes.god_mode_audit import record_god_event

logger = logging.getLogger(__name__)
router = APIRouter()

# ─────────────────────────── Configuration ──

# How much of platform revenue goes to the stake pool. Default 20%.
PROFIT_SHARE_RATIO = float(os.environ.get("PROFIT_SHARE_RATIO", "0.20"))

# Premium members get a 1.5× boost on every payout.
PREMIUM_DIVIDEND_MULTIPLIER = 1.5

# Stake accrual rates per source.
ACCRUAL_RATES = {
    "premium_renewal":     200,   # +200 stakes for renewing Premium each month
    "ride_completed":        2,   # +2 per VibeRidez ride completed
    "vibez_654_played":      1,   # +1 per Vibez 654 round
    "card_game_played":      3,   # +3 per Spades / BidWhist hand finished
    "jftn_room_visited":     1,   # +1 per JFTN visit
    "vibe_call_minute":      1,   # +1 per minute on a Vibe Call
    "deposit_usd":          10,   # +10 per $1 deposited via Solana indexer
    "creator_revenue":      30,   # +30 per $1 a creator earns (3× deposit rate)
    "manual_admin_grant":    0,   # admin discretion
}

# Currency conversion: 1 USD payout = 100 ₵ Vibez Coins.
USD_TO_VIBEZ_COINS = 100

# Premium tier names that qualify for the 1.5× boost.
PREMIUM_TIERS = {"diamond", "gold", "premium"}

# ─── Vibe Peak surge multiplier ─────────────────────────────────
# When the platform crosses an activity threshold, all stake accruals
# get a 2× multiplier for SURGE_TTL_SEC. The flag lives in MongoDB so
# multi-process deploys see the same state.
SURGE_MULTIPLIER = 2.0
SURGE_TTL_SEC = 24 * 60 * 60
SURGE_ACTIVITY_WINDOW_MIN = 60      # measure DAU in last 60 min
SURGE_THRESHOLD_EVENTS = 50         # 50 stake-events in 60 min triggers surge

# Demo / placeholder revenue figure used when there's no real revenue feed.
# Once Stripe / Solana indexer revenue is plumbed in, this becomes
# meaningless and the scheduler reads from a real total.
DEMO_QUARTERLY_PROFIT_USD = float(os.environ.get("PROFIT_SHARE_DEMO_PROFIT", "10000"))


# ─────────────────────────── Helpers ──

def _quarter_key(d: datetime) -> str:
    """Return 'YYYY-Qn' for the given datetime (UTC)."""
    q = (d.month - 1) // 3 + 1
    return f"{d.year}-Q{q}"


def _next_quarter_start(d: datetime) -> datetime:
    """Return the first instant of the next quarter (UTC)."""
    q = (d.month - 1) // 3 + 1
    if q == 4:
        return datetime(d.year + 1, 1, 1, tzinfo=timezone.utc)
    next_first_month = q * 3 + 1
    return datetime(d.year, next_first_month, 1, tzinfo=timezone.utc)


async def _is_premium(db, user_id: str) -> bool:
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "subscription_tier": 1}) or {}
    return (u.get("subscription_tier") or "free").lower() in PREMIUM_TIERS


async def _surge_state(db) -> Dict[str, Any]:
    """Return current surge status. Auto-expires when TTL passes."""
    now = datetime.now(timezone.utc)
    rec = await db.profit_share_surge.find_one({"_id": "current"}, {"_id": 0})
    if not rec or not rec.get("active_until"):
        return {"active": False, "expires_at": None, "multiplier": 1.0}
    try:
        until = datetime.fromisoformat(rec["active_until"].replace("Z", "+00:00"))
    except Exception:
        return {"active": False, "expires_at": None, "multiplier": 1.0}
    if until <= now:
        return {"active": False, "expires_at": None, "multiplier": 1.0}
    return {"active": True, "expires_at": rec["active_until"], "multiplier": SURGE_MULTIPLIER}


async def _maybe_trigger_surge(db) -> None:
    """Check the last hour's accrual count; flip surge ON if we crossed
    the threshold and aren't already surging. Cheap — runs on every accrue."""
    state = await _surge_state(db)
    if state["active"]:
        return
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=SURGE_ACTIVITY_WINDOW_MIN)).isoformat()
    count = await db.profit_share_accruals.count_documents({"at": {"$gte": cutoff}})
    if count >= SURGE_THRESHOLD_EVENTS:
        active_until = (datetime.now(timezone.utc) + timedelta(seconds=SURGE_TTL_SEC)).isoformat()
        await db.profit_share_surge.update_one(
            {"_id": "current"},
            {"$set": {
                "active_until": active_until,
                "triggered_at": datetime.now(timezone.utc).isoformat(),
                "trigger_event_count": count,
            }},
            upsert=True,
        )
        logger.info(f"[profit-share] Vibe Peak surge ON ({count} events in 60min) until {active_until}")


# ─────────────────────────── Stake accrual ──

async def accrue_stake(
    user_id: str,
    source: str,
    amount: Optional[int] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> int:
    """
    Public helper — call from anywhere in the codebase to grant a member
    stakes for an action. Returns the number of stakes granted (after
    surge multiplier if active).

    Examples:
        await accrue_stake(uid, "ride_completed")
        await accrue_stake(uid, "deposit_usd", amount=25)  # 25 * 10 = 250 stakes
        await accrue_stake(uid, "manual_admin_grant", amount=5000)
    """
    rate = ACCRUAL_RATES.get(source, 0)
    if amount is None:
        granted = rate
    else:
        # If a per-unit rate is defined for this source, multiply; otherwise
        # treat `amount` as the literal stake count.
        granted = (rate * int(amount)) if rate > 0 else int(amount)

    if granted <= 0:
        return 0

    db = get_database()

    # Apply Founders Pass multiplier (permanent, per-user) BEFORE surge.
    # Multipliers stack: Founders Pass × Surge.
    user_doc = await db.users.find_one(
        {"user_id": user_id}, {"_id": 0, "founders_pass_multiplier": 1}
    ) or {}
    fp_mult = float(user_doc.get("founders_pass_multiplier") or 1.0)
    if fp_mult > 1.0:
        granted = int(round(granted * fp_mult))

    # Apply surge multiplier if active.
    surge = await _surge_state(db)
    if surge["active"]:
        granted = int(round(granted * surge["multiplier"]))

    await db.profit_share_accruals.insert_one({
        "user_id": user_id,
        "source": source,
        "stakes": granted,
        "founders_pass_mult_applied": fp_mult if fp_mult > 1.0 else None,
        "surge_applied": surge["active"],
        "meta": meta or {},
        "at": datetime.now(timezone.utc).isoformat(),
    })
    await db.profit_share_balances.update_one(
        {"user_id": user_id},
        {
            "$inc": {"current_stakes": granted, "lifetime_stakes": granted},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
        upsert=True,
    )
    # Cheap surge-trigger check (no-op once already active).
    try:
        await _maybe_trigger_surge(db)
    except Exception:
        pass
    return granted


# ─────────────────────────── Public endpoints ──

class AccruePayload(BaseModel):
    source: str
    amount: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None


@router.post("/profit-share/accrue")
async def accrue(payload: AccruePayload, http_request: Request):
    """
    Member-driven accrual (for activity that's user-triggered like
    'jftn_room_visited'). Anti-abuse: only whitelisted sources, and the
    source list excludes admin grants.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if payload.source == "manual_admin_grant":
        raise HTTPException(403, "Admin sources only granted via /admin endpoint.")
    if payload.source not in ACCRUAL_RATES:
        raise HTTPException(400, f"Unknown source. Valid: {sorted(ACCRUAL_RATES.keys())}")
    granted = await accrue_stake(user.user_id, payload.source, payload.amount, payload.meta)
    return {"granted": granted, "source": payload.source}


@router.get("/profit-share/me")
async def my_stakes(http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()

    bal = await db.profit_share_balances.find_one(
        {"user_id": user.user_id}, {"_id": 0}
    ) or {"current_stakes": 0, "lifetime_stakes": 0}

    is_prem = await _is_premium(db, user.user_id)

    # Project next payout based on the current pool.
    pool = await _pool_snapshot(db)
    my_share = 0.0
    my_payout_usd = 0.0
    my_payout_coins = 0
    if pool["total_stakes"] > 0 and bal["current_stakes"] > 0:
        my_share = bal["current_stakes"] / pool["total_stakes"]
        my_payout_usd = my_share * pool["pool_usd"]
        if is_prem:
            my_payout_usd *= PREMIUM_DIVIDEND_MULTIPLIER
        my_payout_coins = int(round(my_payout_usd * USD_TO_VIBEZ_COINS))

    return {
        "user_id": user.user_id,
        "current_stakes": int(bal["current_stakes"]),
        "lifetime_stakes": int(bal["lifetime_stakes"]),
        "is_premium": is_prem,
        "premium_multiplier": PREMIUM_DIVIDEND_MULTIPLIER if is_prem else 1.0,
        "next_quarter_start": _next_quarter_start(datetime.now(timezone.utc)).isoformat(),
        "projected_share_pct": round(my_share * 100, 4),
        "projected_payout_usd": round(my_payout_usd, 2),
        "projected_payout_coins": my_payout_coins,
    }


async def _pool_snapshot(db) -> Dict[str, Any]:
    """Current quarter's pool snapshot."""
    agg = await db.profit_share_balances.aggregate([
        {"$group": {"_id": None, "total_stakes": {"$sum": "$current_stakes"}, "members": {"$sum": 1}}},
    ]).to_list(length=1)
    total_stakes = int(agg[0]["total_stakes"]) if agg else 0
    members = int(agg[0]["members"]) if agg else 0
    pool_usd = DEMO_QUARTERLY_PROFIT_USD * PROFIT_SHARE_RATIO
    return {
        "total_stakes": total_stakes,
        "stakeholders": members,
        "quarterly_profit_usd": DEMO_QUARTERLY_PROFIT_USD,
        "profit_share_ratio": PROFIT_SHARE_RATIO,
        "pool_usd": round(pool_usd, 2),
        "pool_coins": int(round(pool_usd * USD_TO_VIBEZ_COINS)),
    }


@router.get("/profit-share/pool")
async def pool_snapshot():
    db = get_database()
    snap = await _pool_snapshot(db)
    surge = await _surge_state(db)
    return {
        **snap,
        "quarter_key": _quarter_key(datetime.now(timezone.utc)),
        "next_quarter_start": _next_quarter_start(datetime.now(timezone.utc)).isoformat(),
        "premium_multiplier": PREMIUM_DIVIDEND_MULTIPLIER,
        "currency": "₵ Vibez Coins",
        "usd_to_coins_rate": USD_TO_VIBEZ_COINS,
        "surge": surge,
    }


# ────────────── Treasury — public read-only dashboard data ──

@router.get("/profit-share/treasury")
async def treasury_dashboard():
    """
    Public Treasury Report — replaces the manifest's "GVPX governance"
    panel. Shows pool, last-quarter payout total, top stakeholders
    (anonymized), reserve fund balance, and surge state.

    Read-only. No member-by-member identification.
    """
    db = get_database()

    snap = await _pool_snapshot(db)
    surge = await _surge_state(db)

    # Last completed quarter (most recent profit_share_quarters row).
    last_q = await db.profit_share_quarters.find_one(
        {}, {"_id": 0}, sort=[("ran_at", -1)]
    ) or {}

    # Anonymized top stakeholder list — we slice the user_id so individual
    # members aren't deanonymized in a public dashboard.
    top_cursor = db.profit_share_balances.find(
        {"current_stakes": {"$gt": 0}},
        {"_id": 0, "user_id": 1, "current_stakes": 1, "lifetime_stakes": 1},
    ).sort("current_stakes", -1).limit(10)
    top_rows = await top_cursor.to_list(length=10)
    leaderboard = [
        {
            "anon_id": (r["user_id"][:6] + "…" + r["user_id"][-2:])
            if len(r["user_id"]) > 10 else r["user_id"],
            "current_stakes": int(r["current_stakes"]),
            "lifetime_stakes": int(r.get("lifetime_stakes", 0)),
        }
        for r in top_rows
    ]

    # Reserve fund (file 39 v3 → 30% of subscription rake).
    reserve = await db.gvdsg_reserve.find_one(
        {"_id": "stability_reserve"}, {"_id": 0}
    ) or {"balance_usd": 0.0}

    return {
        "current_quarter": {
            "key": _quarter_key(datetime.now(timezone.utc)),
            "pool_coins": snap["pool_coins"],
            "pool_usd": snap["pool_usd"],
            "stakeholders": snap["stakeholders"],
            "total_stakes": snap["total_stakes"],
        },
        "last_quarter": {
            "key": last_q.get("quarter_key"),
            "stakeholders_paid": int(last_q.get("stakeholders", 0)),
            "premium_count": int(last_q.get("premium_count", 0)),
            "actually_paid_coins": int(last_q.get("actually_paid_coins", 0)),
            "actually_paid_usd": float(last_q.get("actually_paid_usd", 0)),
            "ran_at": last_q.get("ran_at"),
        },
        "stability_reserve_usd": float(reserve.get("balance_usd", 0)),
        "leaderboard": leaderboard,
        "surge": surge,
    }


@router.get("/profit-share/surge")
async def surge_status():
    """Quick public endpoint for UIs that just want the surge banner."""
    return await _surge_state(get_database())


@router.get("/profit-share/history")
async def my_history(http_request: Request, limit: int = 50):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    cursor = db.profit_share_payouts.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("paid_at", -1).limit(min(max(1, limit), 200))
    rows = await cursor.to_list(length=limit)
    total = sum(int(r.get("payout_coins", 0)) for r in rows)
    return {"count": len(rows), "rows": rows, "total_coins_received": total}


# ─────────────────────────── Quarterly distribution ──

async def _run_quarter_payout(quarter_key: str, profit_usd: float) -> Dict[str, Any]:
    """
    The actual payout engine. Iterates every stakeholder, computes their
    weighted share, applies the Premium multiplier, credits their ₵
    balance, and rolls their `current_stakes` to zero so the next quarter
    starts fresh. Persists per-payout rows for the user's history.

    IDEMPOTENT — if `quarter_key` is already in `profit_share_quarters`,
    the call returns the existing run rather than double-paying.
    """
    db = get_database()

    # Idempotence guard
    existing = await db.profit_share_quarters.find_one({"quarter_key": quarter_key}, {"_id": 0})
    if existing:
        return {**existing, "already_distributed": True}

    pool_usd = profit_usd * PROFIT_SHARE_RATIO
    pool_coins = int(round(pool_usd * USD_TO_VIBEZ_COINS))

    snapshot = await _pool_snapshot(db)
    total_stakes = snapshot["total_stakes"]
    if total_stakes <= 0:
        # Nothing to distribute. Mark the quarter handled so the scheduler
        # doesn't keep retrying.
        record = {
            "quarter_key": quarter_key,
            "profit_usd": profit_usd,
            "pool_usd": pool_usd,
            "pool_coins": pool_coins,
            "total_stakes": 0,
            "stakeholders": 0,
            "actually_paid_usd": 0,
            "actually_paid_coins": 0,
            "premium_count": 0,
            "ran_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.profit_share_quarters.insert_one(record)
        return record

    cursor = db.profit_share_balances.find(
        {"current_stakes": {"$gt": 0}}, {"_id": 0, "user_id": 1, "current_stakes": 1}
    )
    paid_usd = 0.0
    paid_coins = 0
    paid_count = 0
    premium_count = 0
    paid_at = datetime.now(timezone.utc).isoformat()

    async for row in cursor:
        uid = row["user_id"]
        stakes = int(row["current_stakes"])
        if stakes <= 0:
            continue
        share = stakes / total_stakes
        member_usd = share * pool_usd
        is_prem = await _is_premium(db, uid)
        if is_prem:
            member_usd *= PREMIUM_DIVIDEND_MULTIPLIER
            premium_count += 1
        member_coins = int(round(member_usd * USD_TO_VIBEZ_COINS))

        # Credit the member's ₵ balance — automatic payment.
        await db.users.update_one(
            {"user_id": uid},
            {"$inc": {"credits_balance": member_coins}},
            upsert=False,
        )

        # Write per-member payout row + reset their current_stakes for next quarter.
        await db.profit_share_payouts.insert_one({
            "user_id": uid,
            "quarter_key": quarter_key,
            "stakes_at_payout": stakes,
            "share_pct": round(share * 100, 6),
            "payout_usd": round(member_usd, 4),
            "payout_coins": member_coins,
            "premium_boost_applied": is_prem,
            "paid_at": paid_at,
        })
        await db.profit_share_balances.update_one(
            {"user_id": uid},
            {"$set": {
                "current_stakes": 0,
                "last_payout_at": paid_at,
                "last_payout_quarter": quarter_key,
            }},
        )

        await record_god_event(
            uid, "PROFIT_SHARE_PAYOUT", member_usd,
            meta={"quarter": quarter_key, "stakes": stakes, "premium": is_prem, "coins": member_coins},
        )

        paid_usd += member_usd
        paid_coins += member_coins
        paid_count += 1

    record = {
        "quarter_key": quarter_key,
        "profit_usd": profit_usd,
        "pool_usd": pool_usd,
        "pool_coins": pool_coins,
        "total_stakes": total_stakes,
        "stakeholders": paid_count,
        "premium_count": premium_count,
        "actually_paid_usd": round(paid_usd, 2),
        "actually_paid_coins": paid_coins,
        "ran_at": paid_at,
    }
    await db.profit_share_quarters.insert_one(record)
    logger.info(
        f"[profit-share] {quarter_key}: paid {paid_count} members, "
        f"${paid_usd:.2f} USD ({paid_coins:,} ₵), {premium_count} premium boosted"
    )
    return record


# ─────────────────────────── Chair-pool quarterly payout ──
# User's "Master Deployment Plan" requested chairs to be the primary
# weight for quarterly distributions (premium-gated). This runs ALONGSIDE
# the legacy stake-based payout above. Both share `profit_share_payouts`
# for member history + audit, and both record idempotently.
#
# Pool split: 70% to chair holders, 30% legacy stakes (already paid above).

CHAIR_POOL_RATIO_PRE_EV = 0.70   # of the same quarterly pool — pre-Escape Velocity (= 14% of profit when PROFIT_SHARE_RATIO=0.20)
CHAIR_POOL_RATIO_POST_EV = 1.50  # post-Escape Velocity bump → 30% of profit when PROFIT_SHARE_RATIO=0.20

# Back-compat alias — keep so any caller still importing the old constant
# gets the pre-EV value (no surprise behavioural changes for legacy code).
CHAIR_POOL_RATIO = CHAIR_POOL_RATIO_PRE_EV


async def _current_chair_pool_ratio(db) -> float:
    """Resolve the live chair-pool ratio against the Escape Velocity flag.

    Pre-EV: 0.70 (= 14% of profit, current behaviour).
    Post-EV: 1.50 (= 30% of profit, the founder-promised bump).

    The 30% number is the policy commitment; 1.50 is just the multiplier
    that gets us there given PROFIT_SHARE_RATIO=0.20 (1.50 × 0.20 = 0.30).
    If the founder ever bumps PROFIT_SHARE_RATIO, the chair share scales
    proportionally — that's a feature, not a bug, and matches how the
    overall stake pool moves.

    Source of truth = `platform_state.apex.apex_unlocked` set by the
    ApexEvolution `_activate_apex` helper (the same God-Mode "Pull the
    Switch" lever). We avoid module-side imports of apex_evolution here
    so this module stays standalone-loadable in tests.
    """
    state = await db.platform_state.find_one(
        {"_id": "apex"}, {"_id": 0, "apex_unlocked": 1}
    ) or {}
    return CHAIR_POOL_RATIO_POST_EV if state.get("apex_unlocked") else CHAIR_POOL_RATIO_PRE_EV


async def _run_quarter_chair_payout(quarter_key: str) -> Dict[str, Any]:
    """
    Chair-based distribution. Premium-gated: chair holders without an
    active premium subscription receive nothing from the chair pool that
    quarter (their chairs persist; just no payout this cycle).

    Idempotent — `profit_share_chair_quarters._id == quarter_key`.
    """
    db = get_database()

    existing = await db.profit_share_chair_quarters.find_one(
        {"quarter_key": quarter_key}, {"_id": 0}
    )
    if existing:
        return {**existing, "already_distributed": True}

    # Apply Economy Control safety multiplier — when reserve coverage is
    # low, payouts scale down (never below 50%). Emergency lock = 0×.
    try:
        from routes.economy_control import (
            calculate_safety_multiplier,
            _reserve_balance,
            _total_chair_liability,
            _get_config,
        )
        cfg = await _get_config(db)
        if cfg.get("emergency_lock"):
            logger.warning(f"[chair-pool] {quarter_key}: emergency_lock active, skipping payout")
            return {
                "quarter_key": quarter_key,
                "skipped": True,
                "reason": "emergency_lock_active",
            }
        reserve = await _reserve_balance(db)
        liability = await _total_chair_liability(db)
        safety_mult = calculate_safety_multiplier(reserve, liability)
    except Exception as e:
        logger.warning(f"[chair-pool] safety multiplier check failed, defaulting 1.0: {e}")
        safety_mult = 1.0

    snap = await _pool_snapshot(db)
    chair_pool_ratio = await _current_chair_pool_ratio(db)
    chair_pool_usd = snap["pool_usd"] * chair_pool_ratio * safety_mult

    # Aggregate active chair holders (premium AND chairs > 0).
    # Read both chair count AND weighted_chairs (Genius 3× / Genesis 2×
    # / Standard 1×) so payouts are weighted by earn-rate multiplier.
    active = await db.profit_share_balances.aggregate([
        {"$match": {"locked_chairs": {"$gt": 0}}},
        {"$lookup": {
            "from": "users",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "u",
        }},
        {"$match": {"u.subscription_tier": {"$in": list(PREMIUM_TIERS)}}},
        {"$project": {
            "_id": 0,
            "user_id": 1,
            "locked_chairs": 1,
            "weighted_chairs": 1,
        }},
    ]).to_list(length=200_000)

    # Total WEIGHTED chairs is the denominator. Falls back to raw count
    # for any legacy row that hasn't been migrated yet.
    def _weight_of(row):
        return float(row.get("weighted_chairs") or row.get("locked_chairs") or 0)

    total_weighted = sum(_weight_of(r) for r in active)
    total_active_chairs = sum(int(r["locked_chairs"]) for r in active)

    paid_usd = 0.0
    paid_coins = 0
    paid_count = 0
    paid_at = datetime.now(timezone.utc).isoformat()

    if total_weighted > 0:
        for row in active:
            uid = row["user_id"]
            chairs = int(row["locked_chairs"])
            weight_units = _weight_of(row)
            share = weight_units / total_weighted
            member_usd = share * chair_pool_usd
            member_coins = int(round(member_usd * USD_TO_VIBEZ_COINS))

            # Credit ₵ wallet.
            await db.users.update_one(
                {"user_id": uid},
                {"$inc": {"credits_balance": member_coins}},
            )
            await db.profit_share_payouts.insert_one({
                "user_id": uid,
                "quarter_key": quarter_key,
                "source": "chair_pool",
                "chairs_at_payout": chairs,
                "weighted_chairs_at_payout": round(weight_units, 4),
                "share_pct": round(share * 100, 6),
                "payout_usd": round(member_usd, 4),
                "payout_coins": member_coins,
                "premium_boost_applied": True,
                "paid_at": paid_at,
            })
            await record_god_event(
                uid, "CHAIR_POOL_PAYOUT", member_usd,
                meta={
                    "quarter": quarter_key, "chairs": chairs,
                    "weighted_chairs": round(weight_units, 4),
                    "coins": member_coins,
                },
            )
            paid_usd += member_usd
            paid_coins += member_coins
            paid_count += 1

    record = {
        "quarter_key": quarter_key,
        "chair_pool_usd": round(chair_pool_usd, 2),
        "total_active_chairs": total_active_chairs,
        "total_weighted_chairs": round(total_weighted, 4),
        "premium_chair_holders_paid": paid_count,
        "actually_paid_usd": round(paid_usd, 2),
        "actually_paid_coins": paid_coins,
        "ran_at": paid_at,
    }
    try:
        await db.profit_share_chair_quarters.insert_one(record)
    except Exception as e:
        # Race against the unique index on quarter_key — another worker
        # already wrote this quarter. Return the existing record so the
        # caller sees a clean "already_distributed" response.
        logger.info(f"[chair-pool] {quarter_key}: quarter already recorded ({e}); returning existing")
        existing = await db.profit_share_chair_quarters.find_one(
            {"quarter_key": quarter_key}, {"_id": 0}
        )
        if existing:
            return {**existing, "already_distributed": True}
        raise
    logger.info(
        f"[chair-pool] {quarter_key}: paid {paid_count} chair holders, "
        f"${paid_usd:.2f} USD ({paid_coins:,} ₵), {total_active_chairs} chairs"
    )
    return record


# ─────────────────────────── Admin endpoints ──

class RunQuarterPayload(BaseModel):
    quarterly_profit_usd: Optional[float] = Field(default=None, ge=0)
    quarter_key: Optional[str] = Field(default=None, pattern=r"^\d{4}-Q[1-4]$")


@router.post("/admin/profit-share/run-quarter")
async def admin_run_quarter(
    payload: RunQuarterPayload,
    _: bool = Depends(verify_admin_cookie),
):
    """
    Manual quarter-close trigger. Idempotent — calling twice for the same
    quarter is a no-op.
    """
    profit = payload.quarterly_profit_usd if payload.quarterly_profit_usd is not None else DEMO_QUARTERLY_PROFIT_USD
    qk = payload.quarter_key or _quarter_key(datetime.now(timezone.utc))
    return await _run_quarter_payout(qk, profit)


@router.get("/admin/profit-share/leaderboard")
async def stakeholder_leaderboard(_: bool = Depends(verify_admin_cookie), limit: int = 50):
    db = get_database()
    cursor = db.profit_share_balances.find(
        {"current_stakes": {"$gt": 0}}, {"_id": 0}
    ).sort("current_stakes", -1).limit(min(max(1, limit), 500))
    rows = await cursor.to_list(length=limit)
    return {"count": len(rows), "rows": rows}


# ─────────────────────────── Background scheduler ──

async def profit_share_scheduler() -> None:
    """
    Long-running coroutine started in server.py's startup hook. Sleeps for
    6h between checks. When the wall clock crosses into a new quarter, the
    payout engine fires exactly once (idempotent).
    """
    last_seen_quarter: Optional[str] = None
    while True:
        try:
            now = datetime.now(timezone.utc)
            qk = _quarter_key(now)
            # On the very first tick after deploy, lock in the current
            # quarter so we don't pay out for one we haven't accrued in.
            if last_seen_quarter is None:
                last_seen_quarter = qk
            elif qk != last_seen_quarter:
                # Quarter rolled — pay out the PREVIOUS quarter's pool.
                logger.info(f"[profit-share] quarter rollover detected: {last_seen_quarter} → {qk}")
                await _run_quarter_payout(last_seen_quarter, DEMO_QUARTERLY_PROFIT_USD)
                last_seen_quarter = qk
        except Exception as e:
            logger.warning(f"[profit-share] scheduler tick error: {e}")
        # Check every 6h. Cheap, deterministic.
        await asyncio.sleep(6 * 60 * 60)
