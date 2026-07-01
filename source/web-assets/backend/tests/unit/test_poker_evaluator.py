"""
Unit tests for PokerHandEvaluator (pure logic — no DB, no HTTP).
"""
from utils.poker_evaluator import PokerHandEvaluator as P


class TestCardRankValue:
    def test_numeric_ranks(self):
        assert P.card_rank_value('2') == 2
        assert P.card_rank_value('9') == 9
        assert P.card_rank_value('10') == 10

    def test_face_cards(self):
        assert P.card_rank_value('J') == 11
        assert P.card_rank_value('Q') == 12
        assert P.card_rank_value('K') == 13
        assert P.card_rank_value('A') == 14

    def test_invalid_rank_returns_zero(self):
        assert P.card_rank_value('ZZ') == 0
        assert P.card_rank_value('') == 0


class TestEvaluateHand:
    def test_fewer_than_five_cards_returns_high_card(self):
        name, rank, _ = P.evaluate_hand(['AH', 'KS'])
        assert name == 'High Card'
        assert rank == 1

    def test_recognises_royal_flush(self):
        cards = ['10H', 'JH', 'QH', 'KH', 'AH']
        name, rank, _ = P.evaluate_hand(cards)
        assert rank >= P.HAND_RANKINGS['Straight Flush']

    def test_recognises_four_of_a_kind(self):
        cards = ['9H', '9S', '9D', '9C', '2H']
        name, rank, _ = P.evaluate_hand(cards)
        assert name == 'Four of a Kind'
        assert rank == P.HAND_RANKINGS['Four of a Kind']

    def test_recognises_full_house(self):
        cards = ['10H', '10S', '10D', 'KC', 'KH']
        name, rank, _ = P.evaluate_hand(cards)
        assert name == 'Full House'

    def test_recognises_flush(self):
        cards = ['2H', '7H', 'JH', 'KH', '5H']
        name, rank, _ = P.evaluate_hand(cards)
        assert name in ('Flush', 'Straight Flush', 'Royal Flush')  # all acceptable
        assert rank >= P.HAND_RANKINGS['Flush']

    def test_recognises_straight(self):
        cards = ['5H', '6S', '7D', '8C', '9H']
        name, rank, _ = P.evaluate_hand(cards)
        assert name in ('Straight', 'Straight Flush')
        assert rank >= P.HAND_RANKINGS['Straight']

    def test_recognises_three_of_a_kind(self):
        cards = ['7H', '7S', '7D', 'KC', '2H']
        name, rank, _ = P.evaluate_hand(cards)
        assert name == 'Three of a Kind'

    def test_recognises_two_pair(self):
        cards = ['9H', '9S', '4D', '4C', 'KH']
        name, rank, _ = P.evaluate_hand(cards)
        assert name == 'Two Pair'

    def test_recognises_one_pair(self):
        cards = ['JH', 'JS', '2D', '7C', 'KH']
        name, rank, _ = P.evaluate_hand(cards)
        assert name == 'One Pair'

    def test_recognises_high_card(self):
        cards = ['2H', '5S', '7D', 'JC', 'KH']
        name, rank, _ = P.evaluate_hand(cards)
        assert name == 'High Card'
        assert rank == P.HAND_RANKINGS['High Card']
