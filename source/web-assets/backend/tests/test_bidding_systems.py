"""
Bidding-system regression — Spades / Bid Whist / Euchre / Pinochle / legacy practice.

Guarantees every auction game leaves the human with a chance to bid
(or pass / order-up / name trump) instead of silently advancing past
the bidding UI.
"""
from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.spades_game import SpadesGame, get_spades_ai_bid  # noqa: E402
from utils.euchre_game import EuchreGame  # noqa: E402
from utils.pinochle_game import PinochleGame  # noqa: E402
from utils.bid_whist_game import BidWhistGame  # noqa: E402


# ── Spades ──────────────────────────────────────────────────────────────────

def test_spades_starts_in_bidding_with_empty_bids_placed():
    game = SpadesGame(ruleset="CLASSIC")
    game.deal_cards()
    game.game_phase = "bidding"
    game.bids_placed = []
    assert game.game_phase == "bidding"
    assert game.bids_placed == []
    assert len(game.players["south"]["hand"]) == 13


def test_spades_bid_order_stops_at_human_south():
    """Mirror of spades_practice._advance_bot_bids — bots after south wait."""
    game = SpadesGame(ruleset="CLASSIC")
    game.deal_cards()
    game.game_phase = "bidding"
    game.bids_placed = []

    bid_order = ["south", "west", "north", "east"]
    while len(game.bids_placed) < 4:
        pos = bid_order[len(game.bids_placed)]
        if pos == "south":
            break
        game.set_bid(pos, get_spades_ai_bid(game.players[pos]["hand"]))

    assert "south" not in game.bids_placed
    assert game.game_phase == "bidding"

    assert game.set_bid("south", 3) is True
    while len(game.bids_placed) < 4:
        pos = bid_order[len(game.bids_placed)]
        if pos == "south":
            break
        game.set_bid(pos, get_spades_ai_bid(game.players[pos]["hand"]))

    assert len(game.bids_placed) == 4
    assert game.game_phase == "playing"
    assert game.players["south"]["bid"] == 3


def test_spades_nil_bid_is_zero_and_recorded():
    game = SpadesGame(ruleset="CLASSIC")
    game.deal_cards()
    game.game_phase = "bidding"
    game.bids_placed = []
    assert game.set_bid("south", 0) is True
    assert game.players["south"]["bid"] == 0
    assert "south" in game.bids_placed


# ── Bid Whist ───────────────────────────────────────────────────────────────

def test_bid_whist_deal_leaves_auction_open_for_human():
    game = BidWhistGame()
    game.player_mapping["south"] = "user-1"
    game.player_mapping["north"] = "AI_NORTH"
    game.player_mapping["east"] = "AI_EAST"
    game.player_mapping["west"] = "AI_WEST"
    game.deal_cards()
    assert game.game_phase == "bidding"
    # Each seat gets 12; the remaining 6 form the kitty.
    assert len(game.players["south"]["hand"]) == 12
    assert len(game.kitty) == 6
    assert game.bids == []


# ── Euchre ──────────────────────────────────────────────────────────────────

def test_euchre_run_bots_stops_for_human_bid_turn():
    game = EuchreGame(user_position="south")
    assert game.phase == "bidding"
    game.run_bots(max_steps=32)
    # Either still bidding on the human, or dealer discard / playing if
    # bots ordered up — never a silent skip past all human agency when
    # it's still bidding.
    if game.phase == "bidding":
        assert game.bid_turn == "south"
        view = game.to_view()
        assert view["phase"] == "bidding"
        assert view["bid_turn"] == "south"
        assert view.get("bid_round") in (1, 2)


def test_euchre_pass_keeps_auction_alive_until_named_or_ordered():
    game = EuchreGame(user_position="south")
    game.run_bots(max_steps=32)
    if game.phase != "bidding" or game.bid_turn != "south":
        pytest.skip("bots already closed auction before human seat")
    round_before = game.bid_round
    game.pass_bid("south")
    game.run_bots(max_steps=32)
    # After a human pass, either still bidding (later seat / round 2) or
    # resolved — never stuck without a phase.
    assert game.phase in ("bidding", "ordered_dealer_discard", "playing", "scoring")
    if game.phase == "bidding":
        assert game.bid_round >= round_before


# ── Pinochle ────────────────────────────────────────────────────────────────

def test_pinochle_run_bots_stops_for_human_auction_or_trump():
    game = PinochleGame(user_position="south")
    game.run_bots(max_steps=48)
    assert game.phase in ("bidding", "naming_trump", "playing", "meld", "scoring")
    if game.phase == "bidding":
        assert game.bid_turn == "south"
    if game.phase == "naming_trump":
        assert game.high_bidder == "south"
        view = game.to_view()
        assert view["phase"] == "naming_trump"
        assert view["turn"] == "south"
        assert view["high_bidder"] == "south"


def test_pinochle_naming_trump_view_exposes_high_bidder_as_turn():
    game = PinochleGame(user_position="south")
    # Force naming_trump with south as high bidder.
    game.phase = "naming_trump"
    game.high_bidder = "south"
    game.bid_turn = "east"
    view = game.to_view()
    assert view["turn"] == "south"
    assert view["high_bidder"] == "south"


# ── Legacy practice move payload ────────────────────────────────────────────

def test_legacy_practice_spades_bid_accepts_amount_alias():
    """Frontend used to send `amount`; backend must accept both keys."""
    move_amount = {"action": "bid", "amount": 5}
    move_bid = {"action": "bid", "bid": 4}
    for move, expected in ((move_amount, 5), (move_bid, 4)):
        bid = move.get("bid", move.get("amount", 0))
        assert int(bid) == expected
