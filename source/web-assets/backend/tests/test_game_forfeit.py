"""Unit tests for mid-game quitter penalty (15% house + partner split)."""

from utils.game_forfeit import (
    HOUSE_PENALTY_PCT,
    PARTNER_SHARE_PCT,
    forfeit_policy_public,
    is_mid_game,
    plan_redistribution,
    players_from_mapping,
)


def test_policy_public_matches_agreed_percentages():
    policy = forfeit_policy_public()
    assert policy["house_penalty_pct"] == 0.15
    assert policy["partner_share_pct"] == 0.50
    assert policy["opponent_share_pct"] == 0.50
    assert HOUSE_PENALTY_PCT == 0.15
    assert PARTNER_SHARE_PCT == 0.50


def test_is_mid_game_statuses():
    assert is_mid_game("playing")
    assert is_mid_game("active")
    assert is_mid_game("bidding")
    assert is_mid_game("in_progress")
    assert not is_mid_game("waiting")
    assert not is_mid_game("completed")
    assert not is_mid_game("lobby")
    assert not is_mid_game(None)


def test_players_from_mapping():
    mapping = {
        "north": "u1",
        "south": "u2",
        "east": "AI_EAST",
        "west": "u4",
    }
    players = players_from_mapping(mapping)
    assert len(players) == 4
    assert {"user_id": "u1", "seat": "north"} in players


def test_partner_gets_half_opponents_split_rest():
    """North quits → South (partner) 50%, East+West split 50%."""
    players = [
        {"user_id": "north_user", "seat": "north"},
        {"user_id": "south_user", "seat": "south"},
        {"user_id": "east_user", "seat": "east"},
        {"user_id": "west_user", "seat": "west"},
    ]
    plan = plan_redistribution(players, "north_user", 100)
    by_uid = {uid: (amt, role) for uid, amt, role in plan}

    assert by_uid["south_user"] == (50.0, "partner")
    assert by_uid["east_user"][1] == "opponent"
    assert by_uid["west_user"][1] == "opponent"
    assert by_uid["east_user"][0] + by_uid["west_user"][0] == 50.0
    assert sum(amt for _, amt, _ in plan) == 100.0


def test_ai_partner_does_not_receive_credits():
    """If partner is AI, equal-split among remaining humans (no partner seat credit)."""
    players = [
        {"user_id": "north_user", "seat": "north"},
        {"user_id": "AI_SOUTH", "seat": "south"},
        {"user_id": "east_user", "seat": "east"},
        {"user_id": "west_user", "seat": "west"},
    ]
    plan = plan_redistribution(players, "north_user", 100)
    uids = {uid for uid, _, _ in plan}
    assert "AI_SOUTH" not in uids
    assert "north_user" not in uids
    assert sum(amt for _, amt, _ in plan) == 100.0
    assert len(plan) == 2  # east + west


def test_house_penalty_math():
    entry = 1000
    assert round(entry * HOUSE_PENALTY_PCT, 2) == 150.0


def test_zero_entry_no_redistribution():
    players = [
        {"user_id": "a", "seat": "north"},
        {"user_id": "b", "seat": "south"},
    ]
    assert plan_redistribution(players, "a", 0) == []


def test_nsew_short_seats():
    players = [
        {"user_id": "n", "seat": "N"},
        {"user_id": "s", "seat": "S"},
        {"user_id": "e", "seat": "E"},
        {"user_id": "w", "seat": "W"},
    ]
    plan = plan_redistribution(players, "n", 40)
    by_uid = {uid: role for uid, _, role in plan}
    assert by_uid["s"] == "partner"
    assert by_uid["e"] == "opponent"
    assert by_uid["w"] == "opponent"
