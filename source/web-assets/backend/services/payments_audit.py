"""
Unified Payments Audit (Feb 2026)
─────────────────────────────────────────────────────────────────
Single append-only ledger that records every payment-flow event on
the platform so the founder can reconcile Stripe receipts against
internal coin top-ups, VIP grants, Featured Streamer slots, etc.

Collection: ``payments_audit``
Schema:
  event_id        str (uuid)
  kind            str ('coin_topup', 'high_roller_vip', 'featured_streamer', ...)
  source          str ('stripe_checkout', 'stripe_webhook', 'coin_wallet', 'manual')
  status          str ('created', 'paid', 'failed', 'refunded', 'credited')
  user_id         str | None
  amount_usd      float | None      (price the user paid)
  coins           int | None        (coins delivered, if applicable)
  stripe_session_id  str | None
  metadata        dict
  at              str (ISO timestamp)

The writer is called best-effort — exceptions are swallowed inside
``record_payment_event`` so a Mongo blip never breaks the checkout
hot path. Reconciliation queries are served by ``routes/admin_payments_audit.py``.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

log = logging.getLogger(__name__)


async def record_payment_event(
    db,
    *,
    kind: str,
    source: str,
    status: str,
    user_id: Optional[str] = None,
    amount_usd: Optional[float] = None,
    coins: Optional[int] = None,
    stripe_session_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Append a row to ``payments_audit``. Returns the event_id on
    success, None on any error (best-effort)."""
    try:
        event = {
            "event_id": f"pae_{uuid.uuid4().hex[:14]}",
            "kind": kind,
            "source": source,
            "status": status,
            "user_id": user_id,
            "amount_usd": float(amount_usd) if amount_usd is not None else None,
            "coins": int(coins) if coins is not None else None,
            "stripe_session_id": stripe_session_id,
            "metadata": metadata or {},
            "at": datetime.now(timezone.utc).isoformat(),
        }
        await db.payments_audit.insert_one(event)
        return event["event_id"]
    except Exception as exc:  # noqa: BLE001
        log.warning("payments_audit record failed kind=%s status=%s: %s",
                    kind, status, exc)
        return None
