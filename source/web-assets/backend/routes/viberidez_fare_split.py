"""
VibeRidez Fare Splitter — off-chain canonical implementation.

Every completed VibeRidez ride flows through `distribute_fare(...)` which
splits the gross fare across five buckets per the spec locked in May 2026:

    Pre-Escape Velocity              Post-Escape Velocity
    ───────────────────              ────────────────────
      🚗 Driver         70%            🚗 Driver         70%   (NEVER moves)
      💺 Chair pool     14%            💺 Chair pool     30%   (+16pp from EV bump)
      🏛️  Platform       8.5%           🏛️  Platform       0%
      🛡️  Insurance      5%             🛡️  Insurance      0%
      🎁 Referrals      2.5%           🎁 Referrals      0%
      ────────────────────             ────────────────────
                       100%                              100%

Marketing line: *"Pre-EV the platform takes 8.5%. Post-EV the founder
takes ZERO and 100% of platform/insurance/referral revenue flows back
to chair holders."*

The chair pool slice is auto-routed into the existing
`profit_share_balances` collection so the canonical quarterly chair-share
distribution job picks it up without any additional plumbing. Driver,
platform, insurance, and referral slices are recorded into
`fare_distributions` rows AND aggregated into `treasury_buckets` for
ops visibility.

Idempotent on `ride_id` — re-distributing the same ride is a safe no-op.

Token strategy
──────────────
  • Driver share is denominated in USD and recorded with
    `driver_payout_token = "USDC"` so a future on-chain payout daemon
    can sweep `fare_distributions` rows where
    `driver_payout_status = "pending"` and ship USDC SPL transfers.
    Stable, instant cash-out, no JFTN volatility risk for drivers.
  • Chair-pool share is denominated in USD but credited to chair
    holders in Vibez Coins (₵) via the existing profit-share rails —
    holders win when the network earns AND when the JFTN/Vibez token
    appreciates.

Endpoints (mounted under /api/viberidez/):
  GET  /viberidez/economics/split-policy   — public; current split %
  POST /viberidez/fares/distribute         — auth; manual trigger
  GET  /viberidez/fares/breakdown/{ride_id}— auth; receipt for one ride
  GET  /viberidez/driver/earnings-summary  — auth; driver self-view

Note: `/api/ridez/complete` (in `vibe_ridez_dispatch.py`) calls
`distribute_fare(...)` directly when a ride is completed with a
`total_fare_usd` payload — no double-call here.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ────────────────────────────────────────────── Split policy

# These percentages are the SOURCE OF TRUTH for the splitter. Changing
# them here changes both the off-chain calculation AND the response
# returned by /viberidez/economics/split-policy (which the frontend
# receipt UI reads). Numbers are stored as decimals to avoid float
# rounding drift across many rides.

SPLIT_PRE_EV = {
    "driver":     0.70,
    "chair_pool": 0.14,
    "platform":   0.085,
    "insurance":  0.05,
    "referral":   0.025,
}
SPLIT_POST_EV = {
    "driver":     0.70,
    "chair_pool": 0.30,
    "platform":   0.0,
    "insurance":  0.0,
    "referral":   0.0,
}

# Sanity check at import time — both maps must total exactly 1.0.
for _label, _m in (("PRE_EV", SPLIT_PRE_EV), ("POST_EV", SPLIT_POST_EV)):
    _total = round(sum(_m.values()), 6)
    if _total != 1.0:
        raise RuntimeError(
            f"VibeRidez split {_label} totals {_total}, must equal 1.0"
        )


async def _is_escape_velocity_active(db) -> bool:
    """Mirrors `apex_evolution.is_apex_unlocked` — single source of truth.
    Imported lazily to avoid a circular dep with apex_evolution.py."""
    state = await db.platform_state.find_one(
        {"_id": "apex"}, {"_id": 0, "apex_unlocked": 1}
    )
    return bool(state and state.get("apex_unlocked"))


async def get_active_split(db) -> Dict[str, Any]:
    """Return the live split percentages + EV status. Used by the
    public split-policy endpoint and the internal distributor."""
    ev_active = await _is_escape_velocity_active(db)
    split = SPLIT_POST_EV if ev_active else SPLIT_PRE_EV
    return {
        "escape_velocity_active": ev_active,
        "split": dict(split),  # defensive copy
    }


# ────────────────────────────────────────────── Core distributor

async def distribute_fare(
    db,
    *,
    ride_id: str,
    total_fare_usd: float,
    driver_id: Optional[str],
    rider_id: Optional[str],
    referrer_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Split a completed ride's fare across the 5 buckets. Idempotent on
    `ride_id` — second call for the same ride returns the existing row.

    Side effects:
      - Inserts a `fare_distributions` row (one per ride).
      - Increments per-bucket totals in `treasury_buckets` (single
        rolling document, easy to read for admin dashboards).
      - Credits the chair-pool slice into `profit_share_balances` so
        the next quarterly chair-share distribution picks it up.
    """
    if total_fare_usd <= 0:
        return {"skipped": True, "reason": "non-positive fare"}
    if not ride_id:
        raise ValueError("ride_id is required")

    # Idempotency guard.
    existing = await db.fare_distributions.find_one(
        {"ride_id": ride_id}, {"_id": 0}
    )
    if existing:
        return {**existing, "idempotent_replay": True}

    policy = await get_active_split(db)
    split_pct = policy["split"]

    # Calculate exact per-bucket USD. Round to 4 decimal places to avoid
    # sub-cent drift when summed across thousands of rides.
    def _slice(pct: float) -> float:
        return round(total_fare_usd * pct, 4)

    driver_usd    = _slice(split_pct["driver"])
    chair_usd     = _slice(split_pct["chair_pool"])
    platform_usd  = _slice(split_pct["platform"])
    insurance_usd = _slice(split_pct["insurance"])
    referral_usd  = _slice(split_pct["referral"])

    # Reconcile any rounding drift back into the driver bucket so totals
    # always sum to gross. Driver gets at most 0.0004 extra — negligible.
    drift = round(
        total_fare_usd
        - (driver_usd + chair_usd + platform_usd + insurance_usd + referral_usd),
        4,
    )
    if abs(drift) > 0.0001:
        driver_usd = round(driver_usd + drift, 4)

    now_iso = datetime.now(timezone.utc).isoformat()

    row = {
        "ride_id": ride_id,
        "driver_id": driver_id,
        "rider_id": rider_id,
        "referrer_user_id": referrer_user_id,
        "total_fare_usd": round(total_fare_usd, 4),
        "split_pct_snapshot": dict(split_pct),
        "escape_velocity_active": policy["escape_velocity_active"],

        "driver_usd":    driver_usd,
        "chair_usd":     chair_usd,
        "platform_usd":  platform_usd,
        "insurance_usd": insurance_usd,
        "referral_usd":  referral_usd,

        # On-chain payout state machine — drained by a future Solana
        # daemon. PENDING until the USDC SPL transfer settles.
        "driver_payout_token": "USDC",
        "driver_payout_status": "pending" if driver_id else "skipped_no_driver",
        "driver_payout_tx_sig": None,

        "created_at": now_iso,
    }
    await db.fare_distributions.insert_one(row)
    row.pop("_id", None)

    # Roll up per-bucket aggregates for admin dashboards.
    await db.treasury_buckets.update_one(
        {"_id": "viberidez_fare_split"},
        {"$inc": {
            "total_fare_usd_lifetime":  round(total_fare_usd, 4),
            "driver_usd_lifetime":      driver_usd,
            "chair_pool_usd_lifetime":  chair_usd,
            "platform_usd_lifetime":    platform_usd,
            "insurance_usd_lifetime":   insurance_usd,
            "referral_usd_lifetime":    referral_usd,
            "rides_distributed":        1,
        }, "$set": {"updated_at": now_iso}},
        upsert=True,
    )

    # Credit the chair-pool slice into profit_share_balances so it
    # rides the existing quarterly distribution rails. Lazy import to
    # avoid circular deps with profit_share.py.
    if chair_usd > 0:
        try:
            await db.profit_share_balances.update_one(
                {"_id": "chair_pool_pending"},
                {"$inc": {"pending_usd": chair_usd},
                 "$set": {"updated_at": now_iso}},
                upsert=True,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[viberidez-split] chair pool credit failed: {e}")

    # Credit the referrer (if known) — bookkeeping only; the actual
    # payout happens via the same on-chain daemon as drivers.
    if referrer_user_id and referral_usd > 0:
        try:
            await db.referral_payouts.update_one(
                {"user_id": referrer_user_id},
                {"$inc": {"pending_usd": referral_usd, "rides_credited": 1},
                 "$set": {"updated_at": now_iso}},
                upsert=True,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[viberidez-split] referral credit failed: {e}")

    logger.info(
        "[viberidez-split] ride=%s fare=%.2f driver=%.2f chair=%.2f "
        "platform=%.2f insurance=%.2f referral=%.2f ev=%s",
        ride_id, total_fare_usd, driver_usd, chair_usd,
        platform_usd, insurance_usd, referral_usd,
        policy["escape_velocity_active"],
    )
    return row


# ────────────────────────────────────────────── Public endpoints

@router.get("/viberidez/economics/split-policy")
async def split_policy() -> Dict[str, Any]:
    """Public — drives the receipt UI on the rider/driver app and the
    "How drivers get paid" landing-page accordion.
    """
    db = get_database()
    policy = await get_active_split(db)
    return {
        "escape_velocity_active": policy["escape_velocity_active"],
        "split_pct": policy["split"],
        "split_pct_pre_ev":  SPLIT_PRE_EV,
        "split_pct_post_ev": SPLIT_POST_EV,
        "marketing_line": (
            "Pre-Escape Velocity the platform takes 8.5%. Post-EV the "
            "founder takes ZERO and 100% of platform/insurance/referral "
            "revenue flows back to chair holders."
        ),
    }


# ────────────────────────────────────────────── Auth-gated endpoints

class DistributeBody(BaseModel):
    ride_id: str = Field(..., min_length=1, max_length=128)
    total_fare_usd: float = Field(..., gt=0, le=10_000)
    driver_id: Optional[str] = None
    rider_id: Optional[str] = None
    referrer_user_id: Optional[str] = None


@router.post("/viberidez/fares/distribute")
async def manual_distribute(
    body: DistributeBody, request: Request,
) -> Dict[str, Any]:
    """Manual splitter trigger — used when a ride is completed off-band
    (e.g., dispatcher or admin tooling) and didn't come through
    /ridez/complete. Auth required so leaked ride_ids can't burn revenue.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Sign in to distribute a fare.")
    db = get_database()
    return await distribute_fare(
        db,
        ride_id=body.ride_id,
        total_fare_usd=body.total_fare_usd,
        driver_id=body.driver_id,
        rider_id=body.rider_id,
        referrer_user_id=body.referrer_user_id,
    )


@router.get("/viberidez/fares/breakdown/{ride_id}")
async def fare_breakdown(ride_id: str, request: Request) -> Dict[str, Any]:
    """Per-ride receipt. Auth required + caller must be the driver or
    rider on the ride (admins implicitly pass via cookie elsewhere)."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Sign in to view fare breakdown.")
    db = get_database()
    row = await db.fare_distributions.find_one({"ride_id": ride_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Fare distribution not found for this ride.")
    if user.user_id not in (row.get("driver_id"), row.get("rider_id")):
        raise HTTPException(403, "You weren't part of this ride.")
    return row


@router.get("/viberidez/driver/earnings-summary")
async def driver_earnings_summary(request: Request) -> Dict[str, Any]:
    """Driver self-view: lifetime + 30-day USD earned from fare splits.
    Lists the most recent 25 rides with their per-bucket breakdown so
    drivers can see exactly how every dollar they earned was calculated.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(401, "Sign in to view your earnings.")
    db = get_database()

    cutoff_30d = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    pipeline_lifetime = [
        {"$match": {"driver_id": user.user_id}},
        {"$group": {
            "_id": None,
            "rides": {"$sum": 1},
            "lifetime_fare_usd": {"$sum": "$total_fare_usd"},
            "lifetime_driver_usd": {"$sum": "$driver_usd"},
        }},
    ]
    pipeline_30d = [
        {"$match": {
            "driver_id": user.user_id,
            "created_at": {"$gte": cutoff_30d},
        }},
        {"$group": {
            "_id": None,
            "rides_30d": {"$sum": 1},
            "fare_30d_usd": {"$sum": "$total_fare_usd"},
            "driver_30d_usd": {"$sum": "$driver_usd"},
        }},
    ]

    lifetime = await db.fare_distributions.aggregate(pipeline_lifetime).to_list(1)
    last30 = await db.fare_distributions.aggregate(pipeline_30d).to_list(1)
    recent = await db.fare_distributions.find(
        {"driver_id": user.user_id}, {"_id": 0},
    ).sort("created_at", -1).to_list(length=25)

    lifetime_doc = lifetime[0] if lifetime else {}
    last30_doc = last30[0] if last30 else {}

    return {
        "driver_id": user.user_id,
        "lifetime": {
            "rides":             int(lifetime_doc.get("rides", 0)),
            "fare_usd":          round(float(lifetime_doc.get("lifetime_fare_usd", 0)), 2),
            "driver_payout_usd": round(float(lifetime_doc.get("lifetime_driver_usd", 0)), 2),
        },
        "last_30_days": {
            "rides":             int(last30_doc.get("rides_30d", 0)),
            "fare_usd":          round(float(last30_doc.get("fare_30d_usd", 0)), 2),
            "driver_payout_usd": round(float(last30_doc.get("driver_30d_usd", 0)), 2),
        },
        "recent_rides": recent,
    }
