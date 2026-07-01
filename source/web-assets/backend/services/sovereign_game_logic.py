"""
DSG Sovereign Gaming Engine - Master Game Logic v4.0
─────────────────────────────────────────────────────
Source of truth: DSG_Master_Sovereign_Game_Logic.pdf (v4.0, Feb 2026).

This module is PURE. No DB calls. No I/O. Deterministic.

Implements three sections of the founder spec:

  I.  Universal Tongue / Double-Take Logic
      Card power for Spades, Bid Whist, Baccarat under
      Uptown (High) and Downtown (Low) bid modes. Trump
      suit gets a +200 priority bonus. Jokers are global.

  II. Multiplayer 6-5-4 Infinite Bounty Protocol
      When multiple players tie the high score, each must
      re-ante the original bounty to stay in. Those who
      cannot cover are knocked out. Surviving contenders
      enter a fresh shootout round.

  III. Sovereign Tongue UI Event Payloads
      Returns structured event dicts that the Unity / React
      layer renders. No rendering happens here.

Route layer is responsible for persistence, player balances,
and pushing events over WebSocket. Tested by
backend/tests/test_sovereign_game_logic.py.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple
import math


# ── Section I: Universal Tongue POWER_MATRIX ────────────────────────────────
# Verbatim from DSG_Master_Sovereign_Game_Logic.pdf §I.
POWER_MATRIX: Dict[str, Dict[str, int]] = {
    "UPTOWN": {
        "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
        "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
        "LJ": 90, "BJ": 100,
    },
    "DOWNTOWN": {
        "A": 1, "K": 2, "Q": 3, "J": 4, "10": 5, "9": 6, "8": 7, "7": 8,
        "6": 9, "5": 10, "4": 11, "3": 12, "2": 13,
        "LJ": 90, "BJ": 100,
    },
}

TRUMP_PRIORITY_BONUS: int = 200  # Trump suit gets +200 regardless of bid type.

VALID_BID_TYPES = ("UPTOWN", "DOWNTOWN")


def get_card_power(rank: str, suit: str, bid_type: str, trump_suit: Optional[str]) -> int:
    """
    Compute the power of a card under the current bid type and trump suit.

    Args:
        rank: "2"-"10", "J", "Q", "K", "A", "LJ" (Little Joker), "BJ" (Big Joker)
        suit: "hearts" / "spades" / "clubs" / "diamonds" / "" (jokers have no suit)
        bid_type: "UPTOWN" or "DOWNTOWN"
        trump_suit: trump suit string, or None if no-trump round

    Returns:
        Integer power. Higher = stronger. Ties resolved by caller.
    """
    if bid_type not in POWER_MATRIX:
        raise ValueError(f"Invalid bid_type: {bid_type}. Must be one of {VALID_BID_TYPES}")
    matrix = POWER_MATRIX[bid_type]
    if rank not in matrix:
        raise ValueError(f"Invalid rank: {rank}")

    base = matrix[rank]
    # Jokers are trump-independent per spec (LJ=90, BJ=100 regardless of trump).
    if rank in ("LJ", "BJ"):
        return base
    if trump_suit and suit == trump_suit:
        base += TRUMP_PRIORITY_BONUS
    return base


# ── Section II: 6-5-4 Infinite Bounty Protocol ──────────────────────────────
@dataclass
class TieContender:
    """Minimal player abstraction used by the bounty resolver."""
    player_id: str
    balance: float

    def can_cover(self, amount: float) -> bool:
        return self.balance >= amount

    def deduct(self, amount: float) -> None:
        if amount < 0:
            raise ValueError("deduct amount must be non-negative")
        if not self.can_cover(amount):
            raise ValueError(f"{self.player_id} cannot cover {amount}")
        self.balance = round(self.balance - amount, 8)


@dataclass
class TieResolutionResult:
    """
    Outcome of resolve_multi_tie:

      - status='winner'          single survivor after collecting bounty
      - status='continue'        multiple survivors → new shootout round
      - status='all_bankrupt'    nobody could cover → pot returned to house
    """
    status: str
    contenders: List[TieContender]
    pot: float
    knocked_out: List[TieContender] = field(default_factory=list)
    events: List[Dict] = field(default_factory=list)


def resolve_multi_tie(
    players_in_tie: List[TieContender],
    initial_bounty: float,
    current_pot: float,
) -> TieResolutionResult:
    """
    Apply the Infinite Bounty Protocol to a set of tied players.

    Per spec: every tied player must re-ante `initial_bounty` or be
    eliminated. Surviving contenders advance to a fresh shootout round.
    Mutates `players_in_tie` balances in place.

    Returns TieResolutionResult with knocked-out players and the fresh pot.
    """
    if initial_bounty < 0:
        raise ValueError("initial_bounty must be non-negative")
    if current_pot < 0:
        raise ValueError("current_pot must be non-negative")

    contenders: List[TieContender] = []
    knocked: List[TieContender] = []
    events: List[Dict] = []
    pot = round(current_pot, 8)

    for p in players_in_tie:
        if p.can_cover(initial_bounty):
            p.deduct(initial_bounty)
            contenders.append(p)
            pot = round(pot + initial_bounty, 8)
            events.append({
                "type": "bounty_matched",
                "player_id": p.player_id,
                "bounty": initial_bounty,
                "new_balance": p.balance,
            })
        else:
            knocked.append(p)
            events.append({
                "type": "bounty_forfeit",
                "player_id": p.player_id,
                "reason": "insufficient_balance",
                "required": initial_bounty,
                "held": p.balance,
            })

    if len(contenders) == 0:
        return TieResolutionResult(
            status="all_bankrupt",
            contenders=[],
            pot=pot,
            knocked_out=knocked,
            events=events,
        )
    if len(contenders) == 1:
        return TieResolutionResult(
            status="winner",
            contenders=contenders,
            pot=pot,
            knocked_out=knocked,
            events=events,
        )
    return TieResolutionResult(
        status="continue",
        contenders=contenders,
        pot=pot,
        knocked_out=knocked,
        events=events,
    )


# ── Section III: Sovereign Tongue UI Event Payloads ─────────────────────────
def hot_card_alert(card_rank: str, card_suit: Optional[str], player_id: str) -> Dict:
    """
    Fires when a Joker or a very-high-power card is played.
    Unity/React subscribes to 'sovereign_tongue.hot_card' and plays the fx.
    """
    is_joker = card_rank in ("LJ", "BJ")
    label = {
        "BJ": "Big Joker Played!",
        "LJ": "Little Joker Played!",
        "A":  "Ace Dropped!",
        "K":  "King Played!",
    }.get(card_rank, f"{card_rank} Played!")
    return {
        "type": "sovereign_tongue.hot_card",
        "player_id": player_id,
        "rank": card_rank,
        "suit": card_suit,
        "label": label,
        "is_joker": is_joker,
        "sound_fx": "big_joker" if card_rank == "BJ"
                    else "little_joker" if card_rank == "LJ"
                    else "ace_drop" if card_rank == "A"
                    else "card_slap",
    }


def bounty_warning(bounty: float, contenders: List[TieContender]) -> Dict:
    """Emitted on tie detection. 'Match $X.XX or Bankrupt!' banner."""
    return {
        "type": "sovereign_tongue.bounty_warning",
        "bounty": bounty,
        "label": f"Match ${bounty:.2f} or Bankrupt!",
        "contenders": [
            {"player_id": p.player_id, "can_cover": p.can_cover(bounty)}
            for p in contenders
        ],
    }


def burn_indicator(tokens_burned: float, running_total: float) -> Dict:
    """Real-time counter of tokens removed from circulating supply."""
    return {
        "type": "sovereign_tongue.burn_indicator",
        "burned_this_hand": round(tokens_burned, 8),
        "running_total_burned": round(running_total, 8),
        "label": f"Supply burn: {tokens_burned:.4f} $DSG (total {running_total:.4f})",
    }


__all__ = [
    "POWER_MATRIX",
    "TRUMP_PRIORITY_BONUS",
    "VALID_BID_TYPES",
    "get_card_power",
    "TieContender",
    "TieResolutionResult",
    "resolve_multi_tie",
    "hot_card_alert",
    "bounty_warning",
    "burn_indicator",
]
