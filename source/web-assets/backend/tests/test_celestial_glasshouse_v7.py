"""v7.0 Phase 9 — Celestial Glasshouse Arena tests."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import app
from services import celestial_glasshouse as cg


client = TestClient(app)


# ── Arena access gate ────────────────────────────────────────────────────

def test_arena_basic_user_blocked() -> None:
    out = cg.can_enter_arena(artist_rank=None, chair_count=0)
    assert out["can_enter"] is False
    assert out["arena_seat_class"] == "STREET"


def test_arena_legend_admitted_as_legend() -> None:
    out = cg.can_enter_arena(artist_rank="LEGEND", chair_count=0)
    assert out["can_enter"] is True
    assert out["arena_seat_class"] == "LEGEND"


def test_arena_sovereign_admitted_as_sovereign() -> None:
    out = cg.can_enter_arena(artist_rank=None, chair_count=150)
    assert out["can_enter"] is True
    assert out["arena_seat_class"] == "SOVEREIGN"


def test_arena_apex_admitted_as_headliner() -> None:
    out = cg.can_enter_arena(artist_rank="LEGEND", chair_count=200)
    assert out["can_enter"] is True
    assert out["arena_seat_class"] == "HEADLINER"


# ── Power Couple ─────────────────────────────────────────────────────────

def test_power_couple_requires_apex_both_sides() -> None:
    with pytest.raises(ValueError):
        cg.declare_power_couple(
            "a", "b", "LEGEND", 50, "LEGEND", 0,   # b not Apex (no chairs)
            shared_collab_studio_ids=["s1"],
        )


def test_power_couple_requires_shared_studios() -> None:
    with pytest.raises(ValueError):
        cg.declare_power_couple(
            "a", "b", "LEGEND", 200, "LEGEND", 200,
            shared_collab_studio_ids=[],
        )


def test_power_couple_self_rejected() -> None:
    with pytest.raises(ValueError):
        cg.declare_power_couple(
            "a", "a", "LEGEND", 200, "LEGEND", 200,
            shared_collab_studio_ids=["s1"],
        )


def test_power_couple_happy_path() -> None:
    pc = cg.declare_power_couple(
        "a", "b", "LEGEND", 200, "LEGEND", 200,
        shared_collab_studio_ids=["s1", "s2"],
    )
    assert pc.is_active is True
    assert "a" in pc.members() and "b" in pc.members()


def test_power_couple_bonus_applied_to_member() -> None:
    pc = cg.declare_power_couple(
        "a", "b", "LEGEND", 200, "LEGEND", 200,
        shared_collab_studio_ids=["s1"],
    )
    out = cg.power_couple_bonus_payout(base_payout=100.0, winner_id="a", couple=pc)
    assert out == 110.0   # +10%


def test_power_couple_bonus_not_applied_to_outsider() -> None:
    pc = cg.declare_power_couple(
        "a", "b", "LEGEND", 200, "LEGEND", 200,
        shared_collab_studio_ids=["s1"],
    )
    out = cg.power_couple_bonus_payout(base_payout=100.0, winner_id="stranger", couple=pc)
    assert out == 100.0


def test_power_couple_bonus_no_couple_no_change() -> None:
    out = cg.power_couple_bonus_payout(base_payout=50.0, winner_id="a", couple=None)
    assert out == 50.0


# ── Headliner slots ──────────────────────────────────────────────────────

def test_headliner_book_within_range() -> None:
    pc = cg.declare_power_couple(
        "a", "b", "LEGEND", 200, "LEGEND", 200,
        shared_collab_studio_ids=["s1"],
    )
    booking = cg.book_headliner_slot(pc, 2, "2026-05-04", existing_bookings=[])
    assert booking.slot_index == 2


def test_headliner_double_booking_rejected() -> None:
    pc = cg.declare_power_couple(
        "a", "b", "LEGEND", 200, "LEGEND", 200,
        shared_collab_studio_ids=["s1"],
    )
    first = cg.book_headliner_slot(pc, 0, "2026-05-04", existing_bookings=[])
    with pytest.raises(ValueError):
        cg.book_headliner_slot(pc, 0, "2026-05-04", existing_bookings=[first])


def test_headliner_slot_index_out_of_range() -> None:
    pc = cg.declare_power_couple(
        "a", "b", "LEGEND", 200, "LEGEND", 200,
        shared_collab_studio_ids=["s1"],
    )
    with pytest.raises(ValueError):
        cg.book_headliner_slot(pc, 99, "2026-05-04", existing_bookings=[])


# ── HTTP smoke ───────────────────────────────────────────────────────────

def test_http_arena_access_check() -> None:
    r = client.post("/api/arena/access-check", json={"artist_rank": "LEGEND", "chair_count": 200})
    assert r.status_code == 200
    body = r.json()
    assert body["can_enter"] is True
    assert body["arena_seat_class"] == "HEADLINER"


def test_http_power_couple_full_flow() -> None:
    d = client.post("/api/arena/power-couple/declare", json={
        "artist_a_id": "alice", "artist_b_id": "bob",
        "artist_a_rank": "LEGEND", "artist_a_chairs": 200,
        "artist_b_rank": "LEGEND", "artist_b_chairs": 200,
        "shared_collab_studio_ids": ["studio_alpha", "studio_beta"],
    })
    assert d.status_code == 200
    cid = d.json()["couple_id"]

    # Bonus payout
    b = client.post("/api/arena/power-couple/bonus", json={
        "base_payout": 200.0, "winner_id": "alice", "couple_id": cid,
    })
    assert b.status_code == 200
    assert b.json()["final_payout"] == 220.0
    assert b.json()["bonus_applied"] is True

    # Headliner book
    book = client.post("/api/arena/headliner/book", json={
        "couple_id": cid, "slot_index": 1, "booked_for_date": "2026-05-04",
    })
    assert book.status_code == 200

    # Schedule view
    sched = client.get("/api/arena/headliner/schedule?date=2026-05-04")
    assert sched.status_code == 200
    assert sched.json()["count"] >= 1


def test_http_constants() -> None:
    r = client.get("/api/arena/constants")
    assert r.status_code == 200
    body = r.json()
    assert body["power_couple_auction_bonus"] == 0.10
    assert body["headliner_slots_per_day"] == 4
