"""v7 Phase 7 — InfraWallet MongoDB persistence regression test.

Asserts that the running InfraWallet balance survives a backend restart
(simulated here by calling the hydration helper after dropping the
in-memory dict).
"""
from __future__ import annotations

import os
import asyncio
from typing import Any

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from routes import pricing_tiers_routes as ptr
from services.pricing_tiers import InfraWallet, CreatorWallet


@pytest.fixture(autouse=True)
def _ensure_db():
    """Initialize the database global the same way lifespan does.

    Uses an isolated client per test so motor's event-loop binding does
    not leak into subsequent suites that run TestClient (which spins its
    own loop)."""
    from utils import database as udb
    prior_client = udb.client
    prior_db = udb.db
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    udb.client = client
    udb.db = client[os.environ["DB_NAME"]]

    saved_wallet = ptr._INFRA_WALLET
    saved_creators = ptr._CREATOR_WALLETS
    saved_hydrated = ptr._INFRA_HYDRATED
    yield
    ptr._INFRA_WALLET = saved_wallet
    ptr._CREATOR_WALLETS = saved_creators
    ptr._INFRA_HYDRATED = saved_hydrated
    # Restore prior db globals so the next test suite (e.g. pricing
    # TestClient tests) can lazy-reinitialize on its own event loop.
    client.close()
    udb.client = prior_client
    udb.db = prior_db


@pytest.mark.asyncio
async def test_infra_wallet_persists_across_simulated_restart() -> None:
    # Clean any prior test rows
    from utils.database import get_database
    db = get_database()
    await db[ptr._INFRA_COLLECTION].delete_many({"creator_id": "persist_test_creator"})

    # Reset module state to simulate a fresh process
    ptr._INFRA_WALLET = InfraWallet()
    ptr._CREATOR_WALLETS = {}
    ptr._INFRA_HYDRATED = False

    # Top up wallet & process an upload — should persist to Mongo
    creator = ptr._get_or_create("persist_test_creator")
    creator.balance = 100.0

    from services.pricing_tiers import process_upload
    out = process_upload(creator, ptr._INFRA_WALLET, "SINGLE_EPISODE", count=2)
    assert out.ok is True
    transfer = ptr._INFRA_WALLET.ledger[-1]
    await ptr._persist_transfer(transfer)

    expected_balance_before_restart = ptr._INFRA_WALLET.balance
    assert expected_balance_before_restart >= 10.0  # 2 × $5

    # === SIMULATE BACKEND RESTART ===
    ptr._INFRA_WALLET = InfraWallet()
    ptr._INFRA_HYDRATED = False

    # Hydrate from Mongo
    await ptr._hydrate_infra_from_mongo()

    # Balance should be restored from the persisted ledger row
    persisted = [t for t in ptr._INFRA_WALLET.ledger if t.creator_id == "persist_test_creator"]
    assert len(persisted) >= 1
    assert ptr._INFRA_WALLET.balance >= 10.0

    # Cleanup
    await db[ptr._INFRA_COLLECTION].delete_many({"creator_id": "persist_test_creator"})


@pytest.mark.asyncio
async def test_hydration_is_idempotent() -> None:
    ptr._INFRA_WALLET = InfraWallet()
    ptr._INFRA_HYDRATED = False
    await ptr._hydrate_infra_from_mongo()
    first_balance = ptr._INFRA_WALLET.balance
    # Second call should NOT double-load
    await ptr._hydrate_infra_from_mongo()
    assert ptr._INFRA_WALLET.balance == first_balance
