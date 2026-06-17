"""Unit tests for bonds.BOND_UNLOCK_RULES + _check_unlocks logic."""
from routes.bonds import BOND_UNLOCK_RULES, _bond_id, _check_unlocks


def test_bond_id_sorted_and_stable() -> None:
    assert _bond_id("bob", "alice") == "alice-bob"
    assert _bond_id("alice", "bob") == "alice-bob"
    assert _bond_id("alice", "bob") == _bond_id("bob", "alice")


def test_date_count_unlocks_twin_flame_at_3() -> None:
    assert _check_unlocks("date_count", 2, []) == []
    assert _check_unlocks("date_count", 3, []) == ["twin_flame_vfx"]


def test_date_count_unlocks_all_thresholds_cumulative() -> None:
    # 25+ reaches all 3 thresholds
    unlocks = _check_unlocks("date_count", 25, [])
    assert "twin_flame_vfx" in unlocks
    assert "nebula_floor_skin" in unlocks
    assert "eternal_vibe_aura" in unlocks


def test_already_unlocked_not_returned_again() -> None:
    unlocks = _check_unlocks("date_count", 25, ["twin_flame_vfx", "nebula_floor_skin"])
    assert unlocks == ["eternal_vibe_aura"]


def test_unknown_stat_returns_empty() -> None:
    assert _check_unlocks("not_a_real_stat", 100, []) == []


def test_all_declared_stats_present() -> None:
    for stat in ("date_count", "games_played", "shared_jackpots", "spades_win_streak"):
        assert stat in BOND_UNLOCK_RULES
