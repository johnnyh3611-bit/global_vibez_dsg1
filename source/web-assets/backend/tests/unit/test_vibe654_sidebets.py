"""
Unit tests for Vibe654Engine — pure game logic for the 6-5-4 dice engine.
No DB, no HTTP.
"""
import pytest
from unittest.mock import patch

from routes.vibe_654_dice import Vibe654Engine


@pytest.fixture
def engine():
    return Vibe654Engine()


class TestRollDice:
    def test_returns_requested_count(self, engine):
        for n in (1, 3, 5, 7):
            result = engine.roll_dice(num_dice=n)
            assert len(result) == n

    def test_values_are_in_valid_range(self, engine):
        for _ in range(50):
            for v in engine.roll_dice(num_dice=5):
                assert 1 <= v <= 6


class TestPlayRoundQualification:
    def test_qualified_on_first_roll(self, engine):
        # Mock: first roll yields 6, 5, 4, 3, 2 → qualifies, point = 3+2 = 5
        with patch.object(engine, 'roll_dice', return_value=[6, 5, 4, 3, 2]):
            result = engine.play_round('player1')
            assert result['status'] == 'QUALIFIED'
            assert result['point'] == 5
            assert sorted(result['point_dice']) == [2, 3]

    def test_qualified_with_highest_point(self, engine):
        # 6, 5, 4, 6, 6 → qualifies (6,5,4 locked) → leftover [6, 6] → point 12
        with patch.object(engine, 'roll_dice', return_value=[6, 5, 4, 6, 6]):
            result = engine.play_round('player1')
            assert result['status'] == 'QUALIFIED'
            assert result['point'] == 12

    def test_bust_when_no_six_in_three_rolls(self, engine):
        # Three rolls with no 6 → BUST
        with patch.object(engine, 'roll_dice', return_value=[1, 2, 3, 4, 5]):
            result = engine.play_round('player1')
            assert result['status'] == 'BUST'
            assert result['point'] == 0
            assert len(result['rolls']) == 3

    def test_sequential_qualification_requires_6_before_5(self, engine):
        # First roll has 5 and 4 but no 6 → 5 and 4 ignored (must qualify 6 first)
        # Subsequent rolls also no 6 → BUST
        with patch.object(engine, 'roll_dice', return_value=[5, 4, 3, 2, 1]):
            result = engine.play_round('player1')
            assert result['status'] == 'BUST'

    def test_partial_qualification_across_rolls(self, engine):
        # Roll 1: 6 in the roll → locks 6
        # Roll 2: 5 → locks 5 (rolling 4 dice now)
        # Roll 3: 4 → locks 4 (rolling 3 dice now), leftover is point
        outputs = iter([
            [6, 1, 2, 3, 1],  # 6 locked, has_6=True
            [5, 2, 3, 1],     # 5 locked, has_5=True (4 dice rolled)
            [4, 3, 3],        # 4 locked, has_4=True (3 dice rolled). Leftover [3,3]=6
        ])
        with patch.object(engine, 'roll_dice', side_effect=lambda num_dice: next(outputs)):
            result = engine.play_round('player1')
            assert result['status'] == 'QUALIFIED'
            assert result['point'] == 6


class TestSideBets:
    def test_straight_set_of_sixes_pays_500(self, engine):
        """Bet STRAIGHT_6, roll 6-6-6-6-6 → 500:1 bet resolution."""
        results, envy = engine.check_side_bets(
            [6, 6, 6, 6, 6],
            [{'type': 'STRAIGHT_6', 'amount': 10}],
        )
        assert len(results) == 1
        r = results[0]
        # win_amount = 10 * 500 = 5000; envy_bonus = 5% = 250; net = 4750
        assert r['original_bet'] == 10
        assert r['payout'] == 4750.0
        assert r['envy_tip'] == 250.0

    def test_any_straight_is_hit_even_when_specific_loses(self, engine):
        results, _ = engine.check_side_bets(
            [3, 3, 3, 3, 3],
            [{'type': 'ANY_STRAIGHT', 'amount': 10}],
        )
        assert len(results) == 1
        # 10 * 100 = 1000; envy 2% = 20; net 980
        assert results[0]['payout'] == 980.0

    def test_triple_6_requires_three_plus_sixes(self, engine):
        # Hit: three 6s
        results, _ = engine.check_side_bets(
            [6, 6, 6, 2, 1],
            [{'type': 'TRIPLE_6', 'amount': 10}],
        )
        assert len(results) == 1
        # 10 * 30 = 300; envy 5% = 15; net 285
        assert results[0]['payout'] == 285.0

        # Miss: only two 6s
        results2, _ = engine.check_side_bets(
            [6, 6, 5, 4, 1],
            [{'type': 'TRIPLE_6', 'amount': 10}],
        )
        assert results2 == []

    def test_one_and_done_requires_all_three_of_6_5_4(self, engine):
        # Hit: contains 6, 5, 4
        results, _ = engine.check_side_bets(
            [6, 5, 4, 2, 1],
            [{'type': 'ONE_AND_DONE', 'amount': 10}],
        )
        assert len(results) == 1
        # 10 * 10 = 100; envy 2% = 2; net 98
        assert results[0]['payout'] == 98.0

        # Miss: no 4
        results2, _ = engine.check_side_bets(
            [6, 5, 3, 2, 1],
            [{'type': 'ONE_AND_DONE', 'amount': 10}],
        )
        assert results2 == []

    def test_large_straight_1_through_5(self, engine):
        results, _ = engine.check_side_bets(
            [1, 2, 3, 4, 5],
            [{'type': 'LARGE_STRAIGHT', 'amount': 10}],
        )
        assert len(results) == 1
        # 10 * 100 = 1000; envy 5% = 50; net 950
        assert results[0]['payout'] == 950.0

    def test_large_straight_2_through_6(self, engine):
        results, _ = engine.check_side_bets(
            [2, 3, 4, 5, 6],
            [{'type': 'LARGE_STRAIGHT', 'amount': 10}],
        )
        assert len(results) == 1
        assert results[0]['payout'] == 950.0

    def test_no_matching_side_bets_returns_empty(self, engine):
        results, envy = engine.check_side_bets(
            [1, 2, 3, 6, 5],
            [{'type': 'TRIPLE_6', 'amount': 10}],
        )
        assert results == []

    def test_multiple_side_bets_evaluated_independently(self, engine):
        # Roll [6, 5, 4, 3, 1]: contains 6-5-4 (one_and_done hit) but NOT a
        # large straight (missing 2) and NOT triple_6 (only one 6).
        results, _ = engine.check_side_bets(
            [6, 5, 4, 3, 1],
            [
                {'type': 'ONE_AND_DONE', 'amount': 10},    # hit
                {'type': 'TRIPLE_6', 'amount': 10},        # miss (only one 6)
                {'type': 'LARGE_STRAIGHT', 'amount': 10},  # miss (no 2)
            ],
        )
        # Only ONE_AND_DONE wins
        assert len(results) == 1
        assert results[0]['bet_type'] == 'ONE_AND_DONE'
