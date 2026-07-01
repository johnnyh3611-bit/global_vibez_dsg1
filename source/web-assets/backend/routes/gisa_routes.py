"""
GISA — HTTP routes (v1.0 LOCKED).

Source spec: /app/memory/locked_specs/v8_GISA_AUDIT_BLUEPRINT.md

Endpoints (all under /api/gisa):
  GET  /thresholds          — canonical pass/warn thresholds
  POST /run                 — kicks off an audit (mode + users)
  GET  /report/latest       — returns latest /reports/system_health.json
  GET  /modules             — module audit matrix (LOCKED)
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from dataclasses import asdict

from services.gisa_agent import (
    THRESHOLDS, GISAAgent, write_report,
)
from utils.database import get_database


gisa_router = APIRouter(prefix="/gisa", tags=["gisa-audit"])

REPORT_PATH = "/app/reports/system_health.json"


# ──────────────────────────────────────────────────────────────────────────
# Module Audit Matrix (LOCKED — see v8_GISA_AUDIT_BLUEPRINT.md)
# ──────────────────────────────────────────────────────────────────────────
MODULE_MATRIX = [
    {
        "module": "31 Game Rooms",
        "logic_check": "Physics collision & result sync",
        "visual_check": "Ray-tracing & texture parity (5654 Vibe)",
    },
    {
        "module": "VibeRidez / Hungry Vibes",
        "logic_check": "GPS coordinate isolation",
        "visual_check": "UI responsiveness under load",
    },
    {
        "module": "Blockchain Gateway (Solana)",
        "logic_check": "TPS saturation, double-entry detection",
        "visual_check": "Transaction confirmation speed",
    },
    {
        "module": "Private Rooms",
        "logic_check": "End-to-end data silo check",
        "visual_check": "N/A (performance-focused)",
    },
]


# ──────────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────────
GISAMode = Literal["full_audit", "stress", "isolation", "visual"]


class RunGISARequest(BaseModel):
    mode: GISAMode = "full_audit"
    users: int = Field(default=1000, ge=1, le=1_000_000)


# ──────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────
@gisa_router.get("/thresholds")
async def get_thresholds() -> Dict[str, Any]:
    """Canonical pass/warn thresholds for the 4 audit vectors."""
    return {"thresholds": THRESHOLDS}


@gisa_router.get("/modules")
async def get_module_matrix() -> Dict[str, Any]:
    """Module audit matrix — what's checked, where (LOCKED)."""
    return {"matrix": MODULE_MATRIX}


@gisa_router.post("/run")
async def run_gisa(req: RunGISARequest) -> Dict[str, Any]:
    """Run an audit and return the report. Also persists to disk."""
    try:
        db = get_database()
    except Exception:
        db = None

    agent = GISAAgent(db=db, target_users=req.users)
    if req.mode == "full_audit":
        report = await agent.run_full_audit()
    elif req.mode == "stress":
        report = await agent.run_stress_only()
    elif req.mode == "isolation":
        report = await agent.run_isolation_only()
    elif req.mode == "visual":
        report = await agent.run_visual_only()
    else:
        raise HTTPException(status_code=400, detail=f"unknown mode: {req.mode}")

    write_report(report, path=REPORT_PATH)
    return asdict(report)


@gisa_router.get("/report/latest")
async def get_latest_report() -> Dict[str, Any]:
    """Return the most recent on-disk GISA report."""
    if not os.path.exists(REPORT_PATH):
        raise HTTPException(status_code=404, detail="no GISA report yet — run POST /api/gisa/run first")
    with open(REPORT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


__all__ = ["gisa_router"]
