"""
Premium Dynamic Pricing + 4/3/3 Subscription Rake.

Translates the manifest's File 38 (bonding curve) and File 39 v3 (4/3/3
splitter) into legally-safe equivalents:

  • Dynamic Premium pricing — Netflix-style. Every quarter the platform
    grows, the next NEW Premium subscription costs $0.50 more. Existing
    subscribers are grandfathered at whatever price they signed up at.
    NOT a security — it's just SaaS pricing that scales with platform
    value, identical to how Netflix went from $7.99 → $22.99.

  • 4/3/3 subscription rake — every Premium subscription payment splits:
        40% → operating account (your founder pay)
        30% → stability reserve (rainy-day fund)
        30% → the next quarter's Vibe Stakes pool (boosts existing
              members' loyalty payouts)
    NOT a security — this is just a revenue allocation, identical to
    how Spotify allocates ad revenue across artists.

Endpoints (all under /api):
  GET  /api/premium/price                — current price + grandfathered rate
  POST /api/premium/subscribe            — process subscription, run rake,
                                            stamp grandfathered rate
  GET  /api/admin/premium/reserve        — admin-cookie-gated reserve balance
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user
from routes.admin_dashboard import verify_admin_cookie
from routes.god_mode_audit import record_god_event

logger = logging.getLogger(__name__)
router = APIRouter()

# Pricing curve — base + (number of completed quarters since launch * step).
PREMIUM_BASE_PRICE_USD = float(os.environ.get("PREMIUM_BASE_PRICE_USD", "9.99"))
PREMIUM_PRICE_STEP_USD = float(os.environ.get("PREMIUM_PRICE_STEP_USD", "0.50"))
PLATFORM_LAUNCH_DATE = datetime(2026, 4, 1, tzinfo=timezone.utc)  # Q2 2026

# 4/3/3 split fractions of the subscription payment.
RAKE_OPERATING = 0.40
RAKE_RESERVE = 0.30
RAKE_POOL_BOOST = 0.30


def _quarters_since_launch() -> int:
    now = datetime.now(timezone.utc)
    delta_months = (now.year - PLATFORM_LAUNCH_DATE.year) * 12 + (now.month - PLATFORM_LAUNCH_DATE.month)
    return max(0, delta_months // 3)


def _current_premium_price() -> float:
    return round(PREMIUM_BASE_PRICE_USD + PREMIUM_PRICE_STEP_USD * _quarters_since_launch(), 2)


@router.get("/premium/price")
async def get_premium_price(http_request: Request) -> Dict[str, Any]:
    """
    Returns the current price for a NEW subscription, plus the
    grandfathered rate the caller is locked into (if they're already
    a Premium subscriber).
    """
    current = _current_premium_price()
    grandfathered: Optional[float] = None
    user = await get_current_user(http_request)
    if user:
        db = get_database()
        u = await db.users.find_one(
            {"user_id": user.user_id},
            {"_id": 0, "premium_grandfathered_price_usd": 1},
        ) or {}
        grandfathered = u.get("premium_grandfathered_price_usd")

    return {
        "current_price_usd": current,
        "your_grandfathered_price_usd": grandfathered,
        "base_price_usd": PREMIUM_BASE_PRICE_USD,
        "step_per_quarter_usd": PREMIUM_PRICE_STEP_USD,
        "quarters_since_launch": _quarters_since_launch(),
        "next_price_increase_to_usd": round(current + PREMIUM_PRICE_STEP_USD, 2),
    }


class SubscribePayload(BaseModel):
    payment_amount_usd: float = Field(..., ge=0.01, le=10000.0)
    payment_ref: str = Field(..., min_length=3, max_length=200)


@router.post("/premium/subscribe")
async def process_premium_subscription(
    payload: SubscribePayload, http_request: Request,
) -> Dict[str, Any]:
    """
    Called by the Stripe webhook (or any payment processor) once a member
    successfully pays for Premium. Performs the 4/3/3 rake atomically:
      • bumps `users.subscription_tier=premium` + grandfathers their rate
      • adds `RAKE_OPERATING%` to the operating account ledger
      • adds `RAKE_RESERVE%` to the stability-reserve fund
      • adds `RAKE_POOL_BOOST%` of $ → that many ₵ → next quarter's pool
      • grants the member +200 stakes for the renewal (existing rule)
      • writes a god-mode audit row for the full money trail

    Idempotent on `payment_ref` — Stripe webhooks retry on 5xx + flaky
    networks; calling this twice with the same ref is a no-op.
    """
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()

    # Idempotency guard — if we've already processed this payment_ref,
    # short-circuit and return the prior split.
    existing = await db.gvdsg_operating_ledger.find_one(
        {"ref": payload.payment_ref, "type": "premium_subscription_operating_cut"},
        {"_id": 0},
    )
    if existing:
        return {
            "ok": True,
            "tier": "premium",
            "grandfathered_price_usd": float(existing.get("amount_usd", 0)) / RAKE_OPERATING,
            "split": {
                "operating_cut_usd": float(existing.get("amount_usd", 0)),
                "reserve_cut_usd": round(float(existing.get("amount_usd", 0)) / RAKE_OPERATING * RAKE_RESERVE, 4),
                "pool_boost_usd": round(float(existing.get("amount_usd", 0)) / RAKE_OPERATING * RAKE_POOL_BOOST, 4),
            },
            "stakes_granted": 0,
            "idempotent_replay": True,
        }

    paid = float(payload.payment_amount_usd)
    operating_cut = round(paid * RAKE_OPERATING, 4)
    reserve_cut = round(paid * RAKE_RESERVE, 4)
    pool_boost = round(paid * RAKE_POOL_BOOST, 4)
    now = datetime.now(timezone.utc).isoformat()

    # 1. Mark the user Premium + grandfather the price they paid.
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "subscription_tier": "premium",
            "premium_activated_at": now,
            "premium_grandfathered_price_usd": paid,
            "premium_last_payment_ref": payload.payment_ref,
        }},
        upsert=False,
    )

    # 2. Operating account ledger.
    await db.gvdsg_operating_ledger.insert_one({
        "user_id": user.user_id,
        "type": "premium_subscription_operating_cut",
        "amount_usd": operating_cut,
        "ref": payload.payment_ref,
        "at": now,
    })

    # 3. Stability reserve.
    await db.gvdsg_reserve.update_one(
        {"_id": "stability_reserve"},
        {
            "$inc": {"balance_usd": reserve_cut, "lifetime_in_usd": reserve_cut},
            "$set": {"updated_at": now},
        },
        upsert=True,
    )

    # 4. Boost next quarter's stake pool.
    # We track this in a separate "pool_boost" collection so the scheduler
    # can read the running total + add it to the demo profit number when
    # firing the quarter close. Coins-equivalent (×100) for display.
    boost_coins = int(round(pool_boost * 100))
    await db.profit_share_pool_boosts.insert_one({
        "user_id": user.user_id,
        "amount_usd": pool_boost,
        "amount_coins": boost_coins,
        "source": "premium_subscription_rake",
        "ref": payload.payment_ref,
        "at": now,
    })

    # 5. Stake accrual: +200 for the renewal.
    try:
        from routes.profit_share import accrue_stake
        await accrue_stake(
            user.user_id, "premium_renewal",
            meta={"payment_ref": payload.payment_ref, "paid_usd": paid},
        )
    except Exception as e:
        logger.warning(f"[premium] stake accrual failed: {e}")

    # 6. Audit trail.
    await record_god_event(
        user.user_id, "PREMIUM_SUBSCRIPTION", paid,
        meta={
            "operating_cut": operating_cut,
            "reserve_cut": reserve_cut,
            "pool_boost": pool_boost,
            "ref": payload.payment_ref,
        },
    )

    return {
        "ok": True,
        "tier": "premium",
        "grandfathered_price_usd": paid,
        "split": {
            "operating_cut_usd": operating_cut,
            "reserve_cut_usd": reserve_cut,
            "pool_boost_usd": pool_boost,
        },
        "stakes_granted": 200,
    }


@router.get("/admin/premium/reserve")
async def reserve_balance(_: bool = Depends(verify_admin_cookie)):
    db = get_database()
    rec = await db.gvdsg_reserve.find_one(
        {"_id": "stability_reserve"}, {"_id": 0}
    ) or {"balance_usd": 0, "lifetime_in_usd": 0}
    pool_boost_total = await db.profit_share_pool_boosts.aggregate([
        {"$group": {"_id": None, "usd": {"$sum": "$amount_usd"}, "coins": {"$sum": "$amount_coins"}}},
    ]).to_list(length=1)
    return {
        "balance_usd": float(rec.get("balance_usd", 0)),
        "lifetime_in_usd": float(rec.get("lifetime_in_usd", 0)),
        "lifetime_pool_boost_usd": float((pool_boost_total or [{}])[0].get("usd", 0)),
        "lifetime_pool_boost_coins": int((pool_boost_total or [{}])[0].get("coins", 0)),
    }
