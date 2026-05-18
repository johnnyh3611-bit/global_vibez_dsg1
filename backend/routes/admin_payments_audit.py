"""
Admin Payments Audit (Feb 2026)
─────────────────────────────────────────────────────────────────
Founder-only reconciliation endpoints over the unified
``payments_audit`` collection populated by services/payments_audit.py.

Endpoints (all under /api/admin/payments-audit):
  GET /events         — paginated event feed, filterable by kind/status/user
  GET /summary        — kind × status counts + amount_usd totals for the last N days
  GET /reconcile      — Stripe-paid totals vs internally-credited totals (drift detector)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from config import db
from utils.admin_guard import require_admin

router = APIRouter(prefix="/admin/payments-audit", tags=["admin-payments-audit"])


def _iso(dt: datetime) -> str:
    return dt.isoformat()


@router.get("/events")
async def list_events(
    kind: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    q: Dict[str, Any] = {}
    if kind:
        q["kind"] = kind
    if status:
        q["status"] = status
    if user_id:
        q["user_id"] = user_id
    cursor = db.payments_audit.find(q, {"_id": 0}).sort("at", -1).limit(limit)
    events: List[Dict[str, Any]] = [e async for e in cursor]
    total = await db.payments_audit.count_documents(q)
    return {"events": events, "count": len(events), "total_matching": total}


@router.get("/summary")
async def summary(
    days: int = Query(default=7, ge=1, le=90),
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    """Counts + amount_usd totals grouped by (kind, status) for the
    last ``days`` calendar days. Used by the founder dashboard."""
    since = _iso(datetime.now(timezone.utc) - timedelta(days=days))
    pipeline = [
        {"$match": {"at": {"$gte": since}}},
        {
            "$group": {
                "_id": {"kind": "$kind", "status": "$status"},
                "count": {"$sum": 1},
                "amount_usd": {"$sum": {"$ifNull": ["$amount_usd", 0]}},
                "coins": {"$sum": {"$ifNull": ["$coins", 0]}},
            }
        },
    ]
    rows: List[Dict[str, Any]] = []
    async for r in db.payments_audit.aggregate(pipeline):
        rows.append({
            "kind": r["_id"].get("kind"),
            "status": r["_id"].get("status"),
            "count": r["count"],
            "amount_usd": round(float(r.get("amount_usd") or 0), 2),
            "coins": int(r.get("coins") or 0),
        })
    return {"window_days": days, "since": since, "rows": rows}


@router.get("/reconcile")
async def reconcile(
    days: int = Query(default=7, ge=1, le=90),
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    """Sum Stripe-paid USD vs internally-credited USD for the window.
    Any non-zero ``drift_usd`` means a Stripe receipt is missing an
    internal credit (or vice-versa) and needs ops attention."""
    since = _iso(datetime.now(timezone.utc) - timedelta(days=days))
    paid_pipeline = [
        {"$match": {
            "at": {"$gte": since},
            "source": {"$in": ["stripe_checkout", "stripe_webhook"]},
            "status": {"$in": ["paid", "credited"]},
        }},
        {"$group": {"_id": None, "usd": {"$sum": {"$ifNull": ["$amount_usd", 0]}}}},
    ]
    credited_pipeline = [
        {"$match": {"at": {"$gte": since}, "status": "credited"}},
        {"$group": {"_id": None, "usd": {"$sum": {"$ifNull": ["$amount_usd", 0]}}}},
    ]
    paid_doc = await db.payments_audit.aggregate(paid_pipeline).to_list(length=1)
    credited_doc = await db.payments_audit.aggregate(credited_pipeline).to_list(length=1)
    paid_usd = float((paid_doc[0]["usd"] if paid_doc else 0) or 0)
    credited_usd = float((credited_doc[0]["usd"] if credited_doc else 0) or 0)
    return {
        "window_days": days,
        "since": since,
        "stripe_paid_usd": round(paid_usd, 2),
        "internally_credited_usd": round(credited_usd, 2),
        "drift_usd": round(paid_usd - credited_usd, 2),
    }
