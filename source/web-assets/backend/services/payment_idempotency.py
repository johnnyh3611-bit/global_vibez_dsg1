"""
Cross-rail payment idempotency — track processed transaction keys so Helio
webhooks and Solana indexer retries never double-credit.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional


async def claim_tx_key(
    db,
    *,
    rail: str,
    tx_id: str,
    payment_id: Optional[str] = None,
    user_id: Optional[str] = None,
    meta: Optional[dict] = None,
) -> bool:
    """
    Atomically claim ``rail:tx_id``. Returns True if this caller owns the
    credit; False if the tx was already processed.
    """
    key = f"{rail}:{(tx_id or '').strip()}"
    if key.endswith(":") or key == f"{rail}:":
        return True  # no usable id — caller must use row-level CAS
    try:
        await db.processed_payment_tx.insert_one(
            {
                "tx_key": key,
                "rail": rail,
                "tx_id": str(tx_id).strip(),
                "payment_id": payment_id,
                "user_id": user_id,
                "meta": meta or {},
                "claimed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        return True
    except Exception as exc:
        # Duplicate key → already claimed
        name = type(exc).__name__
        if "Duplicate" in name or getattr(exc, "code", None) == 11000:
            return False
        # Unexpected DB error — fail closed (do not credit)
        raise


async def tx_already_processed(db, *, rail: str, tx_id: str) -> bool:
    key = f"{rail}:{(tx_id or '').strip()}"
    if key.endswith(":"):
        return False
    row = await db.processed_payment_tx.find_one({"tx_key": key}, {"_id": 1})
    return bool(row)
