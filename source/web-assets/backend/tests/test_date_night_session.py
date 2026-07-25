"""Date Night Session consolidation — packs, boards, chemistry, planner handoff."""
from __future__ import annotations

import inspect
from pathlib import Path

from data.date_night_content import DATE_NIGHT_PACKS, SOFT_WYR, BUILD_A_NIGHT_STEPS
from routes import date_night_session as dns


def test_catalog_packs_include_headline_and_arena():
    assert "warm_up" in DATE_NIGHT_PACKS
    assert "build_a_night" in DATE_NIGHT_PACKS
    assert DATE_NIGHT_PACKS["build_a_night"]["headline"] is True
    assert DATE_NIGHT_PACKS["arena_connect4"]["board_game"] == "connect4"
    assert len(SOFT_WYR) >= 3
    assert len(BUILD_A_NIGHT_STEPS) == 5


def test_pack_payload_phases():
    payload = dns._pack_payload("warm_up", "u1", "u2")
    assert payload["phases"][0] == "soft_wyr"
    assert payload["current_phase"] == "soft_wyr"
    assert len(payload["soft_wyr"]) == 3
    assert len(payload["icebreakers"]) == 3


def test_ttt_win_detection():
    cells = ["X", "X", "X", "", "", "", "", "", ""]
    assert dns._ttt_winner(cells) == "X"
    assert dns._ttt_winner([""] * 9) is None


def test_connect4_win_detection():
    cells = [""] * 42
    # horizontal bottom row
    for c in range(4):
        cells[5 * 7 + c] = "crimson"
    assert dns._c4_winner(cells) == "crimson"


def test_chemistry_scoring_increases_with_sync():
    session = {
        "answers": {
            "q1": {"a": "yes", "b": "yes"},
            "q2": {"a": "no", "b": "yes"},
        },
        "positive_interaction": True,
        "build_preferences": {
            "consensus": {"vibe": "cozy", "food": "mixed:a+b"},
        },
        "board": {},
    }
    chem = dns._score_chemistry(session)
    assert 60 <= chem["chemistry_score"] <= 100
    assert chem["openers"]


def test_advance_phase_completes():
    session = {"phases": ["soft_wyr", "chemistry"], "phase_index": 1}
    out = dns._advance_phase_fields(session)
    assert out["current_phase"] == "complete"
    assert out["status"] == "completed"


def test_dating_games_start_delegates_to_date_night():
    src = Path("routes/dating_games.py").read_text(encoding="utf-8")
    assert 'game_type == "date_night"' in src
    assert "start_date_night_session" in src


def test_table_for_two_accept_uses_date_night_redirect():
    src = Path("routes/table_for_two.py").read_text(encoding="utf-8")
    assert "date_night_pack" in src
    assert "/dating/date-night/" in src


def test_socket_events_registered():
    src = inspect.getsource(dns)
    assert "session/start" in Path("routes/date_night_session.py").read_text()
    from services.date_night_socket_events import register_date_night_events

    assert callable(register_date_night_events)


def test_registry_mounts_date_night():
    reg = Path("routes/registry.py").read_text(encoding="utf-8")
    assert "date_night_session" in reg
