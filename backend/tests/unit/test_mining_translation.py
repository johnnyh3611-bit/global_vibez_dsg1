"""Unit tests for Phase 2/3 features: mining, safety-gate, translation, gifts."""
import pytest
from datetime import datetime, timedelta, timezone

from utils.safety_gate import compute_variance
from utils.mining_engine import (
    compute_tier_multiplier,
    compute_loyalty_multiplier,
    is_mining_eligible,
    BASE_REWARDS,
)


# ==================== SAFETY GATE ====================

def test_variance_bot_timing_flags():
    # Bot: exactly 1.0s intervals
    intervals = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
    assert compute_variance(intervals) < 0.01


def test_variance_human_timing_does_not_flag():
    # Human: jittery ~1s intervals
    intervals = [1.02, 0.98, 1.15, 0.87, 1.1, 0.91, 1.0, 1.2, 0.95, 1.05]
    assert compute_variance(intervals) >= 0.05


# ==================== MINING — TIERS & MULTIPLIERS ====================

def test_tier_multiplier_free_is_zero():
    assert compute_tier_multiplier({"subscription_tier": "free"}) == 0.0
    assert compute_tier_multiplier({"subscription_tier": None}) == 0.0
    assert compute_tier_multiplier({}) == 0.0


def test_tier_multiplier_premium_is_one():
    assert compute_tier_multiplier({"subscription_tier": "premium"}) == 1.0


def test_tier_multiplier_plus_is_half():
    assert compute_tier_multiplier({"subscription_tier": "plus"}) == 0.5


def test_tier_multiplier_elite_is_one_and_half():
    assert compute_tier_multiplier({"subscription_tier": "elite"}) == 1.5


def test_loyalty_multiplier_1yr_is_1_1():
    one_year_ago = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
    m = compute_loyalty_multiplier({"created_at": one_year_ago})
    assert 1.09 < m < 1.11


def test_loyalty_multiplier_caps_at_2():
    fifty_years_ago = (datetime.now(timezone.utc) - timedelta(days=365 * 50)).isoformat()
    assert compute_loyalty_multiplier({"created_at": fifty_years_ago}) == 2.0


def test_is_mining_eligible_free_rejected():
    ok, reason = is_mining_eligible({"subscription_tier": "free"})
    assert ok is False
    assert "Upgrade" in reason


def test_is_mining_eligible_premium_accepted():
    ok, _ = is_mining_eligible({"subscription_tier": "premium"})
    assert ok is True


def test_mining_option_c_rates():
    """User chose Option C: 1.5 per trick, 5 per game, 0.1 per minute."""
    assert BASE_REWARDS["trick_won"] == 1.5
    assert BASE_REWARDS["game_won"] == 5.0
    assert BASE_REWARDS["minute_at_table"] == 0.1


def test_game_type_multipliers_spades_vs_roulette():
    """Spades/BidWhist pay premium per the Mining Heartbeat spec."""
    from utils.mining_engine import GAME_TYPE_MULTIPLIER
    assert GAME_TYPE_MULTIPLIER["spades"] == 1.0
    assert GAME_TYPE_MULTIPLIER["bid_whist"] == 1.0
    # Roulette/dice/blackjack pay less
    assert GAME_TYPE_MULTIPLIER["roulette"] < 1.0
    assert GAME_TYPE_MULTIPLIER["blackjack"] < 1.0
    assert GAME_TYPE_MULTIPLIER["dice"] < 1.0


def test_vibe_check_hold_is_72_hours():
    from utils.mining_engine import VIBE_CHECK_HOLD_HOURS
    assert VIBE_CHECK_HOLD_HOURS == 72


def test_extended_rewards_include_spades_and_poker():
    assert "spades_hand_won" in BASE_REWARDS
    assert "bid_whist_hand_won" in BASE_REWARDS
    assert "poker_hand_won" in BASE_REWARDS
    assert "rummy_hand_won" in BASE_REWARDS
    assert "blackjack_round" in BASE_REWARDS
    assert BASE_REWARDS["spades_hand_won"] == 5.0
    assert BASE_REWARDS["blackjack_round"] == 2.0


def test_premium_1yr_year_trick_reward():
    """Premium (1.0) * loyalty 1.1 * base 1.5 = 1.65 per trick."""
    user = {
        "subscription_tier": "premium",
        "created_at": (datetime.now(timezone.utc) - timedelta(days=365)).isoformat(),
    }
    tier = compute_tier_multiplier(user)
    loyalty = compute_loyalty_multiplier(user)
    expected = 1.5 * tier * loyalty
    assert abs(expected - 1.65) < 0.01


# ==================== CHAT TRANSLATION (live LLM — skip if key missing) ====================

@pytest.mark.asyncio
async def test_translate_same_language_detected():
    import os
    if not os.environ.get("EMERGENT_LLM_KEY"):
        pytest.skip("EMERGENT_LLM_KEY not set")
    from routes.chat import translate_message
    r = await translate_message("Hello friend", "EN")
    assert r["translated"].lower().startswith("hello")
    assert r["same_language"] is True


@pytest.mark.asyncio
async def test_translate_french_to_english():
    import os
    if not os.environ.get("EMERGENT_LLM_KEY"):
        pytest.skip("EMERGENT_LLM_KEY not set")
    from routes.chat import translate_message
    r = await translate_message("Salut, comment vas-tu?", "EN")
    assert r["same_language"] is False
    # Should contain English greeting/question words
    low = r["translated"].lower()
    assert any(w in low for w in ["hi", "hello", "how are you"])


# ==================== STREAMING GIFT CATALOG ====================

def test_streaming_gift_catalog_structure():
    from routes.streaming import GIFTS_CATALOG
    for code, gift in GIFTS_CATALOG.items():
        assert "price" in gift
        assert "multiplier" in gift
        assert "duration_sec" in gift
        assert gift["multiplier"] >= 1.0
        assert gift["price"] > 0
