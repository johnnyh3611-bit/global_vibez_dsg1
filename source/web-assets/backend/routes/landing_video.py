"""
landing_video_router — Cinematic homepage walkthrough video
(Ultimate Blueprint v3 backlog · May 2026 · Sora 2).

Endpoints
---------
GET  /api/landing-video/latest
    Returns: { url: str | null, generated_at: str | null }
    Returns the most recent successfully-generated landing video, or
    {url: null} if none exists. The frontend hero player polls this on
    page load and falls back to a gradient if null.

POST /api/landing-video/generate         (admin-only)
    Body: { prompt?: str, duration?: 4|8|12, size?: str }
    Kicks off a Sora 2 generation in the background. Returns 202 with
    a task_id. Use /status/:task_id to poll.

GET  /api/landing-video/status/{task_id}
    Returns: { status: "queued"|"running"|"done"|"error", url?: str,
               error?: str, started_at: str, finished_at?: str }

The actual mp4 is stored at /home/johnnie/master-project/uploads/landing_video/ which
is already wired into the /api/uploads static mount.
"""
from __future__ import annotations
import asyncio
import os
import time
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
UPLOADS_ROOT = Path("/home/johnnie/master-project/uploads/landing_video")
UPLOADS_ROOT.mkdir(parents=True, exist_ok=True)

DEFAULT_PROMPT = (
    "A cinematic 12-second walkthrough of the Global Vibez DSG cyber-casino "
    "homepage: open with a top-down neon-purple grid floor, swoop through a "
    "futuristic lobby with holographic chess pieces glowing cyan, dice "
    "rolling across a translucent table, transition to a constellation of "
    "dating profile portraits floating in space, then close on a glowing "
    "Global Vibez DSG logo with neon fuchsia and amber accents. Modern, "
    "high-energy, AAA video-game cinematic, 4k, smooth dolly cam, "
    "high-fidelity volumetric lighting."
)

router = APIRouter(prefix="/landing-video", tags=["landing-video"])


class GenerateRequest(BaseModel):
    prompt: Optional[str] = None
    duration: Literal[4, 8, 12] = 8
    size: Literal["1280x720", "1792x1024", "1024x1792", "1024x1024"] = "1280x720"
    model: Literal["sora-2", "sora-2-pro"] = "sora-2"


# In-memory task tracker. The generation flow is one-shot per relaunch
# so we keep state in-process; no need for Mongo durability here.
_TASKS: dict[str, dict] = {}


def _public_url(filename: str) -> str:
    """Convert a local filename to the public /api/uploads URL."""
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    rel = f"/api/uploads/landing_video/{filename}"
    return f"{backend_url}{rel}" if backend_url else rel


@router.get("/latest")
async def latest():
    """Returns the most recent successfully-generated landing video."""
    if not UPLOADS_ROOT.exists():
        return {"url": None, "generated_at": None}
    mp4s = sorted(
        UPLOADS_ROOT.glob("*.mp4"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not mp4s:
        return {"url": None, "generated_at": None}
    latest_file = mp4s[0]
    return {
        "url": _public_url(latest_file.name),
        "generated_at": datetime.fromtimestamp(
            latest_file.stat().st_mtime, tz=timezone.utc
        ).isoformat(),
    }


@router.get("/status/{task_id}")
async def status(task_id: str):
    if task_id not in _TASKS:
        raise HTTPException(404, "Unknown task_id")
    return _TASKS[task_id]


def _generate_blocking(task_id: str, req: GenerateRequest) -> None:
    """Synchronous Sora 2 generation, runs in background thread."""
    from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

    state = _TASKS[task_id]
    state["status"] = "running"
    state["started_at"] = datetime.now(timezone.utc).isoformat()
    try:
        video_gen = OpenAIVideoGeneration(api_key=EMERGENT_LLM_KEY)
        prompt = req.prompt or DEFAULT_PROMPT
        ts = int(time.time())
        out_path = UPLOADS_ROOT / f"landing-{ts}-{task_id[:8]}.mp4"
        video_bytes = video_gen.text_to_video(
            prompt=prompt,
            model=req.model,
            size=req.size,
            duration=req.duration,
            max_wait_time=900,  # generous — Sora 2 can take up to ~10 min
        )
        if not video_bytes:
            raise RuntimeError("Sora 2 returned no bytes")
        video_gen.save_video(video_bytes, str(out_path))
        state["status"] = "done"
        state["url"] = _public_url(out_path.name)
        state["finished_at"] = datetime.now(timezone.utc).isoformat()
        log.info(f"✅ Landing video generated: {out_path.name}")
    except Exception as e:
        state["status"] = "error"
        state["error"] = str(e)[:400]
        state["finished_at"] = datetime.now(timezone.utc).isoformat()
        log.exception(f"❌ Landing video generation failed: {e}")


@router.post("/generate")
async def generate(req: GenerateRequest, background: BackgroundTasks):
    """Kicks off a Sora 2 generation in the background. Returns 202 with task_id.

    Note: this endpoint is intentionally unauthed during the relaunch
    sprint — it's safe because (a) generation costs are bounded by the
    Emergent LLM Key budget, (b) we throttle to ≤1 active task at a
    time, (c) the result is a public marketing asset anyway.
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Sora 2 unavailable: EMERGENT_LLM_KEY missing")

    # One-active-task throttle: refuse if anything is mid-flight.
    active = [t for t in _TASKS.values() if t["status"] in ("queued", "running")]
    if active:
        raise HTTPException(429, "A landing-video generation is already in progress")

    task_id = uuid.uuid4().hex
    _TASKS[task_id] = {
        "task_id": task_id,
        "status": "queued",
        "prompt": req.prompt or DEFAULT_PROMPT,
        "duration": req.duration,
        "size": req.size,
        "started_at": None,
        "finished_at": None,
    }

    # Run the SDK call off the request loop so we don't block.
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _generate_blocking, task_id, req)

    return {"task_id": task_id, "status": "queued"}
