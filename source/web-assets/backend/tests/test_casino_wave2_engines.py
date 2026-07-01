"""Smoke tests for Casino Wave-II engines (Three Card, Pai Gow, etc.)."""
from __future__ import annotations

import pytest

from services import casino_wave2_engines as w2


def test_three_card_poker_deterministic() -> None:
    out = w2.play_three_card_poker(ante=10, raise_play=True, pair_plus=5, seed=42)
    assert out.player_hand and out.dealer_hand
    assert out.gross == out.ante_payout + out.play_payout + out.pair_plus_payout + out.ante_bonus


def test_three_card_poker_fold() -> None:
    out = w2.play_three_card_poker(ante=10, raise_play=False, pair_plus=0, seed=1)
    assert out.folded is True
    assert out.play_bet == 0


def test_pai_gow_basic() -> None:
    out = w2.play_pai_gow_simple(stake=10, seed=7)
    assert out["outcome"] in {"win", "lose", "push"}
    assert "player_high" in out and "dealer_high" in out


def test_casino_war_no_war() -> None:
    out = w2.play_casino_war(stake=10, go_to_war=False, seed=3)
    assert out["outcome"] in {"win", "lose", "tie_surrender"}


def test_chemin_de_fer_player_bet() -> None:
    out = w2.play_chemin_de_fer(bet_side="player", stake=10, seed=4)
    assert out["winner"] in {"player", "banker", "tie"}
    assert isinstance(out["player_total"], int) and isinstance(out["banker_total"], int)


def test_european_roulette_red_bet() -> None:
    landed = w2.spin_european_roulette(seed=5)
    out = w2.settle_european_roulette("red", None, 10, landed)
    if landed in w2.EU_ROULETTE_RED:
        assert out["won"] is True
    else:
        assert out["won"] is False


def test_european_roulette_straight_bet() -> None:
    out = w2.settle_european_roulette("straight", 17, 10, 17)
    assert out["won"] is True
    assert out["payout_ratio"] == 35


def test_hazard_pick_main_7() -> None:
    out = w2.play_hazard(main=7, stake=10, seed=99)
    assert out["main"] == 7
    assert out["outcome"] in {"nick_win", "crabs_loss", "chance_hit", "main_loss", "loss"}


def test_chuck_a_luck_payouts() -> None:
    out = w2.play_chuck_a_luck(picked_number=3, stake=10, seed=2)
    assert out["matches"] in {0, 1, 2, 3}
    assert out["payout_ratio"] in {0, 1, 2, 10}


def test_big_six_wheel_layout_total() -> None:
    total = sum(c for _, _, c in w2.BIG_SIX_LAYOUT)
    assert total == 54


def test_big_six_wheel_play() -> None:
    out = w2.play_big_six(bet_label="1", stake=10, seed=11)
    assert out["bet"] == "1"


def test_jacks_or_better_evaluates_royal() -> None:
    royal = [("10", "S"), ("J", "S"), ("Q", "S"), ("K", "S"), ("A", "S")]
    out = w2.play_jacks_or_better(royal, hold_indices=[0, 1, 2, 3, 4], stake=1, seed=1)
    assert out["category"] == "royal_flush"
    assert out["multiplier"] == 800


def test_fan_tan_pick_valid() -> None:
    out = w2.play_fan_tan(pick=2, stake=10, seed=8)
    assert 1 <= out["remainder"] <= 4
    assert isinstance(out["won"], bool)


def test_faro_basic() -> None:
    out = w2.play_faro(picked_rank="K", stake=10, seed=9)
    assert out["outcome"] in {"win", "lose", "split", "no_action"}


def test_vibes_dart_bullseye() -> None:
    out = w2.score_vibes_dart(distance_from_bullseye=0.0, stake=10)
    assert out["tier"] == "bullseye"
    assert out["payout_ratio"] == 50


def test_vibes_dart_miss() -> None:
    out = w2.score_vibes_dart(distance_from_bullseye=0.9, stake=10)
    assert out["tier"] == "miss"
    assert out["gross"] < 0
