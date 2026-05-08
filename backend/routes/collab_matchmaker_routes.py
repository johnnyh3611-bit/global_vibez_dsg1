"""Collab Matchmaker — HTTP routes (v6.5 Phase 2).

All endpoints under /api/collab/*.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.apex_sovereign import ArtistProfile
from services.collab_matchmaker import (
    DuoUpSession, open_duo_up_session, cast_duo_up_vote,
    resolve_duo_up_session, provision_collab_studio,
    rank_collab_candidates, COLLAB_STUDIO_TTL_DAYS,
)


collab_router = APIRouter(prefix="/collab", tags=["collab-matchmaker"])

# In-memory session registry — DB persistence in Phase 3
_DUO_SESSIONS: Dict[str, DuoUpSession] = {}


class ArtistProfileIn(BaseModel):
    user_id: str
    flow_speed: float = Field(..., ge=0.0, le=1.0)
    tempo_bpm: int = Field(..., ge=40, le=260)
    genre: str
    rank: str = "ROOKIE"
    klass: str = "STRATEGIST"

    def to_engine(self) -> ArtistProfile:
        return ArtistProfile(**self.model_dump())


class RankRequest(BaseModel):
    seeker: ArtistProfileIn
    pool: List[ArtistProfileIn]
    top_n: int = 5


@collab_router.post("/rank")
def collab_rank(req: RankRequest) -> Dict:
    seeker = req.seeker.to_engine()
    pool = [a.to_engine() for a in req.pool]
    cands = rank_collab_candidates(seeker, pool, top_n=req.top_n)
    return {
        "seeker": req.seeker.user_id,
        "candidates": [
            {
                "user_id": c.artist.user_id,
                "genre": c.artist.genre,
                "rank": c.artist.rank,
                "synergy_score": c.synergy_score,
                "verdict": c.verdict,
                "components": c.components,
            }
            for c in cands
        ],
    }


class OpenDuoUpRequest(BaseModel):
    seeker: ArtistProfileIn
    pool: List[ArtistProfileIn]


@collab_router.post("/duo-up/open")
def duo_up_open(req: OpenDuoUpRequest) -> Dict:
    try:
        session = open_duo_up_session(req.seeker.to_engine(), [a.to_engine() for a in req.pool])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _DUO_SESSIONS[session.session_id] = session
    return {
        "session_id": session.session_id,
        "seeker_id": session.seeker.user_id,
        "candidates": [
            {
                "user_id": c.artist.user_id,
                "genre": c.artist.genre,
                "rank": c.artist.rank,
                "synergy_score": c.synergy_score,
                "verdict": c.verdict,
            }
            for c in session.candidates
        ],
        "status": session.status,
        "closes_at": session.closes_at,
    }


class DuoUpVoteRequest(BaseModel):
    session_id: str
    voter_id: str
    candidate_user_id: str


@collab_router.post("/duo-up/vote")
def duo_up_vote(req: DuoUpVoteRequest) -> Dict:
    session = _DUO_SESSIONS.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    try:
        cast_duo_up_vote(session, req.voter_id, req.candidate_user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "session_id": session.session_id,
        "vote_counts": session.vote_counts(),
        "total_votes": len(session.votes),
        "status": session.status,
    }


@collab_router.post("/duo-up/resolve")
def duo_up_resolve(session_id: str) -> Dict:
    session = _DUO_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    return resolve_duo_up_session(session)


class ProvisionStudioRequest(BaseModel):
    artist_a: ArtistProfileIn
    artist_b: ArtistProfileIn


@collab_router.post("/studio/provision")
def collab_studio_provision(req: ProvisionStudioRequest) -> Dict:
    try:
        studio = provision_collab_studio(req.artist_a.to_engine(), req.artist_b.to_engine())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return asdict(studio)


@collab_router.get("/studio/ttl-days")
def collab_studio_ttl() -> Dict:
    return {"ttl_days": COLLAB_STUDIO_TTL_DAYS}


__all__ = ["collab_router"]
