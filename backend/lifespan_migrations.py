"""
Lifespan / one-time migrations + index-creation orchestrator.

Extracted from `lifespan.py` (Feb 2026 split). Each ``_migrate_*``
helper is idempotent — re-running on every boot is a no-op once the
target rows have been upgraded.

Order matters: grandfather + chair_ids before index creation in case
future indexes assume the migrated shape.
"""
from __future__ import annotations

import asyncio
import logging

from utils.database import get_database

from lifespan_indexes import _create_indexes_from_spec


async def _migrate_grandfather_genesis_holders(logger: logging.Logger) -> None:
    """One-time chair grandfather migration. Idempotent."""
    try:
        from routes.chairs import _grandfather_genesis_holders  # noqa: PLC0415
        await _grandfather_genesis_holders()
    except Exception as e:
        logger.warning(f"[chairs] grandfather migration skipped: {e}")


async def _migrate_chair_ids_backfill(db, logger: logging.Logger) -> None:
    """One-time chair_ids backfill (Apr 30 2026).

    Every chair_purchases row gets a unique sequential `chair_ids` array
    stamped at buy-time. Rows created BEFORE that schema change have
    `quantity` but no `chair_ids` — backfill them in purchase order so
    the public Chair Wall has a clean chronological numbering.
    Idempotent: only touches rows missing `chair_ids`.
    """
    try:
        counter = await db.profit_share_counters.find_one(
            {"_id": "global_chairs"}, {"_id": 0, "count": 1}
        ) or {}
        global_count = int(counter.get("count") or 0)
        cur = db.chair_purchases.find(
            {"chair_ids": {"$exists": False}},
            {"_id": 1, "quantity": 1, "purchased_at": 1},
        ).sort("purchased_at", 1)
        next_id = 1
        assigned = 0
        async for row in cur:
            qty = int(row.get("quantity") or 0)
            if qty < 1:
                continue
            ids = list(range(next_id, next_id + qty))
            next_id += qty
            await db.chair_purchases.update_one(
                {"_id": row["_id"]},
                {"$set": {"chair_ids": ids}},
            )
            assigned += qty
        # Re-sync the counter so the next live purchase doesn't collide
        # with backfilled IDs.
        if assigned and (next_id - 1) > global_count:
            await db.profit_share_counters.update_one(
                {"_id": "global_chairs"},
                {"$set": {"count": next_id - 1}},
                upsert=True,
            )
        if assigned:
            logger.info(
                f"[chairs] chair_ids backfill assigned {assigned} "
                f"sequential IDs across legacy purchases."
            )
    except Exception as e:
        logger.warning(f"[chairs] chair_ids backfill skipped: {e}")


async def _migrate_phase_rename(db, logger: logging.Logger) -> None:
    """One-time phase rename migration (Apr 30 2026).

    Phase 1 was renamed Genesis → Genius; Phase 2 was renamed
    "Phase II" → "Genesis". Migrate any historical rows so all
    downstream lookups (calculator denominator, milestone IDs, admin
    live-seat phase tags) keep working. Idempotent: each update runs on
    the OLD name only, so re-runs are no-ops.
    """
    try:
        r1 = await db.chair_purchases.update_many(
            {"phase_at_purchase": "Genesis"},
            {"$set": {"phase_at_purchase": "Genius"}},
        )
        r2 = await db.chair_purchases.update_many(
            {"phase_at_purchase": "Phase II"},
            {"$set": {"phase_at_purchase": "Genesis"}},
        )
        # Milestone slugs: "Genesis_25/50/75/100" → "Genius_*"
        ms = await db.profit_share_milestones.find(
            {"_id": {"$regex": "^Genesis_"}}, {"_id": 1}
        ).to_list(length=10_000)
        ms_renamed = 0
        for row in ms:
            old_id = row["_id"]
            new_id = old_id.replace("Genesis_", "Genius_", 1)
            full = await db.profit_share_milestones.find_one({"_id": old_id})
            if full and not await db.profit_share_milestones.find_one({"_id": new_id}):
                full["_id"] = new_id
                await db.profit_share_milestones.insert_one(full)
                await db.profit_share_milestones.delete_one({"_id": old_id})
                ms_renamed += 1
        if (r1.modified_count or r2.modified_count or ms_renamed):
            logger.info(
                f"[chairs] Phase rename migration: "
                f"Genesis→Genius={r1.modified_count}, "
                f"PhaseII→Genesis={r2.modified_count}, "
                f"milestones_renamed={ms_renamed}"
            )
    except Exception as e:
        logger.warning(f"[chairs] phase rename migration skipped: {e}")


async def _seed_pricing_catalog(db, logger: logging.Logger) -> None:
    """Idempotently seed the pricing_catalog collection from the
    in-process defaults so admins can edit prices on the fly without
    a redeploy. No-op on subsequent boots."""
    try:
        from services.pricing_catalog import seed_pricing_catalog  # noqa: PLC0415
        await seed_pricing_catalog(db)
    except Exception as e:
        logger.warning(f"[pricing] catalog seed skipped: {e}")


async def _create_indexes_async(logger: logging.Logger) -> None:
    """Orchestrates one-time chair migrations + index creation.

    2026-05-17 refactor: split into 4 focused helpers above
    (grandfather, chair_ids backfill, phase rename, index spec loop).
    Each step is independently testable and a single failure doesn't
    cascade. Order matters: grandfather + chair_ids before index
    creation in case future indexes assume the migrated shape.
    """
    try:
        await asyncio.sleep(2)  # let motor warm up
        db = get_database()

        await _migrate_grandfather_genesis_holders(logger)
        await _migrate_chair_ids_backfill(db, logger)
        await _migrate_phase_rename(db, logger)
        await _seed_pricing_catalog(db, logger)
        await _create_indexes_from_spec(db, logger)

        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")
