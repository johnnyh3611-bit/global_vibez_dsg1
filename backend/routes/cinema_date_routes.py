"""Cinema Date — HTTP routes (v6.5 Phase 5).

All under /api/cinema-date/*.
"""
from __future__ import annotations

from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.cinema_date import (
    CinemaDateSession, open_cinema_date, schedule_pulse,
    cast_pulse_vote, resolve_pulse, update_position, end_cinema_date,
    CINEMA_DATE_PULSE_REWARD, CINEMA_DATE_DESYNC_TOLERANCE_SECONDS,
)


cinema_router = APIRouter(prefix="/cinema-date", tags=["cinema-date"])

_SESSIONS: Dict[str, CinemaDateSession] = {}


class OpenSessionRequest(BaseModel):
    content_id: str
    viewer_a_id: str
    license_a_id: str
    viewer_b_id: str
    license_b_id: str


@cinema_router.post("/open")
def open_session(req: OpenSessionRequest) -> Dict:
    try:
        session = open_cinema_date(
            content_id=req.content_id,
            viewer_a_id=req.viewer_a_id, license_a_id=req.license_a_id,
            viewer_b_id=req.viewer_b_id, license_b_id=req.license_b_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _SESSIONS[session.session_id] = session
    return {
        "session_id": session.session_id,
        "content_id": session.content_id,
        "viewer_a_id": session.viewer_a_id,
        "viewer_b_id": session.viewer_b_id,
        "status": session.status,
    }


class SchedulePulseRequest(BaseModel):
    session_id: str
    timestamp_seconds: int = Field(..., ge=0)
    question: str = Field(..., min_length=1, max_length=240)


@cinema_router.post("/pulse/schedule")
def pulse_schedule(req: SchedulePulseRequest) -> Dict:
    session = _SESSIONS.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    pulse = schedule_pulse(session, req.timestamp_seconds, req.question)
    return {
        "pulse_id": pulse.pulse_id,
        "timestamp_seconds": pulse.timestamp_seconds,
        "question": pulse.question,
    }


class PulseVoteRequest(BaseModel):
    session_id: str
    pulse_id: str
    voter_id: str
    vote: Literal["yes", "no"]


@cinema_router.post("/pulse/vote")
def pulse_vote(req: PulseVoteRequest) -> Dict:
    session = _SESSIONS.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    try:
        pulse = cast_pulse_vote(session, req.pulse_id, req.voter_id, req.vote)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "pulse_id": pulse.pulse_id,
        "viewer_a_voted": pulse.viewer_a_vote is not None,
        "viewer_b_voted": pulse.viewer_b_vote is not None,
        "both_voted": pulse.both_voted(),
    }


@cinema_router.post("/pulse/resolve")
def pulse_resolve(session_id: str, pulse_id: str) -> Dict:
    session = _SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    try:
        return resolve_pulse(session, pulse_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class UpdatePositionRequest(BaseModel):
    session_id: str
    viewer_id: str
    position_seconds: int = Field(..., ge=0)


@cinema_router.post("/sync/position")
def sync_position(req: UpdatePositionRequest) -> Dict:
    session = _SESSIONS.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    try:
        return update_position(session, req.viewer_id, req.position_seconds)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@cinema_router.post("/{session_id}/end")
def end_session(session_id: str) -> Dict:
    session = _SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    return end_cinema_date(session)


@cinema_router.get("/constants")
def cinema_constants() -> Dict:
    return {
        "pulse_reward_per_viewer": CINEMA_DATE_PULSE_REWARD,
        "desync_tolerance_seconds": CINEMA_DATE_DESYNC_TOLERANCE_SECONDS,
    }


__all__ = ["cinema_router"]
