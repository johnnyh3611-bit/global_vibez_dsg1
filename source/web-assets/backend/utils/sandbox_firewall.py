"""Sandbox firewall — global unhandled-exception handler.

Per Security Directive D1 (2026-05-18): every thrown exception in any
router / game room / sub-feature MUST NOT leak structural info (file
paths, model names, stack traces) to the client, AND must be recorded
server-side so the Live Behavioral Monitoring (D4) layer can correlate
against rate-limit anomalies.

Behaviour:
  • Public response: ``{"detail": "internal error", "request_id": "…"}``
  • Internal log line tagged with ``request_id`` + masked path
  • Best-effort write to the ``security_events`` collection (D4 hook)

FastAPI's ``HTTPException`` keeps its original 4xx/5xx semantics —
this handler only catches the bottom-of-stack unhandled-Exception path.

Usage:
    from utils.sandbox_firewall import install
    install(app, db, logger)
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


def install(app: FastAPI, db, logger: logging.Logger) -> None:
    """Register the sandbox firewall on the given FastAPI app."""

    @app.exception_handler(Exception)
    async def _sandbox_firewall(request: Request, exc: Exception):
        request_id = str(uuid.uuid4())
        masked_path = request.url.path or "/"
        logger.exception(
            "[sandbox-firewall] request_id=%s path=%s method=%s exc_type=%s",
            request_id, masked_path, request.method, type(exc).__name__,
        )
        # Best-effort security-event write — NEVER block response on it.
        try:
            await db.security_events.insert_one({
                "type": "unhandled_exception",
                "request_id": request_id,
                "path": masked_path,
                "method": request.method,
                "exc_type": type(exc).__name__,
                # NEVER store the message body — it can contain user
                # PII / model names. Type + path is enough to correlate.
                "at": datetime.now(timezone.utc).isoformat(),
                "client_ip": request.client.host if request.client else None,
            })
        except Exception:  # noqa: BLE001 — best-effort logger
            pass
        return JSONResponse(
            status_code=500,
            content={"detail": "internal error", "request_id": request_id},
        )
