"""
Admin Security Console (Security Directive D4 · 2026-05-18)
============================================================

Read-only admin surface for the Live Behavioral Monitoring tier of the
Security Directive. Consolidates 3 streams:

  • Unhandled-exception sandbox-firewall events (server.py D1 handler)
  • Rate-limit / brute-force hits (middleware writes to security_events)
  • Match-consensus discrepancies (already writes to security_alerts)

ENDPOINTS (admin-only):
  GET  /api/admin/security/events       — recent events, paginated
  GET  /api/admin/security/airlocks     — global view of held payouts
  POST /api/admin/security/airlocks/release-due  — manual release trigger

Until you wire Datadog/Splunk, this is your behavioral-monitoring
dashboard. The cluster of writes is wide on purpose — every security-
relevant signal lands in `security_events` so a future ingestion job
can stream it out to a SIEM in one shot.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request

from utils.database import get_database, get_current_user
from services.payout_airlock import release_due_payouts

router = APIRouter(prefix="/admin/security", tags=["admin-security"])


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user is None or not getattr(user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def _strip_id(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


@router.get("/events")
async def list_security_events(
    request: Request,
    limit: int = 100,
    event_type: Optional[str] = None,
) -> Dict[str, Any]:
    """Recent security events sorted newest-first. Optional `event_type`
    filter (e.g. `unhandled_exception`, `rate_limit_burst`,
    `failed_login`)."""
    await _require_admin(request)
    db = get_database()
    q: Dict[str, Any] = {}
    if event_type:
        q["type"] = event_type
    cursor = db.security_events.find(q, {"_id": 0}).sort("at", -1).limit(min(limit, 500))
    events = await cursor.to_list(length=500)

    # Discrepancy alerts from match_consensus live in their own
    # collection — fold a slim view into the same response so the admin
    # console has one place to look.
    alerts_cursor = db.security_alerts.find({}, {"_id": 0}).sort("created_at", -1).limit(50)
    alerts = await alerts_cursor.to_list(length=50)

    return {
        "events": events,
        "match_consensus_alerts": alerts,
        "limit": limit,
        "event_type_filter": event_type,
    }


@router.get("/airlocks")
async def list_airlocks(request: Request, status: Optional[str] = None) -> Dict[str, Any]:
    """Global view of the payout-airlock queue. Filter by `held` /
    `cleared` / `cancelled` if needed."""
    await _require_admin(request)
    db = get_database()
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    rows = await db.payout_airlocks.find(q, {"_id": 0}).sort("queued_at", -1).to_list(length=500)
    total_held = sum(r["amount_usd"] for r in rows if r["status"] == "held")
    return {
        "rows": rows,
        "total_held_usd": round(total_held, 2),
        "status_filter": status,
    }


@router.post("/airlocks/release-due")
async def release_due_endpoint(request: Request) -> Dict[str, Any]:
    """Manual trigger for the airlock release worker. Same summary the
    scheduled loop produces."""
    await _require_admin(request)
    db = get_database()
    return await release_due_payouts(db)
