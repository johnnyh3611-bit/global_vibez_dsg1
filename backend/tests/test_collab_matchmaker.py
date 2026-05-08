"""Collab Matchmaker — Phase 2 test sweep."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import app
from services import collab_matchmaker as cm
from services.apex_sovereign import ArtistProfile


client = TestClient(app)


# ── Candidate ranking ────────────────────────────────────────────────────

def _seed_pool() -> list:
    return [
        ArtistProfile("p1", flow_speed=0.7, tempo_bpm=140, genre="trap"),
        ArtistProfile("p2", flow_speed=0.65, tempo_bpm=138, genre="drill"),
        ArtistProfile("p3", flow_speed=0.4, tempo_bpm=90, genre="rnb"),
        ArtistProfile("p4", flow_speed=0.2, tempo_bpm=60, genre="country"),
        ArtistProfile("p5", flow_speed=0.5, tempo_bpm=120, genre="pop"),
        ArtistProfile("p6", flow_speed=0.7, tempo_bpm=140, genre="trap"),
    ]


def test_rank_returns_top_n_sorted_desc() -> None:
    seeker = ArtistProfile("seek", flow_speed=0.7, tempo_bpm=140, genre="trap")
    pool = _seed_pool()
    out = cm.rank_collab_candidates(seeker, pool, top_n=3)
    assert len(out) == 3
    scores = [c.synergy_score for c in out]
    assert scores == sorted(scores, reverse=True)
    # The two trap candidates (p1, p6) at 140 BPM 0.7 flow should both be 100
    assert out[0].synergy_score == 100.0


def test_rank_excludes_seeker() -> None:
    seeker = ArtistProfile("p1", flow_speed=0.7, tempo_bpm=140, genre="trap")
    out = cm.rank_collab_candidates(seeker, _seed_pool())
    user_ids = [c.artist.user_id for c in out]
    assert "p1" not in user_ids


def test_rank_handles_empty_pool() -> None:
    seeker = ArtistProfile("seek", flow_speed=0.5, tempo_bpm=120, genre="pop")
    assert cm.rank_collab_candidates(seeker, []) == []


# ── Duo Up voting ────────────────────────────────────────────────────────

def test_duo_up_session_lifecycle() -> None:
    seeker = ArtistProfile("seek", flow_speed=0.7, tempo_bpm=140, genre="trap")
    session = cm.open_duo_up_session(seeker, _seed_pool())
    assert session.status == "voting"
    assert len(session.candidates) > 0

    # Vote for the first candidate from 3 fans
    target = session.candidates[0].artist.user_id
    other = session.candidates[1].artist.user_id
    for fan in ("fan1", "fan2", "fan3"):
        cm.cast_duo_up_vote(session, fan, target)
    cm.cast_duo_up_vote(session, "fan4", other)

    counts = session.vote_counts()
    assert counts[target] == 3
    assert counts[other] == 1

    out = cm.resolve_duo_up_session(session)
    assert out["winner_user_id"] == target
    assert out["verdict"] == "vote_winner"


def test_duo_up_double_vote_rejected() -> None:
    seeker = ArtistProfile("seek", flow_speed=0.7, tempo_bpm=140, genre="trap")
    session = cm.open_duo_up_session(seeker, _seed_pool())
    target = session.candidates[0].artist.user_id
    cm.cast_duo_up_vote(session, "fan1", target)
    with pytest.raises(ValueError):
        cm.cast_duo_up_vote(session, "fan1", target)


def test_duo_up_no_votes_falls_back_to_top_synergy() -> None:
    seeker = ArtistProfile("seek", flow_speed=0.7, tempo_bpm=140, genre="trap")
    session = cm.open_duo_up_session(seeker, _seed_pool())
    out = cm.resolve_duo_up_session(session)
    assert out["verdict"] == "default_top_synergy"
    assert out["winner_user_id"] == session.candidates[0].artist.user_id


# ── Collab Studio ────────────────────────────────────────────────────────

def test_provision_studio_apex_quality_flag() -> None:
    a = ArtistProfile("a", flow_speed=0.7, tempo_bpm=140, genre="trap")
    b = ArtistProfile("b", flow_speed=0.7, tempo_bpm=140, genre="trap")
    studio = cm.provision_collab_studio(a, b)
    assert studio.is_apex_quality is True
    assert studio.synergy_score == 100.0
    assert len(studio.invite_code) == 6


def test_provision_studio_self_rejected() -> None:
    a = ArtistProfile("a", flow_speed=0.5, tempo_bpm=120, genre="pop")
    with pytest.raises(ValueError):
        cm.provision_collab_studio(a, a)


def test_studio_ttl_14_days() -> None:
    assert cm.COLLAB_STUDIO_TTL_DAYS == 14


# ── HTTP smoke ───────────────────────────────────────────────────────────

def test_http_collab_rank_endpoint() -> None:
    r = client.post("/api/collab/rank", json={
        "seeker": {"user_id": "seek", "flow_speed": 0.7, "tempo_bpm": 140, "genre": "trap"},
        "pool": [
            {"user_id": "p1", "flow_speed": 0.7, "tempo_bpm": 140, "genre": "trap"},
            {"user_id": "p2", "flow_speed": 0.2, "tempo_bpm": 60, "genre": "country"},
        ],
        "top_n": 2,
    })
    assert r.status_code == 200
    body = r.json()
    assert len(body["candidates"]) == 2
    assert body["candidates"][0]["user_id"] == "p1"
    assert body["candidates"][0]["synergy_score"] >= body["candidates"][1]["synergy_score"]


def test_http_duo_up_full_flow() -> None:
    open_r = client.post("/api/collab/duo-up/open", json={
        "seeker": {"user_id": "s", "flow_speed": 0.7, "tempo_bpm": 140, "genre": "trap"},
        "pool": [
            {"user_id": "x", "flow_speed": 0.7, "tempo_bpm": 140, "genre": "trap"},
            {"user_id": "y", "flow_speed": 0.4, "tempo_bpm": 90, "genre": "rnb"},
        ],
    })
    assert open_r.status_code == 200
    sid = open_r.json()["session_id"]

    vote_r = client.post("/api/collab/duo-up/vote", json={
        "session_id": sid, "voter_id": "f1", "candidate_user_id": "x",
    })
    assert vote_r.status_code == 200

    res_r = client.post(f"/api/collab/duo-up/resolve?session_id={sid}")
    assert res_r.status_code == 200
    assert res_r.json()["winner_user_id"] == "x"


def test_http_studio_provision() -> None:
    r = client.post("/api/collab/studio/provision", json={
        "artist_a": {"user_id": "a", "flow_speed": 0.7, "tempo_bpm": 140, "genre": "trap"},
        "artist_b": {"user_id": "b", "flow_speed": 0.7, "tempo_bpm": 140, "genre": "trap"},
    })
    assert r.status_code == 200
    body = r.json()
    assert body["is_apex_quality"] is True
    assert body["synergy_score"] == 100.0


def test_http_studio_ttl() -> None:
    r = client.get("/api/collab/studio/ttl-days")
    assert r.status_code == 200
    assert r.json()["ttl_days"] == 14
