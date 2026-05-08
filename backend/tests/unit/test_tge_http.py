"""HTTP integration tests for TGE routes."""
import os

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "global_vibez_dsg")



MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
USER_A = "pytest_tge_user_a"
USER_B = "pytest_tge_user_b"

_CLIENT = MongoClient(MONGO_URL)


def _db():
    return _CLIENT[DB_NAME]


@pytest.fixture(scope="module")
def client(shared_client):
    return shared_client


@pytest.fixture(scope="module", autouse=True)
def _seed_and_cleanup():
    db = _db()
    # Two users with balances — A opted-in with wallet, B opted-out
    valid_wallet = "So11111111111111111111111111111111111111112"  # wrapped SOL, valid base58
    db.users.update_one(
        {"user_id": USER_A},
        {"$set": {
            "user_id": USER_A,
            "username": "TGE Opt-In",
            "email": "pytest-tge-a@example.com",
            "tge_opt_in": True,
            "solana_wallet_address": valid_wallet,
        }},
        upsert=True,
    )
    db.users.update_one(
        {"user_id": USER_B},
        {"$set": {
            "user_id": USER_B,
            "username": "TGE Lurker",
            "email": "pytest-tge-b@example.com",
            "tge_opt_in": False,
        }},
        upsert=True,
    )
    db.vibez_mining_balance.update_many(
        {"user_id": {"$in": [USER_A, USER_B]}},
        {"$set": {"pending_balance": 50.0, "balance": 25.0, "lifetime_mined": 75.0, "lifetime_redeemed": 0.0}},
        upsert=False,
    )
    db.vibez_mining_balance.update_one(
        {"user_id": USER_A},
        {"$set": {"user_id": USER_A, "pending_balance": 50.0, "balance": 25.0}},
        upsert=True,
    )
    db.vibez_mining_balance.update_one(
        {"user_id": USER_B},
        {"$set": {"user_id": USER_B, "pending_balance": 50.0, "balance": 25.0}},
        upsert=True,
    )
    yield
    db.users.delete_many({"user_id": {"$in": [USER_A, USER_B]}})
    db.vibez_mining_balance.delete_many({"user_id": {"$in": [USER_A, USER_B]}})
    db.vibez_tge_batches.delete_many({"initiated_by": "founder"})


def _admin_login(client: TestClient):
    admin_pw = os.environ.get("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")
    res = client.post("/api/admin/vault-auth", json={"password": admin_pw, "code": "000000"})
    assert res.status_code == 200, res.text


def test_config_public(client: TestClient):
    res = client.get("/api/tge/config")
    assert res.status_code == 200
    body = res.json()
    assert body["mode"] in ("mock", "devnet", "mainnet-beta")
    assert "supported_networks" in body


def test_admin_cohort_requires_admin(client: TestClient):
    # Clear any lingering admin_session cookie from earlier tests (shared client)
    client.cookies.clear()
    res = client.get("/api/tge/admin/cohort")
    assert res.status_code == 403


def test_admin_dry_run_lists_eligible_only(client: TestClient):
    _admin_login(client)
    res = client.get("/api/tge/admin/dry-run?min_vibez=10")
    assert res.status_code == 200
    body = res.json()
    user_ids = {r["user_id"] for r in body["sample_rows"]}
    # User A opted in with wallet → shown
    assert USER_A in user_ids
    # User B is in cohort but not eligible to mint
    assert body["eligible_count"] >= 1
    assert body["pending_opt_in_count"] >= 1


def test_execute_mint_requires_confirm(client: TestClient):
    _admin_login(client)
    res = client.post("/api/tge/admin/execute-mint", json={"min_vibez": 10, "confirm": False})
    assert res.status_code == 400


def test_execute_mint_creates_simulated_batch(client: TestClient):
    _admin_login(client)
    res = client.post("/api/tge/admin/execute-mint", json={"min_vibez": 10, "confirm": True})
    assert res.status_code == 200, res.text
    batch = res.json()["batch"]
    assert batch["status"] == "SIMULATED"
    assert batch["mode"] == "mock"
    assert batch["eligible_count"] >= 1

    # Appears in batch history
    res2 = client.get("/api/tge/admin/batches")
    assert res2.status_code == 200
    ids = [b["batch_id"] for b in res2.json()["batches"]]
    assert batch["batch_id"] in ids


def test_me_opt_in_rejects_invalid_wallet(client: TestClient):
    res = client.post(
        "/api/tge/me/opt-in",
        json={"wallet": "short", "opt_in": True},
        headers={"x-user-id": USER_B},
    )
    assert res.status_code == 400


def test_me_opt_in_and_out(client: TestClient):
    valid = "9wFFFfghi9vVvWwiHnQxKhs5x7sG7bAXbvTeQFhDkpbH"  # 43 base58 chars
    # Opt in
    res = client.post(
        "/api/tge/me/opt-in",
        json={"wallet": valid, "opt_in": True},
        headers={"x-user-id": USER_B},
    )
    assert res.status_code == 200, res.text
    assert res.json()["user"]["tge_opt_in"] is True
    assert res.json()["user"]["solana_wallet_address"] == valid
    # Opt out
    res = client.post(
        "/api/tge/me/opt-in",
        json={"wallet": valid, "opt_in": False},
        headers={"x-user-id": USER_B},
    )
    assert res.status_code == 200
    assert res.json()["user"]["tge_opt_in"] is False


def test_me_status_returns_totals(client: TestClient):
    res = client.get("/api/tge/me/status", headers={"x-user-id": USER_A})
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["user_id"] == USER_A
    assert body["total_vibez"] == pytest.approx(75.0)
    assert body["config"]["mode"] == "mock"
