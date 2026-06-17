"""
Recirculation Engine (Feb 2026) — IN-APP COINS (₵ / VIBEZ) ONLY
─────────────────────────────────────────────────────────────────
SCOPE — read this before touching anything in here:

This engine governs **IN-APP COINS** (the soft-currency ₵ / VIBEZ
that users earn, spend, gift, and bet inside the platform). The
Recirculation Blueprint applies here — burns are dead, the 40/30/30
split keeps coins cycling through pools so velocity drives value.

The **DSG TOKEN** (the on-chain Solana SPL token launching post
``"project complete"``) is a SEPARATE economy with SEPARATE rules.
DSG keeps its **burn schedule** (see ``routes/sovereign_ops_routes.py``
``/burn/schedule`` + ``/admin/burn/execute``, and ``services/ai_governor.py``).
DO NOT call this engine from DSG burn paths and DO NOT route DSG burns
through here. They are deliberately decoupled.

Quick cheat-sheet:
  • Spending ₵ in-app (gifts, wheel jokers, game rakes)  → recirculate() ✓
  • Burning DSG SPL on Solana (TGE schedule, AI governor)  → leave alone ✗

─────────────────────────────────────────────────────────────────
Off-chain 40/30/30 split:

  • 40% → Tournament Pool   (re-enters circulation as prize money)
  • 30% → Platform Treasury (ops / dev / business development)
  • 30% → 72h Airlock       (synthetic scarcity, then released back)

Total in-app supply stays hard-capped at 3,000,000,000 ₵. Coins no
longer leave the system — they cycle through pools faster than
they're hoarded, driving in-app velocity (V = P·T / M).

Collections written:
  • recirculation_ledger     — every split row (append-only audit)
  • recirculation_pools      — { _id, balance } for tournament_pool / treasury
  • recirculation_airlocks   — 72h-held coin rows (separate from USD payouts)
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

log = logging.getLogger(__name__)

# Blueprint percentages — locked at the module level so any future
# tweak is loud and audited. The regression shield pins these.
TOURNAMENT_POOL_PCT: float = 0.40
TREASURY_PCT: float = 0.30
AIRLOCK_PCT: float = 0.30
assert abs(TOURNAMENT_POOL_PCT + TREASURY_PCT + AIRLOCK_PCT - 1.0) < 1e-9, \
    "Recirculation split must sum to 1.0"

AIRLOCK_HOLD_SECONDS: int = 72 * 60 * 60  # 72h per Blueprint


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _split(amount: int) -> Dict[str, int]:
    """Compute the 40/30/30 split in whole coins. The airlock absorbs
    the rounding remainder so the three buckets always sum exactly to
    ``amount`` (the Blueprint contract `total - 40 - 30`)."""
    if amount <= 0:
        return {"tournament": 0, "treasury": 0, "airlock": 0}
    tournament = int(amount * TOURNAMENT_POOL_PCT)
    treasury = int(amount * TREASURY_PCT)
    airlock = int(amount - tournament - treasury)
    return {"tournament": tournament, "treasury": treasury, "airlock": airlock}


async def recirculate(
    db,
    *,
    amount_coins: int,
    source: str,
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Run the 40/30/30 recirculation on ``amount_coins``.

    Writes one ledger row and updates the two pool counters. The 30%
    airlock share is enqueued into the existing ``payout_airlocks``
    collection (D2 directive) so the 72h release worker auto-unlocks
    it without us re-inventing the cron.

    Returns the split + the new pool balances so callers can surface
    "your coins funded X coins for tournaments" to the user.
    """
    if amount_coins <= 0:
        return {
            "ok": False,
            "reason": "non_positive_amount",
            "split": {"tournament": 0, "treasury": 0, "airlock": 0},
        }

    split = _split(amount_coins)
    rec_id = f"recirc_{uuid.uuid4().hex[:14]}"
    now = _now_iso()

    # 1. Append the ledger row.
    await db.recirculation_ledger.insert_one({
        "recirc_id": rec_id,
        "source": source,
        "user_id": user_id,
        "amount_coins": int(amount_coins),
        "split": split,
        "metadata": metadata or {},
        "at": now,
    })

    # 2. Bump tournament + treasury pool counters atomically.
    if split["tournament"]:
        await db.recirculation_pools.update_one(
            {"_id": "tournament_pool"},
            {"$inc": {"balance": split["tournament"]},
             "$setOnInsert": {"created_at": now},
             "$set": {"updated_at": now}},
            upsert=True,
        )
    if split["treasury"]:
        await db.recirculation_pools.update_one(
            {"_id": "treasury"},
            {"$inc": {"balance": split["treasury"]},
             "$setOnInsert": {"created_at": now},
             "$set": {"updated_at": now}},
            upsert=True,
        )

    # 3. Enqueue the 30% airlock share — dedicated collection so coin
    #    rows don't pollute the USD-centric `payout_airlocks`. The
    #    release worker (lifespan_workers._start_recirculation_airlock)
    #    auto-flips `status: held → cleared` after 72h, at which point
    #    the locked coins are considered back in general circulation.
    if split["airlock"]:
        try:
            from datetime import timedelta  # noqa: PLC0415
            clears_at = (
                datetime.now(timezone.utc) + timedelta(seconds=AIRLOCK_HOLD_SECONDS)
            ).isoformat()
            await db.recirculation_airlocks.insert_one({
                "recirc_id": rec_id,
                "amount_coins": int(split["airlock"]),
                "source": source,
                "user_id": user_id,
                "metadata": metadata or {},
                "status": "held",
                "queued_at": now,
                "clears_at": clears_at,
                "hold_seconds": AIRLOCK_HOLD_SECONDS,
            })
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "recirculation airlock enqueue failed (recirc_id=%s): %s",
                rec_id, exc,
            )

    return {
        "ok": True,
        "recirc_id": rec_id,
        "amount_coins": int(amount_coins),
        "split": split,
        "source": source,
        "at": now,
    }


async def get_pool_summary(db) -> Dict[str, Any]:
    """Return the current Tournament Pool + Treasury balances and the
    locked airlock total. Used by the founder dashboard + the live
    ticker we surface on the wallet page."""
    pools = {}
    cursor = db.recirculation_pools.find({}, {"_id": 1, "balance": 1})
    async for doc in cursor:
        pools[doc["_id"]] = int(doc.get("balance", 0))

    airlock_held_doc = await db.recirculation_airlocks.aggregate([
        {"$match": {"status": "held"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_coins"}}},
    ]).to_list(length=1)
    airlock_locked = int(airlock_held_doc[0]["total"]) if airlock_held_doc else 0

    return {
        "tournament_pool": pools.get("tournament_pool", 0),
        "treasury": pools.get("treasury", 0),
        "airlock_locked": airlock_locked,
        "model": "fixed_supply_recirculation",
        "split_pct": {
            "tournament": TOURNAMENT_POOL_PCT,
            "treasury": TREASURY_PCT,
            "airlock": AIRLOCK_PCT,
        },
        "airlock_hold_seconds": AIRLOCK_HOLD_SECONDS,
    }


async def release_due_airlocks(db) -> Dict[str, Any]:
    """Background worker callback: flip every matured airlock row
    (``status='held' AND clears_at < now``) to ``status='cleared'``.
    The locked coins are then considered back in general circulation
    (we don't move them anywhere — they were never withdrawn from the
    supply, the airlock is a velocity/scarcity gate, not custody).
    Idempotent: re-runs flip nothing since the filter excludes cleared rows.
    """
    now = datetime.now(timezone.utc).isoformat()
    cursor = db.recirculation_airlocks.find(
        {"status": "held", "clears_at": {"$lte": now}},
        {"_id": 0, "recirc_id": 1, "amount_coins": 1},
    )
    matured = 0
    released = 0
    total_coins = 0
    async for row in cursor:
        matured += 1
        result = await db.recirculation_airlocks.update_one(
            {"recirc_id": row["recirc_id"], "status": "held"},
            {"$set": {"status": "cleared", "cleared_at": now}},
        )
        if result.modified_count:
            released += 1
            total_coins += int(row.get("amount_coins") or 0)
    return {
        "matured": matured,
        "released": released,
        "coins_released": total_coins,
        "at": now,
    }


async def airlock_release_loop() -> None:
    """5-minute cadence release loop. Imported by ``lifespan_workers``."""
    import asyncio  # noqa: PLC0415
    from utils.database import get_database  # noqa: PLC0415
    await asyncio.sleep(35)  # warm-up
    while True:
        try:
            db = get_database()
            summary = await release_due_airlocks(db)
            if summary["released"]:
                log.info(
                    "recirculation airlock tick: released=%d coins_released=%d",
                    summary["released"], summary["coins_released"],
                )
        except Exception as exc:  # noqa: BLE001
            log.warning("recirculation airlock tick failed: %s", exc)
        await asyncio.sleep(5 * 60)

