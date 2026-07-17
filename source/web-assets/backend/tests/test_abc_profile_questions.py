"""Unit tests for progressive A/B/C profile question bank."""
from data.abc_profile_questions import (
    ABC_PROFILE_QUESTIONS,
    get_batch,
    max_batch,
    questions_by_id,
)


def test_abc_bank_has_three_option_questions():
    assert len(ABC_PROFILE_QUESTIONS) >= 12
    for q in ABC_PROFILE_QUESTIONS:
        assert len(q["options"]) == 3
        ids = [o["id"] for o in q["options"]]
        assert ids == ["a", "b", "c"]
        assert q["question"]
        assert "batch" in q


def test_abc_batches_cover_range():
    assert max_batch() >= 2
    for b in range(max_batch() + 1):
        batch = get_batch(b)
        assert len(batch) == 3


def test_abc_ids_unique():
    ids = [q["id"] for q in ABC_PROFILE_QUESTIONS]
    assert len(ids) == len(set(ids))
    assert set(questions_by_id().keys()) == set(ids)
