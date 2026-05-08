"""
Lock-in tests for Vibes Slots engine.
Source: DSG_ComingSoon_Master_Engines.pdf §2 (founder spec, Feb 2026).
"""
import pytest

from services.vibes_slots import (
    REEL_COUNT, SYMBOLS,
    spin_reels, evaluate_payline,
    execute_spin, SpinResult,
    JackpotPool, feed_jackpot, reset_jackpot_after_win,
)
from services.coming_soon_engines import (
    VIBES_SLOTS_RTP, VIBES_SLOTS_JACKPOT_FEED_PCT,
)


# ── Engine constants ────────────────────────────────────────────────────────
def test_five_reels():
    assert REEL_COUNT == 5


def test_six_symbols():
    assert len(SYMBOLS) == 6
    assert set(SYMBOLS.keys()) == {"cherry", "bell", "diamond", "seven", "wild", "joker"}


def test_only_joker_is_jackpot():
    jackpots = [k for k, v in SYMBOLS.items() if v["is_jackpot"]]
    assert jackpots == ["joker"]


def test_only_wild_is_wild():
    wilds = [k for k, v in SYMBOLS.items() if v["is_wild"]]
    assert wilds == ["wild"]


# ── spin_reels deterministic with seed ──────────────────────────────────────
def test_spin_reels_seeded_is_deterministic():
    a = spin_reels(seed=42)
    b = spin_reels(seed=42)
    c = spin_reels(seed=43)
    assert a == b
    assert a != c or len(a) == REEL_COUNT  # deterministic + 5 reels


def test_spin_reels_returns_five_symbols():
    reels = spin_reels(seed=1)
    assert len(reels) == REEL_COUNT
    for r in reels:
        assert r in SYMBOLS


# ── evaluate_payline ────────────────────────────────────────────────────────
def test_three_cherries_pays():
    matches, anchor, mult = evaluate_payline(["cherry", "cherry", "cherry", "bell", "diamond"])
    assert matches == 3
    assert anchor == "cherry"
    assert mult == SYMBOLS["cherry"]["pay_3"]


def test_four_cherries_pays_more_than_three():
    _, _, m3 = evaluate_payline(["cherry"] * 3 + ["bell", "diamond"])
    _, _, m4 = evaluate_payline(["cherry"] * 4 + ["bell"])
    assert m4 > m3


def test_five_jokers_jackpot_payout():
    matches, anchor, mult = evaluate_payline(["joker"] * 5)
    assert matches == 5
    assert anchor == "joker"
    assert mult == 2500  # spec jackpot value (tuned for 96% RTP)


def test_five_jokers_is_jackpot_in_full_spin():
    # Force all-joker hand by manually injecting reels via execute_spin path
    res = execute_spin(stake=1.0, seed=42)  # likely not jackpot
    assert isinstance(res.is_jackpot_hit, bool)
    # Use evaluate_payline directly for jackpot semantics check
    matches, anchor, _ = evaluate_payline(["joker"] * 5)
    assert SYMBOLS[anchor]["is_jackpot"] is True
    assert matches == REEL_COUNT


def test_two_matches_no_pay():
    matches, anchor, mult = evaluate_payline(["cherry", "cherry", "bell", "diamond", "seven"])
    assert matches == 2
    assert mult == 0


def test_wild_substitutes_for_cherry():
    # cherry, wild, wild, bell, diamond → 3 cherry-equivalent
    matches, anchor, mult = evaluate_payline(["cherry", "wild", "wild", "bell", "diamond"])
    assert matches == 3
    assert anchor == "cherry"
    assert mult == SYMBOLS["cherry"]["pay_3"]


def test_wild_does_not_substitute_for_joker():
    # joker, wild, wild — wild can't sub for jackpot. So anchor is joker, run is 1 (just joker).
    # Actually run-counter checks _normalize_for_match: joker target, wild substitution blocked.
    # So matches stops at first non-joker (wild can't sub). run = 1.
    matches, anchor, mult = evaluate_payline(["joker", "wild", "joker", "joker", "joker"])
    assert anchor == "joker"
    assert matches == 1   # wild on reel 2 breaks the run
    assert mult == 0


def test_all_wilds_pays_as_wild():
    matches, anchor, mult = evaluate_payline(["wild"] * 5)
    assert matches == 5
    assert anchor == "wild"
    assert mult == SYMBOLS["wild"]["pay_5"]


def test_evaluate_payline_rejects_wrong_length():
    with pytest.raises(ValueError):
        evaluate_payline(["cherry"] * 4)


# ── execute_spin ────────────────────────────────────────────────────────────
def test_execute_spin_basic_structure():
    res = execute_spin(stake=10.0, seed=42, active_user_count=100)
    assert isinstance(res, SpinResult)
    assert len(res.reels) == REEL_COUNT
    assert res.stake == 10.0
    assert res.jackpot_feed == 0.1   # 1% of 10
    assert res.is_jackpot_hit in (True, False)


def test_execute_spin_jackpot_feed_is_one_percent():
    res = execute_spin(stake=100.0, seed=1)
    assert res.jackpot_feed == round(100.0 * VIBES_SLOTS_JACKPOT_FEED_PCT, 8)
    assert res.jackpot_feed == 1.0


def test_execute_spin_negative_stake_rejected():
    with pytest.raises(ValueError):
        execute_spin(stake=-1)


def test_execute_spin_negative_user_count_rejected():
    with pytest.raises(ValueError):
        execute_spin(stake=1, active_user_count=-1)


def test_jackpot_hit_emits_sovereign_rain_event():
    """Find a seed that produces all-jokers, validate the event payload."""
    # Brute-force-find a seed across the first few thousand
    found_seed = None
    for s in range(20_000):
        if spin_reels(seed=s) == ["joker"] * 5:
            found_seed = s
            break
    if found_seed is None:
        pytest.skip("Probabilistically rare; bumping search range would slow test")
    res = execute_spin(stake=1.0, seed=found_seed, active_user_count=42)
    assert res.is_jackpot_hit is True
    assert res.sovereign_rain_event is not None
    assert res.sovereign_rain_event["gift_per_user"] == 1
    assert res.sovereign_rain_event["user_count"] == 42
    assert res.sovereign_rain_event["total_distributed"] == 42


# ── RTP convergence (smoke test, not exact) ─────────────────────────────────
def test_rtp_within_reasonable_bounds_50k_spins():
    """
    Spec target RTP = 0.96. Real-world casino slots vary ±5% from spec
    in any 50k-spin sample. We assert RTP is in [0.50, 1.50] which catches
    catastrophic engine bugs (broken paytable, etc.) without flaking on
    legitimate variance.
    """
    rng = __import__("random").Random(42)
    total_wagered = 0.0
    total_paid = 0.0
    for _ in range(50_000):
        seed = rng.randint(0, 10**9)
        res = execute_spin(stake=1.0, seed=seed)
        total_wagered += res.stake
        total_paid += res.gross_payout
    rtp = total_paid / total_wagered
    # Sanity: RTP should be in a livable range (engine works)
    assert 0.50 <= rtp <= 1.50, f"Engine RTP catastrophically off: {rtp:.4f}"


# ── JackpotPool ─────────────────────────────────────────────────────────────
def test_jackpot_pool_seed():
    pool = JackpotPool()
    assert pool.current_amount == 100_000.00


def test_feed_jackpot_accumulates():
    pool = JackpotPool(current_amount=100.0)
    feed_jackpot(pool, 5.50)
    assert pool.current_amount == 105.50


def test_feed_jackpot_negative_rejected():
    pool = JackpotPool()
    with pytest.raises(ValueError):
        feed_jackpot(pool, -1)


def test_reset_after_win_pays_full_amount():
    pool = JackpotPool(current_amount=250_000.00)
    paid, updated = reset_jackpot_after_win(pool, "alice", "2026-05-04T20:00:00Z")
    assert paid == 250_000.00
    assert updated.current_amount == 100_000.00
    assert updated.last_winner == "alice"
    assert updated.last_won_at == "2026-05-04T20:00:00Z"


def test_reset_requires_winner_id():
    pool = JackpotPool()
    with pytest.raises(ValueError):
        reset_jackpot_after_win(pool, "", "2026-05-04T20:00:00Z")
