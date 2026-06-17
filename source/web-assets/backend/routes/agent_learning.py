"""
Agent Learning endpoint — persist design lessons from the
<LogDesignLesson /> floating button into MongoDB + append to
/app/memory/LEARNING_LOG.md so they're visible to humans + the audit
agents on the next run.

Admin-gated via verify_admin_cookie — NOT open to anonymous users
because lessons feed directly into the rulebook and could be abused
as a vector to inject arbitrary text into the codebase docs.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from utils.database import get_database
from routes.admin_dashboard import verify_admin_cookie
from services.mem0_client import get_mem0_client

logger = logging.getLogger(__name__)
router = APIRouter()

LEARNING_LOG = Path("/app/memory/LEARNING_LOG.md")
MEMORY_DIR = Path("/app/memory")
ALLOWED_CATEGORIES = {"Visuals", "Flow", "Rules", "Treasury", "Games", "Other"}


class LessonPayload(BaseModel):
    insight: str = Field(..., min_length=5, max_length=500)
    category: str = Field(default="Other")


@router.post("/agent/learn")
async def log_design_lesson(
    payload: LessonPayload,
    db=Depends(get_database),
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Persist a design lesson. Writes to `design_lessons` + LEARNING_LOG.md."""
    category = payload.category if payload.category in ALLOWED_CATEGORIES else "Other"

    # Light sanitation — strip markdown control chars that could tamper
    # with LEARNING_LOG.md structure.
    insight = re.sub(r"[\r\n]+", " ", payload.insight).strip()
    if not insight:
        raise HTTPException(400, "insight cannot be empty after sanitation")

    now = datetime.now(timezone.utc)
    doc = {
        "insight": insight,
        "category": category,
        "created_at": now.isoformat(),
    }
    await db.design_lessons.insert_one(doc)
    doc.pop("_id", None)

    # Append to LEARNING_LOG.md (grouped by date).
    try:
        header = f"\n## {now.strftime('%Y-%m-%d')}\n"
        line = f"- [{category}] {insight}\n"
        existing = LEARNING_LOG.read_text() if LEARNING_LOG.exists() else ""
        today_stamp = f"## {now.strftime('%Y-%m-%d')}"
        if today_stamp in existing:
            # Append under today's existing header.
            LEARNING_LOG.write_text(existing + line)
        else:
            LEARNING_LOG.write_text(existing + header + line)
    except Exception as exc:
        logger.warning(f"[agent/learn] failed to append LEARNING_LOG.md: {exc}")

    return {"persisted": True, "lesson": doc}


@router.get("/agent/lessons")
async def list_lessons(
    limit: int = 50,
    _: bool = Depends(verify_admin_cookie),
    db=Depends(get_database),
) -> Dict[str, Any]:
    """Return the most recent N design lessons (admin-only)."""
    limit = max(1, min(limit, 200))
    rows = await db.design_lessons.find({}, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(length=limit)
    return {"count": len(rows), "lessons": rows}


# ─────────────────────────────────────────── Mem0 semantic memory

@router.get("/agent/memory/status")
async def memory_status(_: bool = Depends(verify_admin_cookie)) -> Dict[str, Any]:
    """Confirm Mem0 connectivity. Replaces ``openclaw mem0 status``."""
    mem0 = get_mem0_client()
    return {
        "connected": mem0.enabled,
        "user_id": mem0.user_id if mem0.enabled else None,
        "provider": "mem0ai",
    }


@router.get("/agent/memory/search")
async def memory_search(
    q: str,
    limit: int = 10,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Semantic search over the founder's long-term memory."""
    mem0 = get_mem0_client()
    if not mem0.enabled:
        raise HTTPException(503, "Mem0 not configured (set MEM0_API_KEY)")
    limit = max(1, min(limit, 50))
    results = mem0.search(q, limit=limit)
    return {"query": q, "count": len(results), "results": results}


@router.post("/agent/memory/import")
async def memory_import(
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Bulk-import the canonical workspace docs into Mem0.

    Walks ``/app/memory/`` and pushes every relevant ``.md`` file. Files
    under 2000 words are sent as a single memory; longer files are
    split by ``#`` heading. Mirrors the original openclaw spec.

    Skips: AGENTS.md, BOOTSTRAP.md, HEARTBEAT.md, TOOLS.md (per spec).
    """
    mem0 = get_mem0_client()
    if not mem0.enabled:
        raise HTTPException(503, "Mem0 not configured (set MEM0_API_KEY)")

    skip_names = {"AGENTS.md", "BOOTSTRAP.md", "HEARTBEAT.md", "TOOLS.md"}
    candidates = ["MASTER_RULEBOOK.md", "LEARNING_LOG.md", "PRD.md",
                  "ONBOARDING.md", "test_credentials.md"]
    found, imported, skipped = [], 0, []

    for name in candidates:
        path = MEMORY_DIR / name
        if not path.exists() or name in skip_names:
            skipped.append(name)
            continue
        text = path.read_text(encoding="utf-8")
        found.append(name)
        word_count = len(text.split())

        if word_count <= 2000:
            res = mem0.add_raw(text, metadata={"source_file": name,
                                               "category": "doc"})
            if res:
                imported += 1
            continue

        # Long file — split by top-level `#` headings.
        chunks: List[str] = []
        current = ""
        for line in text.splitlines():
            if line.startswith("# "):
                if current.strip():
                    chunks.append(current)
                current = line + "\n"
            else:
                current += line + "\n"
        if current.strip():
            chunks.append(current)
        for i, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
            res = mem0.add_raw(
                chunk[:8000],  # mem0 has per-message size limits
                metadata={"source_file": name, "chunk_index": i,
                          "category": "doc_chunk"},
            )
            if res:
                imported += 1

    return {
        "found_files": found,
        "skipped_files": skipped,
        "items_imported": imported,
    }
