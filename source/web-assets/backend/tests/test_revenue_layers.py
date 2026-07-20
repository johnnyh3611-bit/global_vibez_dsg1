"""Catalog smoke tests for gamification / engagement / VIP layers."""
from __future__ import annotations


def test_live_event_catalog():
    from services.vibe_live_events import EVENT_CATALOG, REWARDED_ACTIONS, event_window

    assert "weekly_top_vibe" in EVENT_CATALOG
    assert "grand_dsg_sweepstakes" in EVENT_CATALOG
    assert EVENT_CATALOG["weekly_top_vibe"]["entry_coins"] == 250
    assert "invite_friend" in REWARDED_ACTIONS
    window = event_window(EVENT_CATALOG["weekly_top_vibe"])
    assert "starts_at" in window and "ends_at" in window


def test_personalize_packs_and_vip_tables():
    from routes.stream_engagement import PERSONALIZE_PACKS
    from routes.revenue_intelligence import VIP_TABLES

    assert PERSONALIZE_PACKS["basic"]["coins"] == 200
    assert PERSONALIZE_PACKS["flagship"]["coins"] == 2000
    assert "vip_spades_high" in VIP_TABLES
    assert VIP_TABLES["vip_venue_preferred"]["requires_founding_or_vip"] is True


def test_sponsorship_tiers_still_present():
    from services.venue_sponsorship import SPONSORSHIP_TIERS

    assert set(SPONSORSHIP_TIERS) == {"spotlight", "partner", "flagship"}
