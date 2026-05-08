"""
DSG "War of Attrition" Logic v1.0
─────────────────────────────────
Source of truth: Global_Vibez_Sovereign_Final_Constitution_v10.pdf
(founder spec, Feb 2026).

Pure module. Deterministic. No DB. No I/O.

Implements three sections of the founder spec:

  1. The "Infinite Stake" Loop
     Recursive tie-breaker. Each tie carries the bounty forward;
     both players must re-ante. Repeats until:
       (a) one player wins the roll, or
       (b) a player cannot cover the bounty (bankruptcy).
     Implemented ITERATIVELY to avoid Python recursion limits.

  2. The Sovereign Tax Multiplier
     Every re-entry is a new taxable transaction.
     Each re-ante adds the 13.5% Sovereign Tax to cumulative
     tax revenue. A 3-tie game generates 300% more tax than
     a standard game. Integrates with services/pricing_master_vault.py
     (SOVEREIGN_TAX_RATE = 0.135).

  3. Spectator "Side-Action"
     During the tie loop, returns an event payload the room
     broadcast can use to re-open the spectator side-betting
     window for each fresh round.

Tested by backend/tests/test_war_of_attrition.py.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple

from services.pricing_master_vault import SOVEREIGN_TAX_RATE
from services.sovereign_game_logic import TieContender


# ── Section 1: Infinite Stake Loop ──────────────────────────────────────────
@dataclass
class RollResult:
    """
    Outcome of a single 6-5-4 roll in the shootout.

    - is_tie=True  → loop continues
    - is_tie=False → winner is the specified contender
    """
    is_tie: bool
    winner: Optional[TieContender] = None


@dataclass
class AttritionOutcome:
    """
    Final resolution of an Infinite Stake loop.

    status:
      'winner'        → one contender won a non-tied roll
      'bankruptcy'    → loop ended because a contender could not
                        cover the bounty; opponent takes the pot
      'all_bankrupt'  → neither contender could cover on a
                        subsequent round (rare edge case)
    """
    status: str
    winner: Optional[TieContender]
    loser: Optional[TieContender]
    final_pot: float
    rounds_played: int
    total_tax: float
    tax_breakdown: List[float] = field(default_factory=list)
    pot_history: List[float] = field(default_factory=list)
    events: List[Dict] = field(default_factory=list)


def initiate_shootout(
    player_a: TieContender,
    player_b: TieContender,
    current_pot: float,
    bounty: float,
    roll_fn: Callable[[TieContender, TieContender], RollResult],
    max_rounds: int = 1000,
) -> AttritionOutcome:
    """
    Run the recursive tie-breaker iteratively.

    Per spec §1: on each tie, both players deduct `bounty`, pot
    grows by 2*bounty, and a fresh roll is performed. Loop exits
    on a non-tied roll or a bankruptcy.

    `roll_fn` is an injected dice roller so the engine stays pure
    and testable. In production, the route layer wires a real
    RNG-backed roller.

    `max_rounds` is a safety cap — the loop is theoretically
    infinite (§1 "repeats indefinitely") but we cap at 1000 to
    prevent runaway loops from buggy roll functions.

    Returns an AttritionOutcome with full pot, tax, and event history.
    """
    if bounty < 0:
        raise ValueError("bounty must be non-negative")
    if current_pot < 0:
        raise ValueError("current_pot must be non-negative")
    if max_rounds < 1:
        raise ValueError("max_rounds must be >= 1")

    pot = round(current_pot, 8)
    rounds = 0
    tax_breakdown: List[float] = []
    pot_history: List[float] = [pot]
    events: List[Dict] = []
    total_tax = 0.0

    while rounds < max_rounds:
        # Bankruptcy check — spec §1: "resolveByBankruptcy"
        if not player_a.can_cover(bounty):
            events.append({
                "type": "attrition.bankruptcy",
                "bankrupt_player": player_a.player_id,
                "opponent": player_b.player_id,
                "round": rounds,
            })
            if not player_b.can_cover(bounty):
                return AttritionOutcome(
                    status="all_bankrupt",
                    winner=None,
                    loser=None,
                    final_pot=pot,
                    rounds_played=rounds,
                    total_tax=round(total_tax, 8),
                    tax_breakdown=tax_breakdown,
                    pot_history=pot_history,
                    events=events,
                )
            return AttritionOutcome(
                status="bankruptcy",
                winner=player_b,
                loser=player_a,
                final_pot=pot,
                rounds_played=rounds,
                total_tax=round(total_tax, 8),
                tax_breakdown=tax_breakdown,
                pot_history=pot_history,
                events=events,
            )
        if not player_b.can_cover(bounty):
            events.append({
                "type": "attrition.bankruptcy",
                "bankrupt_player": player_b.player_id,
                "opponent": player_a.player_id,
                "round": rounds,
            })
            return AttritionOutcome(
                status="bankruptcy",
                winner=player_a,
                loser=player_b,
                final_pot=pot,
                rounds_played=rounds,
                total_tax=round(total_tax, 8),
                tax_breakdown=tax_breakdown,
                pot_history=pot_history,
                events=events,
            )

        # Re-ante — spec §1: "Process Re-Entry"
        player_a.deduct(bounty)
        player_b.deduct(bounty)
        pot = round(pot + 2 * bounty, 8)
        pot_history.append(pot)

        # Sovereign Tax — spec §2: "Every re-entry is a new transaction"
        round_tax = round(2 * bounty * SOVEREIGN_TAX_RATE, 8)
        total_tax = round(total_tax + round_tax, 8)
        tax_breakdown.append(round_tax)

        rounds += 1

        events.append({
            "type": "attrition.reentry",
            "round": rounds,
            "pot": pot,
            "round_tax": round_tax,
            "cumulative_tax": total_tax,
            "contenders": [
                {"player_id": player_a.player_id, "balance": player_a.balance},
                {"player_id": player_b.player_id, "balance": player_b.balance},
            ],
        })

        # Re-roll — spec §1: "Re-roll Logic"
        result = roll_fn(player_a, player_b)

        if not result.is_tie:
            if result.winner is None:
                raise ValueError("roll_fn returned is_tie=False with no winner")
            loser = player_b if result.winner is player_a else player_a
            events.append({
                "type": "attrition.resolved",
                "round": rounds,
                "winner": result.winner.player_id,
                "final_pot": pot,
                "total_tax": total_tax,
            })
            return AttritionOutcome(
                status="winner",
                winner=result.winner,
                loser=loser,
                final_pot=pot,
                rounds_played=rounds,
                total_tax=total_tax,
                tax_breakdown=tax_breakdown,
                pot_history=pot_history,
                events=events,
            )
        # Tied → continue loop

    # Safety cap reached
    raise RuntimeError(
        f"War of Attrition exceeded safety cap of {max_rounds} rounds"
    )


# ── Section 2: Sovereign Tax Multiplier ─────────────────────────────────────
def compute_tie_tax_multiplier(original_pot: float, tie_rounds: int, bounty: float) -> Dict:
    """
    Illustrate the tax revenue lift from ties, per spec §2.

    Example from the doc:
      Original $10 pot → $1.35 tax
      Tie 1: pot $20 → $2.70 tax
      Tie 2: pot $30 → $4.05 tax

    Returns a dict with baseline tax, total tax, and multiplier.
    This is a READ-ONLY projection; it does NOT mutate state.
    """
    if original_pot < 0:
        raise ValueError("original_pot must be non-negative")
    if tie_rounds < 0:
        raise ValueError("tie_rounds must be non-negative")
    if bounty < 0:
        raise ValueError("bounty must be non-negative")

    baseline_tax = round(original_pot * SOVEREIGN_TAX_RATE, 8)
    per_tie_tax = round(2 * bounty * SOVEREIGN_TAX_RATE, 8)
    additional_tax = round(per_tie_tax * tie_rounds, 8)
    total_tax = round(baseline_tax + additional_tax, 8)
    multiplier = round(total_tax / baseline_tax, 4) if baseline_tax > 0 else 0.0
    return {
        "original_pot": round(original_pot, 8),
        "bounty": round(bounty, 8),
        "tie_rounds": tie_rounds,
        "tax_rate": SOVEREIGN_TAX_RATE,
        "baseline_tax": baseline_tax,
        "per_tie_tax": per_tie_tax,
        "additional_tax": additional_tax,
        "total_tax": total_tax,
        "multiplier": multiplier,
    }


# ── Section 3: Spectator Side-Action ────────────────────────────────────────
def reopen_spectator_side_action(
    room_id: str,
    round_number: int,
    contenders: List[TieContender],
    current_pot: float,
) -> Dict:
    """
    Emit an event payload that tells the room's spectator UI to
    re-open the side-betting window for the upcoming tied round.

    Room broadcast layer (WebSocket) subscribes to
    'attrition.spectator_window_open'.
    """
    return {
        "type": "attrition.spectator_window_open",
        "room_id": room_id,
        "round_number": round_number,
        "current_pot": round(current_pot, 8),
        "contenders": [
            {"player_id": p.player_id, "balance": p.balance} for p in contenders
        ],
        "label": f"Ride the Winner - Round {round_number} - Pot ${current_pot:.2f}",
    }


__all__ = [
    "RollResult",
    "AttritionOutcome",
    "initiate_shootout",
    "compute_tie_tax_multiplier",
    "reopen_spectator_side_action",
]
