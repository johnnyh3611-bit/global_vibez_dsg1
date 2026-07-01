"""
DSG Board & Hybrid Casino Logic - Volume II
─────────────────────────────────────────────
Source of truth: DSG_Sovereign_Board_Hybrid_Casino_Master.pdf (founder spec, Feb 2026).

This module is PURE. No DB. No I/O. Deterministic.

Implements three sections of the founder spec:

  I.   Board Game Bounty War (Ludo, Yahtzee, etc.)
       Winner-Takes-All baseline. On tie, FLAT-RATE buy-in per round
       (NOT the geometric doubling of services/war_of_attrition.py).
       Players who can't cover are marked BANKRUPT and eliminated.

  II.  Hybrid Roulette: "The Sovereign Spin"
       Standard player-vs-house for 29 minutes. Every 30th minute,
       all active table bets are POOLED. Winning number/color takes
       the pot minus 13.5% Sovereign Tax. No-hit rolls carry over
       into a "Honey Pot" jackpot.

  III. House Bonus & Spectator "Triple-Threat"
       House Drops, King's Ransom (spectator tipping into live pot),
       Spectator Side-Bets, Passive Mining placeholders.

Wired to:
  - services/pricing_master_vault.py     SOVEREIGN_TAX_RATE = 0.135
  - services/sovereign_game_logic.py     TieContender (re-used)
  - services/war_of_attrition.py         (separate doubling protocol — DON'T confuse)

Tested by backend/tests/test_board_hybrid_casino.py.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple

from services.pricing_master_vault import SOVEREIGN_TAX_RATE
from services.sovereign_game_logic import TieContender


# ── Section I: Board Bounty War (FLAT-RATE) ─────────────────────────────────
@dataclass
class BoardWarRound:
    """Outcome of a single round of the Flat-Rate Bounty War."""
    round_number: int
    pot_before: float
    pot_after: float
    survivors: List[str]              # player_ids still in
    eliminated: List[str]             # marked BANKRUPT this round
    contributions: Dict[str, float]   # player_id -> amount paid this round
    round_tax: float                  # 13.5% on the round's intake
    events: List[Dict]


@dataclass
class BoardWarOutcome:
    """Final result of a multi-round Flat-Rate Bounty War."""
    status: str                       # 'winner' | 'all_bankrupt'
    winner: Optional[str]
    final_pot: float
    rounds_played: int
    total_tax: float
    rounds: List[BoardWarRound] = field(default_factory=list)


def trigger_board_war(
    contenders: List[TieContender],
    flat_buyin: float,
    initial_pot: float = 0.0,
    max_rounds: int = 100,
) -> BoardWarOutcome:
    """
    Implements the verbatim spec function `triggerBoardWar` from §I.

    Per spec: every contender attempts to deduct `flat_buyin`. Those who
    can cover stay in. Those who can't are marked BANKRUPT and eliminated.
    Rounds repeat until exactly one survivor remains, or all are bankrupt.

    The flat rate distinguishes this from the Card-Game War of Attrition
    (which DOUBLES the bounty each round). Board games stay on a fixed
    buy-in — the elimination is the punishment, not the dollar amount.

    Args:
        contenders: Tied players who must enter the bounty war
        flat_buyin: Re-ante amount (constant for every round)
        initial_pot: Starting pot brought into the war
        max_rounds: Safety cap

    Returns:
        BoardWarOutcome with full round-by-round trace + tax accounting
    """
    if flat_buyin < 0:
        raise ValueError("flat_buyin must be non-negative")
    if initial_pot < 0:
        raise ValueError("initial_pot must be non-negative")
    if not contenders:
        raise ValueError("contenders must not be empty")
    if max_rounds < 1:
        raise ValueError("max_rounds must be >= 1")

    pot = round(initial_pot, 8)
    total_tax = 0.0
    rounds: List[BoardWarRound] = []
    active: List[TieContender] = list(contenders)

    for round_num in range(1, max_rounds + 1):
        pot_before = pot
        contributions: Dict[str, float] = {}
        eliminated: List[str] = []
        round_events: List[Dict] = []

        survivors_this_round: List[TieContender] = []
        for p in active:
            if p.balance >= flat_buyin:
                p.deduct(flat_buyin)
                pot = round(pot + flat_buyin, 8)
                contributions[p.player_id] = flat_buyin
                survivors_this_round.append(p)
                round_events.append({
                    "type": "board_war.bounty_paid",
                    "round": round_num,
                    "player_id": p.player_id,
                    "amount": flat_buyin,
                    "balance_after": p.balance,
                })
            else:
                eliminated.append(p.player_id)
                round_events.append({
                    "type": "board_war.bankrupt",
                    "round": round_num,
                    "player_id": p.player_id,
                    "required": flat_buyin,
                    "balance": p.balance,
                })

        # Tax = 13.5% of THIS round's intake (per spec: "burn rate")
        round_intake = sum(contributions.values())
        round_tax = round(round_intake * SOVEREIGN_TAX_RATE, 8)
        total_tax = round(total_tax + round_tax, 8)

        rounds.append(BoardWarRound(
            round_number=round_num,
            pot_before=pot_before,
            pot_after=pot,
            survivors=[p.player_id for p in survivors_this_round],
            eliminated=eliminated,
            contributions=contributions,
            round_tax=round_tax,
            events=round_events,
        ))

        active = survivors_this_round

        if len(active) == 0:
            return BoardWarOutcome(
                status="all_bankrupt",
                winner=None,
                final_pot=pot,
                rounds_played=round_num,
                total_tax=total_tax,
                rounds=rounds,
            )
        if len(active) == 1:
            return BoardWarOutcome(
                status="winner",
                winner=active[0].player_id,
                final_pot=pot,
                rounds_played=round_num,
                total_tax=total_tax,
                rounds=rounds,
            )
        # else: 2+ survivors → another flat-rate round

    raise RuntimeError(f"Board War exceeded safety cap of {max_rounds} rounds")


# ── Section II: Hybrid Roulette / Sovereign Spin ────────────────────────────
SOVEREIGN_SPIN_PERIOD_MIN: int = 30      # every Nth minute → mega-pot
STANDARD_PLAY_MINUTES: int = 29          # the 29 normal minutes


@dataclass
class RouletteBet:
    """A single player bet placed at the table."""
    player_id: str
    amount: float
    target: str       # e.g. "17", "red", "even", "1-12"

    def __post_init__(self):
        if self.amount <= 0:
            raise ValueError("bet amount must be positive")


@dataclass
class SovereignSpinResult:
    """Result of one Sovereign Spin."""
    winning_number: int               # 0..36 (European wheel)
    winning_color: str                # "red" | "black" | "green"
    pooled_amount: float              # sum of all bets
    winners: List[Tuple[str, float]]  # (player_id, payout)
    total_payout: float               # before tax
    sovereign_tax: float              # 13.5% of payout
    net_to_winners: float             # total_payout - sovereign_tax
    honey_pot_carry: float            # pot rolled forward when no winner
    is_honey_pot_hit: bool


# Standard European wheel colors (single-zero)
_RED_NUMBERS = frozenset({1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36})
_BLACK_NUMBERS = frozenset({2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35})


def _color_of(n: int) -> str:
    if n == 0:
        return "green"
    if n in _RED_NUMBERS:
        return "red"
    return "black"


def is_sovereign_spin_minute(minute_of_hour: int) -> bool:
    """
    True if the given minute (0..59) is a Sovereign Spin minute.
    Per spec: "Every 30th minute". We treat minute 29 (0-indexed) as the
    Sovereign Spin, which is the 30th minute when counting from 1.
    """
    if not (0 <= minute_of_hour <= 59):
        raise ValueError("minute_of_hour must be 0..59")
    # Spec: "Standard Player-vs-House play for 29 minutes. Every 30th minute…"
    # Interpretation: minutes 0..28 (29 minutes) are standard, minute 29 is Spin,
    # then 30..58 standard, minute 59 is Spin again.
    return (minute_of_hour + 1) % SOVEREIGN_SPIN_PERIOD_MIN == 0


def _bet_pays(bet: RouletteBet, winning_number: int, winning_color: str) -> bool:
    """Determine whether a bet wins on this spin (standard roulette)."""
    t = bet.target.lower().strip()
    if t.isdigit():
        return int(t) == winning_number
    if t in ("red", "black"):
        return t == winning_color
    if t in ("even", "odd"):
        if winning_number == 0:
            return False
        return ("even" if winning_number % 2 == 0 else "odd") == t
    if t in ("low", "1-18"):
        return 1 <= winning_number <= 18
    if t in ("high", "19-36"):
        return 19 <= winning_number <= 36
    if t == "1-12":
        return 1 <= winning_number <= 12
    if t == "13-24":
        return 13 <= winning_number <= 24
    if t == "25-36":
        return 25 <= winning_number <= 36
    return False


def execute_sovereign_spin(
    bets: List[RouletteBet],
    winning_number: int,
    honey_pot_carry: float = 0.0,
) -> SovereignSpinResult:
    """
    Execute one Sovereign Spin per spec §II.

    All `bets` are pooled into a single pot. Players who match the winning
    number/color split the pot proportionally to their stake among winners.
    If NOBODY wins, the entire pot rolls over to the next Sovereign Spin
    via `honey_pot_carry`.

    13.5% Sovereign Tax is applied to the gross payout. The remainder is
    distributed to winners.
    """
    if not (0 <= winning_number <= 36):
        raise ValueError("winning_number must be 0..36")
    if honey_pot_carry < 0:
        raise ValueError("honey_pot_carry must be non-negative")

    color = _color_of(winning_number)
    pooled = round(sum(b.amount for b in bets) + honey_pot_carry, 8)
    winning_bets = [b for b in bets if _bet_pays(b, winning_number, color)]

    if not winning_bets:
        # Honey-pot carry: pot rolls forward, no tax taken (no winnings yet)
        return SovereignSpinResult(
            winning_number=winning_number,
            winning_color=color,
            pooled_amount=pooled,
            winners=[],
            total_payout=0.0,
            sovereign_tax=0.0,
            net_to_winners=0.0,
            honey_pot_carry=pooled,
            is_honey_pot_hit=False,
        )

    # Split pot proportionally to winner stake
    total_winning_stake = sum(b.amount for b in winning_bets)
    sovereign_tax = round(pooled * SOVEREIGN_TAX_RATE, 8)
    net_to_winners = round(pooled - sovereign_tax, 8)

    payouts: List[Tuple[str, float]] = []
    distributed = 0.0
    for b in winning_bets[:-1]:
        share = round(net_to_winners * (b.amount / total_winning_stake), 8)
        payouts.append((b.player_id, share))
        distributed = round(distributed + share, 8)
    # Last winner takes the remainder so we never lose floating-point cents
    last = winning_bets[-1]
    payouts.append((last.player_id, round(net_to_winners - distributed, 8)))

    return SovereignSpinResult(
        winning_number=winning_number,
        winning_color=color,
        pooled_amount=pooled,
        winners=payouts,
        total_payout=pooled,
        sovereign_tax=sovereign_tax,
        net_to_winners=net_to_winners,
        honey_pot_carry=0.0,
        is_honey_pot_hit=honey_pot_carry > 0,
    )


# ── Section III: House Bonus & Spectator "Triple-Threat" ────────────────────
@dataclass
class HouseDropEvent:
    """A House liquidity injection — spec: 'AI injects liquidity into active pots'."""
    pot_id: str
    amount: float
    reason: str           # e.g. "loyalty_boost", "chair_holder_priority"
    is_chair_holder_room: bool


def calculate_house_drop(
    base_pot: float,
    is_chair_holder_room: bool,
    activity_score: float = 1.0,
) -> float:
    """
    Spec §III: "Random House Drops … Chair Holder rooms get priority."

    Pure heuristic the route layer can use to size a House Drop:
      base = 1% of the pot times activity_score
      chair-holder rooms get 3x priority multiplier
    """
    if base_pot < 0:
        raise ValueError("base_pot must be non-negative")
    if activity_score < 0:
        raise ValueError("activity_score must be non-negative")
    base = base_pot * 0.01 * activity_score
    if is_chair_holder_room:
        base *= 3.0
    return round(base, 8)


def kings_ransom_tip(pot: float, tip_amount: float, spectator_id: str) -> Dict:
    """
    Spec §III: "King's Ransom: Spectators can gift tokens into the live pot
    to 'pump' the stakes during a tie-breaker."

    Pure helper that builds the event payload + applies the 13.5% tax to
    the tip itself. Returns the new pot balance and tax info.
    """
    if tip_amount <= 0:
        raise ValueError("tip_amount must be positive")
    tax = round(tip_amount * SOVEREIGN_TAX_RATE, 8)
    net_to_pot = round(tip_amount - tax, 8)
    return {
        "type": "spectator.kings_ransom",
        "spectator_id": spectator_id,
        "tip_gross": round(tip_amount, 8),
        "tax": tax,
        "net_to_pot": net_to_pot,
        "new_pot": round(pot + net_to_pot, 8),
        "label": f"{spectator_id} gifts ${tip_amount:.2f} (${tax:.2f} burned, ${net_to_pot:.2f} into pot)",
    }


def spectator_side_bet_payout(stake: float, odds_multiplier: float, won: bool) -> Dict:
    """
    Spec §III: "Spectator Side-Bets: Watchers bet on Bounty War outcomes;
    13.5% tax applies to all winnings."
    """
    if stake <= 0:
        raise ValueError("stake must be positive")
    if odds_multiplier <= 0:
        raise ValueError("odds_multiplier must be positive")
    if not won:
        return {
            "won": False,
            "stake": round(stake, 8),
            "gross_winnings": 0.0,
            "tax": 0.0,
            "net_winnings": 0.0,
        }
    gross = round(stake * odds_multiplier, 8)
    tax = round(gross * SOVEREIGN_TAX_RATE, 8)
    return {
        "won": True,
        "stake": round(stake, 8),
        "gross_winnings": gross,
        "tax": tax,
        "net_winnings": round(gross - tax, 8),
    }


__all__ = [
    # Section I
    "BoardWarRound", "BoardWarOutcome", "trigger_board_war",
    # Section II
    "RouletteBet", "SovereignSpinResult",
    "SOVEREIGN_SPIN_PERIOD_MIN", "STANDARD_PLAY_MINUTES",
    "is_sovereign_spin_minute", "execute_sovereign_spin",
    # Section III
    "HouseDropEvent", "calculate_house_drop",
    "kings_ransom_tip", "spectator_side_bet_payout",
]
