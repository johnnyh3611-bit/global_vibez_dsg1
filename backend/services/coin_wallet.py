"""
Unified Vibez-Coin wallet helpers (May 2026)
─────────────────────────────────────────────────────────────────
Single source of truth for spending ₵ from ``users.credits_balance``.
Used by every "Pay with Vibez Coins" path across the platform:

  • Yellow Pages tier upgrades (Verified / Elite / Featured)
  • HungryVibez food orders
  • VibeRidez seat bookings
  • JFTN room passes (already migrated)

Conversion rate is fixed at **100 ₵ = $1.00** so the math stays
transparent across all utility rooms.

Atomic decrement is enforced via a Mongo conditional update so two
concurrent debits cannot overdraw the wallet.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

log = logging.getLogger(__name__)

# Locked rate (DO NOT CHANGE without a migration — every coin price
# in every utility room is computed from this constant).
#
# 2,000 ₵ = $1 USD.
#   • Total DSG supply is fixed at 3,000,000,000 coins → roughly $3M
#     hard cap at the launch rate. As burns + buy-pressure shrink the
#     float, the per-coin USD value rises (founder pricing model).
#   • Every spend in the app routes through ``debit_coins`` so the
#     burn rate is observable on a single ledger.
# 2026-05-18 founder ask: rate changed from $1 = 2,000 ₵ to $1 = 1,000 ₵
# across the entire app. Each Vibez Coin is worth 2× its prior value;
# coin-denominated allowances/bets/pots stay the same number but their
# USD-equivalent doubles. This is the single source of truth — every
# other rate constant (watch_and_wager, wallet docs, PricingMasterVault)
# is reconciled to this value.
COINS_PER_USD = 1000


def usd_to_coins(amount_usd: float) -> int:
    """Round to nearest coin so we never short the platform."""
    return int(round(amount_usd * COINS_PER_USD))


def coins_to_usd(coins: int) -> float:
    return coins / COINS_PER_USD


async def get_balance(db, user_id: str) -> int:
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "credits_balance": 1})
    return int((user or {}).get("credits_balance", 0) or 0)


async def debit_coins(
    db,
    user_id: str,
    coins: int,
    *,
    reason: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Atomically deduct ``coins`` from the user's wallet.

    Returns ``{ok, balance_after, shortfall}``. Never raises on
    insufficient balance — the caller decides whether to 402 or to
    surface a top-up CTA, since the desired UX differs by feature.
    """
    if coins <= 0:
        raise ValueError("debit amount must be positive")

    # Conditional decrement — only succeeds if the user has enough.
    result = await db.users.update_one(
        {"user_id": user_id, "credits_balance": {"$gte": coins}},
        {"$inc": {"credits_balance": -coins}},
    )

    if result.modified_count == 0:
        balance = await get_balance(db, user_id)
        return {
            "ok": False,
            "balance_after": balance,
            "shortfall": max(0, coins - balance),
            "needed": coins,
        }

    balance_after = await get_balance(db, user_id)

    # Audit ledger row — keeps a paper trail for refunds/disputes.
    await db.coin_ledger.insert_one({
        "user_id": user_id,
        "coins": -coins,
        "reason": reason,
        "metadata": metadata or {},
        "balance_after": balance_after,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    log.info("coin_wallet debit user=%s coins=%d reason=%s balance=%d",
             user_id, coins, reason, balance_after)

    return {"ok": True, "balance_after": balance_after, "shortfall": 0, "needed": coins}


async def credit_coins(
    db,
    user_id: str,
    coins: int,
    *,
    reason: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Credit coins to a user (refund, ambassador commission, payout)."""
    if coins <= 0:
        raise ValueError("credit amount must be positive")
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"credits_balance": coins}},
        upsert=False,
    )
    balance_after = await get_balance(db, user_id)
    await db.coin_ledger.insert_one({
        "user_id": user_id,
        "coins": coins,
        "reason": reason,
        "metadata": metadata or {},
        "balance_after": balance_after,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    log.info("coin_wallet credit user=%s coins=%d reason=%s balance=%d",
             user_id, coins, reason, balance_after)
    return {"balance_after": balance_after}
