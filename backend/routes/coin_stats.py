"""
Coin Ledger Stats — public scarcity readout (May 2026)
─────────────────────────────────────────────────────────────────
Powers the "Burn Counter" widget on the landing page. Every spend in
the unified-market app routes through ``services.coin_wallet.debit_coins``
which writes a row into ``coin_ledger``. This route summarises that
ledger so the public can watch the 3B-coin float tighten in real time.

The numbers tell the founder pricing model story to investors,
ambassadors, and beta testers all at once:
  • Total supply  = 3,000,000,000 coins (locked at the contract)
  • Burned coins  = sum of every spend (negative-coin rows in ledger)
  • Top-ups       = sum of every Stripe ₵ purchase that was credited
  • Float         = coins currently held across user wallets

This route is intentionally open (no auth) — the Burn Counter is a
marketing widget visible to anonymous landing-page visitors.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import APIRouter

from config import db as _db

router = APIRouter(prefix="/coins", tags=["coin-stats"])

# Locked at the smart-contract level. Do NOT change.
TOTAL_SUPPLY: int = 3_000_000_000


@router.get("/stats/burn")
async def burn_counter_stats() -> Dict[str, Any]:
    """Aggregate scarcity stats for the public Burn Counter widget."""
    now = datetime.now(timezone.utc)
    iso_24h = (now - timedelta(hours=24)).isoformat()

    # ── Lifetime totals ───────────────────────────────────────────
    burned_pipeline = [
        {"$match": {"coins": {"$lt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$coins"}}},
    ]
    credited_pipeline = [
        {"$match": {"coins": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$coins"}}},
    ]
    burned_24h_pipeline = [
        {"$match": {"coins": {"$lt": 0}, "created_at": {"$gte": iso_24h}}},
        {"$group": {"_id": None, "total": {"$sum": "$coins"}}},
    ]

    async def _sum(pipeline) -> int:
        cursor = _db.coin_ledger.aggregate(pipeline)
        async for row in cursor:
            return int(row.get("total") or 0)
        return 0

    burned_signed = await _sum(burned_pipeline)        # negative
    credited_signed = await _sum(credited_pipeline)    # positive
    burned_24h_signed = await _sum(burned_24h_pipeline)

    burned_total = abs(burned_signed)
    burned_today = abs(burned_24h_signed)
    credited_total = credited_signed

    # ── Float — sum of credits_balance across all users ───────────
    user_float = 0
    cursor = _db.users.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$credits_balance"}}},
    ])
    async for row in cursor:
        user_float = int(row.get("total") or 0)

    circulating = max(0, TOTAL_SUPPLY - burned_total)

    # ── Top burn reasons (last 24h) ───────────────────────────────
    reason_pipeline = [
        {"$match": {"coins": {"$lt": 0}, "created_at": {"$gte": iso_24h}}},
        {"$group": {
            "_id": "$reason",
            "coins_burned": {"$sum": {"$abs": "$coins"}},
            "tx_count": {"$sum": 1},
        }},
        {"$sort": {"coins_burned": -1}},
        {"$limit": 5},
    ]
    top_reasons = []
    async for row in _db.coin_ledger.aggregate(reason_pipeline):
        top_reasons.append({
            "reason": row["_id"] or "unknown",
            "coins_burned": int(row["coins_burned"]),
            "tx_count": int(row["tx_count"]),
        })

    # USD-equivalent at the locked 2,000 ₵ = $1 rate.
    from services.coin_wallet import COINS_PER_USD, coins_to_usd
    return {
        "total_supply": TOTAL_SUPPLY,
        "burned_total": burned_total,
        "burned_today": burned_today,
        "circulating": circulating,
        "user_float": user_float,
        "topup_total_credited": credited_total,
        "burn_pct": round(burned_total / TOTAL_SUPPLY * 100, 6),
        "coins_per_usd": COINS_PER_USD,
        "burned_total_usd": round(coins_to_usd(burned_total), 2),
        "burned_today_usd": round(coins_to_usd(burned_today), 2),
        "top_reasons_24h": top_reasons,
        "as_of": now.isoformat(),
    }
