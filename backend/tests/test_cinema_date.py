"""Cinema Date — Phase 5 test sweep."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import app
from services import cinema_date as cd


client = TestClient(app)


def test_open_session_requires_two_viewers() -> None:
    with pytest.raises(ValueError):
        cd.open_cinema_date("c1", "u1", "lic1", "u1", "lic2")


def test_open_session_requires_licenses() -> None:
    with pytest.raises(ValueError):
        cd.open_cinema_date("c1", "u1", "", "u2", "lic2")


def test_pulse_full_lifecycle_match() -> None:
    s = cd.open_cinema_date("c1", "u1", "L1", "u2", "L2")
    p = cd.schedule_pulse(s, 600, "Vibe check?")
    cd.cast_pulse_vote(s, p.pulse_id, "u1", "yes")
    cd.cast_pulse_vote(s, p.pulse_id, "u2", "yes")
    res = cd.resolve_pulse(s, p.pulse_id)
    assert res["outcome"] == "both_yes"
    assert res["reward_per_voter"] == 5
    assert res["total_reward_paid"] == 10
    assert s.match_score == 1


def test_pulse_mismatch_decrements_score() -> None:
    s = cd.open_cinema_date("c1", "u1", "L1", "u2", "L2")
    p = cd.schedule_pulse(s, 100, "Cuddle?")
    cd.cast_pulse_vote(s, p.pulse_id, "u1", "yes")
    cd.cast_pulse_vote(s, p.pulse_id, "u2", "no")
    res = cd.resolve_pulse(s, p.pulse_id)
    assert res["outcome"] == "mismatch"
    assert res["reward_per_voter"] == 0
    assert s.match_score == -1


def test_pulse_both_no_is_match_no_reward() -> None:
    s = cd.open_cinema_date("c1", "u1", "L1", "u2", "L2")
    p = cd.schedule_pulse(s, 100, "Skip?")
    cd.cast_pulse_vote(s, p.pulse_id, "u1", "no")
    cd.cast_pulse_vote(s, p.pulse_id, "u2", "no")
    res = cd.resolve_pulse(s, p.pulse_id)
    assert res["outcome"] == "both_no"
    assert res["reward_per_voter"] == 0
    assert s.match_score == 1


def test_pulse_double_vote_rejected() -> None:
    s = cd.open_cinema_date("c1", "u1", "L1", "u2", "L2")
    p = cd.schedule_pulse(s, 100, "?")
    cd.cast_pulse_vote(s, p.pulse_id, "u1", "yes")
    with pytest.raises(ValueError):
        cd.cast_pulse_vote(s, p.pulse_id, "u1", "no")


def test_pulse_unknown_voter_rejected() -> None:
    s = cd.open_cinema_date("c1", "u1", "L1", "u2", "L2")
    p = cd.schedule_pulse(s, 100, "?")
    with pytest.raises(ValueError):
        cd.cast_pulse_vote(s, p.pulse_id, "stranger", "yes")


def test_position_sync_detection() -> None:
    s = cd.open_cinema_date("c1", "u1", "L1", "u2", "L2")
    out = cd.update_position(s, "u1", 60)
    assert out["out_of_sync"] is True   # was at 0, jumped to 60
    out2 = cd.update_position(s, "u2", 60)
    assert out2["out_of_sync"] is False


def test_end_session_perfect_date_verdict() -> None:
    s = cd.open_cinema_date("c1", "u1", "L1", "u2", "L2")
    s.match_score = 7
    out = cd.end_cinema_date(s)
    assert out["verdict"] == "PERFECT_DATE"
    assert s.status == "ended"


def test_end_session_mismatch_verdict() -> None:
    s = cd.open_cinema_date("c1", "u1", "L1", "u2", "L2")
    s.match_score = -3
    out = cd.end_cinema_date(s)
    assert out["verdict"] == "MISMATCH"


# ── HTTP smoke ───────────────────────────────────────────────────────────

def test_http_full_cinema_date_flow() -> None:
    o = client.post("/api/cinema-date/open", json={
        "content_id": "c1", "viewer_a_id": "u1", "license_a_id": "L1",
        "viewer_b_id": "u2", "license_b_id": "L2",
    })
    assert o.status_code == 200
    sid = o.json()["session_id"]

    p = client.post("/api/cinema-date/pulse/schedule", json={
        "session_id": sid, "timestamp_seconds": 600, "question": "Vibing?",
    })
    assert p.status_code == 200
    pid = p.json()["pulse_id"]

    client.post("/api/cinema-date/pulse/vote", json={
        "session_id": sid, "pulse_id": pid, "voter_id": "u1", "vote": "yes",
    })
    client.post("/api/cinema-date/pulse/vote", json={
        "session_id": sid, "pulse_id": pid, "voter_id": "u2", "vote": "yes",
    })

    r = client.post(f"/api/cinema-date/pulse/resolve?session_id={sid}&pulse_id={pid}")
    assert r.status_code == 200
    assert r.json()["outcome"] == "both_yes"

    e = client.post(f"/api/cinema-date/{sid}/end")
    assert e.status_code == 200
    assert e.json()["match_score"] == 1


def test_http_constants() -> None:
    r = client.get("/api/cinema-date/constants")
    assert r.status_code == 200
    body = r.json()
    assert body["pulse_reward_per_viewer"] == 5
