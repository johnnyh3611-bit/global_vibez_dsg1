"""AI Judge — SQLModel models + escrow math smoke tests."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest


@pytest.fixture()
def judge_session(monkeypatch, tmp_path):
    monkeypatch.setenv("AI_JUDGE_DB_DIR", str(tmp_path))
    # Reset module-level engine to point at temp db
    import importlib
    import app.modules.ai_judge.db as dbmod
    import app.modules.ai_judge.models  # noqa: F401

    importlib.reload(dbmod)
    dbmod.init_db()
    from sqlmodel import Session

    with Session(dbmod.get_engine()) as session:
        yield session


def test_models_and_tally(judge_session):
    from app.modules.ai_judge.models import CaseVote, DisputeCase, VerdictType
    from app.modules.ai_judge.service import _tally

    case = DisputeCase(
        case_id="ajc_test1",
        user_a_id="a1",
        user_b_id="b1",
        story_a="A says they were wronged in the lounge.",
        story_b="B says it was a misunderstanding over the table.",
        entry_fee_credits=100,
        escrow_credits=200,
        status="VOTING",
    )
    judge_session.add(case)
    judge_session.commit()

    votes = [
        CaseVote(
            case_id="ajc_test1",
            voter_id="v1",
            verdict_type=VerdictType.GUILTY.value,
            vibe_credits_staked=50,
        ),
        CaseVote(
            case_id="ajc_test1",
            voter_id="v2",
            verdict_type=VerdictType.GUILTY.value,
            vibe_credits_staked=25,
        ),
        CaseVote(
            case_id="ajc_test1",
            voter_id="v3",
            verdict_type=VerdictType.INNOCENT.value,
            vibe_credits_staked=100,
        ),
    ]
    majority, g, i = _tally(votes)
    assert majority == "GUILTY"
    assert g == 2 and i == 1


def test_platform_fee_bps():
    from app.modules.ai_judge.service import PLATFORM_FEE_BPS

    assert PLATFORM_FEE_BPS == 250
    pool = 10_000
    fee = int(round(pool * PLATFORM_FEE_BPS / 10_000))
    assert fee == 250


def test_schemas_validate_entry_fee():
    from app.modules.ai_judge.schemas import CaseCreateRequest, VoteCastRequest
    from pydantic import ValidationError

    ok = CaseCreateRequest(
        user_a_id="a",
        user_b_id="b",
        story_a="Ten chars..",
        story_b="Also ten..!",
        entry_fee_credits=250,
    )
    assert ok.entry_fee_credits == 250

    with pytest.raises(ValidationError):
        CaseCreateRequest(
            user_a_id="a",
            user_b_id="b",
            story_a="short",
            story_b="Also ten..!",
            entry_fee_credits=250,
        )

    vote = VoteCastRequest(
        case_id="ajc_x",
        verdict_type="INNOCENT",
        vibe_credits_staked=100,
    )
    assert vote.verdict_type == "INNOCENT"


def test_router_import():
    from routes import ai_judge

    assert ai_judge.router is not None
    paths = {getattr(r, "path", None) for r in ai_judge.router.routes}
    assert any(p and "cases" in p for p in paths)
