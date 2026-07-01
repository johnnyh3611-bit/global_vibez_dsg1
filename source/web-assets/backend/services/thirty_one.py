"""
DSG "Thirty-One" Game Logic (Game #31 — Scarcity Rules)
────────────────────────────────────────────────────────
Source of truth: GlobalVibezDSG_Fixed_Handoff_31Games.pdf §1 (founder spec).

Thirty-One is a classic 3-card hand scoring game. In the DSG variant:

  - Scoring is SUIT-LOCKED: you sum each suit independently and take
    the highest single-suit total.
  - Aces = 11 points.  Face cards (J, Q, K) = 10.  Number cards = pip value.
  - If your best single-suit total == 31 → instant BLITZ (auto-win
    triggers the 13.5% Sovereign Tax celebration + token burn).
  - Otherwise → LIVE with that score.

Integrates with:
  - services/war_of_attrition.py (Sovereign Tie-Breaker / Bounty War)
    when players tie for the lowest score and must re-ante.
  - services/sovereign_game_logic.py (Sovereign Tongue UI cues:
    burn_indicator, bounty_warning) for the "Match the Bounty!"
    pop-ups + real-time token-burn HUD.

Pure module. Deterministic. No DB. No I/O. Tested by
backend/tests/test_thirty_one.py.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple


# ── Card value table (spec §1) ──────────────────────────────────────────────
FACE_CARDS = ("J", "Q", "K")
ACE_VALUE = 11
FACE_VALUE = 10
BLITZ_SCORE = 31

VALID_SUITS = ("S", "H", "D", "C")
VALID_RANKS = ("2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A")


@dataclass(frozen=True)
class Card:
    """A single playing card. Suit must be S/H/D/C; rank per VALID_RANKS."""
    rank: str
    suit: str

    def __post_init__(self):
        if self.rank not in VALID_RANKS:
            raise ValueError(f"Invalid rank: {self.rank}")
        if self.suit not in VALID_SUITS:
            raise ValueError(f"Invalid suit: {self.suit} (must be S/H/D/C)")


def card_value(rank: str) -> int:
    """Return the DSG Thirty-One point value of a rank."""
    if rank == "A":
        return ACE_VALUE
    if rank in FACE_CARDS:
        return FACE_VALUE
    return int(rank)


# ── Core scoring (spec §1 dsg_31_logic) ─────────────────────────────────────
@dataclass
class ThirtyOneResult:
    """Outcome of scoring a single hand."""
    status: str                 # 'BLITZ' or 'LIVE'
    score: int                  # best single-suit total
    suits: Dict[str, int]       # per-suit totals
    payout: bool                # True if BLITZ instant win


def dsg_31_logic(hand: List[Card]) -> ThirtyOneResult:
    """
    Compute a Thirty-One hand score, suit-locked.

    Mirrors the spec's JS reference:
        let suits = {'S':0,'H':0,'D':0,'C':0};
        hand.forEach(c => suits[c.suit] += c.value);
        let best = Math.max(...Object.values(suits));
        if (best === 31) return { status:'BLITZ', payout:true };
        return { status:'LIVE', score:best };
    """
    if not hand:
        raise ValueError("hand must contain at least one card")

    suits: Dict[str, int] = {s: 0 for s in VALID_SUITS}
    for c in hand:
        suits[c.suit] += card_value(c.rank)

    best = max(suits.values())
    if best == BLITZ_SCORE:
        return ThirtyOneResult(status="BLITZ", score=best, suits=suits, payout=True)
    return ThirtyOneResult(status="LIVE", score=best, suits=suits, payout=False)


# ── Round resolution helpers ────────────────────────────────────────────────
@dataclass
class PlayerHand:
    player_id: str
    hand: List[Card]


@dataclass
class RoundOutcome:
    """
    Resolution of a Thirty-One round across multiple players.

    - blitzes: any players with score == 31 (all win equally; caller decides
      pot split; per spec a BLITZ triggers 13.5% tax celebration)
    - low_score: the minimum score among non-blitz players (spec: tie at
      low score triggers Sovereign Tie-Breaker)
    - low_score_players: the player(s) who held the low score (life loss)
    - high_score: reported for completeness
    """
    scored: List[Tuple[str, ThirtyOneResult]]
    blitzes: List[str]
    low_score: int
    low_score_players: List[str]
    high_score: int
    high_score_players: List[str]
    tie_at_low: bool  # True → caller must invoke war_of_attrition shootout


def resolve_round(players: List[PlayerHand]) -> RoundOutcome:
    """Score every player's hand and report blitzes + low-score ties."""
    if not players:
        raise ValueError("players must contain at least one entry")

    scored: List[Tuple[str, ThirtyOneResult]] = []
    for p in players:
        scored.append((p.player_id, dsg_31_logic(p.hand)))

    blitzes = [pid for pid, r in scored if r.status == "BLITZ"]
    non_blitz = [(pid, r) for pid, r in scored if r.status == "LIVE"]

    if non_blitz:
        low = min(r.score for _, r in non_blitz)
        high = max(r.score for _, r in non_blitz)
        low_players = [pid for pid, r in non_blitz if r.score == low]
        high_players = [pid for pid, r in non_blitz if r.score == high]
    else:
        low = high = BLITZ_SCORE
        low_players = []
        high_players = []

    return RoundOutcome(
        scored=scored,
        blitzes=blitzes,
        low_score=low,
        low_score_players=low_players,
        high_score=high,
        high_score_players=high_players,
        tie_at_low=(len(low_players) > 1),
    )


__all__ = [
    "Card",
    "FACE_CARDS",
    "ACE_VALUE",
    "FACE_VALUE",
    "BLITZ_SCORE",
    "VALID_SUITS",
    "VALID_RANKS",
    "card_value",
    "ThirtyOneResult",
    "PlayerHand",
    "RoundOutcome",
    "dsg_31_logic",
    "resolve_round",
]
