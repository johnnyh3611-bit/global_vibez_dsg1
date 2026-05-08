"""Apex Sovereign Layer — full v6.5 Phase 1 test sweep."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import app
from services import apex_sovereign as eng


client = TestClient(app)


# ── Synergy scoring ───────────────────────────────────────────────────────

def test_synergy_perfect_match() -> None:
    a = eng.ArtistProfile("u1", flow_speed=0.7, tempo_bpm=140, genre="trap")
    b = eng.ArtistProfile("u2", flow_speed=0.7, tempo_bpm=140, genre="trap")
    out = eng.compute_synergy_score(a, b)
    assert out["synergy_score"] == 100.0
    assert out["verdict"] == "ELITE_DUO"


def test_synergy_self_match_rejected() -> None:
    a = eng.ArtistProfile("u1", flow_speed=0.5, tempo_bpm=120, genre="rnb")
    with pytest.raises(ValueError):
        eng.compute_synergy_score(a, a)


def test_synergy_cross_genre_drop() -> None:
    a = eng.ArtistProfile("u1", flow_speed=0.9, tempo_bpm=180, genre="trap")
    b = eng.ArtistProfile("u2", flow_speed=0.1, tempo_bpm=60, genre="country")
    out = eng.compute_synergy_score(a, b)
    assert out["synergy_score"] < 60
    assert out["verdict"] == "MISMATCH"


def test_http_synergy_endpoint() -> None:
    r = client.post("/api/apex/synergy", json={
        "a": {"user_id": "a", "flow_speed": 0.6, "tempo_bpm": 140, "genre": "trap"},
        "b": {"user_id": "b", "flow_speed": 0.6, "tempo_bpm": 138, "genre": "drill"},
    })
    assert r.status_code == 200
    body = r.json()
    assert "synergy_score" in body
    assert body["synergy_score"] >= 80


# ── AI Oracle ─────────────────────────────────────────────────────────────

def test_oracle_default_is_strategy_coach() -> None:
    out = eng.oracle_select_state({})
    assert out["state"] == "strategy_coach"
    assert out["is_red_protocol"] is False


def test_oracle_panic_button_flips_to_guardian() -> None:
    out = eng.oracle_select_state({"panic_button_pressed": True})
    assert out["state"] == "safety_guardian"
    assert out["trigger"] == "panic_button_pressed"
    assert out["is_red_protocol"] is True


def test_oracle_priority_order() -> None:
    """Panic button beats harassment keyword (it's higher in the priority list)."""
    out = eng.oracle_select_state({
        "harassment_keyword": True, "panic_button_pressed": True,
    })
    assert out["trigger"] == "panic_button_pressed"


def test_red_protocol_alert_severity() -> None:
    alert = eng.build_red_protocol_alert("u1", "panic_button_pressed", "10001")
    assert alert.severity == "CRITICAL"
    d = alert.to_dict()
    assert d["user_id"] == "u1"
    assert d["location"] == "10001"


def test_http_oracle_state_endpoint() -> None:
    r = client.post("/api/apex/oracle-state", json={"context": {"geo_fence_violation": True}})
    assert r.status_code == 200
    assert r.json()["state"] == "safety_guardian"
    assert r.json()["trigger"] == "geo_fence_violation"


# ── Pulse Polling ─────────────────────────────────────────────────────────

def test_pulse_poll_full_lifecycle_via_http() -> None:
    # Create
    r1 = client.post("/api/apex/pulse-poll/create", json={
        "stream_id": "stream_1", "question": "Did the freestyle hit?",
    })
    assert r1.status_code == 200
    poll_id = r1.json()["poll_id"]

    # 3 votes yes, 1 vote no
    for v, who in [("yes", "u1"), ("yes", "u2"), ("yes", "u3"), ("no", "u4")]:
        r = client.post("/api/apex/pulse-poll/vote", json={
            "poll_id": poll_id, "voter_id": who, "vote": v,
        })
        assert r.status_code == 200

    # Cannot double-vote
    r_dup = client.post("/api/apex/pulse-poll/vote", json={
        "poll_id": poll_id, "voter_id": "u1", "vote": "no",
    })
    assert r_dup.status_code == 400

    # Resolve
    r2 = client.post(f"/api/apex/pulse-poll/resolve?poll_id={poll_id}")
    assert r2.status_code == 200
    body = r2.json()
    assert body["winning_side"] == "yes"
    assert body["reward_per_voter"] == 5
    assert body["total_reward_paid"] == 15
    assert set(body["winners"]) == {"u1", "u2", "u3"}


def test_pulse_poll_tie_no_reward() -> None:
    poll = eng.PulsePoll(poll_id="p1", stream_id="s1", question="?")
    eng.cast_pulse_vote(poll, "u1", "yes")
    eng.cast_pulse_vote(poll, "u2", "no")
    out = eng.resolve_pulse_poll(poll)
    assert out["tie"] is True
    assert out["reward_per_voter"] == 0


def test_pulse_poll_404_on_missing() -> None:
    r = client.post("/api/apex/pulse-poll/vote", json={
        "poll_id": "nope", "voter_id": "u1", "vote": "yes",
    })
    assert r.status_code == 404


# ── Apex Factor VIP Gate ──────────────────────────────────────────────────

def test_vip_tier_basic() -> None:
    out = eng.compute_vip_tier(artist_rank=None, chair_count=0)
    assert out["tier"] == "basic"
    assert out["celestial_glasshouse_access"] is False


def test_vip_tier_vibe_legend() -> None:
    out = eng.compute_vip_tier(artist_rank="LEGEND", chair_count=5)
    assert out["tier"] == "vibe_legend"
    assert out["holographic_crown"] is True
    assert out["global_broadcast_eligible"] is False


def test_vip_tier_vibe_sovereign() -> None:
    out = eng.compute_vip_tier(artist_rank="ROOKIE", chair_count=150)
    assert out["tier"] == "vibe_sovereign"
    assert out["holographic_crown"] is False


def test_vip_tier_apex_dual() -> None:
    out = eng.compute_vip_tier(artist_rank="LEGEND", chair_count=200)
    assert out["tier"] == "apex"
    assert out["global_broadcast_eligible"] is True
    assert out["holographic_crown"] is True


def test_http_vip_tier_endpoint() -> None:
    r = client.post("/api/apex/vip-tier", json={"artist_rank": "LEGEND", "chair_count": 150})
    assert r.status_code == 200
    assert r.json()["tier"] == "apex"


def test_http_vip_thresholds_endpoint() -> None:
    r = client.get("/api/apex/vip-thresholds")
    assert r.status_code == 200
    body = r.json()
    assert body["sovereign_min_chairs"] == 100
    assert body["legend_rank_threshold"] == "LEGEND"
