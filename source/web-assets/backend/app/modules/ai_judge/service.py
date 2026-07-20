"""
AI Judge core logic — VibeCredit escrow, voting, majority verdict, LLM speech.

Uses Mongo ``credits_balance`` for the closed-loop wallet and SQLModel
tables for case / vote persistence.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlmodel import Session, select

from app.modules.ai_judge.models import CaseStatus, CaseVote, DisputeCase, VerdictType
from app.modules.ai_judge.schemas import CaseCreateRequest, VoteCastRequest

log = logging.getLogger(__name__)

PLATFORM_FEE_BPS = 250  # 2.5%


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _mongo():
    from utils.database import get_database  # noqa: PLC0415

    return get_database()


async def _debit_credits(user_id: str, amount: int, *, reason: str) -> None:
    from utils.wallet_fields import pick_wallet_field_for_debit  # noqa: PLC0415

    db = await _mongo()
    doc = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "credits_balance": 1, "token_balance": 1},
    ) or {}
    try:
        field, _ = pick_wallet_field_for_debit(doc, amount)
    except ValueError as exc:
        raise ValueError(f"insufficient_credits:{user_id}:{amount}") from exc
    await db.users.update_one({"user_id": user_id}, {"$inc": {field: -amount}})
    await db.ai_judge_escrow_ledger.insert_one(
        {
            "event_id": f"aje_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "amount": -amount,
            "reason": reason,
            "at": _now().isoformat(),
        }
    )


async def _credit_credits(user_id: str, amount: int, *, reason: str) -> None:
    if amount <= 0:
        return
    from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415

    db = await _mongo()
    doc = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "credits_balance": 1, "token_balance": 1},
    ) or {}
    field = pick_wallet_field_for_credit(doc)
    await db.users.update_one({"user_id": user_id}, {"$inc": {field: amount}})
    await db.ai_judge_escrow_ledger.insert_one(
        {
            "event_id": f"aje_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "amount": amount,
            "reason": reason,
            "at": _now().isoformat(),
        }
    )


async def submit_case(session: Session, payload: CaseCreateRequest) -> DisputeCase:
    """Deduct entry fees from both parties, lock escrow, create case."""
    if payload.user_a_id == payload.user_b_id:
        raise ValueError("parties_must_differ")

    fee = int(payload.entry_fee_credits)
    # Debit both — if B fails, refund A.
    await _debit_credits(
        payload.user_a_id, fee, reason=f"ai_judge_entry_a:{payload.user_a_id}"
    )
    try:
        await _debit_credits(
            payload.user_b_id, fee, reason=f"ai_judge_entry_b:{payload.user_b_id}"
        )
    except ValueError:
        await _credit_credits(
            payload.user_a_id, fee, reason="ai_judge_entry_refund_a"
        )
        raise

    case = DisputeCase(
        case_id=f"ajc_{uuid.uuid4().hex[:12]}",
        user_a_id=payload.user_a_id,
        user_b_id=payload.user_b_id,
        story_a=payload.story_a,
        story_b=payload.story_b,
        entry_fee_credits=fee,
        escrow_credits=fee * 2,
        stake_pool_credits=0,
        status=CaseStatus.VOTING.value,
        created_at=_now(),
    )
    session.add(case)
    session.commit()
    session.refresh(case)
    return case


async def cast_vote(
    session: Session, payload: VoteCastRequest, voter_id: str
) -> CaseVote:
    """Record vote and lock staked VibeCredits into the case stake pool."""
    case = session.exec(
        select(DisputeCase).where(DisputeCase.case_id == payload.case_id)
    ).first()
    if not case:
        raise ValueError("case_not_found")
    if case.status != CaseStatus.VOTING.value:
        raise ValueError("case_not_open_for_voting")
    if voter_id in (case.user_a_id, case.user_b_id):
        raise ValueError("parties_cannot_vote")

    existing = session.exec(
        select(CaseVote).where(
            CaseVote.case_id == payload.case_id,
            CaseVote.voter_id == voter_id,
        )
    ).first()
    if existing:
        raise ValueError("already_voted")

    stake = int(payload.vibe_credits_staked)
    await _debit_credits(
        voter_id, stake, reason=f"ai_judge_stake:{payload.case_id}"
    )

    vote = CaseVote(
        case_id=payload.case_id,
        voter_id=voter_id,
        verdict_type=payload.verdict_type,
        vibe_credits_staked=stake,
        created_at=_now(),
    )
    case.stake_pool_credits = int(case.stake_pool_credits or 0) + stake
    session.add(vote)
    session.add(case)
    session.commit()
    session.refresh(vote)
    return vote


def _tally(votes: List[CaseVote]) -> Tuple[str, int, int]:
    guilty = sum(1 for v in votes if v.verdict_type == VerdictType.GUILTY.value)
    innocent = sum(1 for v in votes if v.verdict_type == VerdictType.INNOCENT.value)
    if guilty > innocent:
        return VerdictType.GUILTY.value, guilty, innocent
    if innocent > guilty:
        return VerdictType.INNOCENT.value, guilty, innocent
    # Tie → INNOCENT (presumption of innocence)
    return VerdictType.INNOCENT.value, guilty, innocent


async def _generate_verdict_speech(
    case: DisputeCase, majority: str
) -> str:
    """Ask configured LLM for a dramatic courtroom speech; fall back locally."""
    prompt = (
        "You are the AI Judge of Global Vibez DSG — theatrical, fair, neon-noir.\n"
        f"Case {case.case_id}.\n"
        f"Party A ({case.user_a_id}) testimony:\n{case.story_a}\n\n"
        f"Party B ({case.user_b_id}) testimony:\n{case.story_b}\n\n"
        f"The audience majority verdict is: {majority}.\n"
        "Deliver a 2–4 sentence dramatic verdict speech announcing the result. "
        "Do not invent extra evidence. End with bang of the digital gavel."
    )
    try:
        from services.ai_engine import LlmChat, UserMessage  # noqa: PLC0415

        chat = LlmChat(
            system_message=(
                "You are the AI Judge hologram. Speak with flair, keep it PG-13, "
                "and respect the closed-loop VibeCredit courtroom."
            )
        ).with_model("gemini", "gemini-2.0-flash")
        speech = await chat.send_message(UserMessage(text=prompt))
        if speech and speech.strip():
            return speech.strip()[:8000]
    except Exception as exc:  # noqa: BLE001
        log.warning("ai_judge LLM speech fallback: %s", exc)

    gavel = "⚡ *digital gavel strikes the bench*"
    if majority == VerdictType.GUILTY.value:
        return (
            f"After weighing both testimonies, this Court finds the accused GUILTY. "
            f"The Vibez of the room have spoken. Escrowed VibeCredits flow to the "
            f"prevailing voters. {gavel}"
        )
    return (
        f"After weighing both testimonies, this Court finds the accused INNOCENT. "
        f"Presumption holds — the majority stands with clearance. Escrowed "
        f"VibeCredits flow to the prevailing voters. {gavel}"
    )


async def execute_verdict(session: Session, case_id: str) -> Dict[str, Any]:
    """
    Tally votes, generate LLM speech, distribute escrow (−2.5% platform fee)
    to voters who matched the majority, proportional to stake.
    """
    case = session.exec(
        select(DisputeCase).where(DisputeCase.case_id == case_id)
    ).first()
    if not case:
        raise ValueError("case_not_found")
    if case.status == CaseStatus.RESOLVED.value:
        return {
            "case_id": case.case_id,
            "majority_verdict": case.majority_verdict,
            "verdict_speech": case.verdict_speech,
            "platform_fee_credits": case.platform_fee_credits,
            "distributed_credits": 0,
            "winners": [],
            "status": case.status,
            "already": True,
        }
    if case.status != CaseStatus.VOTING.value:
        raise ValueError("case_not_votable")

    votes = list(
        session.exec(select(CaseVote).where(CaseVote.case_id == case_id)).all()
    )
    majority, guilty_n, innocent_n = _tally(votes)
    speech = await _generate_verdict_speech(case, majority)

    total_pool = int(case.escrow_credits or 0) + int(case.stake_pool_credits or 0)
    fee = int(round(total_pool * PLATFORM_FEE_BPS / 10_000))
    distributable = max(0, total_pool - fee)

    winners = [v for v in votes if v.verdict_type == majority]
    winner_ids: List[str] = []
    distributed = 0

    if winners and distributable > 0:
        total_stake = sum(int(v.vibe_credits_staked) for v in winners) or 1
        # Proportional payout; remainder pennies go to first winner.
        paid = 0
        for i, v in enumerate(winners):
            if i == len(winners) - 1:
                share = distributable - paid
            else:
                share = int(distributable * int(v.vibe_credits_staked) / total_stake)
                paid += share
            await _credit_credits(
                v.voter_id,
                share,
                reason=f"ai_judge_payout:{case_id}:{majority}",
            )
            winner_ids.append(v.voter_id)
            distributed += share
    elif distributable > 0 and not winners:
        # No audience — refund parties equally from entry escrow (minus fee share).
        half = distributable // 2
        await _credit_credits(
            case.user_a_id, half, reason=f"ai_judge_refund_a:{case_id}"
        )
        await _credit_credits(
            case.user_b_id,
            distributable - half,
            reason=f"ai_judge_refund_b:{case_id}",
        )
        winner_ids = [case.user_a_id, case.user_b_id]
        distributed = distributable

    case.status = CaseStatus.RESOLVED.value
    case.majority_verdict = majority
    case.verdict_speech = speech
    case.platform_fee_credits = fee
    case.resolved_at = _now()
    session.add(case)
    session.commit()
    session.refresh(case)

    return {
        "case_id": case.case_id,
        "majority_verdict": majority,
        "verdict_speech": speech,
        "platform_fee_credits": fee,
        "distributed_credits": distributed,
        "winners": winner_ids,
        "status": case.status,
        "tally": {"GUILTY": guilty_n, "INNOCENT": innocent_n},
    }


def get_case(session: Session, case_id: str) -> Optional[DisputeCase]:
    return session.exec(
        select(DisputeCase).where(DisputeCase.case_id == case_id)
    ).first()


def list_open_cases(session: Session, limit: int = 20) -> List[DisputeCase]:
    return list(
        session.exec(
            select(DisputeCase)
            .where(DisputeCase.status == CaseStatus.VOTING.value)
            .order_by(DisputeCase.created_at.desc())
            .limit(max(1, min(limit, 50)))
        ).all()
    )


def vote_counts(session: Session, case_id: str) -> Tuple[int, int]:
    votes = list(
        session.exec(select(CaseVote).where(CaseVote.case_id == case_id)).all()
    )
    guilty = sum(1 for v in votes if v.verdict_type == VerdictType.GUILTY.value)
    innocent = sum(1 for v in votes if v.verdict_type == VerdictType.INNOCENT.value)
    return guilty, innocent
