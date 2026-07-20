"""SQLModel tables for AI Judge dispute cases and audience votes."""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class VerdictType(str, Enum):
    GUILTY = "GUILTY"
    INNOCENT = "INNOCENT"


class CaseStatus(str, Enum):
    OPEN = "OPEN"
    VOTING = "VOTING"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"


class DisputeCase(SQLModel, table=True):
    """A two-party dispute with entry fees locked in escrow."""

    __tablename__ = "ai_judge_dispute_cases"

    id: Optional[int] = Field(default=None, primary_key=True)
    case_id: str = Field(index=True, unique=True, max_length=64)
    user_a_id: str = Field(index=True, max_length=128)
    user_b_id: str = Field(index=True, max_length=128)
    story_a: str = Field(default="", max_length=8000)
    story_b: str = Field(default="", max_length=8000)
    entry_fee_credits: int = Field(default=100, ge=1)
    escrow_credits: int = Field(default=0, ge=0)
    stake_pool_credits: int = Field(default=0, ge=0)
    status: str = Field(default=CaseStatus.VOTING.value, max_length=32, index=True)
    majority_verdict: Optional[str] = Field(default=None, max_length=16)
    verdict_speech: Optional[str] = Field(default=None, max_length=16000)
    platform_fee_credits: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=_utc_now)
    resolved_at: Optional[datetime] = Field(default=None)


class CaseVote(SQLModel, table=True):
    """Audience vote with staked VibeCredits locked until verdict."""

    __tablename__ = "ai_judge_case_votes"

    id: Optional[int] = Field(default=None, primary_key=True)
    case_id: str = Field(index=True, max_length=64)
    voter_id: str = Field(index=True, max_length=128)
    verdict_type: str = Field(max_length=16)  # GUILTY | INNOCENT
    vibe_credits_staked: int = Field(default=0, ge=1)
    created_at: datetime = Field(default_factory=_utc_now)
