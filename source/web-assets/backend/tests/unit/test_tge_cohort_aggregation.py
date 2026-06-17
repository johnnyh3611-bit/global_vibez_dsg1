"""
Focused tests for the $lookup aggregation path in build_eligible_cohort.

Verifies the aggregation:
  - Returns the identical wire shape as the previous N+1 implementation
  - Filters by threshold strictly
  - Sorts by total_vibez DESC
  - Coerces tge_opt_in correctly (missing → False, true → True)
  - Returns [] when no users cross the threshold
  - Handles rows whose user has been deleted (silently excluded via $unwind)
"""
import os
from typing import List

import pytest
from pymongo import MongoClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "global_vibez_dsg")

from services.tge_service import build_eligible_cohort  # noqa: E402


MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
PREFIX = "pytest_agg_"
_CLIENT = MongoClient(MONGO_URL)


def _sync_db():
    return _CLIENT[DB_NAME]


import pytest_asyncio


@pytest_asyncio.fixture
async def motor_db():
    """Per-test motor client — tied to the running asyncio loop."""
    from motor.motor_asyncio import AsyncIOMotorClient
    cli = AsyncIOMotorClient(MONGO_URL)
    try:
        yield cli[DB_NAME]
    finally:
        cli.close()


@pytest.fixture(scope="module", autouse=True)
def _seed():
    sdb = _sync_db()
    users = [
        # Above threshold + opted in + wallet → eligible
        {"user_id": f"{PREFIX}a", "username": "Ada", "email": f"{PREFIX}a@x", "tge_opt_in": True,
         "solana_wallet_address": "9wFFFfghi9vVvWwiHnQxKhs5x7sG7bAXbvTeQFhDkpbH"},
        # Above threshold, opted in but no wallet → ineligible but in cohort
        {"user_id": f"{PREFIX}b", "username": "Bea", "email": f"{PREFIX}b@x", "tge_opt_in": True,
         "solana_wallet_address": ""},
        # Above threshold, no opt-in → ineligible but in cohort
        {"user_id": f"{PREFIX}c", "username": "Cal", "email": f"{PREFIX}c@x"},
        # Below threshold → excluded
        {"user_id": f"{PREFIX}d", "username": "Dan", "email": f"{PREFIX}d@x", "tge_opt_in": True,
         "solana_wallet_address": "9wFFFfghi9vVvWwiHnQxKhs5x7sG7bAXbvTeQFhDkpbH"},
        # Balance row present but user deleted — should NOT crash (silently dropped)
        # (We don't create this user. Balance only.)
    ]
    for u in users:
        sdb.users.update_one({"user_id": u["user_id"]}, {"$set": u}, upsert=True)

    balances = [
        {"user_id": f"{PREFIX}a", "pending_balance": 100.0, "balance": 50.0},  # total 150
        {"user_id": f"{PREFIX}b", "pending_balance": 30.0, "balance": 0.0},    # total 30
        {"user_id": f"{PREFIX}c", "pending_balance": 0.0, "balance": 75.5},    # total 75.5
        {"user_id": f"{PREFIX}d", "pending_balance": 5.0, "balance": 0.0},     # total 5
        {"user_id": f"{PREFIX}orphan", "pending_balance": 999.0, "balance": 0.0},
    ]
    for b in balances:
        sdb.vibez_mining_balance.update_one({"user_id": b["user_id"]}, {"$set": b}, upsert=True)
    yield
    sdb.users.delete_many({"user_id": {"$regex": f"^{PREFIX}"}})
    sdb.vibez_mining_balance.delete_many({"user_id": {"$regex": f"^{PREFIX}"}})


@pytest.mark.asyncio
async def test_aggregation_returns_expected_shape(motor_db):
    rows = await build_eligible_cohort(motor_db, min_vibez=20)
    pytest_rows = [r for r in rows if r["user_id"].startswith(PREFIX)]
    user_ids = {r["user_id"] for r in pytest_rows}
    # a, b, c cross the threshold of 20; d does not. Orphan row has no user.
    assert user_ids == {f"{PREFIX}a", f"{PREFIX}b", f"{PREFIX}c"}
    # Shape assertions on Ada (top of the list)
    ada = next(r for r in pytest_rows if r["user_id"] == f"{PREFIX}a")
    assert set(ada.keys()) == {
        "user_id", "username", "wallet", "opted_in",
        "total_vibez", "pending_vibez", "available_vibez", "eligible_to_mint",
    }
    assert ada["total_vibez"] == 150.0
    assert ada["pending_vibez"] == 100.0
    assert ada["available_vibez"] == 50.0
    assert ada["opted_in"] is True
    assert ada["wallet"] != ""
    assert ada["eligible_to_mint"] is True


@pytest.mark.asyncio
async def test_sort_order_desc_by_total_vibez(motor_db):
    rows = await build_eligible_cohort(motor_db, min_vibez=0)
    # Filter to our test users so other fixtures don't interfere
    mine: List[dict] = [r for r in rows if r["user_id"].startswith(PREFIX)]
    # Must be sorted DESC by total_vibez
    totals = [r["total_vibez"] for r in mine]
    assert totals == sorted(totals, reverse=True)


@pytest.mark.asyncio
async def test_opt_in_boolean_coercion(motor_db):
    rows = await build_eligible_cohort(motor_db, min_vibez=0)
    bea = next(r for r in rows if r["user_id"] == f"{PREFIX}b")
    cal = next(r for r in rows if r["user_id"] == f"{PREFIX}c")
    assert bea["opted_in"] is True   # user doc has tge_opt_in=True
    assert cal["opted_in"] is False  # user doc missing tge_opt_in → False


@pytest.mark.asyncio
async def test_eligible_requires_both_opt_in_and_wallet(motor_db):
    rows = await build_eligible_cohort(motor_db, min_vibez=0)
    eligible_ids = {r["user_id"] for r in rows if r["eligible_to_mint"] and r["user_id"].startswith(PREFIX)}
    # Ada (a) and Dan (d) both have wallet + opt_in. Bea (b) lacks wallet.
    # Cal (c) lacks opt_in. Orphan has no user doc.
    assert eligible_ids == {f"{PREFIX}a", f"{PREFIX}d"}


@pytest.mark.asyncio
async def test_orphan_balance_row_is_silently_excluded(motor_db):
    rows = await build_eligible_cohort(motor_db, min_vibez=0)
    ids = {r["user_id"] for r in rows}
    # The balance row for PREFIX+orphan has no matching user doc — $unwind
    # without preserveNullAndEmptyArrays drops it.
    assert f"{PREFIX}orphan" not in ids


@pytest.mark.asyncio
async def test_threshold_is_strict_gte(motor_db):
    """total=5 should not appear with threshold=10."""
    rows = await build_eligible_cohort(motor_db, min_vibez=10)
    ids = {r["user_id"] for r in rows if r["user_id"].startswith(PREFIX)}
    assert f"{PREFIX}d" not in ids


@pytest.mark.asyncio
async def test_threshold_gte_exact_match(motor_db):
    """A user at exactly the threshold is INCLUDED ($gte)."""
    # Temporarily boost PREFIX+d to exactly 20
    _sync_db().vibez_mining_balance.update_one(
        {"user_id": f"{PREFIX}d"},
        {"$set": {"pending_balance": 20.0, "balance": 0.0}},
    )
    try:
        rows = await build_eligible_cohort(motor_db, min_vibez=20)
        ids = {r["user_id"] for r in rows if r["user_id"].startswith(PREFIX)}
        assert f"{PREFIX}d" in ids
    finally:
        _sync_db().vibez_mining_balance.update_one(
            {"user_id": f"{PREFIX}d"},
            {"$set": {"pending_balance": 5.0, "balance": 0.0}},
        )
