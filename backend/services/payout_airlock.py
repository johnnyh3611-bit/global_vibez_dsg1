"""
Payout Airlock — shared 72-hour security hold for outward asset transfers.

Per the **Security Directive D2 (2026-05-18)**: every outward asset
transfer originating from the platform — creator earnings withdrawal,
crypto/DSG bridge withdrawal, driver payout, escrow release — must
serve a hard **72-hour** delay before funds clear. This is a server-
side temporal lock; a client API call CANNOT shorten it.

The pattern mirrors `routes.match_consensus` (which already airlocks
match prize payouts). A single collection `payout_airlocks` holds the
held rows; a periodic worker in `lifespan.py` flips rows from `held` →
`cleared` and triggers the underlying transfer.

USAGE — enqueue a payout from any route::

    from services.payout_airlock import enqueue_payout
    airlock = await enqueue_payout(
        db,
        user_id=user.user_id,
        amount_usd=42.50,
        currency="usd",
        source="creator_withdraw",          # short stable string
        destination="bank_acct_123",        # where the money goes
        metadata={"stripe_account_id": "..."},
    )
    # Returned airlock has `clears_at` 72h in the future.

The release worker is responsible for:
  1. Finding `payout_airlocks` rows where `clears_at < now()` + `status==held`
  2. Routing them to the actual transfer code (Stripe payout, on-chain
     transfer, etc.) — keyed by `source`
  3. Flipping `status: cleared` + stamping `cleared_at`

This service module ONLY enqueues + clears the rows. The actual
transfer side-effect lives in `routes.payout_airlock_release` (admin
ops endpoint) so this module stays a pure data layer.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

# Security Directive D2: 72-hour airlock — NON-negotiable.
AIRLOCK_HOURS = 72


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def enqueue_payout(
    db,
    *,
    user_id: str,
    amount_usd: float,
    currency: str,
    source: str,
    destination: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Insert a held airlock row and return the public-safe view.

    Idempotency: the caller is expected to generate a unique
    `request_id` if they need replay protection. This service does
    NOT dedupe — two calls with the same user/amount/source produce
    two held rows, which is the safer default for money.
    """
    now = _utcnow()
    clears_at = now + timedelta(hours=AIRLOCK_HOURS)
    row = {
        "user_id": user_id,
        "amount_usd": round(float(amount_usd), 2),
        "currency": currency,
        "source": source,
        "destination": destination,
        "metadata": metadata or {},
        "status": "held",
        "queued_at": _iso(now),
        "clears_at": _iso(clears_at),
        "hours": AIRLOCK_HOURS,
    }
    result = await db.payout_airlocks.insert_one(row)
    row["airlock_id"] = str(result.inserted_id)
    row.pop("_id", None)
    return row


async def list_user_payouts(
    db, user_id: str, *, limit: int = 50
) -> Dict[str, Any]:
    """User-facing read: 'what's coming, what cleared, what's held'."""
    rows = await db.payout_airlocks.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("queued_at", -1).to_list(length=limit)
    held = sum(r["amount_usd"] for r in rows if r["status"] == "held")
    cleared = sum(r["amount_usd"] for r in rows if r["status"] == "cleared")
    return {
        "rows": rows,
        "total_held_usd": round(held, 2),
        "total_cleared_usd": round(cleared, 2),
        "airlock_hours": AIRLOCK_HOURS,
    }


async def release_due_payouts(db) -> Dict[str, Any]:
    """Scan for matured held rows and flip them to cleared.

    NOTE: this only flips the row state. Wiring the actual outward
    transfer (Stripe payout API, on-chain Solana transfer, etc.) lives
    downstream — see `routes.payout_airlock_release.process_cleared()`.
    Decoupling the state flip from the transfer means a failed transfer
    can be retried without re-queuing a new 72h hold.
    """
    now_iso = _iso(_utcnow())
    cursor = db.payout_airlocks.find(
        {"status": "held", "clears_at": {"$lte": now_iso}},
        {"_id": 0},
    )
    matured = await cursor.to_list(length=500)
    released_ids = []
    for row in matured:
        result = await db.payout_airlocks.update_one(
            {
                "user_id": row["user_id"],
                "queued_at": row["queued_at"],
                "status": "held",
            },
            {"$set": {"status": "cleared", "cleared_at": now_iso}},
        )
        if result.modified_count:
            released_ids.append(row.get("queued_at"))
    return {
        "matured": len(matured),
        "released": len(released_ids),
    }
