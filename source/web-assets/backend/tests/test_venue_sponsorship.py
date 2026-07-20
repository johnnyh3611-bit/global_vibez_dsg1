"""Venue Partnership / Sponsored Vibez Spots — unit + API smoke."""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo import MongoClient

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "global_vibez")


def test_tier_catalog():
    from services.venue_sponsorship import resolve_tier, tier_catalog

    tiers = tier_catalog()
    assert {t["id"] for t in tiers} == {"spotlight", "partner", "flagship"}
    partner = resolve_tier("partner")
    assert partner["usd_month"] == 99.0
    assert partner["platform_commission_bps"] == 800
    with pytest.raises(ValueError):
        resolve_tier("nope")


def test_commission_math_and_carousel(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")

    from utils.database import initialize_database
    from services import venue_sponsorship as vs
    import importlib
    import routes.venue_sponsorship as route

    initialize_database(os.environ["MONGO_URL"], os.environ["DB_NAME"])
    importlib.reload(route)

    app = FastAPI()
    app.include_router(route.router, prefix="/api")

    sync = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    spot_id = f"spot_test_{uuid.uuid4().hex[:8]}"
    sync.venue_sponsored_spots.delete_many({"spot_id": spot_id})
    sync.venue_sponsored_spots.insert_one(
        {
            "spot_id": spot_id,
            "venue_name": "Pytest Lounge",
            "tier_id": "partner",
            "tier_label": "Partner",
            "status": "active",
            "carousel_weight": 25,
            "platform_commission_bps": 800,
            "conversions": 0,
            "commission_vibe_total": 0,
            "expires_at": vs.expires_in_days(30),
            "activated_at": vs.utc_now_iso(),
        }
    )

    with TestClient(app) as client:
        r = client.get("/api/venue-sponsorship/tiers")
        assert r.status_code == 200
        assert len(r.json()["tiers"]) == 3

        r2 = client.get("/api/venue-sponsorship/carousel?limit=20")
        assert r2.status_code == 200
        ids = {s["spot_id"] for s in r2.json()["spots"]}
        assert spot_id in ids

    # Sync path: simulate ledger write the service would make (800 bps of 10k)
    amount = 10_000
    bps = 800
    commission = int(round(amount * bps / 10_000))
    assert commission == 800
    sync.venue_sponsored_spots.update_one(
        {"spot_id": spot_id},
        {"$inc": {"conversions": 1, "commission_vibe_total": commission}},
    )
    updated = sync.venue_sponsored_spots.find_one({"spot_id": spot_id}, {"_id": 0})
    assert updated["conversions"] == 1
    assert updated["commission_vibe_total"] == 800
