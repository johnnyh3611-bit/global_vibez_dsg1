"""
AI Governor (v11 + v12 Constitution) — the autonomous economic pilot.

  • Burn-Slide:     burn_rate = min(0.05, max(0, (supply - 350M) / 50M * 0.01))
                    5% burn starts at 750M total supply, ramps to 0% at 350M floor.
  • Anti-Whale:     Standard cap = 2M DSG · Chair Holder cap = 5M DSG ·
                    Crew wallets exempt.
  • Mining Boost:   Chair Holders earn at a 5× multiplier.

All reads are pure functions. All writes (applying a burn) route through the
Founder-queued Sovereign Ops panel in God Mode — dry-run by default.
"""
from __future__ import annotations

from typing import Any, Dict

# v12 supply anchors.
TOTAL_SUPPLY_START = 750_000_000
SUPPLY_FLOOR = 350_000_000
BURN_STEP_SIZE = 50_000_000
BURN_STEP_RATE = 0.01
BURN_RATE_CEILING = 0.05

# v12 anti-whale caps.
WALLET_CAP_STANDARD = 2_000_000
WALLET_CAP_CHAIR = 5_000_000

# v12 mining boost.
CHAIR_MINING_MULTIPLIER = 5.0


def current_burn_rate(circulating_supply: int) -> float:
    """Return the active burn rate given the live circulating supply.
    Mirrors the v12 `updateEconomicState` JS exactly."""
    raw = max(0.0, (circulating_supply - SUPPLY_FLOOR) / BURN_STEP_SIZE * BURN_STEP_RATE)
    return round(min(BURN_RATE_CEILING, raw), 4)


def next_burn_breakpoint(circulating_supply: int) -> Dict[str, Any]:
    """How many DSG must burn before `burn_rate` steps down next."""
    rate = current_burn_rate(circulating_supply)
    # When rate is at ceiling, next step down occurs once supply drops below the
    # threshold where raw_rate falls under 0.05 (i.e. supply < 350M + 5 * 50M = 600M).
    if rate >= BURN_RATE_CEILING:
        supply_at_next = SUPPLY_FLOOR + 5 * BURN_STEP_SIZE - 1
    elif rate <= 0:
        supply_at_next = SUPPLY_FLOOR
    else:
        steps_above_floor = int(round(rate / BURN_STEP_RATE))
        supply_at_next = SUPPLY_FLOOR + (steps_above_floor - 1) * BURN_STEP_SIZE
    return {
        "current_rate": rate,
        "supply_when_rate_drops": max(SUPPLY_FLOOR, supply_at_next),
        "distance_to_next_step": max(0, circulating_supply - max(SUPPLY_FLOOR, supply_at_next)),
        "floor": SUPPLY_FLOOR,
    }


def wallet_cap_for(is_chair_holder: bool, is_crew: bool) -> int:
    """Per-wallet DSG ceiling — crew wallets are unlimited (return -1 sentinel)."""
    if is_crew:
        return -1
    return WALLET_CAP_CHAIR if is_chair_holder else WALLET_CAP_STANDARD


def would_exceed_cap(current_balance: int, adding: int, is_chair_holder: bool, is_crew: bool) -> bool:
    cap = wallet_cap_for(is_chair_holder, is_crew)
    if cap < 0:
        return False
    return (current_balance + adding) > cap


def mining_reward(
    user_power: float,
    global_daily_pool: float,
    is_chair_holder: bool,
    is_ambassador: bool = False,
) -> Dict[str, float]:
    """v12 daily mining reward.

    Chair Holders earn at a 5× multiplier. Ambassadors receive an
    additional 5% **Ambassador Override** kickback on their own mining
    payout (per v12 "Ambassador Dividends / Ambassador Override").

    Returns `{base, chair_bonus, ambassador_override, total}` so the
    UI can show each line separately — no more opaque flat numbers.
    """
    base = max(0.0, float(user_power)) * max(0.0, float(global_daily_pool))
    chair_bonus = 0.0
    if is_chair_holder:
        chair_bonus = base * (CHAIR_MINING_MULTIPLIER - 1)  # the extra 4× portion
    subtotal = base + chair_bonus
    override = 0.0
    if is_ambassador:
        from services.sovereign_engine import AMBASSADOR_OVERRIDE  # noqa: PLC0415
        override = subtotal * AMBASSADOR_OVERRIDE
    return {
        "base": round(base, 4),
        "chair_bonus": round(chair_bonus, 4),
        "ambassador_override": round(override, 4),
        "total": round(subtotal + override, 4),
    }


__all__ = [
    "TOTAL_SUPPLY_START",
    "SUPPLY_FLOOR",
    "BURN_STEP_SIZE",
    "BURN_RATE_CEILING",
    "WALLET_CAP_STANDARD",
    "WALLET_CAP_CHAIR",
    "CHAIR_MINING_MULTIPLIER",
    "current_burn_rate",
    "next_burn_breakpoint",
    "wallet_cap_for",
    "would_exceed_cap",
    "mining_reward",
]
