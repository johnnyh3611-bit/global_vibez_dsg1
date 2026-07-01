"""v7.0 Phase 7 — Pricing Tiers + Infra Wallet test sweep."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import app
from services import pricing_tiers as pt


client = TestClient(app)


# ── Pricing constants are the v7 canon ──────────────────────────────────

def test_pricing_tiers_are_locked_v7_values() -> None:
    assert pt.PRICING_TIERS["SINGLE_EPISODE"] == 5.00
    assert pt.PRICING_TIERS["SERIES_BUNDLE"] == 20.00
    assert pt.PRICING_TIERS["VIBE_CLIP"] == 0.50
    assert pt.PRICING_TIERS["MUSIC_TRACK"] == 0.50


# ── Bundle math — Buy 4 Get 1 Free ──────────────────────────────────────

def test_bundle_5_episodes_costs_20() -> None:
    assert pt.bundle_listing_cost("SERIES_BUNDLE", 5) == 20.0


def test_bundle_10_episodes_costs_40() -> None:
    assert pt.bundle_listing_cost("SERIES_BUNDLE", 10) == 40.0


def test_bundle_4_episodes_no_full_bundle_falls_back_to_single() -> None:
    """4 episodes — not enough for the 5-episode bundle. Charge 4 × $5 = $20."""
    assert pt.bundle_listing_cost("SERIES_BUNDLE", 4) == 20.0


def test_bundle_6_episodes_one_bundle_plus_singleton() -> None:
    """5 in a bundle + 1 single = $20 + $5 = $25."""
    assert pt.bundle_listing_cost("SERIES_BUNDLE", 6) == 25.0


def test_single_episode_count_3_costs_15() -> None:
    assert pt.bundle_listing_cost("SINGLE_EPISODE", 3) == 15.0


def test_clip_count_4_costs_2() -> None:
    assert pt.bundle_listing_cost("VIBE_CLIP", 4) == 2.0


def test_unknown_content_type_rejected() -> None:
    with pytest.raises(ValueError):
        pt.bundle_listing_cost("HOLOGRAM", 1)


def test_zero_count_rejected() -> None:
    with pytest.raises(ValueError):
        pt.bundle_listing_cost("VIBE_CLIP", 0)


# ── processUpload (founder pseudocode parity) ────────────────────────────

def test_process_upload_happy_path() -> None:
    creator = pt.CreatorWallet("c1", balance=100.0)
    infra = pt.InfraWallet()
    out = pt.process_upload(creator, infra, "SINGLE_EPISODE", count=3)
    assert out.ok is True
    assert out.status == "UPLOAD_READY"
    assert out.cost == 15.0
    assert out.unlocked_slots == 3
    assert creator.balance == 85.0
    assert infra.balance == 15.0
    assert len(infra.ledger) == 1


def test_process_upload_insufficient_funds_does_not_charge() -> None:
    creator = pt.CreatorWallet("c1", balance=2.0)
    infra = pt.InfraWallet()
    out = pt.process_upload(creator, infra, "SINGLE_EPISODE", count=1)
    assert out.ok is False
    assert out.status == "INSUFFICIENT_FUNDS"
    # Critical invariant: a failed upload MUST NOT debit the creator
    assert creator.balance == 2.0
    # And it MUST NOT add a ledger entry
    assert infra.balance == 0.0


def test_infra_wallet_total_received_aggregates() -> None:
    creator = pt.CreatorWallet("c1", balance=200.0)
    infra = pt.InfraWallet()
    pt.process_upload(creator, infra, "SINGLE_EPISODE", count=2)
    pt.process_upload(creator, infra, "VIBE_CLIP", count=4)
    pt.process_upload(creator, infra, "SERIES_BUNDLE", count=5)
    assert infra.balance == 10.0 + 2.0 + 20.0
    assert infra.total_received() == 32.0
    assert len(infra.ledger) == 3


def test_infra_wallet_per_creator_filter() -> None:
    creator_a = pt.CreatorWallet("a", balance=100.0)
    creator_b = pt.CreatorWallet("b", balance=100.0)
    infra = pt.InfraWallet()
    pt.process_upload(creator_a, infra, "VIBE_CLIP", count=2)
    pt.process_upload(creator_b, infra, "VIBE_CLIP", count=4)
    assert len(infra.transfers_for_creator("a")) == 1
    assert len(infra.transfers_for_creator("b")) == 1


# ── HTTP smoke ───────────────────────────────────────────────────────────

def test_http_get_pricing_tiers() -> None:
    r = client.get("/api/pricing/tiers")
    assert r.status_code == 200
    body = r.json()
    assert body["tiers"]["SINGLE_EPISODE"] == 5.0
    assert body["tiers"]["SERIES_BUNDLE"] == 20.0
    assert body["series_bundle_episode_count"] == 5


def test_http_get_quote_for_bundle() -> None:
    r = client.get("/api/pricing/quote?content_type=SERIES_BUNDLE&count=10")
    assert r.status_code == 200
    assert r.json()["cost_usd"] == 40.0


def test_http_full_upload_flow() -> None:
    # Top up
    client.post("/api/pricing/wallet/deposit", json={
        "creator_id": "test_creator_alpha", "amount": 100.0,
    })
    # Process upload
    r = client.post("/api/pricing/process-upload", json={
        "creator_id": "test_creator_alpha",
        "content_type": "SINGLE_EPISODE",
        "count": 2,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["status"] == "UPLOAD_READY"
    assert body["cost_usd"] == 10.0
    assert body["creator_balance_after"] == 90.0

    # Infra ledger should have it
    led = client.get("/api/pricing/infra/ledger?limit=5")
    assert led.status_code == 200
    found = any(t["creator_id"] == "test_creator_alpha"
                for t in led.json()["ledger"])
    assert found, "creator's transfer not in infra ledger"


def test_http_insufficient_funds() -> None:
    # Brand-new creator with $0 balance
    r = client.post("/api/pricing/process-upload", json={
        "creator_id": "broke_creator", "content_type": "SINGLE_EPISODE", "count": 1,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert body["status"] == "INSUFFICIENT_FUNDS"
