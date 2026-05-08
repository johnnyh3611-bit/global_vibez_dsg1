"""
DSG "My Vibe" Social & Battle Engine — Volume V
────────────────────────────────────────────────
Source: DSG_MyVibe_Social_Battle_Master.pdf (founder spec, Feb 2026).

Pure module: streamer battle math, gas mechanic, stroll physics constants.

Section I:  Sovereign Battle Win Logic + 13.5% Tax distribution math
Section II: "Gas" Mechanic & Hybrid Heat/Mining algorithm (50/50)
Section III: Revolutionary Stroll Physics constants

Tested by backend/tests/test_social_battle_engine.py.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from services.pricing_master_vault import SOVEREIGN_TAX_RATE


# ── Section I: Sovereign Battle Win Logic ──────────────────────────────────
# Spec verbatim:
#   tax = totalPot * 0.135
#   netPot = totalPot - tax
#   streamerShare  = netPot * 0.60
#   platformShare  = netPot * 0.40
STREAMER_SHARE_PCT: float = 0.60   # of netPot, streamer/winner takes 60%
PLATFORM_SHARE_PCT: float = 0.40   # of netPot, platform takes 40%


@dataclass
class BattlePotSplit:
    """Result of distributing a streamer-battle pot."""
    gift_total: float
    seat_fees: float
    total_pot: float
    sovereign_tax: float
    net_pot: float
    streamer_share: float
    platform_share: float


def split_battle_pot(gift_total: float, seat_fees: float = 0.0) -> BattlePotSplit:
    """
    Implement the spec-verbatim battle-pot math.

      total_pot     = gift_total + seat_fees
      sovereign_tax = total_pot * 0.135
      net_pot       = total_pot - tax
      streamer      = net_pot * 0.60
      platform      = net_pot * 0.40
    """
    if gift_total < 0:
        raise ValueError("gift_total must be non-negative")
    if seat_fees < 0:
        raise ValueError("seat_fees must be non-negative")

    total_pot = round(gift_total + seat_fees, 8)
    tax = round(total_pot * SOVEREIGN_TAX_RATE, 8)
    net_pot = round(total_pot - tax, 8)
    streamer = round(net_pot * STREAMER_SHARE_PCT, 8)
    platform = round(net_pot - streamer, 8)  # absorb FP rounding into platform

    return BattlePotSplit(
        gift_total=round(gift_total, 8),
        seat_fees=round(seat_fees, 8),
        total_pot=total_pot,
        sovereign_tax=tax,
        net_pot=net_pot,
        streamer_share=streamer,
        platform_share=platform,
    )


# ── Section II: Gas Mechanic & Hybrid Algorithm ────────────────────────────
# Spec: "Algorithm balances Heat (Active Gifting) and Mining (Vibe-Share
# Watchers) at a 50/50 ratio."
HYBRID_HEAT_RATIO: float = 0.50
HYBRID_MINING_RATIO: float = 0.50

# Verbatim from spec table:
NITRO_GIFT_VALUE_DSG: int = 50          # +1 multiplier to Game Move
NITRO_GIFT_MULTIPLIER: float = 1.0      # additive: current_mult + 1.0

SHIELD_GIFT_VALUE_DSG: int = 20         # blocks 1 confusion debuff
SHIELD_GIFT_BLOCKS: int = 1


@dataclass
class GasGiftEffect:
    """Outcome of applying a gas gift to a battle player's state."""
    gift_type: str
    cost_dsg: int
    multiplier_added: float
    debuffs_blocked: int


def apply_gas_gift(gift_type: str) -> GasGiftEffect:
    """
    Build the mechanical effect of a gas gift. Pure — caller mutates state.
    """
    g = gift_type.lower().strip()
    if g == "nitro":
        return GasGiftEffect(
            gift_type="nitro",
            cost_dsg=NITRO_GIFT_VALUE_DSG,
            multiplier_added=NITRO_GIFT_MULTIPLIER,
            debuffs_blocked=0,
        )
    if g == "shield":
        return GasGiftEffect(
            gift_type="shield",
            cost_dsg=SHIELD_GIFT_VALUE_DSG,
            multiplier_added=0.0,
            debuffs_blocked=SHIELD_GIFT_BLOCKS,
        )
    raise ValueError(f"unsupported gas gift: {gift_type}")


def hybrid_score(heat_score: float, mining_score: float) -> float:
    """
    Blend the two engagement signals into a single rank value per spec
    (50/50 weighting). Used to rank streamers in the discover feed.
    """
    if heat_score < 0 or mining_score < 0:
        raise ValueError("scores must be non-negative")
    return round(heat_score * HYBRID_HEAT_RATIO + mining_score * HYBRID_MINING_RATIO, 8)


# ── Section III: Revolutionary Stroll Physics ──────────────────────────────
# Pure constants the frontend (Three.js / Unity) reads to render the stroll.
HAPTIC_GRAVITY_ENABLED: bool = True
WARP_TRANSITION_ENABLED: bool = True
SOVEREIGN_CRATE_MIN_INTERVAL: int = 50      # min strolls between drops
SOVEREIGN_CRATE_MAX_INTERVAL: int = 100     # max strolls between drops
MULTI_STREAMER_GRID_MIN: int = 2            # 2-streamer grid
MULTI_STREAMER_GRID_MAX: int = 4            # 4-streamer grid


def should_drop_sovereign_crate(strolls_since_last_drop: int, rng_value: float) -> bool:
    """
    Deterministic crate-drop decider. Caller supplies the RNG value (0..1).

    Spec: "Random loot drops every 50-100 strolls". We treat that as:
      - Below 50: never drops.
      - 50..100: probability ramps linearly from 0 → 1.
      - Above 100: always drops.
    """
    if strolls_since_last_drop < 0:
        raise ValueError("strolls_since_last_drop must be non-negative")
    if not (0.0 <= rng_value <= 1.0):
        raise ValueError("rng_value must be 0..1")

    if strolls_since_last_drop < SOVEREIGN_CRATE_MIN_INTERVAL:
        return False
    if strolls_since_last_drop >= SOVEREIGN_CRATE_MAX_INTERVAL:
        return True
    span = SOVEREIGN_CRATE_MAX_INTERVAL - SOVEREIGN_CRATE_MIN_INTERVAL
    threshold = (strolls_since_last_drop - SOVEREIGN_CRATE_MIN_INTERVAL) / span
    return rng_value < threshold


__all__ = [
    "STREAMER_SHARE_PCT", "PLATFORM_SHARE_PCT",
    "BattlePotSplit", "split_battle_pot",
    "HYBRID_HEAT_RATIO", "HYBRID_MINING_RATIO", "hybrid_score",
    "NITRO_GIFT_VALUE_DSG", "NITRO_GIFT_MULTIPLIER",
    "SHIELD_GIFT_VALUE_DSG", "SHIELD_GIFT_BLOCKS",
    "GasGiftEffect", "apply_gas_gift",
    "HAPTIC_GRAVITY_ENABLED", "WARP_TRANSITION_ENABLED",
    "SOVEREIGN_CRATE_MIN_INTERVAL", "SOVEREIGN_CRATE_MAX_INTERVAL",
    "MULTI_STREAMER_GRID_MIN", "MULTI_STREAMER_GRID_MAX",
    "should_drop_sovereign_crate",
]
