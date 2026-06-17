"""
Streamflow integration — read-only backend + stream-record bookkeeping.

Streamflow is a pure on-chain Solana protocol — there's no REST API key
like Stripe. Every write (create / cancel / withdraw) requires a wallet
signature, which is why we use the **hybrid pattern** (user option C):

  1. BACKEND (this module):
       - Stores a per-stream record in `streamflow_streams` collection
         AFTER the user signs the tx on the frontend. Keyed by the
         on-chain stream PDA + the tx signature.
       - Exposes admin endpoints to LIST stored streams (with an
         optional live-sync that queries the chain for up-to-date
         state via public RPC).

  2. FRONTEND (see `pages/admin/StreamflowAdmin.tsx`):
       - Uses `@streamflow/stream` JS SDK + `@solana/wallet-adapter`
         to build + submit the `createStream` transaction. Solflare
         prompts the admin to sign.
       - On success, POSTs the resulting `{stream_pubkey, signature,
         recipient, token_mint, amount, period, cliff, ...}` back
         to /api/admin/streamflow/streams to record it here.

Crew payouts specifically:
  - "Crew" = founders' cosigners, early devs, ambassadors.
  - Each payout is a Streamflow vesting stream (locked initial amount
    that unlocks linearly over time, optionally with a cliff).
  - Founder signs each one in Solflare; we keep the historical log
    + show the live state in the God-Mode admin dashboard.

Network: reads `STREAMFLOW_CLUSTER` (default `devnet`) to decide which
RPC to probe for live on-chain state. Flipping to `mainnet` requires
the `"domains"` safe word.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _cfg() -> Dict[str, str]:
    return {
        "treasury_wallet": os.environ.get("STREAMFLOW_TREASURY_WALLET", "").strip(),
        "cluster":         os.environ.get("STREAMFLOW_CLUSTER", "devnet").strip(),
        "rpc":             (
            os.environ.get("VIBEZ_SOLANA_RPC")
            or ("https://api.devnet.solana.com"
                if os.environ.get("STREAMFLOW_CLUSTER", "devnet") == "devnet"
                else "https://api.mainnet-beta.solana.com")
        ),
    }


def is_configured() -> bool:
    return bool(_cfg()["treasury_wallet"])


# ────────────────────────────────────────────── Record store

async def record_stream(
    db, *,
    stream_pubkey: str,
    signature: str,
    recipient: str,
    token_mint: str,
    amount_ui: float,
    recipient_label: Optional[str] = None,
    note: Optional[str] = None,
    period_seconds: Optional[int] = None,
    cliff_seconds: Optional[int] = None,
    created_by_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Persist an on-chain stream we just created. Idempotent on
    `stream_pubkey` so a frontend retry never double-records."""
    cfg = _cfg()
    now_iso = datetime.now(timezone.utc).isoformat()
    row = {
        "stream_pubkey": stream_pubkey,
        "signature": signature,
        "recipient": recipient,
        "recipient_label": recipient_label,
        "token_mint": token_mint,
        "amount_ui": float(amount_ui),
        "period_seconds": period_seconds,
        "cliff_seconds": cliff_seconds,
        "note": note,
        "cluster": cfg["cluster"],
        "treasury_wallet": cfg["treasury_wallet"],
        "created_by_user_id": created_by_user_id,
        "created_at": now_iso,
        "status": "active",
    }
    await db.streamflow_streams.update_one(
        {"stream_pubkey": stream_pubkey},
        {"$setOnInsert": row},
        upsert=True,
    )
    return row


async def list_streams(
    db, *, limit: int = 100, recipient: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Return stored streams, newest first. Optionally filter by
    recipient wallet (e.g., a specific crew member's address)."""
    q: Dict[str, Any] = {}
    if recipient:
        q["recipient"] = recipient
    rows = await db.streamflow_streams.find(q, {"_id": 0}).sort(
        "created_at", -1,
    ).to_list(length=max(1, min(limit, 500)))
    return rows


async def mark_stream_status(
    db, stream_pubkey: str, status: str, **extra: Any,
) -> bool:
    """Flip stream status (cancelled / completed / ...). Frontend
    calls this after a successful cancel/withdraw tx lands on-chain."""
    now_iso = datetime.now(timezone.utc).isoformat()
    res = await db.streamflow_streams.update_one(
        {"stream_pubkey": stream_pubkey},
        {"$set": {"status": status, "status_updated_at": now_iso, **extra}},
    )
    return res.matched_count > 0
