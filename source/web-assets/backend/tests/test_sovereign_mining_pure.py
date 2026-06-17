"""
Pure-function tests for services/sovereign_mining.py.
Every formula and every edge case from the PDF's code blocks is covered.
"""
import pytest

from services import sovereign_mining as sm


# ── Stream 1 · Hardware Leasing ─────────────────────────────────────────

def test_leasing_basic_proportional_yield():
    # Device with 10% of network power → 10% of pool = 500_000 ₵
    y = sm.calculate_leasing_yield(
        device_power_score=1000,
        total_network_power=10_000,
        daily_pool_slice=5_000_000,
        is_active_pulse=True,
    )
    assert y == 500_000.0


def test_leasing_chromebook_floor_guarantees_minimum():
    # Power below floor should snap to CHROMEBOOK_MINIMUM.
    y = sm.calculate_leasing_yield(
        device_power_score=5,  # below CHROMEBOOK_FLOOR=100
        total_network_power=1_000_000,
        is_active_pulse=True,
    )
    assert y == sm.CHROMEBOOK_MINIMUM


def test_leasing_inactive_pulse_applies_80pct_penalty():
    active = sm.calculate_leasing_yield(1000, 10_000, 1_000_000, is_active_pulse=True)
    idle = sm.calculate_leasing_yield(1000, 10_000, 1_000_000, is_active_pulse=False)
    # PDF: "80% drop if inactive" = keep 20%.
    assert idle == pytest.approx(active * 0.20, rel=1e-6)


def test_leasing_zero_network_power_safe():
    assert sm.calculate_leasing_yield(100, 0, 5_000_000, True) == 0


# ── Stream 2 · Ambassador Node ──────────────────────────────────────────

def test_ambassador_gated_below_50_recruits():
    assert sm.ambassador_mining_override(network_game_volume=10_000_000, recruit_count=49) == 0


def test_ambassador_5pct_when_gated_opens():
    # PDF: OVERRIDE_RATE = 0.05
    assert sm.ambassador_mining_override(100_000, 50) == 5_000.0


def test_ambassador_scales_with_volume():
    assert sm.ambassador_mining_override(2_000_000, 100) == 100_000.0


# ── Stream 3 · Stream-to-Earn ───────────────────────────────────────────

def test_stream_bot_protection_zero_interactions():
    assert sm.calculate_stream_yield(watch_time_minutes=600, interaction_count=0) == 0


def test_stream_yield_linear_in_time():
    y = sm.calculate_stream_yield(watch_time_minutes=60, interaction_count=5)
    assert y == 60 * sm.STREAM_RATE_PER_MINUTE


# ── Stream 4 · Proof-of-Movement ────────────────────────────────────────

def test_movement_driver_earns_1_5x():
    assert sm.movement_mint(miles=10, is_driver=True) == 10 * 1.5


def test_movement_rider_earns_0_5x():
    assert sm.movement_mint(miles=10, is_driver=False) == 10 * 0.5


def test_movement_negative_or_zero_miles_safe():
    assert sm.movement_mint(miles=0, is_driver=True) == 0
    assert sm.movement_mint(miles=-5, is_driver=False) == 0


# ── Stream 5 · Tournament Minting ───────────────────────────────────────

def test_tournament_mint_is_10pct_of_prize_pool():
    assert sm.unlock_tournament_block(prize_pool=100_000) == 10_000


def test_tournament_empty_pool_mints_nothing():
    assert sm.unlock_tournament_block(0) == 0


# ── Stream 6 · Chair & Golden multipliers (stackable) ──────────────────

def test_multipliers_stack_chair_and_golden():
    # 1000 × 5 × 10 = 50_000
    assert sm.apply_multipliers(1000, is_chair_holder=True, is_golden_hour=True) == 50_000


def test_multipliers_identity_when_neither_active():
    assert sm.apply_multipliers(777, False, False) == 777


def test_multipliers_chair_only():
    assert sm.apply_multipliers(100, is_chair_holder=True) == 500


def test_multipliers_golden_only():
    assert sm.apply_multipliers(100, is_golden_hour=True) == 1000


# ── Security · Maturity & Master Node ─────────────────────────────────

def test_maturity_lock_blocks_under_30_days():
    assert sm.is_mature(29) is False
    assert sm.is_mature(30) is True
    assert sm.is_mature(31) is True


def test_founder_master_node_takes_1pct():
    assert sm.founder_master_node_cut(10_000) == 100
    assert sm.founder_master_node_cut(99) == 1  # rounds 0.99 → 1
    assert sm.founder_master_node_cut(0) == 0
