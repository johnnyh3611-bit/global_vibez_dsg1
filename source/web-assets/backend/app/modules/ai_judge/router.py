"""FastAPI routes for AI Judge dispute resolution."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from app.modules.ai_judge.db import get_session, init_db
from app.modules.ai_judge.schemas import (
    CaseCreateRequest,
    CasePublic,
    VerdictResult,
    VoteCastRequest,
)
from app.modules.ai_judge import service as svc
from utils.database import get_current_user

router = APIRouter(prefix="/ai-judge", tags=["ai-judge"])


def _session_dep():
    yield from get_session()


def _to_public(case, guilty: int = 0, innocent: int = 0) -> CasePublic:
    return CasePublic(
        case_id=case.case_id,
        user_a_id=case.user_a_id,
        user_b_id=case.user_b_id,
        story_a=case.story_a,
        story_b=case.story_b,
        entry_fee_credits=case.entry_fee_credits,
        escrow_credits=case.escrow_credits,
        stake_pool_credits=case.stake_pool_credits,
        status=case.status,
        majority_verdict=case.majority_verdict,
        verdict_speech=case.verdict_speech,
        platform_fee_credits=case.platform_fee_credits or 0,
        created_at=case.created_at,
        resolved_at=case.resolved_at,
        guilty_votes=guilty,
        innocent_votes=innocent,
    )


@router.get("/health")
@router.get("/status")
async def health() -> Dict[str, Any]:
    """Liveness + fee config. ``/status`` is the ops curl alias for ``/health``."""
    init_db()
    open_n = 0
    try:
        from sqlmodel import Session, select
        from app.modules.ai_judge.db import get_engine
        from app.modules.ai_judge.models import CaseStatus, DisputeCase

        with Session(get_engine()) as session:
            open_n = len(
                list(
                    session.exec(
                        select(DisputeCase).where(
                            DisputeCase.status == CaseStatus.VOTING.value
                        )
                    ).all()
                )
            )
    except Exception:
        open_n = -1
    return {
        "ok": True,
        "module": "ai_judge",
        "status": "ready",
        "fee_bps": svc.PLATFORM_FEE_BPS,
        "open_cases": open_n,
    }


@router.post("/cases", response_model=CasePublic)
async def create_case(
    payload: CaseCreateRequest,
    http_request: Request,
    session: Session = Depends(_session_dep),
) -> CasePublic:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    # Caller must be party A or B
    if user.user_id not in (payload.user_a_id, payload.user_b_id):
        raise HTTPException(403, "You must be a party to the dispute")
    try:
        case = await svc.submit_case(session, payload)
    except ValueError as exc:
        msg = str(exc)
        if msg.startswith("insufficient_credits"):
            raise HTTPException(402, "Insufficient VibeCredits for entry fee") from exc
        raise HTTPException(400, msg) from exc
    return _to_public(case)


@router.get("/cases/open", response_model=List[CasePublic])
async def open_cases(
    limit: int = 20,
    session: Session = Depends(_session_dep),
) -> List[CasePublic]:
    rows = svc.list_open_cases(session, limit=limit)
    out: List[CasePublic] = []
    for c in rows:
        g, i = svc.vote_counts(session, c.case_id)
        out.append(_to_public(c, g, i))
    return out


@router.get("/cases/{case_id}", response_model=CasePublic)
async def get_case(
    case_id: str, session: Session = Depends(_session_dep)
) -> CasePublic:
    case = svc.get_case(session, case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    g, i = svc.vote_counts(session, case_id)
    return _to_public(case, g, i)


@router.post("/votes")
async def cast_vote(
    payload: VoteCastRequest,
    http_request: Request,
    session: Session = Depends(_session_dep),
) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    try:
        vote = await svc.cast_vote(session, payload, user.user_id)
    except ValueError as exc:
        msg = str(exc)
        code = 400
        if msg.startswith("insufficient_credits"):
            code = 402
        elif msg == "case_not_found":
            code = 404
        elif msg == "already_voted":
            code = 409
        raise HTTPException(code, msg) from exc
    return {
        "ok": True,
        "case_id": vote.case_id,
        "verdict_type": vote.verdict_type,
        "vibe_credits_staked": vote.vibe_credits_staked,
    }


@router.post("/cases/{case_id}/execute", response_model=VerdictResult)
async def execute_verdict(
    case_id: str,
    http_request: Request,
    session: Session = Depends(_session_dep),
) -> VerdictResult:
    """Admin / timer trigger — tally, LLM speech, distribute escrow."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    email = (getattr(user, "email", None) or "").lower()
    # Parties, admins, or founder emails may trigger; timers call as system later.
    case = svc.get_case(session, case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    is_party = user.user_id in (case.user_a_id, case.user_b_id)
    is_admin = bool(getattr(user, "is_admin", False)) or email.endswith(
        ("@globalvibez.com", "@globalvibezdsg.com")
    )
    if not (is_party or is_admin):
        raise HTTPException(403, "Only parties or admin can execute the verdict")
    try:
        result = await svc.execute_verdict(session, case_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return VerdictResult(**{k: result[k] for k in VerdictResult.model_fields})
