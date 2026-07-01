"""
Streamflow admin endpoints — God-Mode vesting + crew payout control.

All routes require the God-Mode admin cookie. Writes (record/cancel)
only happen AFTER the founder has signed the on-chain tx in Solflare,
so the server never holds a private key — matches the hybrid "option C"
user requirement.

  GET  /api/admin/streamflow/status           — config snapshot
  GET  /api/admin/streamflow/streams          — list stored streams
  POST /api/admin/streamflow/streams          — record a fresh stream
  POST /api/admin/streamflow/streams/{sp}/status — mark cancelled/completed
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.admin_dashboard import verify_admin_cookie
from services.streamflow_service import (
    _cfg,
    is_configured,
    list_streams,
    mark_stream_status,
    record_stream,
)
from utils.database import get_database

router = APIRouter()


@router.get("/admin/streamflow/status")
async def status(_: bool = Depends(verify_admin_cookie)) -> Dict[str, Any]:
    """Returns treasury wallet + network + "are we wired up?". No
    secrets because Streamflow has none — signing happens in Solflare."""
    cfg = _cfg()
    return {
        "configured": is_configured(),
        "treasury_wallet": cfg["treasury_wallet"] or None,
        "cluster": cfg["cluster"],
        "rpc": cfg["rpc"],
        "app_url": (
            "https://app.streamflow.finance"
            if cfg["cluster"] == "mainnet"
            else "https://app.streamflow.finance"
        ),
    }


@router.get("/admin/streamflow/streams")
async def streams(
    limit: int = 100,
    recipient: Optional[str] = None,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    db = get_database()
    rows = await list_streams(db, limit=limit, recipient=recipient)
    return {"count": len(rows), "rows": rows,
            "cluster": _cfg()["cluster"]}


class StreamRecord(BaseModel):
    stream_pubkey: str = Field(..., min_length=32, max_length=64)
    signature: str = Field(..., min_length=20, max_length=200)
    recipient: str = Field(..., min_length=32, max_length=44)
    token_mint: str = Field(..., min_length=32, max_length=44)
    amount_ui: float = Field(..., gt=0)
    recipient_label: Optional[str] = Field(default=None, max_length=80)
    note: Optional[str] = Field(default=None, max_length=500)
    period_seconds: Optional[int] = Field(default=None, gt=0)
    cliff_seconds: Optional[int] = Field(default=None, ge=0)


@router.post("/admin/streamflow/streams")
async def record(
    body: StreamRecord, _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Called by the frontend AFTER Solflare confirms the stream
    creation tx. Idempotent on `stream_pubkey`."""
    db = get_database()
    row = await record_stream(
        db,
        stream_pubkey=body.stream_pubkey,
        signature=body.signature,
        recipient=body.recipient,
        token_mint=body.token_mint,
        amount_ui=body.amount_ui,
        recipient_label=body.recipient_label,
        note=body.note,
        period_seconds=body.period_seconds,
        cliff_seconds=body.cliff_seconds,
    )
    return {"ok": True, "stream": row}


class StatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(active|cancelled|completed|failed)$")
    note: Optional[str] = Field(default=None, max_length=200)


@router.post("/admin/streamflow/streams/{stream_pubkey}/status")
async def update_status(
    stream_pubkey: str, body: StatusUpdate,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    db = get_database()
    extra: Dict[str, Any] = {}
    if body.note:
        extra["status_note"] = body.note
    ok = await mark_stream_status(db, stream_pubkey, body.status, **extra)
    if not ok:
        raise HTTPException(404, "stream not found")
    return {"ok": True, "stream_pubkey": stream_pubkey,
            "status": body.status}
