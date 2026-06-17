"""v7.0 Phase 8 — Beat Auctions test sweep."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from server import app
from services import beat_auctions as ba


client = TestClient(app)


# ── Engine: open / bid / settle ─────────────────────────────────────────

def test_open_auction_basic() -> None:
    a = ba.open_auction(beat_id="beat1", producer_id="prod", reserve_price=50.0, window_hours=24)
    assert a.status == "live"
    assert a.is_open() is True


def test_open_auction_zero_reserve_rejected() -> None:
    with pytest.raises(ValueError):
        ba.open_auction("b", "p", reserve_price=0)


def test_producer_cannot_bid_own_beat() -> None:
    a = ba.open_auction("b", "prod", 10.0)
    with pytest.raises(ValueError):
        ba.submit_sealed_bid(a, "prod", 100.0)


def test_settle_with_no_bids_voids() -> None:
    a = ba.open_auction("b", "p", 10.0)
    out = ba.settle_auction(a)
    assert out["status"] == "voided"
    assert out["reason"] == "no_qualifying_bids"
    assert out["fallback_action"] == "return_to_beat_vault"


def test_settle_below_reserve_voids() -> None:
    a = ba.open_auction("b", "prod", reserve_price=100.0)
    ba.submit_sealed_bid(a, "u1", 50.0)
    ba.submit_sealed_bid(a, "u2", 75.0)
    out = ba.settle_auction(a)
    assert out["status"] == "voided"


def test_settle_picks_highest_bid_70_30() -> None:
    a = ba.open_auction("b", "prod", reserve_price=10.0)
    ba.submit_sealed_bid(a, "u1", 50.0)
    ba.submit_sealed_bid(a, "u2", 100.0)   # winner
    ba.submit_sealed_bid(a, "u3", 75.0)
    out = ba.settle_auction(a)
    assert out["status"] == "settled"
    assert out["winner_id"] == "u2"
    assert out["winning_amount"] == 100.0
    assert out["producer_payout"] == 70.0
    assert out["platform_share"] == 30.0
    assert out["sovereign_tax"] > 0


def test_settle_tie_picks_earliest_bid() -> None:
    a = ba.open_auction("b", "prod", reserve_price=10.0)
    ba.submit_sealed_bid(a, "u1", 100.0)   # earliest at this amount
    ba.submit_sealed_bid(a, "u2", 100.0)
    out = ba.settle_auction(a)
    assert out["winner_id"] == "u1"


def test_double_settle_rejected() -> None:
    a = ba.open_auction("b", "p", 10.0)
    ba.settle_auction(a)
    with pytest.raises(ValueError):
        ba.settle_auction(a)


def test_public_view_hides_individual_bids() -> None:
    a = ba.open_auction("b", "prod", 10.0)
    ba.submit_sealed_bid(a, "u1", 50.0)
    view = ba.public_view(a)
    assert "bid_count" in view
    # Critical sealed-bid invariant — never expose bid amounts pre-settle
    serialized = str(view)
    assert "50.0" not in serialized or "amount" not in serialized.lower()


# ── HTTP smoke ───────────────────────────────────────────────────────────

def test_http_full_auction_flow() -> None:
    o = client.post("/api/auctions/open", json={
        "beat_id": "beat_alpha", "producer_id": "prod_x",
        "reserve_price": 25.0, "window_hours": 48,
    })
    assert o.status_code == 200
    aid = o.json()["auction_id"]

    # Open should publicly say it's open and zero bids
    g = client.get(f"/api/auctions/{aid}")
    assert g.status_code == 200
    assert g.json()["bid_count"] == 0

    # Submit two bids
    b1 = client.post("/api/auctions/bid", json={
        "auction_id": aid, "bidder_id": "artist1", "amount": 30.0,
    })
    assert b1.status_code == 200
    # Sealed-bid invariant — response must NOT contain the amount
    assert "amount" not in b1.json()

    client.post("/api/auctions/bid", json={
        "auction_id": aid, "bidder_id": "artist2", "amount": 80.0,
    })

    # Settle
    s = client.post(f"/api/auctions/settle?auction_id={aid}")
    assert s.status_code == 200
    body = s.json()
    assert body["winner_id"] == "artist2"
    assert body["producer_payout"] == 56.0   # 80 × 0.70

    # Double-settle returns 400
    s2 = client.post(f"/api/auctions/settle?auction_id={aid}")
    assert s2.status_code == 400


def test_http_constants() -> None:
    r = client.get("/api/auctions/constants/splits")
    assert r.status_code == 200
    assert r.json()["producer_share"] == 0.70
    assert r.json()["platform_share"] == 0.30


def test_http_producer_self_bid_rejected() -> None:
    o = client.post("/api/auctions/open", json={
        "beat_id": "beat_self", "producer_id": "self_prod", "reserve_price": 10.0,
    })
    aid = o.json()["auction_id"]
    r = client.post("/api/auctions/bid", json={
        "auction_id": aid, "bidder_id": "self_prod", "amount": 50.0,
    })
    assert r.status_code == 400
