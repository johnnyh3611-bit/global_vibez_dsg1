"""Master Stress-Test Suite — Global Vibez DSG 100K CCU Verification.

Implements the four core tests defined in the founder-uploaded
`Global_Vibez_DSG_Master_Test_Suite.pdf` (May 2026):

  TEST 1 — API & Signaling load (FastAPI /join, 10,000 concurrent)
  TEST 2 — $VIBEZ gifting & ledger speed (target 0.01 s / tx, 5,000 hits)
  TEST 3 — VibeRidez / Hungry Vibez geolocation (Redis GEOADD throughput)
  TEST 4 — UE5 server tick audit (read-only acknowledgement — UE not on stack)

CRITICAL: per the PDF — these MUST run against a staging environment.
Running them against a single local machine will trigger hardware
exhaustion. Each test is gated by an env-var safety toggle.

Run:
    GVDSG_STRESS_ENABLE=1 python -m backend.scripts.master_stress_suite
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import statistics
import time
from typing import Any, Dict, List

import aiohttp

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("stress-suite")

API_URL = os.environ.get("STRESS_API_URL") or os.environ.get(
    "REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com",
)

# Per-test scale knobs — defaults match the PDF, but operators can dial down
# locally so the suite can be smoke-tested without melting the laptop.
TEST1_CONCURRENT_REQUESTS = int(os.environ.get("TEST1_CONCURRENT", "10000"))
TEST2_GIFT_HITS = int(os.environ.get("TEST2_HITS", "5000"))
TEST2_TARGET_S_PER_TX = float(os.environ.get("TEST2_TARGET_TX_S", "0.01"))
TEST3_GEOADD_HITS = int(os.environ.get("TEST3_HITS", "1000"))


# ─────────────────────────────────────────── TEST 1 ──
async def test1_api_signaling_load() -> Dict[str, Any]:
    """Hammer the API with the PDF's exact payload + endpoint."""
    log.info("TEST 1 — API & Signaling load: %d concurrent requests", TEST1_CONCURRENT_REQUESTS)
    payload = {"user_id": "user_id", "action": "join_casino"}
    sem = asyncio.Semaphore(500)   # bound socket use even at 10k tasks
    timeout = aiohttp.ClientTimeout(total=1.5)  # Master Blueprint §1: 1.5s per request

    success = 0
    error = 0
    latencies: List[float] = []
    start = time.time()

    async with aiohttp.ClientSession(timeout=timeout) as session:
        async def one():
            nonlocal success, error
            async with sem:
                t0 = time.time()
                try:
                    async with session.post(
                        f"{API_URL}/api/v1/join",
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    ) as resp:
                        latencies.append(time.time() - t0)
                        if resp.status == 200:
                            success += 1
                        else:
                            error += 1
                except Exception:
                    latencies.append(time.time() - t0)
                    error += 1

        await asyncio.gather(*[one() for _ in range(TEST1_CONCURRENT_REQUESTS)])

    elapsed = time.time() - start
    return {
        "name": "TEST 1: API & Signaling load",
        "concurrent": TEST1_CONCURRENT_REQUESTS,
        "elapsed_s": round(elapsed, 2),
        "success": success,
        "error": error,
        "throughput_rps": round(TEST1_CONCURRENT_REQUESTS / max(elapsed, 0.001), 1),
        "p50_ms": round(statistics.median(latencies) * 1000, 1) if latencies else None,
        "p95_ms": round(_pct(latencies, 0.95) * 1000, 1) if latencies else None,
        "p99_ms": round(_pct(latencies, 0.99) * 1000, 1) if latencies else None,
    }


# ─────────────────────────────────────────── TEST 2 ──
async def test2_gifting_ledger_speed() -> Dict[str, Any]:
    """Rapid-fire JFTN gifting endpoint, measure per-tx latency."""
    log.info("TEST 2 — $VIBEZ gifting & ledger speed: %d hits", TEST2_GIFT_HITS)
    payload = {
        "gifter_user_id": "stress_user_1",
        "recipient_user_id": "stress_user_2",
        "room_id": "stress_room",
        "gift_type": "rose",
        "coin_amount": 50,
    }
    timeout = aiohttp.ClientTimeout(total=5)
    latencies: List[float] = []
    success = 0
    error = 0
    start = time.time()

    sem = asyncio.Semaphore(200)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async def one():
            nonlocal success, error
            async with sem:
                t0 = time.time()
                try:
                    async with session.post(
                        f"{API_URL}/api/just-for-the-night/rooms/gift",
                        json=payload,
                    ) as resp:
                        latencies.append(time.time() - t0)
                        if resp.status in (200, 201):
                            success += 1
                        else:
                            error += 1
                except Exception:
                    latencies.append(time.time() - t0)
                    error += 1

        await asyncio.gather(*[one() for _ in range(TEST2_GIFT_HITS)])

    elapsed = time.time() - start
    avg_s_per_tx = (sum(latencies) / len(latencies)) if latencies else None
    return {
        "name": "TEST 2: $VIBEZ gifting & ledger speed",
        "hits": TEST2_GIFT_HITS,
        "elapsed_s": round(elapsed, 2),
        "success": success,
        "error": error,
        "avg_s_per_tx": round(avg_s_per_tx, 4) if avg_s_per_tx else None,
        "target_s_per_tx": TEST2_TARGET_S_PER_TX,
        "meets_target": (avg_s_per_tx is not None) and (avg_s_per_tx <= TEST2_TARGET_S_PER_TX),
    }


# ─────────────────────────────────────────── TEST 3 ──
async def test3_geolocation_throughput() -> Dict[str, Any]:
    """Bulk GEOADD onto the Blueprint's `driver_locations` key.
    If Redis isn't configured the test reports `skipped=True`."""
    log.info("TEST 3 — Geolocation throughput: %d GEOADD operations", TEST3_GEOADD_HITS)
    from services.scale_cache import geo_add_driver, is_redis_enabled  # noqa: PLC0415
    if not is_redis_enabled():
        return {
            "name": "TEST 3: Geolocation",
            "skipped": True,
            "reason": "REDIS_URL not configured — geo throughput test requires Redis",
        }
    start = time.time()
    ok = 0
    err = 0
    for i in range(TEST3_GEOADD_HITS):
        # Spread fake drivers across a roughly NYC bounding box
        lon = -74.0 + (i % 100) * 0.001
        lat = 40.7 + (i % 100) * 0.001
        success = await geo_add_driver(f"stress_driver_{i}", lon, lat)
        if success:
            ok += 1
        else:
            err += 1
    elapsed = time.time() - start
    return {
        "name": "TEST 3: Geolocation throughput",
        "hits": TEST3_GEOADD_HITS,
        "success": ok,
        "error": err,
        "elapsed_s": round(elapsed, 2),
        "ops_per_sec": round(TEST3_GEOADD_HITS / max(elapsed, 0.001), 1),
    }


# ─────────────────────────────────────────── TEST 4 ──
def test4_unreal_engine_tick_audit() -> Dict[str, Any]:
    """The Blueprint PDF specifies an Unreal Engine 5 `stat Game` audit.
    Global Vibez is a web app — UE is not on the stack. We report this
    explicitly so the test suite is honest, not silently green."""
    return {
        "name": "TEST 4: UE5 server tick audit",
        "skipped": True,
        "reason": (
            "Unreal Engine 5 is not part of the Global Vibez stack "
            "(React 19 + FastAPI + MongoDB). UE concepts in the High "
            "Roller PDF are approximated via React/WebGL — see "
            "/casino/high-roller for the web equivalent."
        ),
    }


# ─────────────────────────────────────────── Helpers ──
def _pct(values: List[float], pct: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = min(int(round(pct * (len(s) - 1))), len(s) - 1)
    return s[idx]


async def run_all() -> Dict[str, Any]:
    results = {
        "api_url": API_URL,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "tests": {},
    }
    results["tests"]["test1"] = await test1_api_signaling_load()
    results["tests"]["test2"] = await test2_gifting_ledger_speed()
    results["tests"]["test3"] = await test3_geolocation_throughput()
    results["tests"]["test4"] = test4_unreal_engine_tick_audit()
    results["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return results


if __name__ == "__main__":
    if os.environ.get("GVDSG_STRESS_ENABLE") != "1":
        print(
            "Refusing to run — set GVDSG_STRESS_ENABLE=1 to enable.\n"
            "Per PDF: this MUST run against staging, never a single local machine.",
        )
        raise SystemExit(2)
    out = asyncio.run(run_all())
    print(json.dumps(out, indent=2))
