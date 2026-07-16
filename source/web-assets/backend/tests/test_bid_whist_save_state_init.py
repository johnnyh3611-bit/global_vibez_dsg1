"""Regression: practice start calls save_state() before any trick is led."""
from utils.bid_whist_game import BidWhistGame


def test_save_state_after_init_has_trick_leader():
    game = BidWhistGame()
    assert game.trick_leader is None
    state = game.save_state()
    assert "trick_leader" in state
    assert state["trick_leader"] is None


def test_save_state_after_deal_for_practice_start():
    game = BidWhistGame()
    game.player_mapping["south"] = "user_1"
    game.player_mapping["north"] = "AI_NORTH"
    game.player_mapping["east"] = "AI_EAST"
    game.player_mapping["west"] = "AI_WEST"
    game.deal_cards()
    state = game.save_state()
    assert state["phase"] == "bidding"
    assert len(state["players_data"]["south"]["hand"]) == 12
    assert len(state["kitty"]) == 6
    assert state["trick_leader"] is None
