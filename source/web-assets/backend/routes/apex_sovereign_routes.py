"""
Apex Sovereign Layer — HTTP routes (v6.5 Phase 1).

All endpoints under /api/apex/*. Pure pass-through to
services.apex_sovereign — no DB writes yet (the founder dashboard
will hit these read-only first; persistence comes in Phase 2 once the
admin widget is approved).
"""
from __future__ import annotations

import uuid
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.apex_sovereign import (
    ArtistProfile, compute_synergy_score,
    oracle_select_state, build_red_protocol_alert,
    PulsePoll, cast_pulse_vote, resolve_pulse_poll, PULSE_POLL_REWARD,
    compute_vip_tier,
    APEX_LEGEND_RANK_THRESHOLD, APEX_SOVEREIGN_MIN_CHAIRS,
)


apex_router = APIRouter(prefix="/apex", tags=["apex-sovereign"])


# ── In-memory poll registry (Phase 1 — DB persistence in Phase 2) ─────────
_POLL_REGISTRY: Dict[str, PulsePoll] = {}


# ──────────────────────────────────────────────────────────────────────────
# 1. SYNERGY SCORING
# ──────────────────────────────────────────────────────────────────────────
class ArtistProfileIn(BaseModel):
    user_id: str
    flow_speed: float = Field(..., ge=0.0, le=1.0)
    tempo_bpm: int = Field(..., ge=40, le=260)
    genre: str
    rank: str = "ROOKIE"
    klass: str = "STRATEGIST"


class SynergyRequest(BaseModel):
    a: ArtistProfileIn
    b: ArtistProfileIn


@apex_router.post("/synergy")
def synergy(req: SynergyRequest) -> Dict:
    try:
        a = ArtistProfile(**req.a.model_dump())
        b = ArtistProfile(**req.b.model_dump())
        return compute_synergy_score(a, b)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# 2. AI ORACLE STATE MACHINE
# ──────────────────────────────────────────────────────────────────────────
class OracleStateRequest(BaseModel):
    context: Dict   # arbitrary signals; engine reads known trigger keys


@apex_router.post("/oracle-state")
def oracle_state(req: OracleStateRequest) -> Dict:
    return oracle_select_state(req.context)


class RedProtocolRequest(BaseModel):
    user_id: str
    trigger: str
    location: Optional[str] = None


@apex_router.post("/red-protocol")
def red_protocol(req: RedProtocolRequest) -> Dict:
    return build_red_protocol_alert(req.user_id, req.trigger, req.location).to_dict()


# ──────────────────────────────────────────────────────────────────────────
# 3. PULSE POLLING
# ──────────────────────────────────────────────────────────────────────────
class PulsePollCreateRequest(BaseModel):
    stream_id: str
    question: str = Field(..., min_length=1, max_length=240)


class PulsePollVoteRequest(BaseModel):
    poll_id: str
    voter_id: str
    vote: Literal["yes", "no"]


@apex_router.post("/pulse-poll/create")
def pulse_poll_create(req: PulsePollCreateRequest) -> Dict:
    pid = str(uuid.uuid4())
    poll = PulsePoll(poll_id=pid, stream_id=req.stream_id, question=req.question)
    _POLL_REGISTRY[pid] = poll
    return {
        "poll_id": pid,
        "stream_id": poll.stream_id,
        "question": poll.question,
        "status": poll.status,
        "reward_per_voter": PULSE_POLL_REWARD,
    }


@apex_router.post("/pulse-poll/vote")
def pulse_poll_vote(req: PulsePollVoteRequest) -> Dict:
    poll = _POLL_REGISTRY.get(req.poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="poll not found")
    try:
        cast_pulse_vote(poll, req.voter_id, req.vote)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "poll_id": poll.poll_id,
        "yes_votes": poll.yes_votes,
        "no_votes": poll.no_votes,
        "percentages": poll.percentages(),
        "status": poll.status,
    }


@apex_router.post("/pulse-poll/resolve")
def pulse_poll_resolve(poll_id: str) -> Dict:
    poll = _POLL_REGISTRY.get(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="poll not found")
    return resolve_pulse_poll(poll)


@apex_router.get("/pulse-poll/{poll_id}")
def pulse_poll_get(poll_id: str) -> Dict:
    poll = _POLL_REGISTRY.get(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="poll not found")
    return {
        "poll_id": poll.poll_id,
        "stream_id": poll.stream_id,
        "question": poll.question,
        "yes_votes": poll.yes_votes,
        "no_votes": poll.no_votes,
        "percentages": poll.percentages(),
        "status": poll.status,
    }


# ──────────────────────────────────────────────────────────────────────────
# 4. APEX FACTOR VIP GATE
# ──────────────────────────────────────────────────────────────────────────
class VipTierRequest(BaseModel):
    artist_rank: Optional[str] = None
    chair_count: int = 0


@apex_router.post("/vip-tier")
def vip_tier(req: VipTierRequest) -> Dict:
    return compute_vip_tier(artist_rank=req.artist_rank, chair_count=req.chair_count)


@apex_router.get("/vip-thresholds")
def vip_thresholds() -> Dict:
    return {
        "legend_rank_threshold": APEX_LEGEND_RANK_THRESHOLD,
        "sovereign_min_chairs": APEX_SOVEREIGN_MIN_CHAIRS,
        "doc": (
            "Apex tier = LEGEND artist rank AND ≥100 chairs. "
            "Vibe Legend = LEGEND only. Vibe Sovereign = ≥100 chairs only. "
            "Basic = neither. From DSG_Apex_and_Collab_Blueprint.pdf §VIP Gate."
        ),
    }


__all__ = ["apex_router"]
