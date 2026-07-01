"""Unit tests for Card Royale tournament engine."""
import pytest
from datetime import datetime, timezone, timedelta
from utils.tournament_engine import score_round, simulate_bot_score, _next_slot_for


class TestScoreRound:
    def test_spades_made_bid_gets_boost(self):
        made = score_round("spades_score", {"bid": 4, "tricks": 5, "bags": 1})
        missed = score_round("spades_score", {"bid": 5, "tricks": 3, "bags": 0})
        assert made > missed

    def test_spades_score_clamped(self):
        s = score_round("spades_score", {"bid": 13, "tricks": 13, "bags": 10})
        assert 0 <= s <= 1000

    def test_blackjack_pnl_positive_above_500(self):
        assert score_round("blackjack_pnl", {"net_coins": 2000}) > 500

    def test_blackjack_pnl_negative_below_500(self):
        assert score_round("blackjack_pnl", {"net_coins": -2000}) < 500

    def test_blackjack_pnl_zero_is_midpoint(self):
        assert score_round("blackjack_pnl", {"net_coins": 0}) == pytest.approx(500.0)

    def test_poker_doubling_stack_caps(self):
        # 200K stack → 1000
        assert score_round("poker_stack", {"final_stack": 200_000}) == pytest.approx(1000.0)
        # 100K stack → 500
        assert score_round("poker_stack", {"final_stack": 100_000}) == pytest.approx(500.0)

    def test_poker_negative_clamped(self):
        assert score_round("poker_stack", {"final_stack": 0}) == 0.0

    def test_rummy_gin_gets_bonus(self):
        gin = score_round("rummy_deadwood", {"final_deadwood": 0, "gin": True})
        no_gin = score_round("rummy_deadwood", {"final_deadwood": 0, "gin": False})
        assert gin > no_gin
        assert gin - no_gin == pytest.approx(250.0)

    def test_rummy_deadwood_penalty(self):
        low = score_round("rummy_deadwood", {"final_deadwood": 5})
        high = score_round("rummy_deadwood", {"final_deadwood": 80})
        assert low > high

    def test_bid_whist_made_bid_rewards(self):
        made = score_round("bid_whist_score", {"bid": 5, "made": True, "uptown": True})
        missed = score_round("bid_whist_score", {"bid": 5, "made": False, "uptown": True})
        assert made > missed

    def test_bid_whist_downtown_multiplier(self):
        uptown = score_round("bid_whist_score", {"bid": 4, "made": True, "uptown": True})
        downtown = score_round("bid_whist_score", {"bid": 4, "made": True, "uptown": False})
        assert downtown > uptown

    def test_unknown_scoring_returns_zero(self):
        assert score_round("mystery_scoring", {}) == 0.0


class TestBotSim:
    def test_bot_score_in_range(self):
        for _ in range(100):
            s = simulate_bot_score("spades_score", difficulty=0.5)
            assert 0.0 <= s <= 1000.0

    def test_bot_score_harder_is_higher_on_average(self):
        easy = sum(simulate_bot_score("spades_score", 0.1) for _ in range(200)) / 200
        hard = sum(simulate_bot_score("spades_score", 0.9) for _ in range(200)) / 200
        assert hard > easy


class TestScheduler:
    def test_daily_next_slot_is_future(self):
        now = datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc)
        s = _next_slot_for("daily@20:00", now)
        assert s is not None and s > now
        assert s.hour == 20 and s.minute == 0

    def test_daily_after_time_rolls_over(self):
        now = datetime(2026, 4, 1, 22, 0, tzinfo=timezone.utc)
        s = _next_slot_for("daily@20:00", now)
        assert s is not None
        assert s.date() == (now + timedelta(days=1)).date()

    def test_every_n_hours(self):
        now = datetime(2026, 4, 1, 3, 15, tzinfo=timezone.utc)
        s = _next_slot_for("every_2h", now)
        assert s is not None and s > now
        assert s.hour % 2 == 0

    def test_weekly_saturday(self):
        now = datetime(2026, 4, 1, 12, 0, tzinfo=timezone.utc)  # Wed
        s = _next_slot_for("weekly@sat@21:00", now)
        assert s is not None and s > now
        assert s.weekday() == 5  # Saturday

    def test_invalid_cron_returns_none(self):
        assert _next_slot_for("some_garbage", datetime.now(timezone.utc)) is None
