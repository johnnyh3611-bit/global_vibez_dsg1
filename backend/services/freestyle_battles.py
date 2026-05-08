"""
Live Freestyle Battles — v6.5 Phase 3.

Source spec: DSG_Apex_and_Collab_Blueprint.pdf §Live Freestyle Battles.

Components:
  1. Beat Vault — producer marketplace, $0.50 per use, 70/30 split
  2. Random Beat option — surprises the artist for higher betting odds
  3. Live Battle session — 2 artists, ≥1 round, audience votes
  4. Live betting on round winner — 30% platform cut, rest pays winning bettors

All revenue applies the canonical SOVEREIGN_TAX_RATE (13.5%) on top of
the producer / platform split, matching every other room on the platform.

Pure Python — DB persistence wired via routes/freestyle_battles_routes.py.
"""
from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional

from services.pricing_master_vault import SOVEREIGN_TAX_RATE


# ──────────────────────────────────────────────────────────────────────────
# 1. BEAT VAULT
# ──────────────────────────────────────────────────────────────────────────
BEAT_USE_PRICE: float = 0.50      # $0.50 per use, per founder spec
BEAT_PRODUCER_SHARE: float = 0.70  # 70% to producer, 30% platform
PLATFORM_BETTING_CUT: float = 0.30  # 30% of total betting pool
RANDOM_BEAT_ODDS_BOOST: float = 1.5  # multiplier for "Random" beat selection


@dataclass(frozen=True)
class Beat:
    beat_id: str
    producer_id: str
    title: str
    bpm: int
    genre: str
    use_count: int = 0
    is_active: bool = True


def settle_beat_use(beat: Beat) -> Dict:
    """Compute payout split for a single beat use. Returns the producer
    earnings, platform fee, and Sovereign Tax."""
    if not beat.is_active:
        raise ValueError("beat is inactive")
    gross = BEAT_USE_PRICE
    producer_share = round(gross * BEAT_PRODUCER_SHARE, 4)
    platform_share = round(gross * (1.0 - BEAT_PRODUCER_SHARE), 4)
    tax = round(gross * SOVEREIGN_TAX_RATE, 4)
    return {
        "beat_id": beat.beat_id,
        "producer_id": beat.producer_id,
        "gross": gross,
        "producer_payout": producer_share,
        "platform_share": platform_share,
        "sovereign_tax": tax,
        "net_to_treasury": round(platform_share - tax, 4),
    }


# ──────────────────────────────────────────────────────────────────────────
# 2. LIVE BATTLE SESSION
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class BattleRound:
    round_number: int
    beat_id: str             # which beat (or "RANDOM:<beat_id>" if randomly drawn)
    is_random_beat: bool
    artist_a_score: int = 0   # 0..100 audience score
    artist_b_score: int = 0
    status: Literal["pending", "active", "judged"] = "pending"
    winner: Optional[Literal["a", "b", "tie"]] = None


@dataclass
class FreestyleBattle:
    battle_id: str
    artist_a_id: str
    artist_b_id: str
    rounds: List[BattleRound] = field(default_factory=list)
    status: Literal["lobby", "live", "complete"] = "lobby"
    winner_id: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def round_count(self) -> int:
        return len(self.rounds)

    def add_round(self, beat_id: str, is_random_beat: bool) -> BattleRound:
        rd = BattleRound(
            round_number=self.round_count() + 1,
            beat_id=beat_id,
            is_random_beat=is_random_beat,
        )
        self.rounds.append(rd)
        return rd


def judge_round(rnd: BattleRound, score_a: int, score_b: int) -> BattleRound:
    """Audience-aggregated scores 0..100. Engine picks winner — tie if equal."""
    if not (0 <= score_a <= 100 and 0 <= score_b <= 100):
        raise ValueError("scores must be 0..100")
    rnd.artist_a_score = score_a
    rnd.artist_b_score = score_b
    if score_a > score_b:
        rnd.winner = "a"
    elif score_b > score_a:
        rnd.winner = "b"
    else:
        rnd.winner = "tie"
    rnd.status = "judged"
    return rnd


def conclude_battle(battle: FreestyleBattle) -> Dict:
    """Sum round wins. Whoever wins more rounds wins the battle."""
    a_wins = sum(1 for r in battle.rounds if r.winner == "a")
    b_wins = sum(1 for r in battle.rounds if r.winner == "b")

    if a_wins > b_wins:
        battle.winner_id = battle.artist_a_id
        outcome = "artist_a"
    elif b_wins > a_wins:
        battle.winner_id = battle.artist_b_id
        outcome = "artist_b"
    else:
        battle.winner_id = None
        outcome = "draw"

    battle.status = "complete"
    return {
        "battle_id": battle.battle_id,
        "outcome": outcome,
        "winner_id": battle.winner_id,
        "rounds_a": a_wins,
        "rounds_b": b_wins,
        "total_rounds": battle.round_count(),
    }


# ──────────────────────────────────────────────────────────────────────────
# 3. LIVE BETTING — 30% platform cut + Sovereign Tax
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class BattleBet:
    bettor_id: str
    on_artist: Literal["a", "b"]   # who they're backing
    stake: float
    placed_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def place_battle_bet(
    bets: List[BattleBet], bettor_id: str, on_artist: str, stake: float,
) -> BattleBet:
    if on_artist not in ("a", "b"):
        raise ValueError("on_artist must be 'a' or 'b'")
    if stake <= 0:
        raise ValueError("stake must be > 0")
    bet = BattleBet(bettor_id=bettor_id, on_artist=on_artist, stake=stake)
    bets.append(bet)
    return bet


def settle_battle_bets(
    bets: List[BattleBet], winning_artist: Literal["a", "b"],
    is_random_beat: bool = False,
) -> Dict:
    """Compute the payout matrix:
      - 30% of the total pool goes to platform (then taxed)
      - Remaining 70% is divided pro-rata among winning bettors weighted
        by their stake, with a 1.5× odds boost if the winning beat was
        randomly drawn.
    """
    if winning_artist not in ("a", "b"):
        raise ValueError("winning_artist must be 'a' or 'b'")
    total_pool = sum(b.stake for b in bets)
    if total_pool == 0:
        return {
            "total_pool": 0.0, "platform_cut": 0.0, "sovereign_tax": 0.0,
            "winners_pool": 0.0, "payouts": [],
            "random_beat_boost": is_random_beat,
        }
    platform_cut = round(total_pool * PLATFORM_BETTING_CUT, 4)
    sovereign_tax = round(total_pool * SOVEREIGN_TAX_RATE, 4)
    winners_pool_base = round(total_pool - platform_cut, 4)
    boost = RANDOM_BEAT_ODDS_BOOST if is_random_beat else 1.0
    winners_pool = round(winners_pool_base * boost, 4)

    winning_bets = [b for b in bets if b.on_artist == winning_artist]
    winning_total_stake = sum(b.stake for b in winning_bets)

    payouts: List[Dict] = []
    if winning_total_stake > 0:
        for b in winning_bets:
            share = b.stake / winning_total_stake
            payout = round(winners_pool * share, 4)
            payouts.append({
                "bettor_id": b.bettor_id,
                "stake": b.stake,
                "payout": payout,
                "profit": round(payout - b.stake, 4),
            })

    return {
        "total_pool": round(total_pool, 4),
        "platform_cut": platform_cut,
        "sovereign_tax": sovereign_tax,
        "net_to_treasury": round(platform_cut - sovereign_tax, 4),
        "winners_pool": winners_pool,
        "winning_artist": winning_artist,
        "random_beat_boost": is_random_beat,
        "winning_bets_count": len(winning_bets),
        "payouts": payouts,
    }


# ──────────────────────────────────────────────────────────────────────────
# 4. RANDOM BEAT DRAW (deterministic via secrets — uniform across catalog)
# ──────────────────────────────────────────────────────────────────────────
def draw_random_beat(catalog: List[Beat]) -> Beat:
    """Uniform random selection from active catalog beats."""
    active = [b for b in catalog if b.is_active]
    if not active:
        raise ValueError("no active beats in catalog")
    return secrets.choice(active)


__all__ = [
    "BEAT_USE_PRICE", "BEAT_PRODUCER_SHARE",
    "PLATFORM_BETTING_CUT", "RANDOM_BEAT_ODDS_BOOST",
    "Beat", "settle_beat_use",
    "BattleRound", "FreestyleBattle",
    "judge_round", "conclude_battle",
    "BattleBet", "place_battle_bet", "settle_battle_bets",
    "draw_random_beat",
]
