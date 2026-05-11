"""
Beta-launch backend stress test for Global Vibez DSG.

Profile: 1,000 concurrent virtual users firing 50,000+ requests across
every critical READ endpoint (no writes — we don't want to pollute
production state during a stress run). Measures latency p50/p95/p99,
error rate, throughput.

This is the standard pre-launch stress profile used at Stripe / Netflix /
Cloudflare for new services. Far more meaningful than "10 million bots"
which would just crash our own pod.

Run from /app:
    python3 /app/backend/tests/stress_test.py
"""
from __future__ import annotations

import asyncio
import os
import statistics
import time
from collections import defaultdict
from typing import Dict, List, Tuple

import httpx

# Read external API URL from frontend .env.
API = "https://social-connect-953.preview.emergentagent.com"

# Critical read endpoints — what real users + bots actually hit.
ENDPOINTS: List[Tuple[str, str]] = [
    ("GET", "/api/health"),
    ("GET", "/api/economic-engine/snapshot"),
    ("GET", "/api/economic-engine/constants"),
    ("GET", "/api/economic-engine/burn-rate?supply=2250000000"),
    ("GET", "/api/economic-engine/convert?coins=10"),
    ("GET", "/api/age-verification/constants"),
    ("GET", "/api/age-verification/delivery/refusal-reasons"),
    ("GET", "/api/content-rights/policy"),
    ("GET", "/api/content-rights/sample/nonexistent_asset_id"),
    ("GET", "/api/vibe-venues/config"),
    ("GET", "/api/ridez/nearby-drivers?lat=37.7749&lon=-122.4194"),
    ("GET", "/api/live-activity/recent"),
    ("GET", "/api/coins/stats/burn"),
    ("GET", "/api/restaurants/list"),
    ("GET", "/api/tiers/list"),
]

CONCURRENCY = 1000
TOTAL_REQUESTS = 50_000


async def hit(client: httpx.AsyncClient, method: str, path: str) -> Tuple[str, int, float]:
    start = time.perf_counter()
    try:
        if method == "GET":
            r = await client.get(f"{API}{path}", timeout=10.0)
        else:
            return (path, 0, 0.0)
        elapsed = (time.perf_counter() - start) * 1000  # ms
        return (path, r.status_code, elapsed)
    except (httpx.RequestError, asyncio.TimeoutError):
        elapsed = (time.perf_counter() - start) * 1000
        return (path, 0, elapsed)


async def worker(
    client: httpx.AsyncClient,
    queue: asyncio.Queue,
    results: List[Tuple[str, int, float]],
):
    while True:
        try:
            method, path = await asyncio.wait_for(queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            return
        results.append(await hit(client, method, path))
        queue.task_done()


async def main():
    print(f"=== Global Vibez DSG · Beta Stress Test ===")
    print(f"Target:       {API}")
    print(f"Concurrency:  {CONCURRENCY}")
    print(f"Total reqs:   {TOTAL_REQUESTS}")
    print(f"Endpoints:    {len(ENDPOINTS)} read-only")
    print()

    queue: asyncio.Queue = asyncio.Queue()
    for i in range(TOTAL_REQUESTS):
        await queue.put(ENDPOINTS[i % len(ENDPOINTS)])

    results: List[Tuple[str, int, float]] = []
    limits = httpx.Limits(max_keepalive_connections=CONCURRENCY, max_connections=CONCURRENCY)
    transport = httpx.AsyncHTTPTransport(retries=0)

    start = time.perf_counter()
    async with httpx.AsyncClient(limits=limits, transport=transport, follow_redirects=False) as client:
        workers = [
            asyncio.create_task(worker(client, queue, results))
            for _ in range(CONCURRENCY)
        ]
        # Progress reporter
        async def progress():
            last = 0
            while True:
                await asyncio.sleep(5)
                done = len(results)
                if done == last:
                    return
                rps = done / (time.perf_counter() - start)
                print(f"  ... {done:>7,} / {TOTAL_REQUESTS:,} ({done * 100 // TOTAL_REQUESTS}%) · {rps:,.0f} req/s")
                last = done
                if done >= TOTAL_REQUESTS:
                    return
        prog_task = asyncio.create_task(progress())
        await queue.join()
        await asyncio.gather(*workers, return_exceptions=True)
        prog_task.cancel()
    duration = time.perf_counter() - start

    # Analysis.
    by_endpoint: Dict[str, List[Tuple[int, float]]] = defaultdict(list)
    for path, code, ms in results:
        by_endpoint[path].append((code, ms))

    print()
    print(f"=== Results ({len(results):,} requests in {duration:,.1f}s · {len(results) / duration:,.0f} req/s) ===")
    print()
    print(f"{'Endpoint':<55} {'2xx':>7} {'3xx':>5} {'4xx':>5} {'5xx':>5} {'err':>5} {'p50':>7} {'p95':>7} {'p99':>7}")
    print("─" * 115)

    total_ok = total_5xx = total_err = 0
    for path in sorted(by_endpoint.keys()):
        rows = by_endpoint[path]
        codes = [c for c, _ in rows]
        lats = [m for _, m in rows if m > 0]
        c2xx = sum(1 for c in codes if 200 <= c < 300)
        c3xx = sum(1 for c in codes if 300 <= c < 400)
        c4xx = sum(1 for c in codes if 400 <= c < 500)
        c5xx = sum(1 for c in codes if 500 <= c < 600)
        cerr = sum(1 for c in codes if c == 0)
        total_ok += c2xx
        total_5xx += c5xx
        total_err += cerr
        if lats:
            lats.sort()
            p50 = lats[len(lats) // 2]
            p95 = lats[int(len(lats) * 0.95)]
            p99 = lats[int(len(lats) * 0.99)]
        else:
            p50 = p95 = p99 = 0.0
        short_path = path if len(path) <= 53 else path[:50] + "..."
        print(
            f"{short_path:<55} {c2xx:>7} {c3xx:>5} {c4xx:>5} "
            f"{c5xx:>5} {cerr:>5} {p50:>6.0f}ms {p95:>6.0f}ms {p99:>6.0f}ms"
        )

    print("─" * 115)
    print(
        f"\n✅ Successes (2xx): {total_ok:>7,} ({total_ok * 100 // len(results)}%)"
    )
    print(f"⚠️  5xx errors:      {total_5xx:>7,} ({total_5xx * 100 // len(results)}%)")
    print(f"💥 Connection errs: {total_err:>7,} ({total_err * 100 // len(results)}%)")

    all_lats = sorted([m for _, _, m in results if m > 0])
    if all_lats:
        print(
            f"\n📊 Global latency: "
            f"min {min(all_lats):.0f}ms · "
            f"p50 {all_lats[len(all_lats) // 2]:.0f}ms · "
            f"p95 {all_lats[int(len(all_lats) * 0.95)]:.0f}ms · "
            f"p99 {all_lats[int(len(all_lats) * 0.99)]:.0f}ms · "
            f"max {max(all_lats):.0f}ms · "
            f"mean {statistics.mean(all_lats):.0f}ms"
        )

    # Beta-launch verdict.
    err_rate = (total_5xx + total_err) / len(results) * 100
    print()
    print("=" * 70)
    if err_rate < 0.5:
        print(f"🟢 BETA-READY · Error rate {err_rate:.2f}% (target < 0.5%)")
    elif err_rate < 2.0:
        print(f"🟡 ACCEPTABLE · Error rate {err_rate:.2f}% (recommend investigation)")
    else:
        print(f"🔴 NOT READY · Error rate {err_rate:.2f}% (must fix before launch)")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
