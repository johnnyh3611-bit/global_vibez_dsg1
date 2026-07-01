"""
Per-route latency telemetry — p50/p95 snapshot for the admin dashboard.

Records every API request's duration into a per-route bounded deque (1024
samples max) so memory stays flat under load. The `/api/admin/perf-snapshot`
endpoint reads from this in-process store; nothing is persisted to disk.

Why deques and not Mongo? This is operator-grade telemetry — we want zero
DB write amplification and zero IO on every request. A 1024-sample rolling
window per route gives very stable p95 for any route hit > ~10×/min, and
the whole snapshot fits in well under 1 MB.
"""
from __future__ import annotations

import time
from collections import deque
from statistics import median
from threading import Lock
from typing import Deque, Dict, List

from fastapi import FastAPI, Request

# ───────────────────────────── store
_MAX_SAMPLES_PER_ROUTE = 1024
_samples: Dict[str, Deque[float]] = {}
_lock = Lock()


def _record(route: str, ms: float) -> None:
    with _lock:
        bucket = _samples.get(route)
        if bucket is None:
            bucket = deque(maxlen=_MAX_SAMPLES_PER_ROUTE)
            _samples[route] = bucket
        bucket.append(ms)


def _percentile(sorted_data: List[float], pct: float) -> float:
    """Inclusive p-th percentile via linear interpolation. ``sorted_data``
    must already be sorted ascending. Returns 0.0 for empty input."""
    if not sorted_data:
        return 0.0
    if len(sorted_data) == 1:
        return sorted_data[0]
    k = (len(sorted_data) - 1) * pct
    f = int(k)
    c = min(f + 1, len(sorted_data) - 1)
    if f == c:
        return sorted_data[f]
    return sorted_data[f] + (sorted_data[c] - sorted_data[f]) * (k - f)


def snapshot() -> Dict[str, object]:
    """Build the public payload — one row per route, sorted by p95 desc."""
    with _lock:
        rows = []
        for route, bucket in _samples.items():
            if not bucket:
                continue
            arr = sorted(bucket)
            rows.append({
                "route": route,
                "samples": len(arr),
                "p50_ms": round(median(arr), 2),
                "p95_ms": round(_percentile(arr, 0.95), 2),
                "p99_ms": round(_percentile(arr, 0.99), 2),
                "max_ms": round(arr[-1], 2),
                "avg_ms": round(sum(arr) / len(arr), 2),
            })
        rows.sort(key=lambda r: r["p95_ms"], reverse=True)
        total_samples = sum(r["samples"] for r in rows)
    return {
        "success": True,
        "tracked_routes": len(rows),
        "total_samples": total_samples,
        "samples_per_route_cap": _MAX_SAMPLES_PER_ROUTE,
        "rows": rows,
    }


def reset() -> None:
    """Wipe all samples — useful for tests and operator-driven baselines."""
    with _lock:
        _samples.clear()


# ───────────────────────────── middleware
def install_perf_middleware(app: FastAPI) -> None:
    """Attach the latency-recording middleware to the FastAPI app.

    Records ``elapsed_ms`` for every API request that reaches a routed
    handler. We key by the *route template* (e.g., ``/api/admin/all-users``)
    not the resolved path, so admin-IDs and user-IDs don't shard the buckets.
    """
    @app.middleware("http")
    async def _record_request_latency(request: Request, call_next):
        # Only meter the API surface — static assets and Socket.IO are
        # routed through different code paths and would skew the report.
        path = request.url.path
        if not path.startswith("/api/"):
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        # Prefer the matched route template if FastAPI resolved one.
        route_obj = request.scope.get("route")
        route_key = getattr(route_obj, "path", None) or path
        method = request.method.upper()
        _record(f"{method} {route_key}", elapsed_ms)
        return response
