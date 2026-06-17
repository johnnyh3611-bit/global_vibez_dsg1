"""
Performance alert webhook — pings Slack/Discord when route p95 crosses
a threshold. Lightweight, fire-and-forget background loop that taps
the existing in-process telemetry (`services.perf_telemetry.snapshot`)
every 60 seconds and dedupes alerts so we don't spam the channel.

ENV (all optional — feature is fully off if `PERF_ALERT_WEBHOOK_URL`
is unset, even after a redeploy):
  • PERF_ALERT_WEBHOOK_URL    — Slack/Discord incoming-webhook URL
  • PERF_ALERT_THRESHOLD_MS   — p95 alarm threshold in ms (default 1000)
  • PERF_ALERT_MIN_SAMPLES    — minimum samples in the bucket before we
                                trust the p95 (default 30)
  • PERF_ALERT_COOLDOWN_S     — per-route cooldown between repeat alerts
                                (default 600 = 10 min)
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Dict, Optional

import httpx

logger = logging.getLogger(__name__)

POLL_INTERVAL_S = 60


def _env_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


def _webhook_url() -> str:
    return (os.environ.get("PERF_ALERT_WEBHOOK_URL") or "").strip()


def _threshold_ms() -> int:
    return _env_int("PERF_ALERT_THRESHOLD_MS", 1000)


def _min_samples() -> int:
    return _env_int("PERF_ALERT_MIN_SAMPLES", 30)


def _cooldown_s() -> int:
    return _env_int("PERF_ALERT_COOLDOWN_S", 600)


# Per-route timestamp of the last alert sent — keeps us from spamming the
# channel while a route is consistently slow.
_LAST_ALERT_AT: Dict[str, float] = {}


def _format_message(route: str, p95: float, p50: float, samples: int) -> dict:
    """Build a payload that works for BOTH Slack and Discord webhooks.

    Slack ignores the `content` key, Discord ignores `text` — sending
    both fields is harmless and makes the same loop work for both
    targets without environment-sniffing.
    """
    summary = (
        f"⚠️ *Vibez perf alert* — `{route}` p95 = {p95:.0f}ms "
        f"(p50 {p50:.0f}ms · {samples} samples · threshold {_threshold_ms()}ms)"
    )
    return {"text": summary, "content": summary}


async def _post_alert(client: httpx.AsyncClient, payload: dict) -> bool:
    url = _webhook_url()
    if not url:
        return False
    try:
        r = await client.post(url, json=payload, timeout=8)
        r.raise_for_status()
        return True
    except Exception as exc:
        logger.warning(f"[perf-alert] webhook POST failed: {exc}")
        return False


async def perf_alert_loop() -> None:
    """Long-running coroutine. Started from the FastAPI lifespan if the
    webhook URL is set. Exits silently otherwise."""
    if not _webhook_url():
        logger.info("[perf-alert] disabled (set PERF_ALERT_WEBHOOK_URL to enable)")
        return

    threshold = _threshold_ms()
    min_samples = _min_samples()
    cooldown = _cooldown_s()
    logger.info(
        f"[perf-alert] enabled · threshold={threshold}ms · min_samples="
        f"{min_samples} · cooldown={cooldown}s"
    )

    async with httpx.AsyncClient() as client:
        while True:
            try:
                from services.perf_telemetry import snapshot  # local import — module may not be loaded yet
                snap = snapshot()
                rows = snap.get("rows") or []
                now = time.monotonic()

                for row in rows:
                    p95 = float(row.get("p95_ms") or 0)
                    samples = int(row.get("samples") or 0)
                    route = row.get("route") or "?"
                    if p95 < threshold or samples < min_samples:
                        continue
                    last = _LAST_ALERT_AT.get(route, 0)
                    if (now - last) < cooldown:
                        continue
                    payload = _format_message(
                        route, p95, float(row.get("p50_ms") or 0), samples
                    )
                    sent = await _post_alert(client, payload)
                    if sent:
                        _LAST_ALERT_AT[route] = now
                        logger.info(
                            f"[perf-alert] sent for {route} (p95={p95:.0f}ms)"
                        )
            except Exception as exc:
                # The loop must NEVER die — a transient telemetry hiccup
                # shouldn't blow up the whole alert pipeline.
                logger.warning(f"[perf-alert] cycle error: {exc}")
            await asyncio.sleep(POLL_INTERVAL_S)


# ──────────────────────────────────── admin trigger (manual test)

from fastapi import APIRouter, Depends, HTTPException  # noqa: E402
from routes.admin_dashboard import verify_admin_cookie  # noqa: E402

router = APIRouter()


@router.post("/admin/perf-alert/test")
async def perf_alert_test(_: bool = Depends(verify_admin_cookie)):
    """Fire a one-off test alert at the configured webhook so the
    operator can confirm Slack/Discord wiring without waiting for a
    real slow route. Returns 503 if the webhook isn't configured."""
    if not _webhook_url():
        raise HTTPException(503, detail="PERF_ALERT_WEBHOOK_URL not configured")
    payload = {
        "text": "✅ *Vibez perf alert test* — webhook is wired correctly.",
        "content": "✅ Vibez perf alert test — webhook is wired correctly.",
    }
    async with httpx.AsyncClient() as client:
        ok = await _post_alert(client, payload)
    if not ok:
        raise HTTPException(502, detail="webhook POST failed (see backend logs)")
    return {"ok": True, "sent": True}


@router.get("/admin/perf-alert/status")
async def perf_alert_status(_: bool = Depends(verify_admin_cookie)):
    """Read-only snapshot of the alert config + per-route cooldowns."""
    return {
        "configured": bool(_webhook_url()),
        "threshold_ms": _threshold_ms(),
        "min_samples": _min_samples(),
        "cooldown_s": _cooldown_s(),
        "active_cooldowns": {
            route: round(time.monotonic() - ts, 1)
            for route, ts in _LAST_ALERT_AT.items()
        },
    }
