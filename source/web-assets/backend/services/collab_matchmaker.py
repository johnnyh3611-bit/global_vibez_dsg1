"""
Collab Matchmaker — v6.5 Phase 2.

Connects two artists for a collaborative single. Flow per
DSG_Apex_and_Collab_Blueprint.pdf §Collab Matchmaker:

  1. Artist requests collab → engine ranks all eligible candidates
     by synergy score (uses services.apex_sovereign.compute_synergy_score)
  2. Top N candidates are surfaced as "Duo Up" cards
  3. Community votes on which pair to studio
  4. Winning duo is provisioned a Private Collab Studio (room)
  5. Studio is dissolved 14 days after creation (auto-expiry)

Pure Python data-classes + functions — DB persistence wired via
routes/collab_matchmaker_routes.py.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional

from services.apex_sovereign import ArtistProfile, compute_synergy_score


COLLAB_STUDIO_TTL_DAYS: int = 14
COLLAB_DEFAULT_TOP_N: int = 5     # how many candidates to surface for fan voting


# ──────────────────────────────────────────────────────────────────────────
# 1. CANDIDATE RANKING
# ──────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class CollabCandidate:
    artist: ArtistProfile
    synergy_score: float
    verdict: str
    components: Dict[str, float]


def rank_collab_candidates(
    seeker: ArtistProfile,
    pool: List[ArtistProfile],
    top_n: int = COLLAB_DEFAULT_TOP_N,
) -> List[CollabCandidate]:
    """Rank a pool of artists by synergy with the seeker. Excludes the
    seeker themselves and any duplicates by user_id."""
    seen = {seeker.user_id}
    out: List[CollabCandidate] = []
    for cand in pool:
        if cand.user_id in seen:
            continue
        seen.add(cand.user_id)
        try:
            score = compute_synergy_score(seeker, cand)
        except ValueError:
            continue
        out.append(CollabCandidate(
            artist=cand,
            synergy_score=score["synergy_score"],
            verdict=score["verdict"],
            components=score["components"],
        ))
    out.sort(key=lambda c: c.synergy_score, reverse=True)
    return out[: max(1, top_n)]


# ──────────────────────────────────────────────────────────────────────────
# 2. DUO UP — community voting
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class DuoUpVote:
    """One fan vote for a candidate pair."""
    voter_id: str
    candidate_user_id: str   # which candidate they want to duet with the seeker
    cast_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class DuoUpSession:
    session_id: str
    seeker: ArtistProfile
    candidates: List[CollabCandidate]
    votes: List[DuoUpVote] = field(default_factory=list)
    status: Literal["voting", "closed"] = "voting"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    closes_at: str = field(
        default_factory=lambda: (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    )
    winner_user_id: Optional[str] = None

    def vote_counts(self) -> Dict[str, int]:
        counts: Dict[str, int] = {c.artist.user_id: 0 for c in self.candidates}
        for v in self.votes:
            if v.candidate_user_id in counts:
                counts[v.candidate_user_id] += 1
        return counts

    def has_voter(self, voter_id: str) -> bool:
        return any(v.voter_id == voter_id for v in self.votes)


def open_duo_up_session(seeker: ArtistProfile, pool: List[ArtistProfile]) -> DuoUpSession:
    candidates = rank_collab_candidates(seeker, pool)
    if not candidates:
        raise ValueError("no eligible candidates in pool")
    return DuoUpSession(
        session_id=str(uuid.uuid4()),
        seeker=seeker,
        candidates=candidates,
    )


def cast_duo_up_vote(
    session: DuoUpSession, voter_id: str, candidate_user_id: str,
) -> DuoUpSession:
    if session.status != "voting":
        raise ValueError("voting is closed for this session")
    if session.has_voter(voter_id):
        raise ValueError("voter has already cast a ballot")
    valid_ids = {c.artist.user_id for c in session.candidates}
    if candidate_user_id not in valid_ids:
        raise ValueError(f"{candidate_user_id} is not a candidate in this session")
    session.votes.append(DuoUpVote(voter_id=voter_id, candidate_user_id=candidate_user_id))
    return session


def resolve_duo_up_session(session: DuoUpSession) -> Dict:
    counts = session.vote_counts()
    if not session.votes:
        # No votes cast — pick the highest synergy candidate by default
        winner = session.candidates[0].artist.user_id
        verdict = "default_top_synergy"
    else:
        winner = max(counts, key=lambda k: counts[k])
        verdict = "vote_winner"
    session.status = "closed"
    session.winner_user_id = winner
    return {
        "session_id": session.session_id,
        "winner_user_id": winner,
        "vote_counts": counts,
        "total_votes": len(session.votes),
        "verdict": verdict,
        "closes_at": session.closes_at,
    }


# ──────────────────────────────────────────────────────────────────────────
# 3. PRIVATE COLLAB STUDIO
# ──────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class CollabStudio:
    studio_id: str
    artist_a_id: str
    artist_b_id: str
    synergy_score: float
    created_at: str
    expires_at: str
    invite_code: str   # 6-char invite for studio session
    is_apex_quality: bool   # True if synergy ≥ 90 (founder spec — Apex quality)


def provision_collab_studio(
    artist_a: ArtistProfile, artist_b: ArtistProfile,
) -> CollabStudio:
    if artist_a.user_id == artist_b.user_id:
        raise ValueError("cannot provision studio with self")
    score = compute_synergy_score(artist_a, artist_b)
    now = datetime.now(timezone.utc)
    return CollabStudio(
        studio_id=str(uuid.uuid4()),
        artist_a_id=artist_a.user_id,
        artist_b_id=artist_b.user_id,
        synergy_score=score["synergy_score"],
        created_at=now.isoformat(),
        expires_at=(now + timedelta(days=COLLAB_STUDIO_TTL_DAYS)).isoformat(),
        invite_code=str(uuid.uuid4())[:6].upper(),
        is_apex_quality=score["synergy_score"] >= 90.0,
    )


def is_studio_active(studio: CollabStudio, now: Optional[datetime] = None) -> bool:
    """True if the studio is still within its TTL window."""
    now = now or datetime.now(timezone.utc)
    expires = datetime.fromisoformat(studio.expires_at)
    return now < expires


__all__ = [
    "COLLAB_STUDIO_TTL_DAYS", "COLLAB_DEFAULT_TOP_N",
    "CollabCandidate", "rank_collab_candidates",
    "DuoUpVote", "DuoUpSession",
    "open_duo_up_session", "cast_duo_up_vote", "resolve_duo_up_session",
    "CollabStudio", "provision_collab_studio", "is_studio_active",
]
