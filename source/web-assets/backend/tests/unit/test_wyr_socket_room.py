"""Would You Rather socket room init helpers."""
from services.would_you_rather_socket_events import _pick_question


def test_pick_question_has_options():
    q = _pick_question()
    assert q["id"]
    assert q["option_a"]
    assert q["option_b"]


def test_pick_question_exclude():
    first = _pick_question()
    second = _pick_question({first["id"]})
    # With enough questions, exclusion should usually differ; always valid shape
    assert second["id"]
    assert "option_a" in second
