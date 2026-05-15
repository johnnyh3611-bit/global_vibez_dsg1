"""
Real User Monitoring (RUM) collector — item 8/8 of the Feb 2026 roadmap.

Frontend sends performance + error beacons here. We store the last 5K
samples per metric in a capped buffer. The /metrics endpoint exposes
aggregate p50/p95/p99 + counts for the ops dashboard. No 3rd-party
SaaS — pure local for now.
"""
from __future__ import annotations

import os
from collections import deque
from datetime import datetime, timezone

from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field


_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "vibez_global")
_client = AsyncIOMotorClient(_MONGO_URL)
_db = _client[_DB_NAME]
_rum_col = _db["rum_beacons"]


# In-process ring buffer for fast aggregates without hitting Mongo.
_RING_SIZE = 5000
_rings: dict[str, deque] = {}


def _ring(metric: str) -> deque:
    if metric not in _rings:
        _rings[metric] = deque(maxlen=_RING_SIZE)
    return _rings[metric]


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    sv = sorted(values)
    idx = int(round((p / 100) * (len(sv) - 1)))
    return float(sv[idx])


router = APIRouter(prefix="/rum", tags=["rum"])


class Beacon(BaseModel):
    metric: str = Field(..., min_length=1, max_length=60)
    value: float
    route: str | None = None
    user_id: str | None = None
    ua: str | None = Field(default=None, max_length=200)


@router.post("/beacon")
async def receive_beacon(b: Beacon):
    """Frontend posts a performance sample. Stored in Mongo (last 100K)
    + in-process ring (last 5K per metric)."""
    _ring(b.metric).append(b.value)
    await _rum_col.insert_one({
        **b.model_dump(),
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "ok"}


@router.get("/metrics")
async def get_metrics():
    """Snapshot of every metric ring buffer (p50/p95/p99/count)."""
    out = {}
    for metric, ring in _rings.items():
        vals = list(ring)
        if not vals:
            continue
        out[metric] = {
            "count": len(vals),
            "p50": round(_percentile(vals, 50), 2),
            "p95": round(_percentile(vals, 95), 2),
            "p99": round(_percentile(vals, 99), 2),
            "avg": round(sum(vals) / len(vals), 2),
            "max": round(max(vals), 2),
        }
    return {"metrics": out, "ring_size": _RING_SIZE}
