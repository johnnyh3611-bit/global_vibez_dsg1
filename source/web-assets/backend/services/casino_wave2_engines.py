"""
Casino Coming-Soon Engines (Wave II).

Pure deterministic game engines for the second batch of 'Coming Soon'
casino games. Each function takes seed/inputs and returns a JSON-serializable
outcome. These are designed to be testable in isolation by
backend/tests/test_casino_wave2_engines.py.

All payouts honour SOVEREIGN_TAX_RATE from the pricing master vault.

Games implemented:
  - Three Card Poker        (player vs dealer, ante + play, pair plus side bet)
  - Pai Gow                 (highly simplified — high-card vs dealer)
  - Casino War              (single-card war, optional 'go to war')
  - Chemin de Fer           (banker variant of baccarat — same payouts)
  - European Roulette       (single-zero, all standard bet types)
  - Hazard                  (precursor to craps — main/chance)
  - Chuck-A-Luck            (3-dice, single-number bet)
  - Big Six Wheel           (54-segment money wheel)
  - Jacks or Better         (5-card draw video poker — pair of jacks min)
  - Fan-Tan                 (1/2/3/4 leftover bean count)
  - Faro                    (single deck, soda/hock card calls)
  - Vibes Darts             (target archer skill bonus)
"""
from __future__ import annotations

import random
import secrets
from collections import Counter
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from services.pricing_master_vault import SOVEREIGN_TAX_RATE

# ── Cryptographically-strong RNG for production gameplay ─────────────────
# `random` (Mersenne Twister) is sufficient for fairness in most internal
# games but regulators prefer `secrets.SystemRandom()` for casino RNG
# because the seed is the OS entropy pool and the sequence is not
# predictable from prior outputs. We expose `_RNG` for runtime calls
# and keep `random.Random(seed)` available for deterministic tests
# (engines accept an explicit `seed` parameter that bypasses _RNG).
_RNG: secrets.SystemRandom = secrets.SystemRandom()


# ── Card primitives (shared by Three Card Poker, Pai Gow, Casino War, ...) ─
SUITS: Tuple[str, ...] = ("S", "H", "D", "C")
RANKS: Tuple[str, ...] = ("2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A")
RANK_VALUE: Dict[str, int] = {r: i + 2 for i, r in enumerate(RANKS)}


def _shuffled_deck(seed: Optional[int] = None) -> List[Tuple[str, str]]:
    # Test path: deterministic Mersenne Twister seeded by the caller.
    # Production path: cryptographically-strong SystemRandom (regulator-grade).
    rng = random.Random(seed) if seed is not None else _RNG
    deck = [(r, s) for r in RANKS for s in SUITS]
    rng.shuffle(deck)
    return deck


def _apply_tax(gross: float) -> Tuple[float, float]:
    if gross <= 0:
        return (0.0, round(gross, 8))
    tax = round(gross * SOVEREIGN_TAX_RATE, 8)
    return (tax, round(gross - tax, 8))


# ──────────────────────────────────────────────────────────────────────────
# 1. THREE CARD POKER
# ──────────────────────────────────────────────────────────────────────────
THREE_CARD_PAIR_PLUS_PAYOUTS: Dict[str, int] = {
    "straight_flush": 40,
    "three_of_a_kind": 30,
    "straight": 6,
    "flush": 4,
    "pair": 1,
}
THREE_CARD_ANTE_BONUS: Dict[str, int] = {
    "straight_flush": 5,
    "three_of_a_kind": 4,
    "straight": 1,
}


def _three_card_category(cards: List[Tuple[str, str]]) -> Tuple[str, List[int]]:
    """Return (category, tiebreaker) for a 3-card hand."""
    if len(cards) != 3:
        raise ValueError("3 cards required")
    vals = sorted([RANK_VALUE[r] for r, _ in cards], reverse=True)
    suits = [s for _, s in cards]
    is_flush = len(set(suits)) == 1
    distinct = sorted(set(vals))
    is_straight = (
        len(distinct) == 3 and (max(vals) - min(vals) == 2)
    ) or (sorted(vals) == [2, 3, 14])  # A-2-3 wheel
    counts = Counter(vals)
    most = counts.most_common(1)[0][1]

    if is_flush and is_straight:
        return ("straight_flush", vals)
    if most == 3:
        return ("three_of_a_kind", vals)
    if is_straight:
        return ("straight", vals)
    if is_flush:
        return ("flush", vals)
    if most == 2:
        # rearrange so paired rank goes first
        pair_rank = [v for v, c in counts.items() if c == 2][0]
        kicker = [v for v, c in counts.items() if c == 1][0]
        return ("pair", [pair_rank, kicker])
    return ("high_card", vals)


def _three_card_qualifies(category: str, tb: List[int]) -> bool:
    """Dealer qualifies with Queen-high or better."""
    if category != "high_card":
        return True
    return tb[0] >= RANK_VALUE["Q"]


@dataclass
class ThreeCardOutcome:
    player_hand: List[Tuple[str, str]]
    dealer_hand: List[Tuple[str, str]]
    player_category: str
    dealer_category: str
    dealer_qualifies: bool
    folded: bool
    ante: float
    play_bet: float
    pair_plus: float
    ante_payout: float
    play_payout: float
    pair_plus_payout: float
    ante_bonus: float
    gross: float
    tax: float
    net: float


def play_three_card_poker(
    ante: float, raise_play: bool, pair_plus: float = 0.0,
    seed: Optional[int] = None,
) -> ThreeCardOutcome:
    if ante <= 0:
        raise ValueError("ante must be positive")
    if pair_plus < 0:
        raise ValueError("pair_plus must be ≥ 0")

    deck = _shuffled_deck(seed)
    p_hand = deck[:3]
    d_hand = deck[3:6]
    p_cat, p_tb = _three_card_category(p_hand)
    d_cat, d_tb = _three_card_category(d_hand)
    qualifies = _three_card_qualifies(d_cat, d_tb)
    play_bet = ante if raise_play else 0.0

    # Pair Plus side bet
    pp_payout = 0.0
    if pair_plus > 0 and p_cat in THREE_CARD_PAIR_PLUS_PAYOUTS:
        pp_payout = round(pair_plus * THREE_CARD_PAIR_PLUS_PAYOUTS[p_cat], 8)

    # Ante bonus (always paid when player has straight or better, even if loses)
    ante_bonus = 0.0
    if p_cat in THREE_CARD_ANTE_BONUS:
        ante_bonus = round(ante * THREE_CARD_ANTE_BONUS[p_cat], 8)

    if not raise_play:
        gross_main = -ante  # folded
        gross = gross_main + pp_payout + (-pair_plus if pp_payout == 0 else 0.0)
        tax, net = _apply_tax(gross)
        return ThreeCardOutcome(
            p_hand, d_hand, p_cat, d_cat, qualifies, True, ante, 0.0, pair_plus,
            -ante, 0.0, pp_payout if pp_payout > 0 else -pair_plus, ante_bonus,
            gross, tax, net,
        )

    # Compare hands
    p_idx = ("high_card", "pair", "flush", "straight", "three_of_a_kind", "straight_flush").index(p_cat)
    d_idx = ("high_card", "pair", "flush", "straight", "three_of_a_kind", "straight_flush").index(d_cat)
    if p_idx > d_idx or (p_idx == d_idx and p_tb > d_tb):
        winner = "player"
    elif p_idx < d_idx or p_tb < d_tb:
        winner = "dealer"
    else:
        winner = "push"

    if not qualifies:
        # Ante pays 1:1, Play pushes
        ante_pay = ante
        play_pay = 0.0
    elif winner == "player":
        ante_pay = ante
        play_pay = play_bet
    elif winner == "dealer":
        ante_pay = -ante
        play_pay = -play_bet
    else:
        ante_pay = 0.0
        play_pay = 0.0

    gross = ante_pay + play_pay + ante_bonus + (
        pp_payout if pp_payout > 0 else -pair_plus
    )
    tax, net = _apply_tax(gross)
    return ThreeCardOutcome(
        p_hand, d_hand, p_cat, d_cat, qualifies, False, ante, play_bet, pair_plus,
        ante_pay, play_pay,
        pp_payout if pp_payout > 0 else -pair_plus, ante_bonus,
        gross, tax, net,
    )


# ──────────────────────────────────────────────────────────────────────────
# 2. PAI GOW (simplified high-card variant)
# ──────────────────────────────────────────────────────────────────────────
def play_pai_gow_simple(stake: float, seed: Optional[int] = None) -> Dict:
    """Simplified Pai Gow: player and dealer each draw 7 cards. Highest
    rank in each hand is compared. Tie = push (no commission)."""
    if stake <= 0:
        raise ValueError("stake must be positive")
    deck = _shuffled_deck(seed)
    player_hand = deck[:7]
    dealer_hand = deck[7:14]
    p_high = max(RANK_VALUE[r] for r, _ in player_hand)
    d_high = max(RANK_VALUE[r] for r, _ in dealer_hand)

    if p_high > d_high:
        # Player wins; 5% commission on win
        gross = round(stake * 0.95, 8)
        outcome = "win"
    elif p_high < d_high:
        gross = -stake
        outcome = "lose"
    else:
        gross = 0.0
        outcome = "push"
    tax, net = _apply_tax(gross)
    return {
        "player_high": p_high, "dealer_high": d_high,
        "outcome": outcome, "gross": gross, "tax": tax, "net": net,
        "player_hand": [{"rank": r, "suit": s} for r, s in player_hand],
        "dealer_hand": [{"rank": r, "suit": s} for r, s in dealer_hand],
    }


# ──────────────────────────────────────────────────────────────────────────
# 3. CASINO WAR
# ──────────────────────────────────────────────────────────────────────────
def play_casino_war(stake: float, go_to_war: bool, seed: Optional[int] = None) -> Dict:
    """One card each. Tie → optional 'go to war' (extra ante). Tie wins
    war → bonus 1:1. Surrender on tie loses half."""
    if stake <= 0:
        raise ValueError("stake must be positive")
    deck = _shuffled_deck(seed)
    p_card = deck[0]
    d_card = deck[1]
    p_v = RANK_VALUE[p_card[0]]
    d_v = RANK_VALUE[d_card[0]]

    if p_v > d_v:
        gross = stake
        outcome = "win"
        extra: Optional[Dict] = None
    elif p_v < d_v:
        gross = -stake
        outcome = "lose"
        extra = None
    else:
        # Tie
        if not go_to_war:
            # Surrender: lose half the stake
            gross = -round(stake / 2, 8)
            outcome = "tie_surrender"
            extra = None
        else:
            # War: burn 3 cards, then deal 1 each. Ante doubles.
            war_p = deck[2 + 3]
            war_d = deck[2 + 4]
            war_p_v = RANK_VALUE[war_p[0]]
            war_d_v = RANK_VALUE[war_d[0]]
            extra_ante = stake
            if war_p_v >= war_d_v:
                # Win or tie on war = even money on the original stake +
                # bonus 1:1 on the extra ante (per Vegas rules).
                gross = stake + extra_ante
                outcome = "war_win"
            else:
                gross = -(stake + extra_ante)
                outcome = "war_lose"
            extra = {
                "war_player_card": {"rank": war_p[0], "suit": war_p[1]},
                "war_dealer_card": {"rank": war_d[0], "suit": war_d[1]},
                "extra_ante": extra_ante,
            }

    tax, net = _apply_tax(gross)
    return {
        "player_card": {"rank": p_card[0], "suit": p_card[1]},
        "dealer_card": {"rank": d_card[0], "suit": d_card[1]},
        "outcome": outcome,
        "gross": gross, "tax": tax, "net": net,
        "war": extra,
    }


# ──────────────────────────────────────────────────────────────────────────
# 4. CHEMIN DE FER (Banker baccarat — same hand math, different table flow)
# ──────────────────────────────────────────────────────────────────────────
def _baccarat_hand_value(cards: List[Tuple[str, str]]) -> int:
    total = 0
    for r, _ in cards:
        v = RANK_VALUE[r]
        if v >= 10:
            v = 0  # 10/J/Q/K = 0
        elif v == 14:
            v = 1  # Ace = 1
        total += v
    return total % 10


def play_chemin_de_fer(bet_side: str, stake: float, seed: Optional[int] = None) -> Dict:
    """bet_side = 'player' | 'banker' | 'tie'. Standard 8-deck baccarat math."""
    if bet_side not in ("player", "banker", "tie"):
        raise ValueError("bet_side must be player/banker/tie")
    if stake <= 0:
        raise ValueError("stake must be positive")

    deck = _shuffled_deck(seed)
    player = deck[:2]
    banker = deck[2:4]
    p_total = _baccarat_hand_value(player)
    b_total = _baccarat_hand_value(banker)

    # Natural 8/9 → no draw
    if p_total < 8 and b_total < 8:
        if p_total <= 5:
            player.append(deck[4])
            p_total = _baccarat_hand_value(player)
        # Banker draws based on simplified rule (matches industry table)
        if b_total <= 5:
            banker.append(deck[5])
            b_total = _baccarat_hand_value(banker)

    if p_total > b_total:
        winner = "player"
    elif p_total < b_total:
        winner = "banker"
    else:
        winner = "tie"

    if bet_side == winner:
        if bet_side == "banker":
            gross = round(stake * 0.95, 8)  # 5% commission
        elif bet_side == "tie":
            gross = stake * 8
        else:
            gross = stake
    elif winner == "tie":
        gross = 0.0   # bets push if banker/player when tie
    else:
        gross = -stake
    tax, net = _apply_tax(gross)
    return {
        "player_hand": [{"rank": r, "suit": s} for r, s in player],
        "banker_hand": [{"rank": r, "suit": s} for r, s in banker],
        "player_total": p_total, "banker_total": b_total,
        "winner": winner, "gross": gross, "tax": tax, "net": net,
    }


# ──────────────────────────────────────────────────────────────────────────
# 5. EUROPEAN ROULETTE (single-zero)
# ──────────────────────────────────────────────────────────────────────────
EU_ROULETTE_RED = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
EU_ROULETTE_PAYOUTS: Dict[str, int] = {
    "straight": 35, "split": 17, "street": 11, "corner": 8,
    "line": 5, "column": 2, "dozen": 2, "red": 1, "black": 1,
    "even": 1, "odd": 1, "low": 1, "high": 1,
}


def spin_european_roulette(seed: Optional[int] = None) -> int:
    rng = random.Random(seed) if seed is not None else _RNG
    return rng.randint(0, 36)


def settle_european_roulette(bet_type: str, bet_value, stake: float, landed: int) -> Dict:
    """bet_type:
      - straight: bet_value = single int 0..36
      - red/black/even/odd/low/high: bet_value = None
      - column: 1..3
      - dozen: 1..3
    """
    if stake <= 0:
        raise ValueError("stake must be positive")
    if not (0 <= landed <= 36):
        raise ValueError("landed must be 0..36")

    won = False
    if bet_type == "straight":
        won = (bet_value == landed)
    elif bet_type == "red":
        won = landed in EU_ROULETTE_RED
    elif bet_type == "black":
        won = landed not in EU_ROULETTE_RED and landed != 0
    elif bet_type == "even":
        won = landed != 0 and landed % 2 == 0
    elif bet_type == "odd":
        won = landed % 2 == 1
    elif bet_type == "low":
        won = 1 <= landed <= 18
    elif bet_type == "high":
        won = 19 <= landed <= 36
    elif bet_type == "dozen":
        if bet_value == 1: won = 1 <= landed <= 12
        elif bet_value == 2: won = 13 <= landed <= 24
        elif bet_value == 3: won = 25 <= landed <= 36
    elif bet_type == "column":
        if landed == 0:
            won = False
        else:
            col = ((landed - 1) % 3) + 1
            won = col == bet_value
    else:
        raise ValueError(f"unsupported bet_type {bet_type}")

    payout_ratio = EU_ROULETTE_PAYOUTS.get(bet_type, 1)
    gross = stake * payout_ratio if won else -stake
    tax, net = _apply_tax(gross)
    return {
        "landed": landed, "bet_type": bet_type, "bet_value": bet_value,
        "won": won, "payout_ratio": payout_ratio,
        "gross": gross, "tax": tax, "net": net,
    }


# ──────────────────────────────────────────────────────────────────────────
# 6. HAZARD (precursor to Craps — pick a 'main', roll dice)
# ──────────────────────────────────────────────────────────────────────────
def play_hazard(main: int, stake: float, seed: Optional[int] = None) -> Dict:
    """Caster picks a 'main' 5..9. Two dice. Rules per 17th-century English
    hazard simplified: total == main → win. 2/3/12 → 'crabs' loss. Other
    totals = chance number; reroll until chance hits (win) or main hits (loss).
    """
    if main not in (5, 6, 7, 8, 9):
        raise ValueError("main must be 5..9")
    if stake <= 0:
        raise ValueError("stake must be positive")
    rng = random.Random(seed) if seed is not None else _RNG
    history: List[Tuple[int, int]] = []

    first = (rng.randint(1, 6), rng.randint(1, 6))
    history.append(first)
    total = sum(first)

    if total == main:
        outcome = "nick_win"
        gross = stake
    elif total in (2, 3, 12):
        outcome = "crabs_loss"
        gross = -stake
    else:
        chance = total
        # roll up to 50 times
        outcome = "loss"
        gross = -stake
        for _ in range(50):
            roll = (rng.randint(1, 6), rng.randint(1, 6))
            history.append(roll)
            t = sum(roll)
            if t == chance:
                outcome = "chance_hit"; gross = stake; break
            if t == main:
                outcome = "main_loss"; gross = -stake; break

    tax, net = _apply_tax(gross)
    return {
        "main": main, "history": [list(h) for h in history],
        "outcome": outcome, "gross": gross, "tax": tax, "net": net,
    }


# ──────────────────────────────────────────────────────────────────────────
# 7. CHUCK-A-LUCK
# ──────────────────────────────────────────────────────────────────────────
def play_chuck_a_luck(picked_number: int, stake: float, seed: Optional[int] = None) -> Dict:
    """Three dice rolled. Pick a number 1..6.
       1 match → 1:1, 2 matches → 2:1, 3 matches (triple) → 10:1.
    """
    if picked_number < 1 or picked_number > 6:
        raise ValueError("picked_number must be 1..6")
    if stake <= 0:
        raise ValueError("stake must be positive")
    rng = random.Random(seed) if seed is not None else _RNG
    dice = [rng.randint(1, 6) for _ in range(3)]
    matches = sum(1 for d in dice if d == picked_number)
    if matches == 0:
        gross = -stake
        ratio = 0
    elif matches == 1:
        gross = stake; ratio = 1
    elif matches == 2:
        gross = stake * 2; ratio = 2
    else:
        gross = stake * 10; ratio = 10
    tax, net = _apply_tax(gross)
    return {
        "dice": dice, "picked": picked_number, "matches": matches,
        "payout_ratio": ratio, "gross": gross, "tax": tax, "net": net,
    }


# ──────────────────────────────────────────────────────────────────────────
# 8. BIG SIX WHEEL (54-segment wheel of fortune)
# ──────────────────────────────────────────────────────────────────────────
# Standard payout segments + counts. Labels are payout multipliers
# (1×, 2×, 5×, 10×, 20×, Joker 40×, Logo 40×) — never fiat amounts.
# All stakes settle in Vibez Coins.
BIG_SIX_LAYOUT: List[Tuple[str, int, int]] = [
    # (label, payout_ratio, count_on_wheel)
    ("1", 1, 24),
    ("2", 2, 15),
    ("5", 5, 7),
    ("10", 10, 4),
    ("20", 20, 2),
    ("Joker", 40, 1),
    ("Logo", 40, 1),
]
# Total = 24+15+7+4+2+1+1 = 54


def spin_big_six(seed: Optional[int] = None) -> Tuple[str, int]:
    """Returns (segment_label, payout_ratio)."""
    rng = random.Random(seed) if seed is not None else _RNG
    pool: List[Tuple[str, int]] = []
    for label, ratio, count in BIG_SIX_LAYOUT:
        pool.extend([(label, ratio)] * count)
    return rng.choice(pool)


def play_big_six(bet_label: str, stake: float, seed: Optional[int] = None) -> Dict:
    if stake <= 0:
        raise ValueError("stake must be positive")
    valid = {x[0] for x in BIG_SIX_LAYOUT}
    if bet_label not in valid:
        raise ValueError(f"bet_label must be one of {valid}")
    landed_label, landed_ratio = spin_big_six(seed)
    won = landed_label == bet_label
    gross = stake * landed_ratio if won else -stake
    tax, net = _apply_tax(gross)
    return {
        "landed": landed_label, "bet": bet_label, "won": won,
        "payout_ratio": landed_ratio if won else 0,
        "gross": gross, "tax": tax, "net": net,
    }


# ──────────────────────────────────────────────────────────────────────────
# 9. JACKS OR BETTER (5-card draw video poker)
# ──────────────────────────────────────────────────────────────────────────
JACKS_OR_BETTER_PAYTABLE: Dict[str, int] = {
    "royal_flush": 800, "straight_flush": 50, "four_of_a_kind": 25,
    "full_house": 9, "flush": 6, "straight": 4, "three_of_a_kind": 3,
    "two_pair": 2, "jacks_or_better": 1,
}


def _five_card_eval(cards: List[Tuple[str, str]]) -> str:
    if len(cards) != 5:
        raise ValueError("5 cards required")
    vals = [RANK_VALUE[r] for r, _ in cards]
    suits = [s for _, s in cards]
    counts = Counter(vals)
    pattern = sorted(counts.values(), reverse=True)
    is_flush = len(set(suits)) == 1
    sorted_vals = sorted(set(vals))
    is_straight = (len(sorted_vals) == 5) and (max(sorted_vals) - min(sorted_vals) == 4)
    if not is_straight and sorted_vals == [2, 3, 4, 5, 14]:  # wheel
        is_straight = True
    is_royal = is_flush and is_straight and set(vals) == {10, 11, 12, 13, 14}
    if is_royal:
        return "royal_flush"
    if is_flush and is_straight:
        return "straight_flush"
    if pattern == [4, 1]:
        return "four_of_a_kind"
    if pattern == [3, 2]:
        return "full_house"
    if is_flush:
        return "flush"
    if is_straight:
        return "straight"
    if pattern == [3, 1, 1]:
        return "three_of_a_kind"
    if pattern == [2, 2, 1]:
        return "two_pair"
    if pattern == [2, 1, 1, 1]:
        # Pair must be Jacks or better
        pair_rank = [v for v, c in counts.items() if c == 2][0]
        if pair_rank >= 11:
            return "jacks_or_better"
        return "pair_low"
    return "high_card"


def deal_jacks_or_better(seed: Optional[int] = None) -> List[Tuple[str, str]]:
    return _shuffled_deck(seed)[:5]


def draw_jacks_or_better(
    initial: List[Tuple[str, str]], hold_indices: List[int],
    seed: Optional[int] = None,
) -> Dict:
    """Hold the listed indices, replace the rest from a fresh deck."""
    if len(initial) != 5:
        raise ValueError("initial hand must have 5 cards")
    deck = _shuffled_deck(seed)
    # Use cards not already in initial
    initial_set = set((r, s) for r, s in initial)
    fresh = [c for c in deck if c not in initial_set]
    final: List[Tuple[str, str]] = []
    fi = 0
    for i in range(5):
        if i in hold_indices:
            final.append(initial[i])
        else:
            final.append(fresh[fi])
            fi += 1
    cat = _five_card_eval(final)
    return {"final_hand": [{"rank": r, "suit": s} for r, s in final], "category": cat}


def play_jacks_or_better(
    initial: List[Tuple[str, str]], hold_indices: List[int],
    stake: float, seed: Optional[int] = None,
) -> Dict:
    if stake <= 0:
        raise ValueError("stake must be positive")
    out = draw_jacks_or_better(initial, hold_indices, seed=seed)
    cat = out["category"]
    multiplier = JACKS_OR_BETTER_PAYTABLE.get(cat, 0)
    if multiplier > 0:
        gross = stake * multiplier
    else:
        gross = -stake
    tax, net = _apply_tax(gross)
    return {
        "final_hand": out["final_hand"], "category": cat,
        "multiplier": multiplier, "gross": gross, "tax": tax, "net": net,
    }


# ──────────────────────────────────────────────────────────────────────────
# 10. FAN-TAN (Chinese bean game — guess remainder when divided by 4)
# ──────────────────────────────────────────────────────────────────────────
def play_fan_tan(pick: int, stake: float, seed: Optional[int] = None) -> Dict:
    """Pick 1..4. Banker pulls a random pile of 8..96 beans. Beans are
    counted out 4 at a time. Remainder (1..4) is the result. 3:1 win,
    less 5% commission (industry standard)."""
    if pick not in (1, 2, 3, 4):
        raise ValueError("pick must be 1..4")
    if stake <= 0:
        raise ValueError("stake must be positive")
    rng = random.Random(seed) if seed is not None else _RNG
    pile = rng.randint(8, 96)
    remainder = pile % 4 or 4   # 0 → 4
    won = (remainder == pick)
    if won:
        gross = round(stake * 3 * 0.95, 8)
    else:
        gross = -stake
    tax, net = _apply_tax(gross)
    return {
        "pile": pile, "remainder": remainder, "pick": pick,
        "won": won, "gross": gross, "tax": tax, "net": net,
    }


# ──────────────────────────────────────────────────────────────────────────
# 11. FARO (single-deck "soda/hock" card calls)
# ──────────────────────────────────────────────────────────────────────────
def play_faro(picked_rank: str, stake: float, seed: Optional[int] = None) -> Dict:
    """Banker draws two cards: 'losing' (banker) and 'winning' (player).
    If picked rank == winning card → 1:1 win. == losing → -1 stake.
    Tie/split (same rank both) → half stake loss."""
    if picked_rank not in RANKS:
        raise ValueError("invalid rank")
    if stake <= 0:
        raise ValueError("stake must be positive")
    deck = _shuffled_deck(seed)
    losing = deck[0]
    winning = deck[1]
    if losing[0] == winning[0]:
        # Split
        gross = -round(stake / 2, 8)
        outcome = "split"
    elif winning[0] == picked_rank:
        gross = stake; outcome = "win"
    elif losing[0] == picked_rank:
        gross = -stake; outcome = "lose"
    else:
        gross = 0.0; outcome = "no_action"
    tax, net = _apply_tax(gross)
    return {
        "losing_card": {"rank": losing[0], "suit": losing[1]},
        "winning_card": {"rank": winning[0], "suit": winning[1]},
        "picked": picked_rank, "outcome": outcome,
        "gross": gross, "tax": tax, "net": net,
    }


# ──────────────────────────────────────────────────────────────────────────
# 12. VIBES DARTS (skill game — payout based on accuracy)
# ──────────────────────────────────────────────────────────────────────────
def score_vibes_dart(distance_from_bullseye: float, stake: float) -> Dict:
    """distance_from_bullseye is 0.0 (perfect) → 1.0 (edge of board).
    Bullseye (≤0.05) = 50:1. Inner ring (≤0.15) = 10:1. Outer (≤0.40) = 2:1.
    Miss (>0.40) = -stake.
    """
    if not (0.0 <= distance_from_bullseye <= 1.0):
        raise ValueError("distance must be 0..1")
    if stake <= 0:
        raise ValueError("stake must be positive")
    if distance_from_bullseye <= 0.05:
        ratio = 50; tier = "bullseye"
    elif distance_from_bullseye <= 0.15:
        ratio = 10; tier = "inner_ring"
    elif distance_from_bullseye <= 0.40:
        ratio = 2; tier = "outer_ring"
    else:
        ratio = -1; tier = "miss"

    gross = stake * ratio if ratio > 0 else -stake
    tax, net = _apply_tax(gross)
    return {
        "distance": distance_from_bullseye, "tier": tier,
        "payout_ratio": ratio, "gross": gross, "tax": tax, "net": net,
    }


__all__ = [
    "RANKS", "SUITS", "RANK_VALUE",
    "play_three_card_poker", "THREE_CARD_PAIR_PLUS_PAYOUTS",
    "play_pai_gow_simple",
    "play_casino_war",
    "play_chemin_de_fer",
    "spin_european_roulette", "settle_european_roulette",
    "EU_ROULETTE_PAYOUTS", "EU_ROULETTE_RED",
    "play_hazard",
    "play_chuck_a_luck",
    "BIG_SIX_LAYOUT", "spin_big_six", "play_big_six",
    "JACKS_OR_BETTER_PAYTABLE", "deal_jacks_or_better",
    "draw_jacks_or_better", "play_jacks_or_better",
    "play_fan_tan",
    "play_faro",
    "score_vibes_dart",
]
