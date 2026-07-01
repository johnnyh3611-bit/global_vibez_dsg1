"""
Apex Sovereign Layer — v6.5 Phase 1 backend engine.

Consolidates four founder-spec features into a single coherent domain:

  1. Vigilant Matchmaking Room (v4/v5 spec) — AI synergy scoring
  2. AI Oracle state machine — Strategy Coach (Vigilant) ↔ Safety Guardian
  3. Rewarded Pulse Polling (v5 spec) — Yes/No live-stream polls + Vibe Points
  4. Apex Factor VIP Gate (Apex Blueprint) — VIP tier derivation, Celestial Glasshouse access

Pure Python, deterministic where possible. UI layer + DB persistence are
wired through routes/apex_sovereign_routes.py.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Literal, Optional, Sequence


# ──────────────────────────────────────────────────────────────────────────
# 1. VIGILANT MATCHMAKING — Synergy Scoring
# ──────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class ArtistProfile:
    """Minimal subset needed for synergy scoring."""
    user_id: str
    flow_speed: float        # 0..1   — relative tempo of the artist's flow
    tempo_bpm: int           # ~60..220
    genre: str               # "trap" | "rnb" | "house" | "drill" | "rock" | "pop" | "country" | "soul" | "edm" | "jazz"
    rank: str = "ROOKIE"     # "ROOKIE" | "PRO" | "ELITE" | "LEGEND"
    klass: str = "STRATEGIST"  # "STRATEGIST" | "FREESTYLER" | "PRODUCER" | "VOCALIST"


# Genre affinity matrix — symmetric. Higher = more compatible.
# Numbers are tuned for a feel-good 60-99% baseline so the UI hits the
# "98% SYNERGY" headline number naturally for well-matched pairs.
_GENRE_AFFINITY: Dict[str, Dict[str, float]] = {
    "trap":    {"trap": 1.0, "drill": 0.95, "rnb": 0.80, "pop": 0.75, "rock": 0.45, "country": 0.35, "house": 0.55, "soul": 0.65, "edm": 0.60, "jazz": 0.50},
    "drill":   {"drill": 1.0, "trap": 0.95, "rock": 0.55, "rnb": 0.70, "pop": 0.65, "country": 0.30, "house": 0.45, "soul": 0.55, "edm": 0.55, "jazz": 0.45},
    "rnb":     {"rnb": 1.0, "soul": 0.95, "pop": 0.85, "trap": 0.80, "house": 0.70, "jazz": 0.80, "rock": 0.55, "country": 0.45, "drill": 0.70, "edm": 0.65},
    "soul":    {"soul": 1.0, "rnb": 0.95, "jazz": 0.90, "pop": 0.75, "trap": 0.65, "house": 0.55, "rock": 0.50, "country": 0.55, "drill": 0.55, "edm": 0.50},
    "pop":     {"pop": 1.0, "rnb": 0.85, "edm": 0.85, "house": 0.80, "trap": 0.75, "soul": 0.75, "rock": 0.65, "country": 0.60, "drill": 0.65, "jazz": 0.55},
    "house":   {"house": 1.0, "edm": 0.95, "pop": 0.80, "rnb": 0.70, "trap": 0.55, "soul": 0.55, "drill": 0.45, "rock": 0.50, "country": 0.30, "jazz": 0.45},
    "edm":     {"edm": 1.0, "house": 0.95, "pop": 0.85, "trap": 0.60, "rnb": 0.65, "rock": 0.55, "drill": 0.55, "soul": 0.50, "country": 0.30, "jazz": 0.40},
    "rock":    {"rock": 1.0, "country": 0.65, "pop": 0.65, "edm": 0.55, "rnb": 0.55, "soul": 0.50, "trap": 0.45, "house": 0.50, "drill": 0.55, "jazz": 0.55},
    "country": {"country": 1.0, "rock": 0.65, "soul": 0.55, "pop": 0.60, "rnb": 0.45, "trap": 0.35, "house": 0.30, "drill": 0.30, "edm": 0.30, "jazz": 0.40},
    "jazz":    {"jazz": 1.0, "soul": 0.90, "rnb": 0.80, "pop": 0.55, "rock": 0.55, "house": 0.45, "edm": 0.40, "trap": 0.50, "drill": 0.45, "country": 0.40},
}


def _genre_affinity(a: str, b: str) -> float:
    """Return symmetric affinity in 0..1. Unknown genres default to 0.5."""
    return _GENRE_AFFINITY.get(a.lower(), {}).get(b.lower(), 0.5)


def compute_synergy_score(a: ArtistProfile, b: ArtistProfile) -> Dict:
    """Return synergy_score (0..100) + components.

    Weighted blend:
      - genre   45%
      - tempo   30%   (closer BPM = higher)
      - flow    25%   (closer flow_speed = higher)
    """
    if a.user_id == b.user_id:
        raise ValueError("cannot compute synergy of a profile with itself")

    genre_component = _genre_affinity(a.genre, b.genre)

    # Tempo affinity falls off linearly — 0 BPM diff = 1.0, 80+ BPM diff = 0.2
    tempo_diff = abs(a.tempo_bpm - b.tempo_bpm)
    tempo_component = max(0.2, 1.0 - tempo_diff / 100.0)

    flow_diff = abs(a.flow_speed - b.flow_speed)
    flow_component = max(0.3, 1.0 - flow_diff)  # 0 diff = 1.0, full opposite = 0.3

    score = (
        genre_component * 0.45
        + tempo_component * 0.30
        + flow_component * 0.25
    ) * 100.0
    score_rounded = round(score, 1)
    return {
        "synergy_score": score_rounded,
        "components": {
            "genre": round(genre_component * 100, 1),
            "tempo": round(tempo_component * 100, 1),
            "flow": round(flow_component * 100, 1),
        },
        "verdict": (
            "ELITE_DUO" if score_rounded >= 90
            else "STRONG_MATCH" if score_rounded >= 75
            else "WORKABLE" if score_rounded >= 60
            else "MISMATCH"
        ),
    }


# ──────────────────────────────────────────────────────────────────────────
# 2. AI ORACLE — Strategy Coach (Vigilant) ↔ Safety Guardian
# ──────────────────────────────────────────────────────────────────────────
class OracleState(str, Enum):
    STRATEGY_COACH = "strategy_coach"     # Vigilant — game advice, synergy hints
    SAFETY_GUARDIAN = "safety_guardian"   # Red Protocol — danger / collusion / harm signals


# Context signals that flip the Oracle from coach to guardian.
# Ordered by priority — first match wins.
_GUARDIAN_TRIGGERS: Sequence[str] = (
    "panic_button_pressed",
    "geo_fence_violation",
    "minor_detected",
    "collusion_signal",
    "harassment_keyword",
    "self_harm_keyword",
    "weapon_detected",
    "emergency_contact_invoked",
)


def oracle_select_state(context: Dict) -> Dict:
    """Given a context dict (room / signal / event flags), return the
    AI Oracle state we should switch to + the trigger that fired (if any)."""
    triggered: Optional[str] = None
    for trigger in _GUARDIAN_TRIGGERS:
        if context.get(trigger):
            triggered = trigger
            break

    if triggered:
        return {
            "state": OracleState.SAFETY_GUARDIAN.value,
            "trigger": triggered,
            "is_red_protocol": True,
            "advisory": f"Safety Guardian engaged · trigger: {triggered}",
        }
    return {
        "state": OracleState.STRATEGY_COACH.value,
        "trigger": None,
        "is_red_protocol": False,
        "advisory": "Strategy Coach (Vigilant) — coaching mode active",
    }


@dataclass(frozen=True)
class RedProtocolAlert:
    """Schema for a logged Red Protocol event (DB write payload)."""
    user_id: str
    trigger: str
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    location: Optional[str]   # zip code or "remote"
    timestamp: str

    def to_dict(self) -> Dict:
        return asdict(self)


_TRIGGER_SEVERITY: Dict[str, str] = {
    "panic_button_pressed": "CRITICAL",
    "self_harm_keyword": "CRITICAL",
    "weapon_detected": "CRITICAL",
    "minor_detected": "HIGH",
    "emergency_contact_invoked": "HIGH",
    "harassment_keyword": "MEDIUM",
    "geo_fence_violation": "MEDIUM",
    "collusion_signal": "MEDIUM",
}


def build_red_protocol_alert(
    user_id: str, trigger: str, location: Optional[str] = None,
) -> RedProtocolAlert:
    severity = _TRIGGER_SEVERITY.get(trigger, "LOW")
    return RedProtocolAlert(
        user_id=user_id,
        trigger=trigger,
        severity=severity,
        location=location,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ──────────────────────────────────────────────────────────────────────────
# 3. REWARDED PULSE POLLING (v5 spec — Yes/No, +5 Vibe Points to winners)
# ──────────────────────────────────────────────────────────────────────────
PULSE_POLL_REWARD: int = 5   # Vibe Points per voter on the winning side


@dataclass
class PulsePoll:
    poll_id: str
    stream_id: str
    question: str
    yes_votes: int = 0
    no_votes: int = 0
    yes_voters: List[str] = field(default_factory=list)
    no_voters: List[str] = field(default_factory=list)
    status: Literal["active", "closed"] = "active"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def total_votes(self) -> int:
        return self.yes_votes + self.no_votes

    def percentages(self) -> Dict[str, int]:
        total = self.total_votes()
        if total == 0:
            return {"yes": 50, "no": 50}
        return {
            "yes": round(self.yes_votes / total * 100),
            "no":  round(self.no_votes / total * 100),
        }


def cast_pulse_vote(poll: PulsePoll, voter_id: str, vote: Literal["yes", "no"]) -> PulsePoll:
    if poll.status != "active":
        raise ValueError("poll is closed")
    if voter_id in poll.yes_voters or voter_id in poll.no_voters:
        raise ValueError("voter already cast a ballot")
    if vote == "yes":
        poll.yes_votes += 1
        poll.yes_voters.append(voter_id)
    elif vote == "no":
        poll.no_votes += 1
        poll.no_voters.append(voter_id)
    else:
        raise ValueError("vote must be 'yes' or 'no'")
    return poll


def resolve_pulse_poll(poll: PulsePoll) -> Dict:
    """Close the poll + return the reward payload."""
    if poll.yes_votes > poll.no_votes:
        winning_side: Optional[str] = "yes"
        winners = poll.yes_voters
    elif poll.no_votes > poll.yes_votes:
        winning_side = "no"
        winners = poll.no_voters
    else:
        winning_side = None
        winners = []
    poll.status = "closed"
    return {
        "poll_id": poll.poll_id,
        "winning_side": winning_side,
        "tie": winning_side is None,
        "reward_per_voter": PULSE_POLL_REWARD if winners else 0,
        "winners": winners,
        "total_reward_paid": PULSE_POLL_REWARD * len(winners),
        "percentages": poll.percentages(),
        "yes_votes": poll.yes_votes,
        "no_votes": poll.no_votes,
    }


# ──────────────────────────────────────────────────────────────────────────
# 4. APEX FACTOR VIP GATE — Vibe Legend / Vibe Sovereign tiering
# ──────────────────────────────────────────────────────────────────────────
class VipTier(str, Enum):
    BASIC = "basic"
    VIBE_LEGEND = "vibe_legend"        # top-rank artists
    VIBE_SOVEREIGN = "vibe_sovereign"  # top chair holders
    APEX = "apex"                      # both legend AND sovereign


# Thresholds match founder spec ("top 1% / 1M chairs").
APEX_LEGEND_RANK_THRESHOLD: str = "LEGEND"
APEX_SOVEREIGN_MIN_CHAIRS: int = 100   # 100+ chairs = top-tier holder


def compute_vip_tier(
    artist_rank: Optional[str] = None,
    chair_count: int = 0,
) -> Dict:
    """Derive the user's current Apex tier from their artist rank +
    chair holdings. Returns the tier + the visual flags the UI should set."""
    is_legend = artist_rank == APEX_LEGEND_RANK_THRESHOLD
    is_sovereign = chair_count >= APEX_SOVEREIGN_MIN_CHAIRS

    if is_legend and is_sovereign:
        tier = VipTier.APEX
    elif is_legend:
        tier = VipTier.VIBE_LEGEND
    elif is_sovereign:
        tier = VipTier.VIBE_SOVEREIGN
    else:
        tier = VipTier.BASIC

    return {
        "tier": tier.value,
        "is_legend": is_legend,
        "is_sovereign": is_sovereign,
        "celestial_glasshouse_access": tier != VipTier.BASIC,
        "holographic_crown": tier in (VipTier.APEX, VipTier.VIBE_LEGEND),
        "global_broadcast_eligible": tier == VipTier.APEX,
        "chair_count": chair_count,
        "artist_rank": artist_rank,
    }


__all__ = [
    # Synergy
    "ArtistProfile", "compute_synergy_score",
    # Oracle
    "OracleState", "oracle_select_state",
    "RedProtocolAlert", "build_red_protocol_alert",
    # Pulse polling
    "PULSE_POLL_REWARD", "PulsePoll",
    "cast_pulse_vote", "resolve_pulse_poll",
    # VIP gate
    "VipTier", "compute_vip_tier",
    "APEX_LEGEND_RANK_THRESHOLD", "APEX_SOVEREIGN_MIN_CHAIRS",
]
