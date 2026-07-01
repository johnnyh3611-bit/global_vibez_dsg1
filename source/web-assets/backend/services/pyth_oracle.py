"""
Pyth Network price-oracle client (Solana).

Uses Pyth's public Hermes endpoint — no API key required.
https://hermes.pyth.network/

We use this for:
  - Dollar-equivalent refunds (manifesto §1: "if they paid $5 and $DSG
    is at $0.05, they get 100 $DSG; if it drops to $0.01, they get 500").
  - The Floor-Price Circuit Breaker (manifesto §3): pause auto-refunds
    if $DSG drops below the configured floor.
  - The Solvency Meter on /treasury (manifesto §4).

Token feeds (Pyth uses fixed feed IDs):
  - SOL/USD:   0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
  - USDC/USD:  0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a

For our internal $DSG token we don't have a real Pyth feed yet (token
isn't listed). Fall back to a configured `VIBEZ_USD_PRICE` env var
(defaults to $0.05) until we go live on Mainnet.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

PYTH_HERMES = "https://hermes.pyth.network"

PYTH_SOL_USD = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
PYTH_USDC_USD = "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"


async def fetch_pyth_price(feed_id: str, *, timeout: float = 6.0) -> Optional[float]:
    """Fetch the latest USD price for a Pyth feed. None on any failure."""
    url = f"{PYTH_HERMES}/api/latest_price_feeds?ids[]={feed_id}"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url)
            if r.status_code != 200:
                logger.warning(f"[pyth] {feed_id[:16]}…: HTTP {r.status_code}")
                return None
            data = r.json()
            if not data or not isinstance(data, list):
                return None
            px = data[0].get("price", {})
            raw = float(px.get("price", 0))
            expo = int(px.get("expo", 0))
            return raw * (10 ** expo)
    except Exception as exc:
        logger.warning(f"[pyth] fetch error: {exc}")
        return None


async def get_sol_usd() -> Optional[float]:
    return await fetch_pyth_price(PYTH_SOL_USD)


async def get_usdc_usd() -> Optional[float]:
    return await fetch_pyth_price(PYTH_USDC_USD)


def get_vibez_usd() -> float:
    """Internal VIBEZ price (no Pyth feed yet — Devnet token).

    Reads ``VIBEZ_USD_PRICE`` env var. Defaults to ``0.05`` so the
    refund engine can still compute deterministic outputs on Devnet.
    """
    try:
        return float(os.environ.get("VIBEZ_USD_PRICE", "0.05"))
    except ValueError:
        return 0.05


def usd_to_vibez(usd: float) -> int:
    """Convert USD → integer Vibez Coins (always int per rulebook §3)."""
    price = get_vibez_usd()
    if price <= 0:
        return 0
    return max(0, int(round(usd / price)))
