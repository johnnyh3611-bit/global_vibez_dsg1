"""
Chair Economy Expansion Plan — public roadmap data.

Maps the user's PDF-spec 10-tier expansion ladder (Genius → Apex,
$10 → $55, +$5 every 50k chairs, 500k active circulation + 500k
reserve vault) into a single source of truth that the landing page
and any future "expansion live" toggle can read.

This module DOES NOT touch the existing live pricing engine in
`routes/chairs.py` — those 5 named phases (Genius / Genesis / Phase III
/ Phase IV / Phase V @ 250k cap) remain the source of truth for active
checkout. The expansion ladder represents the *future* supply curve and
is wired into the public roadmap so investors / chair-holders can see
exactly where the economy is headed without us breaking existing locked
weights.
"""
from __future__ import annotations

from typing import Any, Dict, List

# ──────────────────────────── 10-tier expansion ladder ────────────
# Source: Chair_Economy_Expansion_Plan.pdf provided by user 2026-04-29.
# +$5 per 50k chairs sold, starting at $10, capping at $55 over 500k
# chairs of *active circulation*. A separate 500k reserve vault stays
# locked until the platform hits Escape Velocity (major user milestones).

EXPANSION_TIERS: List[Dict[str, Any]] = [
    # Final 3-tier ladder (2026-05-04). Previously this file held the
    # legacy 10-tier +$5 ladder from Chair_Economy_Expansion_Plan.pdf;
    # Founder compressed it to 3 dramatic phases.
    {"order": 1, "name": "Genius",  "low":      0, "high":  50_000, "price_usd":  20},
    {"order": 2, "name": "Genesis", "low":  50_001, "high": 150_000, "price_usd": 100},
    {"order": 3, "name": "Apex",    "low": 150_001, "high": 200_000, "price_usd": 250},
]

# Final 3-tier ladder: 200K active chairs + 800K reserve = 1M total mint.
ACTIVE_CIRCULATION = 200_000
RESERVE_VAULT_LOCKED = 800_000
TOTAL_ECOSYSTEM_CAPACITY = 1_000_000

# Genius-buyer floor-price multiplier vs Apex price ($55 / $10).
GENIUS_FLOOR_MULTIPLIER = 5.5

# Reserve vault unlocks when the platform hits Escape Velocity —
# defined in the PDF as "major user milestones." Tracked downstream via
# the existing `apex_evolution` mechanism; this constant is just the
# user-facing label.
RESERVE_UNLOCK_GATE = "Escape Velocity (major user milestones)"


def total_potential_revenue_usd() -> float:
    """Sum of (tier supply) * (tier price) across the ladder."""
    return float(sum(
        (t["high"] - t["low"] + (1 if t["order"] > 1 else 0)) * t["price_usd"]
        for t in EXPANSION_TIERS
    ))


def get_expansion_plan(active_chairs_sold: int = 0) -> Dict[str, Any]:
    """Return the full plan + a `current_tier` annotation based on the
    *projected* expansion sold count. Until the live pricing engine is
    flipped to the expansion ladder this is purely informational — the
    landing page renders all 10 tiers and highlights where the economy
    *would* be if every legacy chair were a Genius ($10) chair.
    """
    enriched: List[Dict[str, Any]] = []
    current_tier_order = None

    for t in EXPANSION_TIERS:
        in_band = t["low"] <= active_chairs_sold <= t["high"]
        completed = active_chairs_sold > t["high"]
        status = "active" if in_band else ("completed" if completed else "future")
        if status == "active" and current_tier_order is None:
            current_tier_order = t["order"]
        enriched.append({
            **t,
            "supply": t["high"] - t["low"] + (1 if t["order"] > 1 else 0),
            "potential_revenue_usd": (
                (t["high"] - t["low"] + (1 if t["order"] > 1 else 0))
                * t["price_usd"]
            ),
            "status": status,
        })

    return {
        "tiers": enriched,
        "active_circulation": ACTIVE_CIRCULATION,
        "reserve_vault_locked": RESERVE_VAULT_LOCKED,
        "total_ecosystem_capacity": TOTAL_ECOSYSTEM_CAPACITY,
        "genius_floor_multiplier": GENIUS_FLOOR_MULTIPLIER,
        # Back-compat alias for any older clients still reading the old key.
        "genesis_floor_multiplier": GENIUS_FLOOR_MULTIPLIER,
        "reserve_unlock_gate": RESERVE_UNLOCK_GATE,
        "total_potential_revenue_usd": total_potential_revenue_usd(),
        "current_tier_order": current_tier_order,
        "active_chairs_sold": active_chairs_sold,
    }
