"""
Unit tests for BaccaratGame — pure casino logic (no DB, no HTTP).
"""
import pytest
from utils.baccarat_game import BaccaratGame, get_baccarat_ai_bet


@pytest.fixture
def game():
    g = BaccaratGame()
    g.create_deck()
    return g


def _cards(*specs):
    """Helper: [('K', 'hearts'), ('5', 'clubs')] → dicts."""
    return [{'value': v, 'suit': s} for v, s in specs]


class TestCalculateScore:
    def test_empty_hand_is_zero(self, game):
        assert game.calculate_score([]) == 0

    def test_face_cards_are_zero(self, game):
        # K + Q + J = 0 + 0 + 0 = 0
        hand = _cards(('K', 'hearts'), ('Q', 'clubs'), ('J', 'spades'))
        assert game.calculate_score(hand) == 0

    def test_ace_counts_as_one(self, game):
        hand = _cards(('A', 'hearts'), ('5', 'clubs'))
        assert game.calculate_score(hand) == 6

    def test_score_is_last_digit_of_total(self, game):
        # 9 + 5 = 14 → 4
        hand = _cards(('9', 'hearts'), ('5', 'clubs'))
        assert game.calculate_score(hand) == 4

    def test_sum_twenty_yields_zero(self, game):
        # 10 + K = 20 → 0
        hand = _cards(('10', 'hearts'), ('K', 'clubs'))
        assert game.calculate_score(hand) == 0

    def test_natural_nine(self, game):
        # 9 + K = 9
        hand = _cards(('9', 'hearts'), ('K', 'clubs'))
        assert game.calculate_score(hand) == 9


class TestDetermineWinner:
    def test_player_wins(self, game):
        game.player_score = 8
        game.banker_score = 5
        game.determine_winner()
        assert game.winner == 'player'
        assert game.game_phase == 'finished'

    def test_banker_wins(self, game):
        game.player_score = 3
        game.banker_score = 7
        game.determine_winner()
        assert game.winner == 'banker'

    def test_tie(self, game):
        game.player_score = 6
        game.banker_score = 6
        game.determine_winner()
        assert game.winner == 'tie'


class TestCalculatePayout:
    def test_player_win_on_player_bet_pays_1_to_1(self, game):
        game.winner = 'player'
        assert game.calculate_payout('player', 100) == 200

    def test_banker_win_on_banker_bet_pays_after_commission(self, game):
        game.winner = 'banker'
        # 100 + (100 * 0.95) = 195
        assert game.calculate_payout('banker', 100) == 195

    def test_tie_win_on_tie_bet_pays_8_to_1(self, game):
        game.winner = 'tie'
        # 100 * 9 = 900 (original + 8x winnings)
        assert game.calculate_payout('tie', 100) == 900

    def test_tie_push_returns_bet(self, game):
        """Player/Banker bets push (return bet) on a tie."""
        game.winner = 'tie'
        assert game.calculate_payout('player', 100) == 100
        assert game.calculate_payout('banker', 100) == 100

    def test_tie_bet_loses_when_not_a_tie(self, game):
        game.winner = 'player'
        assert game.calculate_payout('tie', 100) == 0

    def test_losing_player_bet_returns_zero(self, game):
        game.winner = 'banker'
        assert game.calculate_payout('player', 100) == 0

    def test_losing_banker_bet_returns_zero(self, game):
        game.winner = 'player'
        assert game.calculate_payout('banker', 100) == 0


class TestThirdCardRules:
    """
    Drawing rules under Banker-drawing tableau
    (https://en.wikipedia.org/wiki/Baccarat#Tableau_of_drawing_rules)
    """

    def test_banker_stands_on_7_or_more(self, game):
        game.banker_score = 7
        assert game._should_banker_draw(player_drew=True, player_third_value=5) is False

    def test_banker_always_draws_at_0_to_2(self, game):
        for score in (0, 1, 2):
            game.banker_score = score
            assert game._should_banker_draw(player_drew=True, player_third_value=8) is True

    def test_banker_at_3_draws_unless_player_third_is_8(self, game):
        game.banker_score = 3
        # Player third = 8 → banker STANDS
        assert game._should_banker_draw(True, 8) is False
        # Player third = 7 → banker DRAWS
        assert game._should_banker_draw(True, 7) is True

    def test_banker_at_6_draws_only_on_player_third_6_or_7(self, game):
        game.banker_score = 6
        for v in (6, 7):
            assert game._should_banker_draw(True, v) is True
        for v in (0, 1, 2, 3, 4, 5, 8, 9):
            assert game._should_banker_draw(True, v) is False

    def test_banker_when_player_stands_draws_on_0_to_5(self, game):
        # "Player stood" path — banker draws on 3,4,5 (per calling context)
        for score in (3, 4, 5):
            game.banker_score = score
            assert game._should_banker_draw(player_drew=False, player_third_value=None) is True
        # At 6 and player stood → stand
        game.banker_score = 6
        assert game._should_banker_draw(player_drew=False, player_third_value=None) is False


class TestDealInitialCards:
    def test_deals_two_cards_to_each_side(self, game):
        state = game.deal_initial_cards()
        assert len(state['player_hand']) == 2
        assert len(state['banker_hand']) == 2

    def test_sets_game_phase_to_dealing(self, game):
        game.deal_initial_cards()
        assert game.game_phase == 'dealing'


class TestAIHelper:
    def test_returns_a_valid_bet_type(self):
        seen = set()
        for _ in range(200):
            bet = get_baccarat_ai_bet()
            assert bet in ('player', 'banker', 'tie')
            seen.add(bet)
        # With 200 samples, we should see at least two distinct bets
        assert len(seen) >= 2
