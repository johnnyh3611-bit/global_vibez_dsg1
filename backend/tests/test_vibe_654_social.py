"""
Integration tests for Vibe 6-5-4 Social Engine — tips, hype, side-bets,
and per-round settlement hook.

Hits the live supervisor-managed backend via httpx to avoid Motor-in-TestClient
event-loop pinning issues.
"""
import os
import sys
from pathlib import Path

import httpx
import pytest
from pymongo import MongoClient
from dotenv import dotenv_values

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Always read MONGO_URL / DB_NAME directly from the .env file so we hit the
# same DB the live backend uses — regardless of what other test files may have
# set via ``os.environ.setdefault``.
_ENV = dotenv_values(Path(__file__).resolve().parents[1] / ".env")
MONGO_URL = _ENV.get("MONGO_URL") or os.environ["MONGO_URL"]
DB_NAME = _ENV.get("DB_NAME") or os.getenv("DB_NAME", "test_database")

BASE = os.getenv("BACKEND_TEST_URL", "http://localhost:8001")
API = f"{BASE}/api"


def _mk_user(db, uid: str, balance: int) -> None:
    db.users.delete_one({"user_id": uid})
    db.users.insert_one({
        "user_id": uid,
        "email": f"{uid}@vbtest.local",
        "token_balance": balance,
    })


def _mk_table(db, tid: str, host_id: str, players):
    db.vibe654_tables.delete_one({"table_id": tid})
    db.vibe654_tables.insert_one({
        "table_id": tid,
        "table_name": "Test Coliseum",
        "host_user_id": host_id,
        "host_name": "Host",
        "buy_in": 10_000,
        "max_players": 20,
        "current_players": players,
        "total_pot": 10_000 * len(players),
        "status": "IN_PROGRESS",
        "round_number": 1,
        "round_history": [],
    })


@pytest.fixture(scope="function")
def client():
    with httpx.Client(base_url=API, timeout=10.0) as c:
        yield c


@pytest.fixture(scope="function")
def db():
    mongo = MongoClient(MONGO_URL)
    return mongo[DB_NAME]


@pytest.fixture()
def table_setup(db):
    host, p1, spec = "vbtest_host", "vbtest_p1", "vbtest_spec"
    _mk_user(db, host, 50_000)
    _mk_user(db, p1, 50_000)
    _mk_user(db, spec, 100_000)
    tid = "vbtest_table_001"
    _mk_table(db, tid, host, [
        {"user_id": host, "player_name": "Host", "status": "active"},
        {"user_id": p1, "player_name": "Player One", "status": "active"},
    ])
    yield {"tid": tid, "host": host, "p1": p1, "spec": spec}
    db.vibe654_tables.delete_one({"table_id": tid})
    db.vibe654_side_bets.delete_many({"table_id": tid})
    db.users.delete_many({"user_id": {"$in": [host, p1, spec]}})


def test_tip_transfers_funds_and_records_event(client, table_setup, db):
    tid, spec, host = table_setup["tid"], table_setup["spec"], table_setup["host"]
    r = client.post(f"/vibe654/tournament/{tid}/tip", json={
        "spectator_user_id": spec,
        "spectator_name": "Spec",
        "recipient_user_id": host,
        "amount": 2500,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert body["event"]["amount"] == 2500
    # Wallet effect
    assert db.users.find_one({"user_id": spec})["token_balance"] == 100_000 - 2500
    assert db.users.find_one({"user_id": host})["token_balance"] == 50_000 + 2500
    # Event persisted on the table
    tbl = db.vibe654_tables.find_one({"table_id": tid})
    assert any(ev["type"] == "tip" for ev in (tbl.get("tip_events") or []))


def test_tip_rejects_self_and_insufficient_funds(client, table_setup, db):
    tid, host = table_setup["tid"], table_setup["host"]
    # self-tip
    r = client.post(f"/vibe654/tournament/{tid}/tip", json={
        "spectator_user_id": host,
        "spectator_name": "Host",
        "recipient_user_id": host,
        "amount": 100,
    })
    assert r.status_code == 400

    # broke spectator
    broke = "vbtest_broke"
    _mk_user(db, broke, 50)
    try:
        r = client.post(f"/vibe654/tournament/{tid}/tip", json={
            "spectator_user_id": broke,
            "spectator_name": "Broke",
            "recipient_user_id": host,
            "amount": 1000,
        })
        assert r.status_code == 402
    finally:
        db.users.delete_one({"user_id": broke})


def test_hype_charges_one_coin_and_records_event(client, table_setup, db):
    tid, spec = table_setup["tid"], table_setup["spec"]
    balance_before = db.users.find_one({"user_id": spec})["token_balance"]
    r = client.post(f"/vibe654/tournament/{tid}/hype", json={
        "spectator_user_id": spec,
        "spectator_name": "Spec",
        "hype_type": "fire",
    })
    assert r.status_code == 200, r.text
    assert db.users.find_one({"user_id": spec})["token_balance"] == balance_before - 1
    tbl = db.vibe654_tables.find_one({"table_id": tid})
    assert any(ev["hype_type"] == "fire" for ev in (tbl.get("hype_events") or []))


def test_sidebet_locks_odds_and_settles_on_winner(client, table_setup, db):
    """
    Verifies the full settle path. We place a ₵1000 bet on p1 winning, then
    simulate settlement via the same async helper the tournament engine uses.
    """
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

    tid, spec, p1 = table_setup["tid"], table_setup["spec"], table_setup["p1"]
    # odds endpoint should expose p1
    r = client.get(f"/vibe654/tournament/{tid}/odds")
    assert r.status_code == 200
    odds_data = r.json()
    assert any(p["user_id"] == p1 for p in odds_data["players"])

    # Place the bet
    r = client.post(f"/vibe654/tournament/{tid}/sidebet", json={
        "spectator_user_id": spec,
        "spectator_name": "Spec",
        "amount": 1000,
        "outcome": "player_wins",
        "target_user_id": p1,
    })
    assert r.status_code == 200, r.text
    bet = r.json()["bet"]
    locked = bet["locked_odds"]
    assert bet["status"] == "open"

    # Simulate p1 winning by running settlement in a fresh event loop with a
    # dedicated Motor client (avoids reusing the live server's loop).
    async def _run_settle():
        from routes.vibe_654_social import settle_side_bets_for_round
        from utils.database import initialize_database
        initialize_database(MONGO_URL, DB_NAME)
        return await settle_side_bets_for_round(table_id=tid, winner_user_id=p1, round_hit_six_five_four=False)

    loop = asyncio.new_event_loop()
    try:
        summary = loop.run_until_complete(_run_settle())
    finally:
        loop.close()

    assert summary["settled_count"] == 1
    assert len(summary["payouts"]) == 1
    pay = summary["payouts"][0]
    assert pay["amount"] == 1000
    assert pay["locked_odds"] == locked
    assert pay["payout"] == int(round(1000 * locked))

    # Ledger row is marked won
    row = db.vibe654_side_bets.find_one({"bet_id": bet["bet_id"]})
    assert row["status"] == "won"
    assert row["payout"] == pay["payout"]


def test_sidebet_rejects_betting_on_self(client, table_setup):
    tid, host = table_setup["tid"], table_setup["host"]
    r = client.post(f"/vibe654/tournament/{tid}/sidebet", json={
        "spectator_user_id": host,
        "spectator_name": "Host",
        "amount": 500,
        "outcome": "player_wins",
        "target_user_id": host,
    })
    assert r.status_code == 400


def test_detect_six_five_four_hit_in_first_roll():
    from routes.vibe_654_social import detect_six_five_four_in_round
    assert detect_six_five_four_in_round({
        "u1": {"score": 6, "qualified": True, "rolls": [[6, 5, 4, 3, 3]]},
    }) is True
    assert detect_six_five_four_in_round({
        "u1": {"score": 0, "qualified": False, "rolls": [[6, 5, 2, 1, 3], [6, 5, 4, 3, 2]]},
    }) is False   # hit on 2nd roll doesn't count


def test_social_feed_exposes_all_three_buckets(client, table_setup, db):
    tid, spec, host = table_setup["tid"], table_setup["spec"], table_setup["host"]
    # Seed at least one of each event type
    client.post(f"/vibe654/tournament/{tid}/tip", json={
        "spectator_user_id": spec, "spectator_name": "S",
        "recipient_user_id": host, "amount": 100,
    })
    client.post(f"/vibe654/tournament/{tid}/hype", json={
        "spectator_user_id": spec, "spectator_name": "S", "hype_type": "horn",
    })
    r = client.get(f"/vibe654/tournament/{tid}/social-feed")
    assert r.status_code == 200
    body = r.json()
    assert "tip_events" in body and "hype_events" in body and "sidebet_events" in body
    assert len(body["tip_events"]) >= 1
    assert len(body["hype_events"]) >= 1
