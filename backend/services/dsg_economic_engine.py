"""
DSG Economic Engine — Vibez Coin Dual-Asset Shield.

Encodes the spec from `Global_Vibez_DSG_Economic_Engine.pdf` (2026-05-13):
maintains $1.00 parity for the main in-app **Vibez Coin** via a dynamic
burn rate (4% → 0.5%) that scales as supply approaches the 1.5B
stabilization target, plus a 50/50 split of fee revenue between
buybacks/burn and a USD liquidity floor.

Complements (does NOT replace) the existing DSG **Golden-Asset Token**
burn schedule in `services/ai_governor.py` (750M supply, 350M floor,
5% ceiling). Two assets:

  * Vibez Coin     — 3,000,000,000 init · 1,500,000,000 stabilization
                     target · 4% → 0.5% dynamic burn · this module
  * DSG Token      — 750,000,000 supply · 350,000,000 floor · 5%
                     ceiling · ai_governor.py (separate)

State is persisted in two Mongo collections:

  * dsg_economic_state   — singleton doc {_id:"current"} holding
                           live `current_supply` + `liquidity_fund_usd`
  * dsg_economic_events  — append-only audit log of every burn,
                           liquidity-fund deposit, and dynamic-price
                           query (so we can prove the engine's actions
                           on-demand to investors / regulators)

All math is deterministic and the spec's Python reference is preserved
verbatim in `calculate_dynamic_burn_rate()`.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ───────────────────────────────────────── Spec-locked constants ──
# Burn-rate curve endpoints (Vibez Coin).
INITIAL_SUPPLY: int = 3_000_000_000
STABILIZATION_TARGET_SUPPLY: int = 1_500_000_000

# DSG Token (Golden Asset) supply — exposed here for surface unity, but
# managed elsewhere (see services/ai_governor.py).
GOLDEN_ASSET_SUPPLY: int = 750_000_000

# Burn rate bounds per spec.
INITIAL_BURN_RATE: float = 0.04      # 4 % at 3 B supply
MINIMUM_BURN_RATE: float = 0.005     # 0.5 % once supply <= 1.5 B target
BURN_RATE_SPREAD: float = INITIAL_BURN_RATE - MINIMUM_BURN_RATE  # 0.035

# 50/50 revenue allocation: half to buyback+burn, half to USD liquidity floor.
REVENUE_SPLIT_RATIO: float = 0.50

# Default utility-room fixed-USD anchor used by `calculate_dynamic_price`.
# Spec callout: "$10 value regardless of the coin's price".
DEFAULT_UTILITY_COST_USD: float = 10.00

# Parity target the engine optimizes around.
PARITY_USD: float = 1.00


# ───────────────────────────────────────── Pure-math helpers ──

def calculate_dynamic_burn_rate(current_supply: float) -> float:
    """
    Dynamic burn rate as a function of `current_supply`.

    Spec Python (preserved verbatim from the PDF):
        if current_supply <= target:
            return min_rate
        progress = (current_supply - target) / (initial - target)
        return round(min_rate + spread * progress, 4)

    Endpoints:
      * current_supply == 3 B  → 4 %   (max burn, fight inflation)
      * current_supply == 1.5 B → 0.5 % (parity reached, low burn)
      * current_supply < 1.5 B  → 0.5 % (floor, never lower)
    """
    if current_supply <= STABILIZATION_TARGET_SUPPLY:
        return round(MINIMUM_BURN_RATE, 4)

    progress = (current_supply - STABILIZATION_TARGET_SUPPLY) / (
        INITIAL_SUPPLY - STABILIZATION_TARGET_SUPPLY
    )
    progress = max(0.0, min(1.0, progress))  # safety clamp
    rate = MINIMUM_BURN_RATE + BURN_RATE_SPREAD * progress
    return round(rate, 4)


def calculate_dynamic_price(cost_usd: float, coin_price_usd: float) -> float:
    """
    Coins required to pay a fixed-USD utility-room cost.

    Used by HungryVibes / VibeRidez / Vibe Venues so a $10 ride is
    *always* a $10 ride regardless of the live coin price.

    Returns the number of coins (float — caller decides rounding policy).
    Raises ValueError on a non-positive coin_price.
    """
    if coin_price_usd <= 0:
        raise ValueError("coin_price_usd must be > 0")
    return cost_usd / coin_price_usd


def split_revenue(amount_usd: float) -> Dict[str, float]:
    """
    50/50 split: half to liquidity fund, half to buyback+burn.

    Returns {"liquidity_usd": x, "buyback_usd": x}.
    """
    if amount_usd < 0:
        raise ValueError("amount_usd must be >= 0")
    liquidity = round(amount_usd * REVENUE_SPLIT_RATIO, 6)
    buyback = round(amount_usd - liquidity, 6)
    return {"liquidity_usd": liquidity, "buyback_usd": buyback}


# ───────────────────────────────────────── Stateful engine (Mongo) ──

_STATE_DOC_ID = "current"


async def get_state(db) -> Dict[str, Any]:
    """Load the singleton state doc, lazily initializing on first call."""
    doc = await db.dsg_economic_state.find_one({"_id": _STATE_DOC_ID})
    if doc is None:
        doc = {
            "_id": _STATE_DOC_ID,
            "current_supply": INITIAL_SUPPLY,
            "liquidity_fund_usd": 0.0,
            "lifetime_burned_coins": 0.0,
            "lifetime_revenue_usd": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.dsg_economic_state.insert_one(doc)
    # Strip _id before returning to JSON-friendly callers.
    out = {k: v for k, v in doc.items() if k != "_id"}
    return out


async def process_revenue(
    db,
    amount_usd: float,
    coin_price_usd: float,
    source: str = "unspecified",
    actor: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Ingest fee revenue from a transaction. Per spec:

      1. Split 50/50 → liquidity fund + buyback budget.
      2. Buyback budget → coins burned = buyback_usd / coin_price_usd.
      3. Atomically decrement supply, increment liquidity fund.
      4. Append immutable event row to dsg_economic_events.

    `source` is a free-form tag (e.g. "vibe_ridez_fare", "jftn_gift",
    "lottery_ticket") that powers post-hoc revenue attribution.
    """
    if amount_usd <= 0:
        raise ValueError("amount_usd must be > 0")
    if coin_price_usd <= 0:
        raise ValueError("coin_price_usd must be > 0")

    split = split_revenue(amount_usd)
    burned_coins = round(split["buyback_usd"] / coin_price_usd, 6)

    # Atomic update: floor supply at 0, never go negative.
    state_before = await db.dsg_economic_state.find_one({"_id": _STATE_DOC_ID})
    if state_before is None:
        await get_state(db)  # initializes
        state_before = await db.dsg_economic_state.find_one({"_id": _STATE_DOC_ID})

    supply_before = float(state_before.get("current_supply", INITIAL_SUPPLY))
    supply_after = max(0.0, supply_before - burned_coins)
    actual_burned = supply_before - supply_after

    now = datetime.now(timezone.utc).isoformat()
    updated = await db.dsg_economic_state.find_one_and_update(
        {"_id": _STATE_DOC_ID},
        {
            "$set": {
                "current_supply": supply_after,
                "updated_at": now,
            },
            "$inc": {
                "liquidity_fund_usd": split["liquidity_usd"],
                "lifetime_burned_coins": actual_burned,
                "lifetime_revenue_usd": amount_usd,
            },
        },
        return_document=True,
    )

    event = {
        "event_id": f"econ_{uuid.uuid4().hex[:14]}",
        "kind": "process_revenue",
        "ts": now,
        "amount_usd": amount_usd,
        "coin_price_usd": coin_price_usd,
        "liquidity_usd": split["liquidity_usd"],
        "buyback_usd": split["buyback_usd"],
        "burned_coins": actual_burned,
        "supply_before": supply_before,
        "supply_after": supply_after,
        "burn_rate_before": calculate_dynamic_burn_rate(supply_before),
        "burn_rate_after": calculate_dynamic_burn_rate(supply_after),
        "source": source,
        "actor": actor,
    }
    await db.dsg_economic_events.insert_one(dict(event))

    return {
        **event,
        "liquidity_fund_usd_after": float(updated.get("liquidity_fund_usd", 0.0)),
    }


async def snapshot(db) -> Dict[str, Any]:
    """Full read-only snapshot for the public dashboard endpoint."""
    state = await get_state(db)
    supply = float(state.get("current_supply", INITIAL_SUPPLY))
    return {
        "constants": {
            "initial_supply": INITIAL_SUPPLY,
            "stabilization_target_supply": STABILIZATION_TARGET_SUPPLY,
            "golden_asset_supply": GOLDEN_ASSET_SUPPLY,
            "initial_burn_rate": INITIAL_BURN_RATE,
            "minimum_burn_rate": MINIMUM_BURN_RATE,
            "revenue_split_ratio": REVENUE_SPLIT_RATIO,
            "default_utility_cost_usd": DEFAULT_UTILITY_COST_USD,
            "parity_usd": PARITY_USD,
        },
        "current_supply": supply,
        "lifetime_burned_coins": float(state.get("lifetime_burned_coins", 0.0)),
        "lifetime_revenue_usd": float(state.get("lifetime_revenue_usd", 0.0)),
        "liquidity_fund_usd": float(state.get("liquidity_fund_usd", 0.0)),
        "current_burn_rate": calculate_dynamic_burn_rate(supply),
        "progress_to_stabilization": (
            0.0
            if supply <= STABILIZATION_TARGET_SUPPLY
            else round(
                1.0 - (supply - STABILIZATION_TARGET_SUPPLY)
                / (INITIAL_SUPPLY - STABILIZATION_TARGET_SUPPLY),
                4,
            )
        ),
        "stabilization_reached": supply <= STABILIZATION_TARGET_SUPPLY,
        "updated_at": state.get("updated_at"),
    }
