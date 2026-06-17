"""
DSG "Thirty-One" (Game #31) HTTP routes.

Thin HTTP layer over services/thirty_one.py (pure logic).
Integrates with:
  - services/war_of_attrition.py   (Sovereign Tie-Breaker on low-score ties)
  - services/sovereign_game_logic.py (DSG Tongue UI event payloads)
  - services/pricing_master_vault.py (13.5% Sovereign Tax)

Routes (prefix /api/games/thirty-one):
  POST /deal            Deal a fresh 3-card hand from a standard 52-card deck
  POST /score           Score a hand (pure — no DB)
  POST /resolve-round   Resolve a multi-player round (flags tie_at_low)
  POST /tie-shootout    Run the War-of-Attrition shootout for tied players
  GET  /constants       Return game constants for frontend (aces=11, blitz=31, etc.)
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Callable, Dict, List, Optional
import random

from services.thirty_one import (
    Card,
    PlayerHand,
    VALID_SUITS,
    VALID_RANKS,
    ACE_VALUE,
    FACE_VALUE,
    BLITZ_SCORE,
    dsg_31_logic,
    resolve_round,
)
from services.war_of_attrition import (
    initiate_shootout,
    RollResult,
)
from services.sovereign_game_logic import (
    TieContender,
    burn_indicator,
    bounty_warning,
    hot_card_alert,
)
from services.pricing_master_vault import SOVEREIGN_TAX_RATE


router = APIRouter(prefix="/games/thirty-one", tags=["thirty-one"])


# ── Models ──────────────────────────────────────────────────────────────────
class CardIn(BaseModel):
    rank: str = Field(..., description="2-10, J, Q, K, A")
    suit: str = Field(..., description="S, H, D, C")


class HandIn(BaseModel):
    hand: List[CardIn]


class PlayerHandIn(BaseModel):
    player_id: str
    hand: List[CardIn]


class ResolveRoundIn(BaseModel):
    players: List[PlayerHandIn]


class TieShootoutPlayer(BaseModel):
    player_id: str
    balance: float


class TieShootoutIn(BaseModel):
    player_a: TieShootoutPlayer
    player_b: TieShootoutPlayer
    current_pot: float = 0.0
    bounty: float = Field(..., gt=0, description="Re-ante amount per tie")
    seed: Optional[int] = Field(None, description="Seed the RNG for deterministic replay")


class DealIn(BaseModel):
    num_players: int = Field(..., ge=1, le=7)
    cards_per_hand: int = Field(3, ge=1, le=5)
    seed: Optional[int] = None


# ── Helpers ─────────────────────────────────────────────────────────────────
def _to_card(c: CardIn) -> Card:
    try:
        return Card(rank=c.rank.upper(), suit=c.suit.upper())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def _standard_deck() -> List[Card]:
    return [Card(rank=r, suit=s) for s in VALID_SUITS for r in VALID_RANKS]


# ── Routes ──────────────────────────────────────────────────────────────────
@router.get("/constants")
def get_constants() -> Dict:
    """Expose locked constants for the frontend."""
    return {
        "ace_value":          ACE_VALUE,
        "face_value":         FACE_VALUE,
        "blitz_score":        BLITZ_SCORE,
        "valid_suits":        list(VALID_SUITS),
        "valid_ranks":        list(VALID_RANKS),
        "sovereign_tax_rate": SOVEREIGN_TAX_RATE,
        "name":               "Thirty-One",
        "tagline":            "Suit-locked scoring. Hit 31 for BLITZ.",
    }


@router.post("/deal")
def deal_hands(req: DealIn) -> Dict:
    """Deal random 3-card hands from a shuffled 52-card deck."""
    rng = random.Random(req.seed) if req.seed is not None else random.Random()
    deck = _standard_deck()
    needed = req.num_players * req.cards_per_hand
    if needed > len(deck):
        raise HTTPException(status_code=400, detail="Not enough cards in deck")
    rng.shuffle(deck)
    hands = []
    for i in range(req.num_players):
        start = i * req.cards_per_hand
        h = deck[start:start + req.cards_per_hand]
        hands.append({
            "player_index": i,
            "hand": [{"rank": c.rank, "suit": c.suit} for c in h],
        })
    return {"hands": hands, "cards_per_hand": req.cards_per_hand}


@router.post("/score")
def score_hand(req: HandIn) -> Dict:
    """Pure score of a single hand. No DB, no auth, no mutation."""
    if not req.hand:
        raise HTTPException(status_code=400, detail="hand must not be empty")
    cards = [_to_card(c) for c in req.hand]
    result = dsg_31_logic(cards)
    events = []
    # Emit a Tongue event whenever a Joker-level moment happens (BLITZ).
    if result.status == "BLITZ":
        events.append({
            "type": "sovereign_tongue.blitz",
            "label": "BLITZ! Instant Win!",
            "sound_fx": "blitz_fanfare",
            "score":  result.score,
        })
    return {
        "status":  result.status,
        "score":   result.score,
        "suits":   result.suits,
        "payout":  result.payout,
        "events":  events,
    }


@router.post("/resolve-round")
def resolve_multi_player_round(req: ResolveRoundIn) -> Dict:
    """
    Score every player's hand in a round. Emits:
      - blitzes list (auto-win)
      - low_score tie flag (route caller should invoke /tie-shootout if True)
      - DSG Tongue bounty_warning event payload when tie_at_low is True
    """
    if not req.players:
        raise HTTPException(status_code=400, detail="players must not be empty")
    player_hands = [
        PlayerHand(player_id=p.player_id, hand=[_to_card(c) for c in p.hand])
        for p in req.players
    ]
    outcome = resolve_round(player_hands)

    tongue_events: List[Dict] = []
    if outcome.tie_at_low:
        tied_contenders = [
            TieContender(player_id=pid, balance=0.0) for pid in outcome.low_score_players
        ]
        tongue_events.append(bounty_warning(bounty=2.00, contenders=tied_contenders))

    return {
        "scored": [
            {
                "player_id": pid,
                "status":    r.status,
                "score":     r.score,
                "suits":     r.suits,
                "payout":    r.payout,
            }
            for pid, r in outcome.scored
        ],
        "blitzes":           outcome.blitzes,
        "low_score":         outcome.low_score,
        "low_score_players": outcome.low_score_players,
        "high_score":        outcome.high_score,
        "high_score_players": outcome.high_score_players,
        "tie_at_low":        outcome.tie_at_low,
        "tongue_events":     tongue_events,
    }


@router.post("/tie-shootout")
def run_tie_shootout(req: TieShootoutIn) -> Dict:
    """
    Resolve a two-player tie via the Sovereign War-of-Attrition protocol.
    Uses a seeded RNG for reproducibility (audit trail). Returns the
    full outcome + event trail, including cumulative Sovereign Tax collected.
    """
    rng = random.Random(req.seed) if req.seed is not None else random.Random()
    a = TieContender(player_id=req.player_a.player_id, balance=req.player_a.balance)
    b = TieContender(player_id=req.player_b.player_id, balance=req.player_b.balance)

    def _roll(ca: TieContender, cb: TieContender) -> RollResult:
        """Random 50/50 re-roll (production replaces with dice-game logic)."""
        if rng.random() < 0.5:
            return RollResult(is_tie=False, winner=ca)
        return RollResult(is_tie=False, winner=cb)

    try:
        outcome = initiate_shootout(
            a, b,
            current_pot=req.current_pot,
            bounty=req.bounty,
            roll_fn=_roll,
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Emit a Sovereign Tongue burn indicator for the final tax take
    burn_event = burn_indicator(
        tokens_burned=outcome.total_tax,
        running_total=outcome.total_tax,
    )

    return {
        "status":        outcome.status,
        "winner":        outcome.winner.player_id if outcome.winner else None,
        "loser":         outcome.loser.player_id if outcome.loser else None,
        "final_pot":     outcome.final_pot,
        "rounds_played": outcome.rounds_played,
        "total_tax":     outcome.total_tax,
        "tax_breakdown": outcome.tax_breakdown,
        "pot_history":   outcome.pot_history,
        "events":        outcome.events,
        "burn_event":    burn_event,
    }


__all__ = ["router"]
