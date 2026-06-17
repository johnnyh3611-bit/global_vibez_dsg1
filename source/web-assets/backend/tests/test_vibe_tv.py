"""Vibe TV Continuity — Phase 6 test sweep."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from server import app
from services import vibe_tv as tv


client = TestClient(app)


# ── Listing fee ──────────────────────────────────────────────────────────

def test_listing_fee_30min_block() -> None:
    assert tv.compute_listing_fee(30) == 5.0


def test_listing_fee_60min_two_blocks() -> None:
    assert tv.compute_listing_fee(60) == 10.0


def test_listing_fee_45min_rounds_up_to_two_blocks() -> None:
    assert tv.compute_listing_fee(45) == 10.0


def test_listing_fee_zero_rejected() -> None:
    with pytest.raises(ValueError):
        tv.compute_listing_fee(0)


# ── Schedule generation ─────────────────────────────────────────────────

def test_schedule_alternates_episodes_and_ads() -> None:
    eps = [tv.TVEpisode(episode_id=f"e{i}", creator_id="c", title=f"Ep{i}",
                         duration_minutes=30, genre="drama",
                         listing_fee_paid=5.0) for i in range(3)]
    out = tv.generate_schedule(eps, datetime(2026, 5, 4, tzinfo=timezone.utc),
                                duration_hours=4)
    kinds = [s.kind for s in out]
    # Pattern: ep, ep, ad, ep, ep, ad, ...
    assert kinds[0] == "episode"
    assert kinds[1] == "episode"
    assert kinds[2] == "ad"


def test_schedule_empty_episodes_rejected() -> None:
    with pytest.raises(ValueError):
        tv.generate_schedule([], datetime.now(timezone.utc))


# ── Ad selection (zip targeting) ────────────────────────────────────────

def test_ad_zip_targeting_picks_local() -> None:
    local_ad = tv.TVAd(ad_id="a1", advertiser_id="adv1", title="Local Pizza",
                        target_zip_codes=["10001"])
    national_ad = tv.TVAd(ad_id="a2", advertiser_id="adv2", title="National Cola",
                           target_zip_codes=[])
    # rng_seed=1 puts random.random() at ~0.13 < 0.70, so local picked
    out = tv.select_ad_for_viewer([local_ad, national_ad], viewer_zip="10001", rng_seed=1)
    assert out is not None and out.ad_id == "a1"


def test_ad_no_match_returns_none() -> None:
    out = tv.select_ad_for_viewer([], viewer_zip=None)
    assert out is None


def test_ad_local_fallback_to_national_when_zip_unmatched() -> None:
    national = tv.TVAd(ad_id="n1", advertiser_id="x", title="National", target_zip_codes=[])
    out = tv.select_ad_for_viewer([national], viewer_zip="99999", rng_seed=42)
    assert out is not None and out.ad_id == "n1"


def test_inject_ads_replaces_placeholders() -> None:
    ad = tv.TVAd(ad_id="a1", advertiser_id="adv", title="Test Ad", target_zip_codes=[])
    schedule = [
        tv.TVSlot(slot_id="s1", kind="episode", payload_id="ep1", title="Ep",
                   starts_at="now", duration_seconds=1800),
        tv.TVSlot(slot_id="s2", kind="ad", payload_id="<TBD>", title="<AI>",
                   starts_at="later", duration_seconds=60),
    ]
    out = tv.inject_ads(schedule, [ad], viewer_zip=None)
    assert len(out) == 2
    assert out[1].payload_id == "a1"
    assert out[1].title == "Test Ad"


def test_inject_ads_skips_when_no_ads_available() -> None:
    schedule = [
        tv.TVSlot(slot_id="s1", kind="episode", payload_id="ep1", title="Ep",
                   starts_at="now", duration_seconds=1800),
        tv.TVSlot(slot_id="s2", kind="ad", payload_id="<TBD>", title="<AI>",
                   starts_at="later", duration_seconds=60),
    ]
    out = tv.inject_ads(schedule, [], viewer_zip=None)
    assert len(out) == 1   # ad slot dropped (no dead air)


# ── HTTP smoke ───────────────────────────────────────────────────────────

def test_http_publish_episode_returns_listing_fee() -> None:
    r = client.post("/api/vibe-tv/episodes/publish", json={
        "creator_id": "c1", "title": "Test Show",
        "duration_minutes": 60, "genre": "drama",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["listing_fee_paid"] == 10.0
    assert body["duration_seconds"] == 3600


def test_http_listing_fee_calc_endpoint() -> None:
    r = client.get("/api/vibe-tv/listing-fee?duration_minutes=90")
    assert r.status_code == 200
    assert r.json()["fee_usd"] == 15.0


def test_http_schedule_endpoint() -> None:
    # Need at least one active episode
    client.post("/api/vibe-tv/episodes/publish", json={
        "creator_id": "c1", "title": "Show A",
        "duration_minutes": 30, "genre": "drama",
    })
    r = client.get("/api/vibe-tv/schedule?hours=2")
    assert r.status_code == 200
    body = r.json()
    assert body["slot_count"] >= 2
    assert all("starts_at" in s for s in body["slots"])


def test_http_constants() -> None:
    r = client.get("/api/vibe-tv/constants")
    assert r.status_code == 200
    body = r.json()
    assert body["episode_listing_fee_per_30m"] == 5.0
    assert body["ad_slot_duration_seconds"] == 60
