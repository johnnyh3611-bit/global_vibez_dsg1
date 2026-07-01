"""
Unit tests for blackjack SideBetCalculator + Card + BlackjackEngine.calculate_hand.
Pure logic — no DB, no HTTP.
"""
import pytest

from routes.blackjack import (
    Card,
    BlackjackEngine,
    SideBetCalculator,
    LightningMultiplier,
)


@pytest.fixture
def engine():
    return BlackjackEngine()


class TestCardValue:
    def test_face_cards_all_ten(self):
        assert Card('J', 'hearts').get_value() == 10
        assert Card('Q', 'hearts').get_value() == 10
        assert Card('K', 'hearts').get_value() == 10

    def test_ace_starts_at_eleven(self):
        assert Card('A', 'spades').get_value() == 11

    def test_numeric_ranks(self):
        assert Card('2', 'clubs').get_value() == 2
        assert Card('9', 'diamonds').get_value() == 9
        assert Card('10', 'hearts').get_value() == 10

    def test_to_string_uses_first_letter_of_suit_uppercased(self):
        assert Card('K', 'hearts').to_string() == 'KH'
        assert Card('10', 'spades').to_string() == '10S'


class TestCalculateHand:
    def test_empty_hand_is_zero(self, engine):
        assert engine.calculate_hand([]) == 0

    def test_two_face_cards_is_twenty(self, engine):
        assert engine.calculate_hand([Card('K', 'H'), Card('Q', 'S')]) == 20

    def test_natural_blackjack(self, engine):
        hand = [Card('A', 'S'), Card('K', 'H')]
        assert engine.calculate_hand(hand) == 21
        assert engine.is_blackjack(hand) is True

    def test_ace_demotes_when_busting(self, engine):
        # 11 + 10 + 5 = 26 → A becomes 1 → 16
        hand = [Card('A', 'S'), Card('10', 'H'), Card('5', 'D')]
        assert engine.calculate_hand(hand) == 16

    def test_multiple_aces(self, engine):
        # A + A + 9 → 11+1+9 = 21 (one ace demoted)
        hand = [Card('A', 'S'), Card('A', 'H'), Card('9', 'D')]
        assert engine.calculate_hand(hand) == 21

    def test_three_aces_plus_eight(self, engine):
        # A+A+A+8 → 11+1+1+8 = 21
        hand = [Card('A', 'S'), Card('A', 'H'), Card('A', 'D'), Card('8', 'C')]
        assert engine.calculate_hand(hand) == 21

    def test_bust_cannot_be_recovered(self, engine):
        # K+Q+5 = 25 → no aces to demote, bust stays 25
        hand = [Card('K', 'H'), Card('Q', 'S'), Card('5', 'D')]
        assert engine.calculate_hand(hand) == 25

    def test_is_blackjack_requires_two_cards(self, engine):
        # 21 with 3 cards is not a natural BJ
        hand = [Card('7', 'H'), Card('7', 'S'), Card('7', 'D')]
        assert engine.calculate_hand(hand) == 21
        assert engine.is_blackjack(hand) is False


class TestPerfectPairs:
    def test_perfect_pair_same_rank_same_suit_pays_25(self):
        r = SideBetCalculator.check_perfect_pairs(
            Card('K', 'hearts'), Card('K', 'hearts')
        )
        assert r == {'win': True, 'payout_multiplier': 25, 'type': 'Perfect Pair'}

    def test_colored_pair_same_color_pays_12(self):
        r = SideBetCalculator.check_perfect_pairs(
            Card('7', 'hearts'), Card('7', 'diamonds')
        )
        assert r == {'win': True, 'payout_multiplier': 12, 'type': 'Colored Pair'}
        r2 = SideBetCalculator.check_perfect_pairs(
            Card('7', 'clubs'), Card('7', 'spades')
        )
        assert r2 == {'win': True, 'payout_multiplier': 12, 'type': 'Colored Pair'}

    def test_mixed_pair_different_color_pays_5(self):
        r = SideBetCalculator.check_perfect_pairs(
            Card('7', 'hearts'), Card('7', 'spades')
        )
        assert r == {'win': True, 'payout_multiplier': 5, 'type': 'Mixed Pair'}

    def test_no_pair_loses(self):
        r = SideBetCalculator.check_perfect_pairs(
            Card('7', 'hearts'), Card('K', 'hearts')
        )
        assert r == {'win': False, 'payout_multiplier': 0, 'type': None}


class TestTwentyOnePlusThree:
    def test_suited_trips_pays_100(self):
        # All same rank AND all same suit
        r = SideBetCalculator.check_21_plus_3(
            Card('7', 'hearts'), Card('7', 'hearts'), Card('7', 'hearts')
        )
        assert r == {'win': True, 'payout_multiplier': 100, 'type': 'Suited Trips'}

    def test_straight_flush_pays_40(self):
        r = SideBetCalculator.check_21_plus_3(
            Card('5', 'hearts'), Card('6', 'hearts'), Card('7', 'hearts')
        )
        assert r == {'win': True, 'payout_multiplier': 40, 'type': 'Straight Flush'}

    def test_three_of_a_kind_different_suits_pays_30(self):
        r = SideBetCalculator.check_21_plus_3(
            Card('7', 'hearts'), Card('7', 'spades'), Card('7', 'clubs')
        )
        assert r == {'win': True, 'payout_multiplier': 30, 'type': 'Three of a Kind'}

    def test_straight_mixed_suits_pays_10(self):
        r = SideBetCalculator.check_21_plus_3(
            Card('5', 'hearts'), Card('6', 'spades'), Card('7', 'clubs')
        )
        assert r == {'win': True, 'payout_multiplier': 10, 'type': 'Straight'}

    def test_ace_low_straight_is_recognised(self):
        # A-2-3 special case
        r = SideBetCalculator.check_21_plus_3(
            Card('A', 'hearts'), Card('2', 'spades'), Card('3', 'clubs')
        )
        # Ace-low straight, mixed suits → Straight (10:1)
        assert r['win'] is True
        assert r['type'] == 'Straight'

    def test_flush_mixed_ranks_pays_5(self):
        r = SideBetCalculator.check_21_plus_3(
            Card('2', 'hearts'), Card('7', 'hearts'), Card('K', 'hearts')
        )
        assert r == {'win': True, 'payout_multiplier': 5, 'type': 'Flush'}

    def test_no_combination_loses(self):
        r = SideBetCalculator.check_21_plus_3(
            Card('2', 'hearts'), Card('7', 'spades'), Card('K', 'clubs')
        )
        assert r == {'win': False, 'payout_multiplier': 0, 'type': None}


class TestLightningMultiplier:
    def test_generate_multiplier_for_blackjack_is_in_set(self):
        # Run many times to hit all branches. Should only produce {6, 15, 25}.
        seen = set()
        for _ in range(500):
            seen.add(LightningMultiplier.generate_multiplier(is_blackjack=True))
        assert seen.issubset({6, 15, 25})
        assert len(seen) >= 1

    def test_generate_multiplier_for_standard_win_is_2_to_5(self):
        seen = set()
        for _ in range(500):
            seen.add(LightningMultiplier.generate_multiplier(is_blackjack=False))
        assert seen.issubset({2, 3, 4, 5})
        # Sampling 500 times the full {2,3,4,5} should appear in practice
        assert len(seen) >= 2

    def test_calculate_payout_multiplies(self):
        assert LightningMultiplier.calculate_payout(10, 5) == 50
        assert LightningMultiplier.calculate_payout(2.5, 4) == 10.0
        assert LightningMultiplier.calculate_payout(0, 10) == 0
