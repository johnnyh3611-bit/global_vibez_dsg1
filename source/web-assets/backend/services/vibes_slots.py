"""
Vibes Slots — DSG Global Progressive Slots Engine
─────────────────────────────────────────────────
Source: DSG_ComingSoon_Master_Engines.pdf §2 (founder spec, Feb 2026).

Spec locks:
  - RTP: 96.0% target
  - 1% of every spin feeds the Global Sovereign Jackpot
  - Sovereign Rain: jackpot hit → 1-coin gift to every active user

Engine design:
  - 5 reels, 1 payline (center row), classic slot layout
  - 6 symbols with weighted distribution per reel
  - Wins on left-anchored sequences (3, 4, or 5 of a kind starting reel 1)
  - 'wild' substitutes for any non-jackpot symbol
  - 'joker' is the jackpot symbol — 5 jokers triggers Sovereign Rain

Pure module. Deterministic given a seed. No DB. No I/O.
Tested by backend/tests/test_vibes_slots.py.
"""
from __future__ import annotations

import random
import secrets

# Cryptographically-strong RNG for production spins. Tests can pass an
# explicit `seed` to get a deterministic Mersenne Twister.
_RNG: secrets.SystemRandom = secrets.SystemRandom()
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from services.coming_soon_engines import (
    VIBES_SLOTS_RTP,
    VIBES_SLOTS_JACKPOT_FEED_PCT,
    VIBES_SLOTS_SOVEREIGN_RAIN_GIFT,
)


# ── Game constants ──────────────────────────────────────────────────────────
REEL_COUNT: int = 5
PAYLINE_COUNT: int = 1   # center row only (classic 5x1)


# Symbol catalog — weight, payouts for 3/4/5 of a kind, special flags
# Tuned so theoretical RTP sits near the 96% spec target.
SYMBOLS: Dict[str, Dict] = {
    "cherry":  {"weight": 30, "pay_3":   1,  "pay_4":    4,  "pay_5":    12,  "is_jackpot": False, "is_wild": False, "emoji": "🍒"},
    "bell":    {"weight": 20, "pay_3":   2,  "pay_4":   10,  "pay_5":    40,  "is_jackpot": False, "is_wild": False, "emoji": "🔔"},
    "diamond": {"weight": 15, "pay_3":   5,  "pay_4":   25,  "pay_5":   125,  "is_jackpot": False, "is_wild": False, "emoji": "💎"},
    "seven":   {"weight": 10, "pay_3":  12,  "pay_4":   75,  "pay_5":   400,  "is_jackpot": False, "is_wild": False, "emoji": "7️⃣"},
    "wild":    {"weight":  5, "pay_3":  25,  "pay_4":  150,  "pay_5":   800,  "is_jackpot": False, "is_wild": True,  "emoji": "⭐"},
    "joker":   {"weight":  3, "pay_3":  50,  "pay_4":  250,  "pay_5":  2500,  "is_jackpot": True,  "is_wild": False, "emoji": "🃏"},
}

_SYMBOL_KEYS: List[str] = list(SYMBOLS.keys())
_TOTAL_WEIGHT: int = sum(s["weight"] for s in SYMBOLS.values())


def _spin_one_reel(rng) -> str:
    """Weighted random choice of a single symbol. Accepts any RNG with
    a `.random()` method (random.Random for tests, secrets.SystemRandom
    in production)."""
    r = rng.random() * _TOTAL_WEIGHT
    cumulative = 0
    for key in _SYMBOL_KEYS:
        cumulative += SYMBOLS[key]["weight"]
        if r < cumulative:
            return key
    return _SYMBOL_KEYS[-1]  # FP guard


def spin_reels(seed: Optional[int] = None) -> List[str]:
    """Return 5 symbols, one per reel."""
    rng = random.Random(seed) if seed is not None else _RNG
    return [_spin_one_reel(rng) for _ in range(REEL_COUNT)]


def _normalize_for_match(symbol: str, target: str) -> bool:
    """A symbol matches the target if it IS the target or it's a wild
    (and the target is not the jackpot symbol — wild does not substitute
    for joker per industry standard)."""
    if symbol == target:
        return True
    if SYMBOLS[symbol]["is_wild"] and not SYMBOLS[target]["is_jackpot"]:
        return True
    return False


def evaluate_payline(reels: List[str]) -> Tuple[int, str, int]:
    """
    Evaluate the center payline left-to-right. Returns (matches, anchor_symbol, raw_payout).

    `matches` = run-length of identical (or wild-substituting) symbols starting reel 1.
    `anchor_symbol` = the non-wild symbol the payline is paying on, or "wild" if all wilds.
    `raw_payout` = payout multiplier for that match length, or 0 if < 3.
    """
    if len(reels) != REEL_COUNT:
        raise ValueError(f"reels must have {REEL_COUNT} symbols")

    # Determine the "anchor" — first non-wild symbol (or wild if all-wild)
    anchor = next((s for s in reels if not SYMBOLS[s]["is_wild"]), "wild")

    # Count run from left
    run = 0
    for s in reels:
        if _normalize_for_match(s, anchor):
            run += 1
        else:
            break

    if run < 3:
        return (run, anchor, 0)

    pay_key = f"pay_{run}"
    raw_payout = SYMBOLS[anchor].get(pay_key, 0)
    return (run, anchor, int(raw_payout))


@dataclass
class SpinResult:
    """Outcome of a single Vibes Slots spin."""
    reels: List[str]
    stake: float
    matches: int                    # 0 if no win, 3/4/5 if win
    anchor_symbol: str              # symbol the payline paid on
    payout_multiplier: int          # spec multiplier for this hit (0 if loss)
    gross_payout: float             # stake * multiplier
    jackpot_feed: float             # 1% of stake routed to global jackpot
    is_jackpot_hit: bool            # True iff joker × 5
    sovereign_rain_event: Optional[Dict]  # broadcast payload if jackpot hit
    rtp_realized: float             # gross_payout / stake (this single spin's realized RTP)


def execute_spin(
    stake: float,
    seed: Optional[int] = None,
    active_user_count: int = 0,
) -> SpinResult:
    """
    Execute a single spin. Caller is responsible for:
      1. Deducting `stake` from buyer
      2. Routing `jackpot_feed` to the global Sovereign Jackpot pool
      3. Crediting `gross_payout` to buyer
      4. If `is_jackpot_hit`, distributing 1 coin to every active user
         (the Sovereign Rain) using `sovereign_rain_event` payload

    `active_user_count` is informational — it shapes the Sovereign Rain
    payload size when the jackpot hits.
    """
    if stake <= 0:
        raise ValueError("stake must be positive")
    if active_user_count < 0:
        raise ValueError("active_user_count must be non-negative")

    reels = spin_reels(seed)
    matches, anchor, mult = evaluate_payline(reels)
    gross = round(stake * mult, 8) if mult > 0 else 0.0
    jackpot_feed = round(stake * VIBES_SLOTS_JACKPOT_FEED_PCT, 8)

    is_jackpot = matches == REEL_COUNT and SYMBOLS[anchor]["is_jackpot"]
    rain_event: Optional[Dict] = None
    if is_jackpot:
        rain_event = {
            "type": "vibes_slots.sovereign_rain",
            "label": "🌧️ SOVEREIGN RAIN! Jackpot hit. 1 coin gifted to every active user.",
            "gift_per_user": VIBES_SLOTS_SOVEREIGN_RAIN_GIFT,
            "user_count": active_user_count,
            "total_distributed": VIBES_SLOTS_SOVEREIGN_RAIN_GIFT * active_user_count,
        }

    return SpinResult(
        reels=reels,
        stake=round(stake, 8),
        matches=matches,
        anchor_symbol=anchor,
        payout_multiplier=mult,
        gross_payout=gross,
        jackpot_feed=jackpot_feed,
        is_jackpot_hit=is_jackpot,
        sovereign_rain_event=rain_event,
        rtp_realized=round(gross / stake, 8) if stake > 0 else 0.0,
    )


# ── Jackpot pool helpers (pure) ─────────────────────────────────────────────
@dataclass
class JackpotPool:
    """In-memory progressive-jackpot accumulator. Route layer mirrors to DB."""
    current_amount: float = 100_000.00     # spec-flavored seed value
    last_winner: Optional[str] = None
    last_won_at: Optional[str] = None      # ISO timestamp string


def feed_jackpot(pool: JackpotPool, contribution: float) -> JackpotPool:
    """Add a contribution. Mutates and returns the pool."""
    if contribution < 0:
        raise ValueError("contribution must be non-negative")
    pool.current_amount = round(pool.current_amount + contribution, 8)
    return pool


def reset_jackpot_after_win(
    pool: JackpotPool,
    winner_id: str,
    won_at_iso: str,
    seed_value: float = 100_000.00,
) -> Tuple[float, JackpotPool]:
    """
    Spec: jackpot resets to a seed amount after being won.
    Returns (paid_amount, updated_pool).
    """
    if not winner_id:
        raise ValueError("winner_id required")
    if seed_value < 0:
        raise ValueError("seed_value must be non-negative")
    paid = pool.current_amount
    pool.current_amount = round(seed_value, 8)
    pool.last_winner = winner_id
    pool.last_won_at = won_at_iso
    return (paid, pool)


__all__ = [
    "REEL_COUNT", "SYMBOLS", "spin_reels", "evaluate_payline",
    "SpinResult", "execute_spin",
    "JackpotPool", "feed_jackpot", "reset_jackpot_after_win",
]
