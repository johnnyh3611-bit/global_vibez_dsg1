"""
Sovereign Mining Vault v1.0 — six decentralized mining streams.

Implements the constitutional primitives from
`Global_Vibez_Sovereign_Mining_Master_Vault.pdf` (2026-05-05):

1. Hardware Leasing (Vibe-Cloud Nodes) — 5M ₵ / 24h pool, weighted by
   device power score. Chromebook floor guarantees a minimum rate.
2. Ambassador Node (Social Mining) — 5% of your network's game
   volume. Gated at 50 verified recruits.
3. Stream-to-Earn (Audience Mining) — watch-time × rate, bot-gated
   by interaction count.
4. Proof-of-Movement (VibeRidez / Hungry Vibes) — miles × rate.
   Drivers earn 3× passengers.
5. Tournament Minting (Skill Mining) — 10% of prize pool as fresh-mint
   bonus unlocked per tournament win.
6. Chair + Golden Block Multipliers — 5× chair, 10× golden hour,
   stackable.

Plus:
• 30-day Maturity Lock — freshly-mined ₵ cannot bridge to DSG until
  30 days after mint.
• Founder Master Node — 1% of every community block auto-credits the
  crew vault.

All functions are PURE (no DB writes, no I/O) so they're trivially
unit-testable. Persistence helpers live in the router next door.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


# ── Mining constants (env-overridable) ────────────────────────────────
def _f(key: str, default: float) -> float:
    try:
        return float(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


def _i(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


# 1. Hardware Leasing
GLOBAL_MINT_POOL_24H: int = _i("MINING_GLOBAL_POOL_24H", 5_000_000)
CHROMEBOOK_FLOOR: int = _i("MINING_CHROMEBOOK_FLOOR", 100)      # device_power_score threshold
CHROMEBOOK_MINIMUM: int = _i("MINING_CHROMEBOOK_MIN_COINS", 25) # daily floor for weak devices
ACTIVE_PULSE_PENALTY: float = _f("MINING_INACTIVE_PENALTY", 0.20)  # 20% of base if no pulse

# 2. Ambassador Node
AMBASSADOR_RECRUIT_GATE: int = _i("MINING_AMBASSADOR_GATE", 50)
AMBASSADOR_OVERRIDE_RATE: float = _f("MINING_AMBASSADOR_OVERRIDE", 0.05)

# 3. Stream-to-Earn
STREAM_RATE_PER_MINUTE: float = _f("MINING_STREAM_RATE_PER_MIN", 0.5)
STREAM_MIN_INTERACTIONS: int = _i("MINING_STREAM_MIN_INTERACTIONS", 1)

# 4. Proof-of-Movement
MOVEMENT_DRIVER_RATE: float = _f("MINING_MOVEMENT_DRIVER_RATE", 1.5)
MOVEMENT_RIDER_RATE: float = _f("MINING_MOVEMENT_RIDER_RATE", 0.5)

# 5. Tournament Minting
TOURNAMENT_MINT_PCT: float = _f("MINING_TOURNAMENT_MINT_PCT", 0.10)

# 6. Multipliers
CHAIR_MULTIPLIER: float = _f("MINING_CHAIR_MULTIPLIER", 5.0)
GOLDEN_HOUR_MULTIPLIER: float = _f("MINING_GOLDEN_MULTIPLIER", 10.0)

# 7. Security
MATURITY_DAYS: int = _i("MINING_MATURITY_DAYS", 30)
FOUNDER_MASTER_NODE_RATE: float = _f("MINING_FOUNDER_MASTER_RATE", 0.01)  # 1%


# ── Pure-function calculators (PDF spec, line-for-line) ────────────────

def calculate_leasing_yield(
    device_power_score: int,
    total_network_power: int,
    daily_pool_slice: int = GLOBAL_MINT_POOL_24H,
    is_active_pulse: bool = True,
) -> float:
    """Stream 1 — Hardware Leasing.

    Base = (device_power_score / total_network_power) × daily_pool_slice.
    Below Chromebook floor, base is CHROMEBOOK_MINIMUM (no one gets zero).
    Inactive pulse = 20% of base (PDF: 80% drop).
    """
    if device_power_score <= 0 or total_network_power <= 0:
        return 0.0
    if device_power_score < CHROMEBOOK_FLOOR:
        base = float(CHROMEBOOK_MINIMUM)
    else:
        base = (device_power_score / total_network_power) * daily_pool_slice
    if not is_active_pulse:
        base *= ACTIVE_PULSE_PENALTY
    return round(base, 4)


def ambassador_mining_override(
    network_game_volume: int,
    recruit_count: int,
) -> float:
    """Stream 2 — Ambassador Node.

    5% of the collective game volume of your verified network.
    Gated at 50 recruits (PDF line 11).
    """
    if recruit_count < AMBASSADOR_RECRUIT_GATE:
        return 0.0
    if network_game_volume <= 0:
        return 0.0
    return round(network_game_volume * AMBASSADOR_OVERRIDE_RATE, 4)


def calculate_stream_yield(
    watch_time_minutes: float,
    interaction_count: int,
    rate_per_minute: float = STREAM_RATE_PER_MINUTE,
) -> float:
    """Stream 3 — Stream-to-Earn.

    watch_time × rate, BUT zero if interactions == 0 (bot protection).
    """
    if interaction_count < STREAM_MIN_INTERACTIONS:
        return 0.0
    if watch_time_minutes <= 0:
        return 0.0
    return round(watch_time_minutes * rate_per_minute, 4)


def movement_mint(miles: float, is_driver: bool) -> float:
    """Stream 4 — Proof-of-Movement.

    Drivers 1.5 ₵/mi, riders 0.5 ₵/mi (PDF).
    """
    if miles <= 0:
        return 0.0
    rate = MOVEMENT_DRIVER_RATE if is_driver else MOVEMENT_RIDER_RATE
    return round(miles * rate, 4)


def unlock_tournament_block(prize_pool: int) -> int:
    """Stream 5 — Tournament Minting.

    10% of the prize pool is minted fresh as a skill-mining block.
    """
    if prize_pool <= 0:
        return 0
    return int(round(prize_pool * TOURNAMENT_MINT_PCT))


def apply_multipliers(
    base_yield: float,
    is_chair_holder: bool = False,
    is_golden_hour: bool = False,
) -> float:
    """Stream 6 — Chair & Golden Block Multipliers.

    Stackable: 5× chair × 10× golden = 50× peak.
    """
    final = float(base_yield)
    if is_chair_holder:
        final *= CHAIR_MULTIPLIER
    if is_golden_hour:
        final *= GOLDEN_HOUR_MULTIPLIER
    return round(final, 4)


# ── Security primitives ───────────────────────────────────────────────

def is_mature(days_since_mint: int) -> bool:
    """30-Day Maturity Lock — freshly minted ₵ is bridge-locked until
    `MATURITY_DAYS` have elapsed (PDF line 48).
    """
    return days_since_mint >= MATURITY_DAYS


def founder_master_node_cut(community_block: int) -> int:
    """1% of every community block routes to the crew vault (PDF)."""
    if community_block <= 0:
        return 0
    return int(round(community_block * FOUNDER_MASTER_NODE_RATE))


# ── Unified ledger row shape ──────────────────────────────────────────

@dataclass
class MiningEvent:
    """Canonical shape written to `mining_ledger` so every stream has
    the same audit trail. `stream` identifies which of the 6 emitted
    the coins; `base_yield` is pre-multipliers; `final_yield` is after
    chair/golden/master-node adjustments.
    """
    user_id: str
    stream: str                  # LEASING|AMBASSADOR|STREAM|MOVEMENT|TOURNAMENT
    base_yield: float
    final_yield: float
    multipliers_applied: list    # e.g. ["chair", "golden"]
    metadata: dict
    matured_at_iso: Optional[str] = None
