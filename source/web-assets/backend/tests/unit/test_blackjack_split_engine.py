"""Unit tests for BlackjackEngine split helpers (shared engine module)."""
import pytest

from services.blackjack_engine import Card, BlackjackEngine, split_dict_hand


@pytest.fixture
def engine():
    return BlackjackEngine()


class TestCanSplit:
    def test_pair_by_rank(self, engine):
        assert engine.can_split([Card("8", "hearts"), Card("8", "spades")])

    def test_ten_value_pair(self, engine):
        assert engine.can_split([Card("10", "hearts"), Card("K", "spades")])

    def test_rejects_non_pair(self, engine):
        assert not engine.can_split([Card("8", "hearts"), Card("9", "spades")])

    def test_rejects_three_cards(self, engine):
        assert not engine.can_split(
            [Card("8", "hearts"), Card("8", "spades"), Card("2", "clubs")]
        )


class TestPerformSplit:
    def test_returns_two_two_card_hands(self, engine):
        hand = [Card("A", "hearts"), Card("A", "spades")]
        a, b, bet_a, bet_b = engine.perform_split(hand, 50.0)
        assert len(a) == 2 and len(b) == 2
        assert a[0].rank == "A" and b[0].rank == "A"
        assert bet_a == bet_b == 50.0

    def test_raises_on_non_pair(self, engine):
        with pytest.raises(ValueError):
            engine.perform_split([Card("2", "hearts"), Card("3", "spades")], 10)


class TestSplitDictHand:
    def test_splits_and_consumes_deck(self):
        hand = [
            {"rank": "9", "suit": "hearts"},
            {"rank": "9", "suit": "clubs"},
        ]
        deck = [
            {"rank": "2", "suit": "spades"},
            {"rank": "3", "suit": "diamonds"},
            {"rank": "4", "suit": "hearts"},
        ]
        a, b, rest = split_dict_hand(hand, deck)
        assert len(a) == 2 and len(b) == 2
        assert len(rest) == 1
