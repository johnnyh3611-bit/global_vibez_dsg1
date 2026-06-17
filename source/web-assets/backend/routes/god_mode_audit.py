"""
God-Mode Audit Logger ("Historian" agent).

Append-only ledger of every privileged action across the platform —
₵ token burns, vault withdrawals, manual deposit credits, admin overrides,
escrow releases, etc. Lives in MongoDB collection `god_mode_audit` and is
exposed as a paginated admin-only feed.

Public helper used everywhere:
    await record_god_event(user_id, action, amount, meta={...})

Endpoint:
  GET /api/admin/audit/feed?limit=50&action=TOKEN_BURN
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends

from utils.database import get_database
from routes.admin_dashboard import verify_admin_cookie

logger = logging.getLogger(__name__)
router = APIRouter()


async def record_god_event(
    user_id: str,
    action: str,
    amount: float = 0.0,
    meta: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Append-only audit row. Never raises — auditing must not break a request.
    Returns the inserted entry's id (or empty string on failure).
    """
    entry = {
        "user_id": user_id,
        "action": action,                # e.g. TOKEN_BURN, VAULT_WITHDRAW, MANUAL_CREDIT
        "amount": float(amount or 0),
        "meta": meta or {},
        "at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        db = get_database()
        res = await db.god_mode_audit.insert_one(entry)
        return str(res.inserted_id)
    except Exception as e:
        logger.warning(f"[god-mode-audit] insert failed: {e}")
        return ""


@router.get("/admin/audit/feed")
async def audit_feed(
    limit: int = 50,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Paginated audit feed (newest first). Admin cookie required."""
    db = get_database()
    q: Dict[str, Any] = {}
    if action:
        q["action"] = action.upper()
    if user_id:
        q["user_id"] = user_id
    cursor = db.god_mode_audit.find(q, {"_id": 0}).sort("at", -1).limit(min(max(1, limit), 500))
    rows: List[Dict[str, Any]] = await cursor.to_list(length=limit)
    counts = await db.god_mode_audit.aggregate([
        {"$match": q},
        {"$group": {"_id": "$action", "count": {"$sum": 1}, "total_amount": {"$sum": "$amount"}}},
        {"$sort": {"count": -1}},
    ]).to_list(length=50)
    return {"count": len(rows), "rows": rows, "by_action": counts}
