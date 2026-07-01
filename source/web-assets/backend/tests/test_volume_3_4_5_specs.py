"""
Lock-in tests for the three Volume III/IV/V founder specs:
  - DSG_ComingSoon_Master_Engines.pdf  → services/coming_soon_engines.py
  - DSG_MyVibe_Social_Battle_Master.pdf → services/social_battle_engine.py
  - DSG_Sovereign_Gifting_Luxury_System.pdf → services/sovereign_gifting.py
"""
import pytest

from services.coming_soon_engines import (
    CARIBBEAN_STUD_PAYOUT_TABLE, caribbean_stud_dealer_qualifies,
    VIBES_SLOTS_RTP, VIBES_SLOTS_JACKPOT_FEED_PCT,
    vibes_slots_jackpot_contribution, trigger_sovereign_rain,
    BINGO_SOVEREIGN_SQUARE_INDICES, BINGO_SOVEREIGN_SQUARE_MULTIPLIER,
    is_bingo_sovereign_square,
    KENO_PERFECT_HIT_PAYOUT, KENO_ZERO_HIT_REBATE, keno_payout,
    SIC_BO_SPECIFIC_TRIPLE_PAYOUT, sic_bo_payout,
    CRAPS_SNAKE_EYES_PAYOUT, CRAPS_BOXCARS_PAYOUT, craps_prop_payout,
    VIBES_WHEEL_SLOTS, VIBES_WHEEL_SOVEREIGN_JOKER_PAYOUT,
    VIBES_WHEEL_SOVEREIGN_JOKER_BURN_PCT, vibes_wheel_spin_outcome,
)
from services.social_battle_engine import (
    STREAMER_SHARE_PCT, PLATFORM_SHARE_PCT, split_battle_pot,
    HYBRID_HEAT_RATIO, HYBRID_MINING_RATIO, hybrid_score,
    NITRO_GIFT_VALUE_DSG, SHIELD_GIFT_VALUE_DSG, apply_gas_gift,
    SOVEREIGN_CRATE_MIN_INTERVAL, SOVEREIGN_CRATE_MAX_INTERVAL,
    should_drop_sovereign_crate,
)
from services.sovereign_gifting import (
    GIFT_CREATOR_PCT, GIFT_TREASURY_PCT, GIFT_BURN_PCT,
    process_luxury_gift, lookup_gift_buff, GIFT_REGISTRY, VIBERIDEZ_GIFTS,
)


# ─────────────────────────────────────────────────────────────────────────────
# Volume IV: Coming Soon Master Engines
# ─────────────────────────────────────────────────────────────────────────────

# Caribbean Stud
def test_caribbean_stud_payout_table_locked():
    assert CARIBBEAN_STUD_PAYOUT_TABLE["royal_flush"] == 100
    assert CARIBBEAN_STUD_PAYOUT_TABLE["straight_flush"] == 50
    assert CARIBBEAN_STUD_PAYOUT_TABLE["full_house"] == 7


def test_dealer_qualifies_at_ace_king():
    assert caribbean_stud_dealer_qualifies("A", "K") is True


def test_dealer_does_not_qualify_below_ace_king():
    assert caribbean_stud_dealer_qualifies("A", "Q") is False
    assert caribbean_stud_dealer_qualifies("K", "Q") is False


# Vibes Slots
def test_vibes_slots_rtp_locked_at_96():
    assert VIBES_SLOTS_RTP == 0.96


def test_vibes_slots_jackpot_feed_is_1pct():
    assert VIBES_SLOTS_JACKPOT_FEED_PCT == 0.01


def test_vibes_slots_jackpot_contribution_math():
    res = vibes_slots_jackpot_contribution(spin_amount=100.0)
    assert res["jackpot_feed"] == 1.0
    assert res["retained_pool"] == 99.0


def test_sovereign_rain_payload():
    res = trigger_sovereign_rain(["u1", "u2", "u3"])
    assert res["gift_per_user"] == 1
    assert res["user_count"] == 3
    assert res["total_distributed"] == 3


def test_sovereign_rain_rejects_empty_user_list():
    with pytest.raises(ValueError):
        trigger_sovereign_rain([])


# Bingo Sovereign Square
def test_bingo_sovereign_square_indices():
    # 4 corners of 5x5 + center: (0,0)=0, (0,4)=4, (2,2)=12, (4,0)=20, (4,4)=24
    assert set(BINGO_SOVEREIGN_SQUARE_INDICES) == {0, 4, 12, 20, 24}


def test_bingo_sovereign_square_pays_2x():
    assert BINGO_SOVEREIGN_SQUARE_MULTIPLIER == 2.0


def test_is_bingo_sovereign_square_pattern():
    assert is_bingo_sovereign_square({0, 4, 12, 20, 24}) is True
    assert is_bingo_sovereign_square({0, 4, 12, 20}) is False    # missing one
    assert is_bingo_sovereign_square({0, 4, 12, 20, 24, 7}) is True  # extra OK


# Keno
def test_keno_perfect_hit_pays_10000():
    assert KENO_PERFECT_HIT_PAYOUT == 10_000
    res = keno_payout(picks=10, hits=10, stake=1.0)
    assert res["multiplier"] == 10000.0
    assert res["gross"] == 10_000.0


def test_keno_zero_hit_pays_one_coin_rebate():
    assert KENO_ZERO_HIT_REBATE == 1
    res = keno_payout(picks=10, hits=0, stake=10.0)
    assert res["gross"] == 1.0


def test_keno_partial_hit_below_50pct_pays_zero():
    res = keno_payout(picks=10, hits=4, stake=10.0)
    assert res["gross"] == 0.0


def test_keno_picks_bounds_enforced():
    with pytest.raises(ValueError):
        keno_payout(picks=11, hits=5, stake=1)
    with pytest.raises(ValueError):
        keno_payout(picks=0, hits=0, stake=1)


# Sic Bo
def test_sic_bo_specific_triple_pays_180_to_1():
    assert SIC_BO_SPECIFIC_TRIPLE_PAYOUT == 180
    res = sic_bo_payout("specific_triple_3", [3, 3, 3], stake=10.0)
    assert res["won"] is True
    assert res["gross"] == 1800.0


def test_sic_bo_wrong_triple_loses():
    res = sic_bo_payout("specific_triple_3", [4, 4, 4], stake=10.0)
    assert res["won"] is False
    assert res["gross"] == 0.0


def test_sic_bo_any_triple_pays_30():
    res = sic_bo_payout("any_triple", [5, 5, 5], stake=10.0)
    assert res["won"] is True
    assert res["payout_ratio"] == 30


# Craps Props
def test_craps_snake_eyes_pays_30():
    assert CRAPS_SNAKE_EYES_PAYOUT == 30
    res = craps_prop_payout("snake_eyes", (1, 1), stake=10.0)
    assert res["won"] is True
    assert res["gross"] == 300.0


def test_craps_boxcars_pays_30():
    assert CRAPS_BOXCARS_PAYOUT == 30
    res = craps_prop_payout("boxcars", (6, 6), stake=10.0)
    assert res["won"] is True


def test_craps_prop_loses_on_other_roll():
    res = craps_prop_payout("snake_eyes", (3, 4), stake=10)
    assert res["won"] is False


# Vibes Wheel
def test_vibes_wheel_has_54_slots():
    assert VIBES_WHEEL_SLOTS == 54


def test_vibes_wheel_sovereign_joker_pays_40():
    assert VIBES_WHEEL_SOVEREIGN_JOKER_PAYOUT == 40
    res = vibes_wheel_spin_outcome(landed_slot_index=0, stake=10.0)
    assert res["is_sovereign_joker"] is True
    assert res["gross"] == 400.0


def test_vibes_wheel_burn_is_10pct():
    assert VIBES_WHEEL_SOVEREIGN_JOKER_BURN_PCT == 0.10
    res = vibes_wheel_spin_outcome(landed_slot_index=27, stake=100.0)
    # 100 * 40 = 4000 gross. Burn = 4000 * 0.10 = 400.
    assert res["burn"] == 400.0


def test_vibes_wheel_non_joker_zero_payout():
    res = vibes_wheel_spin_outcome(landed_slot_index=15, stake=10.0)
    assert res["is_sovereign_joker"] is False
    assert res["gross"] == 0.0
    assert res["burn"] == 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Volume V: My Vibe Social & Battle Engine
# ─────────────────────────────────────────────────────────────────────────────
def test_battle_split_constants_locked():
    assert STREAMER_SHARE_PCT == 0.60
    assert PLATFORM_SHARE_PCT == 0.40
    assert STREAMER_SHARE_PCT + PLATFORM_SHARE_PCT == 1.0


def test_split_battle_pot_spec_math():
    # gift 100, seat 50 → totalPot 150
    # tax = 150 * 0.135 = 20.25 → netPot = 129.75
    # streamer = 129.75 * 0.60 = 77.85
    # platform = 129.75 * 0.40 = 51.90
    s = split_battle_pot(gift_total=100.0, seat_fees=50.0)
    assert s.total_pot == 150.0
    assert s.sovereign_tax == 20.25
    assert s.net_pot == 129.75
    assert s.streamer_share == 77.85
    assert s.platform_share == 51.90


def test_split_pot_zero_seat_fees():
    s = split_battle_pot(gift_total=200.0)
    assert s.total_pot == 200.0
    assert round(s.streamer_share + s.platform_share, 8) == s.net_pot


def test_split_pot_negative_rejected():
    with pytest.raises(ValueError):
        split_battle_pot(gift_total=-1)


def test_hybrid_50_50_blend():
    assert HYBRID_HEAT_RATIO == 0.5 and HYBRID_MINING_RATIO == 0.5
    assert hybrid_score(heat_score=100, mining_score=200) == 150.0


def test_nitro_gift_50_dsg():
    assert NITRO_GIFT_VALUE_DSG == 50
    e = apply_gas_gift("nitro")
    assert e.gift_type == "nitro"
    assert e.cost_dsg == 50
    assert e.multiplier_added == 1.0


def test_shield_gift_20_dsg_blocks_one_debuff():
    assert SHIELD_GIFT_VALUE_DSG == 20
    e = apply_gas_gift("shield")
    assert e.cost_dsg == 20
    assert e.debuffs_blocked == 1


def test_unknown_gas_gift_rejected():
    with pytest.raises(ValueError):
        apply_gas_gift("rocket")


def test_sovereign_crate_below_min_never_drops():
    assert should_drop_sovereign_crate(strolls_since_last_drop=10, rng_value=0.99) is False
    assert should_drop_sovereign_crate(strolls_since_last_drop=49, rng_value=0.99) is False


def test_sovereign_crate_above_max_always_drops():
    assert should_drop_sovereign_crate(strolls_since_last_drop=100, rng_value=0.0) is True
    assert should_drop_sovereign_crate(strolls_since_last_drop=200, rng_value=0.99) is True


def test_sovereign_crate_min_max_locked():
    assert SOVEREIGN_CRATE_MIN_INTERVAL == 50
    assert SOVEREIGN_CRATE_MAX_INTERVAL == 100


# ─────────────────────────────────────────────────────────────────────────────
# Volume III: Sovereign Gifting & Luxury
# ─────────────────────────────────────────────────────────────────────────────
def test_gift_split_constants_sum_to_100pct():
    assert GIFT_CREATOR_PCT == 0.60
    assert GIFT_TREASURY_PCT == 0.275
    assert GIFT_BURN_PCT == 0.125
    assert abs(GIFT_CREATOR_PCT + GIFT_TREASURY_PCT + GIFT_BURN_PCT - 1.0) < 1e-9


def test_process_luxury_gift_split_math():
    # $100 gift → $60 creator, $27.50 treasury, $12.50 burn
    s = process_luxury_gift(item_id="sovereign_crown", price=100.0,
                             buyer_id="b1", recipient_id="r1")
    assert s.creator_share == 60.0
    assert s.treasury_share == 27.5
    assert s.burn_share == 12.5


def test_process_luxury_gift_sums_to_price():
    s = process_luxury_gift(item_id="cyber_cigar", price=33.33,
                             buyer_id="b1", recipient_id="r1")
    total = round(s.creator_share + s.treasury_share + s.burn_share, 8)
    assert total == 33.33


def test_process_luxury_gift_negative_price_rejected():
    with pytest.raises(ValueError):
        process_luxury_gift(item_id="x", price=-1, buyer_id="b", recipient_id="r")


def test_sovereign_crown_buff_locked():
    b = lookup_gift_buff("sovereign_crown")
    assert b is not None
    assert b.boost_type == "mining_speed"
    assert b.boost_value == 0.10
    assert b.duration_minutes == 30


def test_cyber_cigar_buff_locked():
    b = lookup_gift_buff("cyber_cigar")
    assert b.boost_value == 0.05


def test_infinity_decanter_tax_rebate():
    b = lookup_gift_buff("infinity_decanter")
    assert b.boost_type == "tax_rebate"
    assert b.boost_value == 0.10
    assert b.rebate_count == 3


def test_gift_registry_has_three_tiers():
    assert len(GIFT_REGISTRY) == 3
    assert set(GIFT_REGISTRY.keys()) == {"sovereign_crown", "cyber_cigar", "infinity_decanter"}


def test_unknown_gift_returns_none():
    assert lookup_gift_buff("nonexistent_gift") is None


def test_viberidez_world_wrap_protocol():
    assert "neon_underglow" in VIBERIDEZ_GIFTS
    assert "priority_fuel" in VIBERIDEZ_GIFTS
    assert "haptic_sync" in VIBERIDEZ_GIFTS
    pf = VIBERIDEZ_GIFTS["priority_fuel"]
    assert pf.performance == "queue_priority_high_pay_rides"
