"""
Admin Recirculation (Feb 2026)
─────────────────────────────────────────────────────────────────
Founder-only views over the off-chain recirculation engine. Three
endpoints:

  GET /api/admin/recirculation/summary  — pool balances + airlock locked
  GET /api/admin/recirculation/ledger   — paginated split-row history
  GET /api/admin/recirculation/airlocks — current 72h-held rows

The numbers here are the canonical truth until the Solana program
ships post "project complete" — at which point the on-chain reads
replace these.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from config import db
from services.recirculation import get_pool_summary
from utils.admin_guard import require_admin

router = APIRouter(prefix="/admin/recirculation", tags=["admin-recirculation"])


@router.get("/summary")
async def summary(admin=Depends(require_admin)) -> Dict[str, Any]:
    return await get_pool_summary(db)


@router.get("/ledger")
async def ledger(
    source: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    q: Dict[str, Any] = {}
    if source:
        q["source"] = source
    if user_id:
        q["user_id"] = user_id
    cursor = db.recirculation_ledger.find(q, {"_id": 0}).sort("at", -1).limit(limit)
    rows: List[Dict[str, Any]] = [r async for r in cursor]
    return {"rows": rows, "count": len(rows)}


@router.get("/airlocks")
async def airlocks(
    status: str = Query(default="held"),
    limit: int = Query(default=50, ge=1, le=500),
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    cursor = db.recirculation_airlocks.find(q, {"_id": 0}).sort("queued_at", -1).limit(limit)
    rows: List[Dict[str, Any]] = [r async for r in cursor]
    return {"rows": rows, "count": len(rows)}
