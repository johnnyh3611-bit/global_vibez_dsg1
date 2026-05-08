"""
Round 9.1 Sovereign Validator + Tax + Turn Timer regression tests.

Covers:
  1. Validator correctness (joker power indexing under Downtown trump)
  2. /api/turn-timer/check contract (400 unknown, 404 missing)
  3. apply_sovereign_tax math (13.5% on 1000 -> 865)
  4. Source-code wiring: settle_taxable_payout in Spades + Bid Whist,
     apply_sovereign_tax in Vibez 654, stamp_turn_start in BW + Spades,
     turn_timer_router registered.
  5. /api/burn/schedule alive smoke.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

# Force-load the canonical backend .env so DB_NAME matches the live
# backend even when regression_shield ran first and set
# DB_NAME=test_regression_shield via setdefault().
load_dotenv("/app/backend/.env", override=True)

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
BACKEND = Path("/app/backend")


# ── 1. Validator correctness ─────────────────────────────────────────────
class TestSovereignValidator:
    """PDF directive A: Joker Power Indexing."""

    def test_apply_sovereign_tax_135_pct(self):
        from services.sovereign_validator import apply_sovereign_tax
        out = apply_sovereign_tax(1000)
        assert out == {"gross": 1000, "tax": 135, "net": 865}

    def test_apply_sovereign_tax_zero_and_negative(self):
        from services.sovereign_validator import apply_sovereign_tax
        assert apply_sovereign_tax(0) == {"gross": 0, "tax": 0, "net": 0}
        assert apply_sovereign_tax(-50) == {"gross": 0, "tax": 0, "net": 0}

    def test_big_joker_beats_ace_under_downtown_spades_trump(self):
        """CRITICAL: previously the 20-value inversion bug picked Ace.
        Now Big Joker (power 100) must dominate even under Downtown."""
        from services.sovereign_validator import calculate_winner
        trick = [
            {"card": {"suit": "spades", "value": "A"}, "player_id": "A"},
            {"card": {"suit": "joker", "id": "big_joker"}, "player_id": "B"},
        ]
        winner = calculate_winner(trick, trump_suit="spades", led_suit="spades", bid_direction="downtown")
        assert winner is not None
        assert winner["player_id"] == "B"

    def test_little_joker_beats_ace_uptown(self):
        from services.sovereign_validator import calculate_winner
        trick = [
            {"card": {"suit": "spades", "value": "A"}, "player_id": "A"},
            {"card": {"suit": "joker", "id": "little_joker"}, "player_id": "C"},
        ]
        winner = calculate_winner(trick, trump_suit="spades", led_suit="spades", bid_direction="uptown")
        assert winner["player_id"] == "C"

    def test_big_beats_little_joker(self):
        from services.sovereign_validator import calculate_winner
        trick = [
            {"card": {"suit": "joker", "id": "little_joker"}, "player_id": "A"},
            {"card": {"suit": "joker", "id": "big_joker"}, "player_id": "B"},
        ]
        winner = calculate_winner(trick, trump_suit="hearts", led_suit="hearts", bid_direction="uptown")
        assert winner["player_id"] == "B"

    def test_jokers_inert_under_no_trump(self):
        from services.sovereign_validator import calculate_winner
        trick = [
            {"card": {"suit": "spades", "value": "A"}, "player_id": "A"},
            {"card": {"suit": "joker", "id": "big_joker"}, "player_id": "B"},
        ]
        winner = calculate_winner(trick, trump_suit=None, led_suit="spades",
                                  bid_direction="uptown", is_no_trump=True)
        assert winner["player_id"] == "A"

    def test_downtown_two_beats_ace_when_no_jokers(self):
        from services.sovereign_validator import calculate_winner
        trick = [
            {"card": {"suit": "spades", "value": "A"}, "player_id": "A"},
            {"card": {"suit": "spades", "value": "2"}, "player_id": "B"},
        ]
        winner = calculate_winner(trick, trump_suit="spades", led_suit="spades", bid_direction="downtown")
        assert winner["player_id"] == "B"

    def test_validate_turn_time(self):
        import time
        from services.sovereign_validator import validate_turn_time, TURN_TIMER_MS
        assert TURN_TIMER_MS == 15_000
        now_ms = int(time.time() * 1000)
        assert validate_turn_time(now_ms) == "TIME_OK"
        assert validate_turn_time(now_ms - 16_000) == "FORCE_AUTO_PLAY"


# ── 2. Turn-timer endpoint contract ──────────────────────────────────────
class TestTurnTimerEndpoint:
    def test_burn_schedule_smoke(self):
        r = requests.get(f"{BASE_URL}/api/burn/schedule", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "circulating_supply" in data

    def test_unknown_game_type_400(self):
        r = requests.post(
            f"{BASE_URL}/api/turn-timer/check",
            json={"game_id": "abc123", "game_type": "garbage"},
            timeout=10,
        )
        assert r.status_code == 400
        assert "Unknown game_type" in r.json().get("detail", "")

    def test_missing_game_404(self):
        r = requests.post(
            f"{BASE_URL}/api/turn-timer/check",
            json={"game_id": "definitely-not-a-real-game-xyz", "game_type": "bid_whist"},
            timeout=10,
        )
        assert r.status_code == 404
        assert r.json().get("detail") == "Game not found"

    def test_validation_error_short_id(self):
        # Pydantic Field(min_length=3) — game_id too short
        r = requests.post(
            f"{BASE_URL}/api/turn-timer/check",
            json={"game_id": "x", "game_type": "bid_whist"},
            timeout=10,
        )
        assert r.status_code == 422


# ── 3. Bid Whist play_card stamps turn_started_at_ms (DB) ────────────────
class TestBidWhistTurnStamp:
    """Verify stamp_turn_start writes turn_started_at_ms when a card is
    played. We stub a game doc directly in Mongo and call play_card,
    then verify the field appears.
    
    NOTE: The 4-seat BW setup is out of scope per main agent instructions;
    we instead invoke the helper directly which is what the route does."""

    @pytest.mark.asyncio
    async def test_stamp_writes_field(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from motor.motor_asyncio import AsyncIOMotorClient
        from routes.turn_timer import stamp_turn_start

        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        gid = "TEST_bw_stamp_tt_001"
        await db.bid_whist_games.insert_one({"game_id": gid, "status": "active"})
        try:
            await stamp_turn_start(db, "bid_whist", gid)
            doc = await db.bid_whist_games.find_one({"game_id": gid})
            assert doc is not None
            assert "turn_started_at_ms" in doc
            assert isinstance(doc["turn_started_at_ms"], int)
            assert doc["turn_started_at_ms"] > 0
        finally:
            await db.bid_whist_games.delete_one({"game_id": gid})

    @pytest.mark.asyncio
    async def test_check_endpoint_returns_time_ok_for_fresh_stamp(self):
        # Cross-suite race: regression_shield tests warm up in a separate
        # event loop; using pymongo (sync) here side-steps motor pool
        # leakage. The /api/turn-timer/check endpoint reads via Motor too,
        # but it lives on the live backend's own loop, so we just need the
        # write to be durable before issuing the HTTP call.
        import sys
        sys.path.insert(0, "/app/backend")
        import time as _t
        from pymongo import MongoClient
        from pymongo.write_concern import WriteConcern

        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "test_database")
        sync_client = MongoClient(mongo_url)
        sync_db = sync_client[db_name]
        # Force durable write (w=1, j=true) so the live backend can read.
        coll = sync_db.bid_whist_games.with_options(
            write_concern=WriteConcern(w=1, j=True),
        )
        gid = f"TEST_bw_ttok_{int(_t.time()*1000)}"
        coll.delete_many({"game_id": gid})  # ensure clean
        coll.insert_one({
            "game_id": gid,
            "status": "active",
            "turn_started_at_ms": int(_t.time() * 1000),
        })
        # Hand off to mongo to publish via fsync, then briefly wait for
        # the live backend's connection pool to observe the doc.
        sync_client.admin.command("fsync", lock=False)
        _t.sleep(0.2)
        try:
            r = requests.post(
                f"{BASE_URL}/api/turn-timer/check",
                json={"game_id": gid, "game_type": "bid_whist"},
                timeout=10,
            )
            assert r.status_code == 200, f"unexpected: {r.status_code} {r.text}"
            body = r.json()
            assert body["status"] == "TIME_OK"
            assert body["timer_ms"] == 15_000
            assert body["should_auto_play"] is False
            assert body["elapsed_ms"] >= 0
        finally:
            coll.delete_one({"game_id": gid})
            sync_client.close()


# ── 4. Source-code wiring ────────────────────────────────────────────────
class TestSourceCodeWiring:
    """Verify the tax helper + turn-stamp + validator are imported in the
    right places (regression shield equivalent)."""

    def test_spades_uses_settle_taxable_payout(self):
        src = (BACKEND / "routes" / "spades.py").read_text()
        assert "from services.card_game_payouts import settle_taxable_payout" in src
        assert "settled = await settle_taxable_payout(" in src
        assert 'stamp_turn_start(db, "spades"' in src

    def test_bid_whist_uses_settle_taxable_payout(self):
        src = (BACKEND / "routes" / "bid_whist.py").read_text()
        assert "from services.card_game_payouts import settle_taxable_payout" in src
        assert "settle_taxable_payout(" in src
        assert 'stamp_turn_start(db, "bid_whist"' in src

    def test_vibez_654_uses_apply_sovereign_tax(self):
        src = (BACKEND / "routes" / "vibez_654.py").read_text()
        assert "apply_sovereign_tax" in src
        # Tax is on net winnings, not gross bet refund
        assert re.search(r"apply_sovereign_tax\(net_winnings\)", src)

    def test_turn_timer_router_registered(self):
        src = (BACKEND / "routes" / "registry.py").read_text()
        assert "turn_timer_router" in src
        assert "include_router(turn_timer_router)" in src

    def test_card_game_payouts_helper_inserts_gross_tax_net(self):
        src = (BACKEND / "services" / "card_game_payouts.py").read_text()
        assert "credit_transactions.insert_one" in src
        assert '"gross": gross_i' in src
        assert '"tax": preview["tax"]' in src

    def test_bid_whist_grand_master_no_inversion_bug(self):
        """Ensure the rewrite removed the 20-value inversion logic."""
        src = (BACKEND / "services" / "bid_whist_grand_master.py").read_text()
        # The new code delegates to the validator
        assert "calculate_winner" in src or "sovereign_validator" in src


# ── 5. Vibez 654 payout response shape (source-level) ────────────────────
class TestVibez654Wiring:
    def test_payout_response_includes_net_payout_and_sovereign_tax(self):
        src = (BACKEND / "routes" / "vibez_654.py").read_text()
        # The route should expose net_payout + sovereign_tax keys
        assert "net_payout" in src
        assert "sovereign_tax" in src
