"""
Streamer Wrap-Up — HTTP surface.

Mirrors the weekly digest route pattern. Three endpoints:
  • GET  /api/streamer-wrap-up/preview/{streamer_id}
        → returns the rendered HTML + payload so the founder/streamer
          can preview without sending an email
  • POST /api/streamer-wrap-up/send/{streamer_id}
        → dispatches a wrap-up email to a single streamer
  • POST /api/streamer-wrap-up/dispatch-weekly
        → admin-style trigger that loops every streamer; auto-called
          by the Monday 09:00 UTC background loop, but exposed here
          for manual ops
"""
from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from motor.motor_asyncio import AsyncIOMotorClient

from services.streamer_wrap_up_service import (
    compute_streamer_wrap_up,
    dispatch_one_wrap_up,
    dispatch_weekly_wrap_ups,
    render_wrap_up_email_html,
)

router = APIRouter(prefix="/streamer-wrap-up", tags=["streamer-wrap-up"])

_db = AsyncIOMotorClient(os.environ.get("MONGO_URL"))[
    os.environ.get("DB_NAME", "global_vibez_dsg")
]


@router.get("/preview/{streamer_id}", response_class=HTMLResponse)
async def preview_wrap_up(streamer_id: str) -> HTMLResponse:
    """Render the wrap-up HTML in-browser for QA / streamer preview.
    Public — no auth — so streamers can share the link with collaborators
    before going featured."""
    payload = await compute_streamer_wrap_up(_db, streamer_id, days=7)
    if not payload:
        raise HTTPException(404, detail="Streamer has no provisioned live input")
    return HTMLResponse(render_wrap_up_email_html(payload))


@router.post("/send/{streamer_id}")
async def send_one_wrap_up(streamer_id: str) -> Dict[str, Any]:
    """Manual send for a single streamer. Used by the in-app "Email
    me this wrap-up" button on the analytics page and by ops."""
    result = await dispatch_one_wrap_up(_db, streamer_id)
    if not result.get("ok") and not result.get("skipped"):
        raise HTTPException(502, detail=result.get("error") or "send failed")
    return result


@router.post("/dispatch-weekly")
async def dispatch_weekly() -> Dict[str, Any]:
    """Trigger the full Monday-morning dispatch immediately. Idempotent
    per ISO week — repeats this Monday no-op until next week."""
    return await dispatch_weekly_wrap_ups(_db)
