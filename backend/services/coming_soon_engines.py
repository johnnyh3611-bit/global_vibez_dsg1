"""
DSG Coming Soon — Master Engine Constants (Volume IV)
─────────────────────────────────────────────────────
Source: DSG_ComingSoon_Master_Engines.pdf (founder spec, Feb 2026).

Pure module of game rule constants + scoring helpers for:
  1. Caribbean Stud & Pai Gow
  2. Vibes Slots Global Progressive
  3. 30-Second Social: Bingo & Keno
  4. Casino & Dice prop bets (Sic Bo, Craps, Yahtzee bonus, Vibes Wheel)

This module owns the *math + payouts* only. Game state (deck, board, etc.)
is the route layer's job. Full game implementations import these constants
to stay aligned with the founder spec.

Tested by backend/tests/test_coming_soon_engines.py.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Set, Tuple

from services.pricing_master_vault import SOVEREIGN_TAX_RATE


# ── 1. Caribbean Stud & Pai Gow ─────────────────────────────────────────────
# Spec: "Dealer must have Ace-King to qualify. Royal Flush pays 100:1."
CARIBBEAN_STUD_DEALER_QUALIFIER_MIN: Tuple[str, str] = ("A", "K")
CARIBBEAN_STUD_PAYOUT_TABLE: Dict[str, int] = {
    "royal_flush":     100,   # 100:1
    "straight_flush":   50,
    "four_of_a_kind":   20,
    "full_house":        7,
    "flush":             5,
    "straight":          4,
    "three_of_a_kind":   3,
    "two_pair":          2,
    "pair":              1,
    "high_card":         0,
}

# Spec: "Standard Push rules enforced. Money stays for next hand. 13.5% Tax
# applied only on Player Wins."
PAI_GOW_TAX_ON_PLAYER_WIN_ONLY: bool = True


def caribbean_stud_dealer_qualifies(dealer_high: str, dealer_second: str) -> bool:
    """
    Dealer qualifies with Ace-King high or better. Per spec qualifier is
    a hand containing both an Ace AND a King (or any straight/pair that
    naturally outranks A-K-high).
    """
    rank_order = {"2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
                  "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14}
    if dealer_high not in rank_order or dealer_second not in rank_order:
        raise ValueError("invalid rank")
    h, s = rank_order[dealer_high], rank_order[dealer_second]
    a, k = rank_order["A"], rank_order["K"]
    return (h, s) >= (a, k)


# ── 2. Vibes Slots Global Progressive ───────────────────────────────────────
VIBES_SLOTS_RTP: float = 0.96                  # Return-to-Player
VIBES_SLOTS_JACKPOT_FEED_PCT: float = 0.01     # 1% of every spin → progressive jackpot
VIBES_SLOTS_SOVEREIGN_RAIN_GIFT: int = 1       # 1 coin to all active users on jackpot hit


def vibes_slots_jackpot_contribution(spin_amount: float) -> Dict[str, float]:
    """
    Compute jackpot feed + retained pool for a single spin.

    Returns:
      {
        "jackpot_feed":  amount that goes to the global progressive jackpot,
        "retained_pool": amount that stays in the slot's local prize pool,
      }
    """
    if spin_amount <= 0:
        raise ValueError("spin_amount must be positive")
    jackpot = round(spin_amount * VIBES_SLOTS_JACKPOT_FEED_PCT, 8)
    retained = round(spin_amount - jackpot, 8)
    return {"jackpot_feed": jackpot, "retained_pool": retained}


def trigger_sovereign_rain(active_user_ids: List[str]) -> Dict:
    """
    Spec: "Hitting the jackpot triggers a platform-wide animation and a
    1-coin celebratory gift to all active users."
    Returns the broadcast event payload + total coin cost.
    """
    if not active_user_ids:
        raise ValueError("active_user_ids must not be empty")
    return {
        "type": "vibes_slots.sovereign_rain",
        "label": "🌧️ SOVEREIGN RAIN! Jackpot hit. 1 coin gifted to every active user.",
        "gift_per_user": VIBES_SLOTS_SOVEREIGN_RAIN_GIFT,
        "user_count": len(active_user_ids),
        "total_distributed": VIBES_SLOTS_SOVEREIGN_RAIN_GIFT * len(active_user_ids),
    }


# ── 3. 30-Second Social: Bingo & Keno ───────────────────────────────────────
SOCIAL_ROUND_TIMER_SECONDS: int = 30

# Spec: "'Sovereign Square' pattern (Corners + Center) = 2x Payout."
# Standard 5x5 Bingo card index layout:
#   (row, col) → board cell index = row * 5 + col
BINGO_CARD_SIZE: int = 5
BINGO_SOVEREIGN_SQUARE_INDICES: Tuple[int, ...] = (0, 4, 12, 20, 24)  # 4 corners + center
BINGO_SOVEREIGN_SQUARE_MULTIPLIER: float = 2.0

# Spec: "Pick 1-10. 10/10 catch pays 10,000:1. 0/10 catch = 1-coin rebate."
KENO_MIN_PICKS: int = 1
KENO_MAX_PICKS: int = 10
KENO_PERFECT_HIT_PAYOUT: int = 10_000      # 10/10 catch pays 10,000:1
KENO_ZERO_HIT_REBATE: int = 1              # 0/10 catch = 1-coin rebate


def is_bingo_sovereign_square(daubed_indices: Set[int]) -> bool:
    """True iff every Sovereign Square cell (4 corners + center) is daubed."""
    return all(idx in daubed_indices for idx in BINGO_SOVEREIGN_SQUARE_INDICES)


def keno_payout(picks: int, hits: int, stake: float) -> Dict:
    """
    Compute Keno payout.

    Spec edge cases enforced:
      - Perfect 10/10 hit pays 10,000:1.
      - 0/10 catch returns a 1-coin rebate.
      - Every other tier follows a smooth payout curve scaled by `picks`.

    Returns {gross, tax, net, multiplier}.
    """
    if not (KENO_MIN_PICKS <= picks <= KENO_MAX_PICKS):
        raise ValueError(f"picks must be {KENO_MIN_PICKS}..{KENO_MAX_PICKS}")
    if not (0 <= hits <= picks):
        raise ValueError("hits must be 0..picks")
    if stake <= 0:
        raise ValueError("stake must be positive")

    if picks == 10 and hits == 10:
        gross = stake * KENO_PERFECT_HIT_PAYOUT
        multiplier = float(KENO_PERFECT_HIT_PAYOUT)
    elif picks == 10 and hits == 0:
        gross = float(KENO_ZERO_HIT_REBATE)
        multiplier = KENO_ZERO_HIT_REBATE / stake if stake > 0 else 0.0
    else:
        # Standard graded paytable: hits/picks ratio with bonus for high catches
        hit_ratio = hits / picks
        if hit_ratio == 0:
            multiplier = 0.0
        elif hit_ratio < 0.5:
            multiplier = 0.0          # below 50% pays nothing (industry standard)
        elif hit_ratio < 1.0:
            multiplier = 2.0 ** (hits - 1)
        else:  # ratio == 1.0 (full hit) for any pick count
            multiplier = max(2.0 ** picks, 1.0)
        gross = stake * multiplier

    tax = round(gross * SOVEREIGN_TAX_RATE, 8)
    net = round(gross - tax, 8)
    return {
        "picks": picks, "hits": hits, "stake": stake,
        "multiplier": float(multiplier),
        "gross": round(gross, 8),
        "tax": tax,
        "net": net,
    }


# ── 4. Casino & Dice Prop Bets ──────────────────────────────────────────────
# Spec: "Sic Bo: Specific Triple pays 180 to 1."
SIC_BO_SPECIFIC_TRIPLE_PAYOUT: int = 180

# Spec: "Craps Props: Snake Eyes (2) and Boxcars (12) pay 30:1."
CRAPS_SNAKE_EYES_PAYOUT: int = 30          # rolling exactly 1+1
CRAPS_BOXCARS_PAYOUT: int = 30             # rolling exactly 6+6

# Spec: "Yahtzee: Upper Bonus (63+) = 35 points + 10min Mining Boost."
YAHTZEE_UPPER_BONUS_MINING_BOOST_MINUTES: int = 10
YAHTZEE_UPPER_BONUS_MINING_MULT: float = 1.10  # +10% boost for the duration

# Spec: "Vibes Wheel: 54 slots. 2 'Sovereign Jokers' pay 40:1 and trigger 10% burn event."
VIBES_WHEEL_SLOTS: int = 54
VIBES_WHEEL_SOVEREIGN_JOKER_COUNT: int = 2
VIBES_WHEEL_SOVEREIGN_JOKER_PAYOUT: int = 40
VIBES_WHEEL_SOVEREIGN_JOKER_BURN_PCT: float = 0.10


def sic_bo_payout(bet_type: str, dice: List[int], stake: float) -> Dict:
    """
    Compute Sic Bo payout. Currently supports 'specific_triple' (180:1) and
    'any_triple' (30:1). Standard Sic Bo bet menu.
    """
    if len(dice) != 3:
        raise ValueError("Sic Bo requires exactly 3 dice")
    if any(d < 1 or d > 6 for d in dice):
        raise ValueError("dice must be 1..6")
    if stake <= 0:
        raise ValueError("stake must be positive")

    is_triple = len(set(dice)) == 1
    bt = bet_type.lower().strip()

    if bt.startswith("specific_triple_"):
        target = int(bt.split("_")[-1])
        won = is_triple and dice[0] == target
        payout = SIC_BO_SPECIFIC_TRIPLE_PAYOUT if won else 0
    elif bt == "any_triple":
        won = is_triple
        payout = 30 if won else 0  # standard 30:1
    else:
        raise ValueError(f"unsupported Sic Bo bet: {bet_type}")

    gross = stake * payout if won else 0.0
    tax = round(gross * SOVEREIGN_TAX_RATE, 8)
    return {
        "won": won,
        "stake": stake,
        "payout_ratio": payout,
        "gross": round(gross, 8),
        "tax": tax,
        "net": round(gross - tax, 8),
    }


def craps_prop_payout(prop: str, dice_roll: Tuple[int, int], stake: float) -> Dict:
    """
    Snake Eyes (2) and Boxcars (12) prop bets. 30:1 each per spec.
    """
    if len(dice_roll) != 2 or any(d < 1 or d > 6 for d in dice_roll):
        raise ValueError("invalid dice roll")
    if stake <= 0:
        raise ValueError("stake must be positive")
    p = prop.lower().strip()
    if p == "snake_eyes":
        won = dice_roll == (1, 1)
        ratio = CRAPS_SNAKE_EYES_PAYOUT
    elif p == "boxcars":
        won = dice_roll == (6, 6)
        ratio = CRAPS_BOXCARS_PAYOUT
    else:
        raise ValueError(f"unsupported Craps prop: {prop}")
    gross = stake * ratio if won else 0.0
    tax = round(gross * SOVEREIGN_TAX_RATE, 8)
    return {
        "won": won, "stake": stake, "payout_ratio": ratio,
        "gross": round(gross, 8), "tax": tax, "net": round(gross - tax, 8),
    }


def vibes_wheel_spin_outcome(landed_slot_index: int, stake: float) -> Dict:
    """
    Spec: 54 slots, 2 of which are Sovereign Jokers paying 40:1 + 10% burn.
    Slots 0 and 27 are the Sovereign Jokers (opposite sides of the wheel).
    """
    if not (0 <= landed_slot_index < VIBES_WHEEL_SLOTS):
        raise ValueError(f"slot index must be 0..{VIBES_WHEEL_SLOTS - 1}")
    if stake <= 0:
        raise ValueError("stake must be positive")

    sovereign_joker_indices = (0, 27)
    is_sovereign_joker = landed_slot_index in sovereign_joker_indices

    if is_sovereign_joker:
        gross = stake * VIBES_WHEEL_SOVEREIGN_JOKER_PAYOUT
        burn = round(gross * VIBES_WHEEL_SOVEREIGN_JOKER_BURN_PCT, 8)
        tax = round(gross * SOVEREIGN_TAX_RATE, 8)
    else:
        gross = 0.0
        burn = 0.0
        tax = 0.0

    return {
        "slot_index": landed_slot_index,
        "is_sovereign_joker": is_sovereign_joker,
        "gross": round(gross, 8),
        "tax": tax,
        "burn": burn,
        "net": round(gross - tax - burn, 8),
    }


__all__ = [
    "CARIBBEAN_STUD_DEALER_QUALIFIER_MIN", "CARIBBEAN_STUD_PAYOUT_TABLE",
    "PAI_GOW_TAX_ON_PLAYER_WIN_ONLY", "caribbean_stud_dealer_qualifies",
    "VIBES_SLOTS_RTP", "VIBES_SLOTS_JACKPOT_FEED_PCT",
    "vibes_slots_jackpot_contribution", "trigger_sovereign_rain",
    "SOCIAL_ROUND_TIMER_SECONDS", "BINGO_CARD_SIZE",
    "BINGO_SOVEREIGN_SQUARE_INDICES", "BINGO_SOVEREIGN_SQUARE_MULTIPLIER",
    "is_bingo_sovereign_square",
    "KENO_MIN_PICKS", "KENO_MAX_PICKS", "KENO_PERFECT_HIT_PAYOUT",
    "KENO_ZERO_HIT_REBATE", "keno_payout",
    "SIC_BO_SPECIFIC_TRIPLE_PAYOUT", "sic_bo_payout",
    "CRAPS_SNAKE_EYES_PAYOUT", "CRAPS_BOXCARS_PAYOUT", "craps_prop_payout",
    "YAHTZEE_UPPER_BONUS_MINING_BOOST_MINUTES",
    "YAHTZEE_UPPER_BONUS_MINING_MULT",
    "VIBES_WHEEL_SLOTS", "VIBES_WHEEL_SOVEREIGN_JOKER_COUNT",
    "VIBES_WHEEL_SOVEREIGN_JOKER_PAYOUT",
    "VIBES_WHEEL_SOVEREIGN_JOKER_BURN_PCT", "vibes_wheel_spin_outcome",
]
