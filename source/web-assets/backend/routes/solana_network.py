"""
Solana network monitor — endpoints feeding the God-Mode dashboard
widgets (Gas Monitor + TPS Graph).

  GET /api/solana/network/fees     — recent prioritization fees (low/med/high)
  GET /api/solana/network/tps      — recent performance samples (TPS series)

Reads VIBEZ_SOLANA_RPC from env (currently Devnet — flat data — auto-flips
to Mainnet the moment that env var changes). All numbers are derived
purely from RPC responses; no DB writes.

Both endpoints are admin-only because the data is platform-ops level
and we don't want to expose RPC quota to public callers.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from routes.admin_dashboard import verify_admin_cookie

logger = logging.getLogger(__name__)
router = APIRouter()


def _rpc_url() -> str:
    return os.environ.get("VIBEZ_SOLANA_RPC") or "https://api.mainnet-beta.solana.com"


def _is_mainnet() -> bool:
    """True if the configured RPC is mainnet — used to label widgets and
    surface the "still on Devnet" hint until the founder says 'domains'."""
    url = _rpc_url().lower()
    return "mainnet" in url or (
        "helius-rpc.com/?api-key" in url and "devnet" not in url
    )


@router.get("/solana/network/fees")
async def solana_fees(
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Pull the last ~150 blocks of prioritization fees and bucket them
    into low (25th percentile) / med (50th) / high (90th) lamports/CU.
    Devnet returns near-zero values; mainnet returns realistic ones.

    Uses raw JSON-RPC because solana-py 0.36 doesn't expose
    getRecentPrioritizationFees as a typed method yet.
    """
    import httpx  # noqa: PLC0415

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getRecentPrioritizationFees",
        "params": [],
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(_rpc_url(), json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.warning(f"[solana] getRecentPrioritizationFees failed: {e}")
        raise HTTPException(502, f"RPC error: {e}")

    rows = data.get("result") or []
    raw_fees: List[int] = sorted(
        int(r.get("prioritizationFee", 0)) for r in rows
    )
    n = len(raw_fees)

    if n == 0:
        return {
            "rpc_url": _rpc_url(),
            "is_mainnet": _is_mainnet(),
            "samples": 0,
            "low": 0, "med": 0, "high": 0,
            "low_sol": 0.0, "med_sol": 0.0, "high_sol": 0.0,
        }

    def pct(p: float) -> int:
        idx = max(0, min(n - 1, int(round(p * (n - 1)))))
        return int(raw_fees[idx])

    low = pct(0.25)
    med = pct(0.50)
    high = pct(0.90)
    LAMPORTS_PER_SOL = 1_000_000_000
    CU_PER_TX = 200_000

    def to_sol(micro: int) -> float:
        return round((micro * CU_PER_TX) / 1_000_000 / LAMPORTS_PER_SOL, 9)

    return {
        "rpc_url": _rpc_url(),
        "is_mainnet": _is_mainnet(),
        "samples": n,
        "low": low,
        "med": med,
        "high": high,
        "low_sol": to_sol(low),
        "med_sol": to_sol(med),
        "high_sol": to_sol(high),
    }


@router.get("/solana/network/tps")
async def solana_tps(
    samples: int = 30,
    _: bool = Depends(verify_admin_cookie),
) -> Dict[str, Any]:
    """Recent performance samples → TPS series for the live throughput
    chart. `samples` capped at 60 (each sample is ~1 minute of slots)."""
    try:
        from solana.rpc.async_api import AsyncClient  # noqa: PLC0415
    except ImportError:
        raise HTTPException(503, "solana-py not installed")

    samples = max(1, min(samples, 60))
    client = AsyncClient(_rpc_url())
    try:
        resp = await client.get_recent_performance_samples(samples)
    except Exception as e:
        await client.close()
        logger.warning(f"[solana] get_recent_performance_samples failed: {e}")
        raise HTTPException(502, f"RPC error: {e}")
    finally:
        await client.close()

    series = []
    rows = list(reversed(resp.value or []))  # oldest → newest for charting
    for r in rows:
        n_tx = getattr(r, "num_transactions", 0) or 0
        period_secs = getattr(r, "sample_period_secs", 60) or 60
        slot = getattr(r, "slot", 0) or 0
        tps = round(n_tx / period_secs, 2) if period_secs else 0
        series.append({
            "slot": int(slot),
            "n_transactions": int(n_tx),
            "period_secs": int(period_secs),
            "tps": tps,
        })

    avg_tps = round(
        sum(p["tps"] for p in series) / len(series), 2,
    ) if series else 0
    peak_tps = max((p["tps"] for p in series), default=0)

    return {
        "rpc_url": _rpc_url(),
        "is_mainnet": _is_mainnet(),
        "samples": len(series),
        "avg_tps": avg_tps,
        "peak_tps": peak_tps,
        "series": series,
    }
