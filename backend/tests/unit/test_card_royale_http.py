"""End-to-end HTTP tests for /api/card-royale/*.

Uses TestClient as context manager (triggers FastAPI lifespan so motor stays
on the same loop). Mongo seeding/cleanup uses sync pymongo.
"""
import os
from datetime import datetime, timezone, timedelta

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "global_vibez_dsg")



MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
USER_ID = "pytest_cr_user_1"
TEMPLATE_ID = "_pytest_cr_tour"

# Single persistent sync client (closing MongoClient mid-test breaks other
# modules that share the global state).
_CLIENT = MongoClient(MONGO_URL)


def _sync_db():
    return _CLIENT[DB_NAME]


@pytest.fixture(scope="module")
def client(shared_client):
    # Reuse the session-scoped TestClient from conftest.
    return shared_client


@pytest.fixture(scope="module", autouse=True)
def _seed_and_cleanup():
    db = _sync_db()
    # Seed template
    db.tournament_templates.update_one(
        {"template_id": TEMPLATE_ID},
        {"$set": {
            "template_id": TEMPLATE_ID,
            "name": "Pytest Tour",
            "format": "solo_gauntlet",
            "rounds": [
                {"round": 1, "game": "spades", "scoring": "spades_score"},
                {"round": 2, "game": "blackjack", "scoring": "blackjack_pnl"},
            ],
            "schedule_cron": "daily@20:00",
            "duration_hours": 4,
            "free_daily_entry": True,
            "retry_buy_in_coins": 100,
            "prize_pool_seed_vibez": 20.0,
            "prize_pool_seed_coins": 200,
            "prize_split": [1.0],
            "max_participants": 10,
            "description": "pytest",
        }},
        upsert=True,
    )

    # Seed user
    db.users.update_one(
        {"user_id": USER_ID},
        {"$set": {"user_id": USER_ID, "username": "Tester", "email": "pytest-cr@example.com", "balance_coins": 5000}},
        upsert=True,
    )

    # Directly create a tournament doc so we don't depend on the scheduler
    slot = datetime.now(timezone.utc) + timedelta(minutes=1)
    tid = f"t_{TEMPLATE_ID}_{slot.strftime('%Y%m%d_%H%M')}"
    db.tournaments.update_one(
        {"tournament_id": tid},
        {"$set": {
            "tournament_id": tid,
            "template_id": TEMPLATE_ID,
            "name": "Pytest Tour",
            "format": "solo_gauntlet",
            "rounds": [
                {"round": 1, "game": "spades", "scoring": "spades_score"},
                {"round": 2, "game": "blackjack", "scoring": "blackjack_pnl"},
            ],
            "status": "OPEN",
            "starts_at": slot.isoformat(),
            "ends_at": (slot + timedelta(hours=4)).isoformat(),
            "free_daily_entry": True,
            "retry_buy_in_coins": 100,
            "prize_pool_vibez": 20.0,
            "prize_pool_coins": 200,
            "prize_split": [1.0],
            "max_participants": 10,
            "participant_count": 0,
            "description": "pytest",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    yield tid
    # Cleanup
    db.tournament_templates.delete_one({"template_id": TEMPLATE_ID})
    db.tournaments.delete_many({"template_id": TEMPLATE_ID})
    db.tournament_entries.delete_many({"template_id": TEMPLATE_ID})
    db.tournament_scores.delete_many({"user_id": USER_ID})
    db.vibez_mining_ledger.delete_many({"user_id": USER_ID, "event": "tournament_prize"})
    db.vibez_mining_balance.delete_many({"user_id": USER_ID})


def _tid():
    doc = _sync_db().tournaments.find_one({"template_id": TEMPLATE_ID}, {"tournament_id": 1, "_id": 0})
    return doc["tournament_id"] if doc else None


def test_templates_endpoint_lists_pytest_template(client: TestClient):
    res = client.get("/api/card-royale/templates")
    assert res.status_code == 200
    ids = {t["template_id"] for t in res.json()["templates"]}
    assert TEMPLATE_ID in ids


def test_active_lists_our_tournament(client: TestClient):
    res = client.get("/api/card-royale/active")
    assert res.status_code == 200
    ids = {t["tournament_id"] for t in res.json()["tournaments"]}
    assert _tid() in ids


def test_auth_required_for_enter(client: TestClient):
    client.cookies.clear()
    tid = _tid()
    res = client.post("/api/card-royale/enter", json={"tournament_id": tid, "use_free_entry": True})
    assert res.status_code == 401


def test_details_endpoint(client: TestClient):
    tid = _tid()
    res = client.get(f"/api/card-royale/details/{tid}")
    assert res.status_code == 200
    assert res.json()["tournament"]["tournament_id"] == tid


def test_full_entry_flow_with_header_auth(client: TestClient):
    tid = _tid()
    headers = {"x-user-id": USER_ID}

    res = client.post(
        "/api/card-royale/enter",
        json={"tournament_id": tid, "use_free_entry": True},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["ok"] is True

    # Round 1
    res = client.post(
        "/api/card-royale/submit-score",
        json={"tournament_id": tid, "round_num": 1, "raw_score": {"bid": 4, "tricks": 5, "bags": 1}},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["rounds_completed"] == 1

    # Round 2
    res = client.post(
        "/api/card-royale/submit-score",
        json={"tournament_id": tid, "round_num": 2, "raw_score": {"net_coins": 4000}},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["rounds_completed"] == 2

    # Leaderboard
    res = client.get(f"/api/card-royale/leaderboard/{tid}")
    lb = res.json()["leaderboard"]
    me = next((r for r in lb if r["user_id"] == USER_ID), None)
    assert me is not None
    assert me["rank"] == 1
    assert me["rounds_completed"] == 2

    # My entry
    res = client.get(f"/api/card-royale/my-entry/{tid}", headers=headers)
    assert res.status_code == 200
    assert res.json()["entry"]["rounds_completed"] == 2

    # My entries
    res = client.get("/api/card-royale/my-entries", headers=headers)
    assert res.status_code == 200
    assert res.json()["count"] >= 1


def test_finalize_requires_admin(client: TestClient):
    client.cookies.clear()
    tid = _tid()
    res = client.post("/api/card-royale/admin/finalize", json={"tournament_id": tid})
    assert res.status_code == 403


def test_finalize_distributes_prizes(client: TestClient):
    # Authenticate as admin via vault password
    admin_pw = os.environ.get("ADMIN_PASSWORD", "GlobalVibez_Founder_2025!")
    login = client.post("/api/admin/vault-auth", json={"password": admin_pw, "code": "000000"})
    assert login.status_code == 200, login.text

    tid = _tid()
    res = client.post("/api/card-royale/admin/finalize", json={"tournament_id": tid})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ok"] is True
    results = body["results"]
    assert len(results) >= 1
    winner = results[0]
    assert winner["user_id"] == USER_ID
    assert winner["prize_coins"] == 200
    assert winner["prize_vibez"] == pytest.approx(20.0)

    # Verify side effects
    db = _sync_db()
    user = db.users.find_one({"user_id": USER_ID})
    assert user["balance_coins"] >= 5000 + 200
    ledger = db.vibez_mining_ledger.find_one(
        {"user_id": USER_ID, "event": "tournament_prize", "tournament_id": tid}
    )
    assert ledger is not None
    assert ledger["status"] == "PENDING_VIBE_CHECK"
    assert ledger["mined"] == pytest.approx(20.0)
