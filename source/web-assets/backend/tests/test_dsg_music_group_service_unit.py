"""Service-level unit tests for dsg_music_group — verifies the math
contract (burn=0, share sum reconciliation, bps invariant) directly
against the service functions with a fresh in-collection state."""
from __future__ import annotations

import asyncio
import os
import pytest

import sys
sys.path.insert(0, "/home/johnnie/master-project")

from dotenv import load_dotenv  # noqa: E402
load_dotenv("/home/johnnie/master-project/.env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from services.dsg_music_group import (  # noqa: E402
    set_track_rights, set_collaborator_splits,
    disburse_collective_royalty, BPS_TOTAL,
)


@pytest.fixture
def db():
    url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    assert url and db_name, "MONGO_URL / DB_NAME must be set"
    client = AsyncIOMotorClient(url)
    return client[db_name]


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture
def seeded_track(db):
    async def _seed():
        track_id = "test_mg_track_001"
        owner_id = "test_mg_owner_001"
        await db.dsg_tracks.update_one(
            {"track_id": track_id},
            {"$set": {"track_id": track_id, "artist_id": owner_id,
                      "title": "Test Track"}},
            upsert=True,
        )
        return track_id, owner_id

    tid, oid = _run(_seed())
    yield tid, oid

    async def _cleanup():
        await db.dsg_tracks.delete_one({"track_id": tid})
        await db.tracks_rights_ledger.delete_one({"track_id": tid})
        await db.collaborator_splits.delete_many({"track_id": tid})
        await db.music_royalty_payouts.delete_many({"track_id": tid})

    _run(_cleanup())


def test_rights_set_and_get_owner(db, seeded_track):
    track_id, owner_id = seeded_track
    res = _run(set_track_rights(
        db, track_id=track_id, owner_id=owner_id,
        allow_tv_sync=True, allow_casino_background=False,
        allow_commercial_use=True,
    ))
    assert res["ok"] is True
    assert res["allow_tv_sync"] is True
    assert res["allow_commercial_use"] is True


def test_splits_invariant_must_sum_to_10000(db, seeded_track):
    track_id, owner_id = seeded_track
    bad = _run(set_collaborator_splits(
        db, track_id=track_id, owner_id=owner_id,
        splits=[{"user_id": "a", "basis_points": 5000},
                {"user_id": "b", "basis_points": 4000}],  # 9000
    ))
    assert bad["ok"] is False
    assert bad["reason"] == "invalid_basis_points_split"

    good = _run(set_collaborator_splits(
        db, track_id=track_id, owner_id=owner_id,
        splits=[{"user_id": "a", "basis_points": 6000},
                {"user_id": "b", "basis_points": 4000}],  # 10000
    ))
    assert good["ok"] is True
    assert good["total_basis_points"] == BPS_TOTAL


def test_disburse_reconciles_burn_zero_and_share_sum(db, seeded_track):
    track_id, owner_id = seeded_track
    # 60/40 split
    _run(set_collaborator_splits(
        db, track_id=track_id, owner_id=owner_id,
        splits=[{"user_id": "alpha", "basis_points": 6000, "role": "primary"},
                {"user_id": "beta", "basis_points": 4000, "role": "producer"}],
    ))

    res = _run(disburse_collective_royalty(
        db, track_id=track_id, payout_coins=1000,
        source="test_unit",
    ))
    assert res["ok"] is True
    # share sums equals total payout exactly
    total = sum(int(p["share_coins"]) for p in res["payouts"])
    assert total == 1000

    async def _check_burn():
        row = await db.music_royalty_payouts.find_one(
            {"payout_id": res["payout_id"]}, {"_id": 0},
        )
        return row

    row = _run(_check_burn())
    assert row is not None
    assert row["burn_coins"] == 0  # CRITICAL hard rule
    # per-collaborator share_coins sum equals payout_coins
    assert sum(int(p["share_coins"]) for p in row["payouts"]) == row["payout_coins"]


def test_disburse_with_rounding_remainder(db, seeded_track):
    track_id, owner_id = seeded_track
    # 7/3 split with payout that doesn't divide evenly
    _run(set_collaborator_splits(
        db, track_id=track_id, owner_id=owner_id,
        splits=[{"user_id": "alpha", "basis_points": 7000},
                {"user_id": "beta", "basis_points": 3000}],
    ))
    res = _run(disburse_collective_royalty(
        db, track_id=track_id, payout_coins=999, source="test_unit",
    ))
    assert res["ok"] is True
    # ensure remainder is absorbed -> sum equals exactly 999
    total = sum(int(p["share_coins"]) for p in res["payouts"])
    assert total == 999
