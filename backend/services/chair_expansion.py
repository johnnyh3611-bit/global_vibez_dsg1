"""
Chair Economy — value-driven phase shim (2026-05-18).

The original `chair_expansion` 10-tier supply ladder PDF (Apr 2026) was
**retired** when the Founder shipped the Equity Master value matrix. The
new rule:

  • Genius phase = flat $20 floor seat, 50,000-chair cap (sells out).
  • Post-Genius  = chair price is DERIVED from monthly app revenue using
                   the Equity Master formula
                   `price = (monthly_rev × 0.30 / TOTAL_CHAIRS) × 12 / 0.10`
                   with floor anchors at $99 / $360 / $1,800 keyed to
                   $2.75M / $10M / $50M monthly revenue.

This module is kept purely so any legacy `services.chair_expansion`
import path doesn't break. The `get_expansion_plan()` function now
re-exports the Equity Master value matrix in the same shape the old
caller expected, so the landing page and `ChairExpansionPlan.tsx` keep
working without a coordinated cross-file deploy.

DO NOT add new pricing here. The single source of truth is
`routes.equity_master.EQUITY_VALUE_MATRIX`.
"""
from __future__ import annotations

from typing import Any, Dict, List

# Single source of truth: the locked Equity Master matrix.
from routes.equity_master import (  # noqa: PLC0415  (intentional late import)
    EQUITY_VALUE_MATRIX,
    GENIUS_PHASE_FLOOR_USD,
    GENESIS_PHASE_FLOOR_USD,
    TOTAL_CHAIRS_BASELINE,
)

# Genius is the only fixed-supply phase; everything after is open and
# revenue-priced. We surface the cap so the landing page can show the
# "X of 50,000 Genius seats remaining" scarcity meter.
GENIUS_CAP = 50_000
ACTIVE_CIRCULATION = TOTAL_CHAIRS_BASELINE
RESERVE_VAULT_LOCKED = 0  # legacy concept retired with the supply ladder
TOTAL_ECOSYSTEM_CAPACITY = TOTAL_CHAIRS_BASELINE
GENIUS_FLOOR_MULTIPLIER = round(1800 / GENIUS_PHASE_FLOOR_USD, 1)  # $20 → $1,800 = 90×
RESERVE_UNLOCK_GATE = "Genius phase sells out (chair #50,000)"


def _matrix_as_tiers() -> List[Dict[str, Any]]:
    """Convert the Equity Master value matrix into the tier shape the
    `ChairExpansionPlan.tsx` component still consumes. Each row is a
    *revenue milestone* now, not a supply bracket."""
    tiers: List[Dict[str, Any]] = []
    # Row 0: the always-on Genius floor seat (only fixed-price phase).
    tiers.append({
        "order": 0,
        "name": "Genius",
        "low": 0,
        "high": GENIUS_CAP,
        "price_usd": GENIUS_PHASE_FLOOR_USD,
        "supply": GENIUS_CAP,
        "potential_revenue_usd": GENIUS_CAP * GENIUS_PHASE_FLOOR_USD,
        "monthly_rev_anchor_usd": 0,
        "tagline": "Founder floor seat — $20 flat. Sells out at 50,000.",
        "kind": "supply_capped",
    })
    # Rows 1+: revenue-anchored milestones from the locked matrix.
    for i, row in enumerate(EQUITY_VALUE_MATRIX, start=1):
        tiers.append({
            "order": i,
            "name": row["label"],
            "low": GENIUS_CAP,                  # all post-Genius is open
            "high": TOTAL_CHAIRS_BASELINE,
            "price_usd": float(row["market_value_usd"]),
            "supply": TOTAL_CHAIRS_BASELINE - GENIUS_CAP,
            "potential_revenue_usd": None,      # not supply-capped, no fixed pot
            "monthly_rev_anchor_usd": row["monthly_rev_usd"],
            "tagline": row.get("tagline", ""),
            "kind": "revenue_driven",
        })
    return tiers


def get_expansion_plan(active_chairs_sold: int = 0) -> Dict[str, Any]:
    """Return the post-Genius value-driven phase plan in the legacy
    response shape. `active_chairs_sold` is used to flag whether we're
    still in Genius (supply-capped) or past it (revenue-driven)."""
    tiers = _matrix_as_tiers()
    if active_chairs_sold < GENIUS_CAP:
        current_tier_order = 0  # still in Genius
    else:
        current_tier_order = 1  # first post-Genius milestone

    return {
        "tiers": tiers,
        "active_circulation": ACTIVE_CIRCULATION,
        "reserve_vault_locked": RESERVE_VAULT_LOCKED,
        "total_ecosystem_capacity": TOTAL_ECOSYSTEM_CAPACITY,
        "genius_floor_multiplier": GENIUS_FLOOR_MULTIPLIER,
        "reserve_unlock_gate": RESERVE_UNLOCK_GATE,
        "total_potential_revenue_usd": GENIUS_CAP * GENIUS_PHASE_FLOOR_USD,
        "current_tier_order": current_tier_order,
        "active_chairs_sold": active_chairs_sold,
        "pricing_model": (
            "Genius is supply-capped at 50,000 seats × $20. After Genius "
            "sells out, chair price is computed live from monthly app "
            "revenue via the Equity Master formula."
        ),
    }
