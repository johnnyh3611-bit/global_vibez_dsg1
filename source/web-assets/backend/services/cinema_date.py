"""
Cinema Date — v6.5 Phase 5.

Source: Global_Vibez_OMNI_MASTER_v6_5.pdf §Cinema Date.

Two users link their rooms and watch the SAME Memory Bank movie in sync.
Both must hold an ACTIVE license for the content (no piracy proxy).
While watching, the engine fires "Yes/No Pulse" mini-games at scripted
timestamps — the surveys generate Vibe Points and a relationship-vibe
score that the founder dashboard reads.

Pure Python state machine + HTTP routes. Streaming sync is left at the
WebSocket layer (out of scope for v6.5 Phase 5 — the engine just
publishes a 'sync_tick' event the WS layer can broadcast).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional


CINEMA_DATE_PULSE_REWARD: int = 5    # Vibe Points each on a "BOTH YES" pulse
CINEMA_DATE_DESYNC_TOLERANCE_SECONDS: float = 2.0


# ──────────────────────────────────────────────────────────────────────────
# 1. SESSION STATE
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class CinemaPulse:
    """One Yes/No question the engine fires mid-movie. The 2 viewers vote
    independently. If both say YES → +5 VP each + match score increment.
    If split → 0 VP + 'mismatch' tag for the dashboard."""
    pulse_id: str
    timestamp_seconds: int     # when in the movie this pulse fires
    question: str
    viewer_a_vote: Optional[Literal["yes", "no"]] = None
    viewer_b_vote: Optional[Literal["yes", "no"]] = None
    resolved: bool = False

    def both_voted(self) -> bool:
        return self.viewer_a_vote is not None and self.viewer_b_vote is not None

    def both_yes(self) -> bool:
        return self.viewer_a_vote == "yes" and self.viewer_b_vote == "yes"

    def both_no(self) -> bool:
        return self.viewer_a_vote == "no" and self.viewer_b_vote == "no"

    def is_match(self) -> bool:
        return self.both_voted() and self.viewer_a_vote == self.viewer_b_vote


@dataclass
class CinemaDateSession:
    session_id: str
    content_id: str
    viewer_a_id: str
    viewer_b_id: str
    license_a_id: str
    license_b_id: str
    started_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    pulses: List[CinemaPulse] = field(default_factory=list)
    status: Literal["lobby", "playing", "paused", "ended"] = "lobby"
    current_position_seconds: int = 0
    last_sync_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    match_score: int = 0          # +1 per matching pulse, -1 per mismatch
    total_pulses_fired: int = 0


# ──────────────────────────────────────────────────────────────────────────
# 2. SESSION OPS
# ──────────────────────────────────────────────────────────────────────────
def open_cinema_date(
    content_id: str,
    viewer_a_id: str, license_a_id: str,
    viewer_b_id: str, license_b_id: str,
) -> CinemaDateSession:
    if viewer_a_id == viewer_b_id:
        raise ValueError("a cinema date requires two distinct viewers")
    if not license_a_id or not license_b_id:
        raise ValueError("both viewers must hold a Memory Bank license")
    return CinemaDateSession(
        session_id=str(uuid.uuid4()),
        content_id=content_id,
        viewer_a_id=viewer_a_id,
        viewer_b_id=viewer_b_id,
        license_a_id=license_a_id,
        license_b_id=license_b_id,
    )


def schedule_pulse(session: CinemaDateSession, timestamp_seconds: int, question: str) -> CinemaPulse:
    if timestamp_seconds < 0:
        raise ValueError("timestamp must be non-negative")
    pulse = CinemaPulse(
        pulse_id=str(uuid.uuid4()),
        timestamp_seconds=timestamp_seconds,
        question=question,
    )
    session.pulses.append(pulse)
    session.pulses.sort(key=lambda p: p.timestamp_seconds)
    return pulse


def cast_pulse_vote(
    session: CinemaDateSession, pulse_id: str,
    voter_id: str, vote: Literal["yes", "no"],
) -> CinemaPulse:
    pulse = next((p for p in session.pulses if p.pulse_id == pulse_id), None)
    if not pulse:
        raise ValueError("pulse not found in session")
    if pulse.resolved:
        raise ValueError("pulse already resolved")
    if voter_id == session.viewer_a_id:
        if pulse.viewer_a_vote is not None:
            raise ValueError("viewer A already voted on this pulse")
        pulse.viewer_a_vote = vote
    elif voter_id == session.viewer_b_id:
        if pulse.viewer_b_vote is not None:
            raise ValueError("viewer B already voted on this pulse")
        pulse.viewer_b_vote = vote
    else:
        raise ValueError("voter is not in this cinema date")
    return pulse


def resolve_pulse(session: CinemaDateSession, pulse_id: str) -> Dict:
    pulse = next((p for p in session.pulses if p.pulse_id == pulse_id), None)
    if not pulse:
        raise ValueError("pulse not found")
    if pulse.resolved:
        raise ValueError("pulse already resolved")
    pulse.resolved = True
    session.total_pulses_fired += 1

    if not pulse.both_voted():
        # One side didn't vote → no match credit, no penalty
        return {
            "pulse_id": pulse_id,
            "outcome": "incomplete",
            "match_score": session.match_score,
            "reward_per_voter": 0,
        }

    if pulse.is_match():
        session.match_score += 1
        reward = CINEMA_DATE_PULSE_REWARD if pulse.both_yes() else 0
        return {
            "pulse_id": pulse_id,
            "outcome": "both_yes" if pulse.both_yes() else "both_no",
            "match_score": session.match_score,
            "reward_per_voter": reward,
            "total_reward_paid": reward * 2,
        }

    # Mismatch
    session.match_score -= 1
    return {
        "pulse_id": pulse_id,
        "outcome": "mismatch",
        "match_score": session.match_score,
        "reward_per_voter": 0,
    }


def update_position(
    session: CinemaDateSession, viewer_id: str, position_seconds: int,
) -> Dict:
    """Track sync — if either viewer drifts more than tolerance, signal
    a re-sync to the WS layer."""
    if viewer_id not in (session.viewer_a_id, session.viewer_b_id):
        raise ValueError("not a viewer in this session")
    desync = abs(position_seconds - session.current_position_seconds)
    out_of_sync = desync > CINEMA_DATE_DESYNC_TOLERANCE_SECONDS

    session.current_position_seconds = position_seconds
    session.last_sync_at = datetime.now(timezone.utc).isoformat()
    return {
        "session_id": session.session_id,
        "current_position_seconds": position_seconds,
        "out_of_sync": out_of_sync,
        "desync_seconds": desync,
        "tolerance_seconds": CINEMA_DATE_DESYNC_TOLERANCE_SECONDS,
    }


def end_cinema_date(session: CinemaDateSession) -> Dict:
    session.status = "ended"
    return {
        "session_id": session.session_id,
        "viewer_a_id": session.viewer_a_id,
        "viewer_b_id": session.viewer_b_id,
        "match_score": session.match_score,
        "total_pulses_fired": session.total_pulses_fired,
        "verdict": (
            "PERFECT_DATE" if session.match_score >= 5
            else "STRONG_VIBE" if session.match_score >= 2
            else "MUTUAL" if session.match_score == 0
            else "MISMATCH" if session.match_score < 0
            else "WARMING_UP"
        ),
    }


__all__ = [
    "CINEMA_DATE_PULSE_REWARD", "CINEMA_DATE_DESYNC_TOLERANCE_SECONDS",
    "CinemaPulse", "CinemaDateSession",
    "open_cinema_date", "schedule_pulse",
    "cast_pulse_vote", "resolve_pulse",
    "update_position", "end_cinema_date",
]
