"""Pydantic request/response schemas for AI Judge."""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class CaseCreateRequest(BaseModel):
    """Submit a dispute — both parties' entry fees must be payable in VibeCredits."""

    user_a_id: str = Field(min_length=1, max_length=128)
    user_b_id: str = Field(min_length=1, max_length=128)
    story_a: str = Field(min_length=10, max_length=4000)
    story_b: str = Field(min_length=10, max_length=4000)
    entry_fee_credits: int = Field(default=250, ge=50, le=50_000)

    @field_validator("user_a_id", "user_b_id")
    @classmethod
    def strip_ids(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("user id required")
        return v

    @field_validator("story_a", "story_b")
    @classmethod
    def strip_stories(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 10:
            raise ValueError("testimony must be at least 10 characters")
        return v


class VoteCastRequest(BaseModel):
    case_id: str = Field(min_length=1, max_length=64)
    verdict_type: Literal["GUILTY", "INNOCENT"]
    vibe_credits_staked: int = Field(ge=10, le=25_000)


class CasePublic(BaseModel):
    case_id: str
    user_a_id: str
    user_b_id: str
    story_a: str
    story_b: str
    entry_fee_credits: int
    escrow_credits: int
    stake_pool_credits: int
    status: str
    majority_verdict: Optional[str] = None
    verdict_speech: Optional[str] = None
    platform_fee_credits: int = 0
    created_at: datetime
    resolved_at: Optional[datetime] = None
    guilty_votes: int = 0
    innocent_votes: int = 0


class VotePublic(BaseModel):
    case_id: str
    voter_id: str
    verdict_type: str
    vibe_credits_staked: int
    created_at: datetime


class VerdictResult(BaseModel):
    case_id: str
    majority_verdict: str
    verdict_speech: str
    platform_fee_credits: int
    distributed_credits: int
    winners: List[str]
    status: str
