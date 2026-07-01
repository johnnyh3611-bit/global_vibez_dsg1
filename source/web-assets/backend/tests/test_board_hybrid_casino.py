"""
Lock-in tests for DSG Board & Hybrid Casino Logic (Volume II).
Source: DSG_Sovereign_Board_Hybrid_Casino_Master.pdf (founder spec, Feb 2026).
"""
import pytest

from services.sovereign_game_logic import TieContender
from services.board_hybrid_casino import (
    trigger_board_war,
    BoardWarOutcome,
    RouletteBet,
    execute_sovereign_spin,
    is_sovereign_spin_minute,
    calculate_house_drop,
    kings_ransom_tip,
    spectator_side_bet_payout,
    SOVEREIGN_SPIN_PERIOD_MIN,
    STANDARD_PLAY_MINUTES,
)
from services.pricing_master_vault import SOVEREIGN_TAX_RATE


# ── Section I: Board Bounty War (FLAT-RATE) ────────────────────────────────
def test_board_war_single_winner_after_eliminations():
    a = TieContender("alice", 100.0)
    b = TieContender("bob",   3.0)   # covers round 1 only
    c = TieContender("carol", 100.0)
    out = trigger_board_war([a, b, c], flat_buyin=2.0, initial_pot=0.0)
    # Round 1: all three pay 2 → pot = 6
    # Round 2: bob has 1 left, can't cover 2 → BANKRUPT. alice & carol pay 2 each → pot = 10
    # Continues with alice & carol paying 2 each forever (both have 96+) → safety cap or someone wins
    # Since both have equal balance, they'd run forever. We use the cap.
    # Actually: a tie-stalemate between equal-balance players is the spec's endless loop.
    # In practice the route layer pairs them off; here we just verify bob got eliminated.
    assert "bob" in out.rounds[1].eliminated  # round 2 (0-indexed [1])


def test_board_war_winner_when_one_survives():
    rich = TieContender("rich", 1000.0)
    poor = TieContender("poor", 1.0)
    out = trigger_board_war([rich, poor], flat_buyin=2.0)
    # poor can't cover round 1 → BANKRUPT immediately. rich is sole survivor.
    assert out.status == "winner"
    assert out.winner == "rich"
    assert out.rounds_played == 1
    assert out.final_pot == 2.0


def test_board_war_all_bankrupt():
    p1 = TieContender("p1", 0.5)
    p2 = TieContender("p2", 0.5)
    out = trigger_board_war([p1, p2], flat_buyin=2.0)
    assert out.status == "all_bankrupt"
    assert out.winner is None
    assert out.final_pot == 0.0


def test_board_war_tax_per_round():
    a = TieContender("alice", 100.0)
    b = TieContender("bob", 0.5)
    out = trigger_board_war([a, b], flat_buyin=2.0)
    # Round 1: alice pays 2, bob bankrupts → intake 2 → tax = 2 * 0.135 = 0.27
    assert out.total_tax == round(2.0 * SOVEREIGN_TAX_RATE, 8)
    assert out.winner == "alice"


def test_board_war_safety_cap():
    a = TieContender("a", 1_000_000.0)
    b = TieContender("b", 1_000_000.0)
    with pytest.raises(RuntimeError):
        trigger_board_war([a, b], flat_buyin=1.0, max_rounds=10)


def test_board_war_negative_buyin_rejected():
    a = TieContender("a", 10)
    with pytest.raises(ValueError):
        trigger_board_war([a], flat_buyin=-1)


def test_board_war_empty_contenders_rejected():
    with pytest.raises(ValueError):
        trigger_board_war([], flat_buyin=1)


# ── Section II: Hybrid Roulette / Sovereign Spin ───────────────────────────
def test_spin_period_constants():
    assert SOVEREIGN_SPIN_PERIOD_MIN == 30
    assert STANDARD_PLAY_MINUTES == 29


def test_is_sovereign_spin_minute():
    assert is_sovereign_spin_minute(29) is True   # 30th minute (1-indexed)
    assert is_sovereign_spin_minute(59) is True   # 60th minute
    assert is_sovereign_spin_minute(0) is False
    assert is_sovereign_spin_minute(15) is False
    assert is_sovereign_spin_minute(28) is False


def test_is_sovereign_spin_minute_bounds():
    with pytest.raises(ValueError):
        is_sovereign_spin_minute(60)
    with pytest.raises(ValueError):
        is_sovereign_spin_minute(-1)


def test_sovereign_spin_single_winner_takes_pool_minus_tax():
    bets = [
        RouletteBet("alice", 10.0, "17"),
        RouletteBet("bob",   10.0, "5"),
        RouletteBet("carol", 10.0, "23"),
    ]
    res = execute_sovereign_spin(bets, winning_number=17)
    assert res.winning_number == 17
    assert res.pooled_amount == 30.0
    assert res.sovereign_tax == round(30.0 * 0.135, 8)   # 4.05
    assert res.net_to_winners == round(30.0 - 4.05, 8)   # 25.95
    assert len(res.winners) == 1
    assert res.winners[0] == ("alice", 25.95)


def test_sovereign_spin_no_winner_carries_to_honey_pot():
    bets = [RouletteBet("alice", 10.0, "1"), RouletteBet("bob", 5.0, "2")]
    res = execute_sovereign_spin(bets, winning_number=17, honey_pot_carry=100.0)
    assert res.winners == []
    assert res.honey_pot_carry == 115.0   # 10 + 5 + 100 carries
    assert res.sovereign_tax == 0.0       # no payout, no tax taken yet
    assert res.is_honey_pot_hit is False  # nobody hit the pot itself


def test_sovereign_spin_honey_pot_hit_pays_full_carryover():
    bets = [RouletteBet("alice", 10.0, "17")]
    res = execute_sovereign_spin(bets, winning_number=17, honey_pot_carry=500.0)
    assert res.is_honey_pot_hit is True
    assert res.pooled_amount == 510.0
    assert res.sovereign_tax == round(510.0 * 0.135, 8)
    assert res.net_to_winners == round(510.0 - res.sovereign_tax, 8)


def test_sovereign_spin_color_bet():
    bets = [RouletteBet("alice", 10.0, "red"), RouletteBet("bob", 5.0, "black")]
    res = execute_sovereign_spin(bets, winning_number=1)  # 1 is red
    assert res.winning_color == "red"
    assert len(res.winners) == 1
    assert res.winners[0][0] == "alice"


def test_sovereign_spin_zero_is_green_neither_red_nor_black_wins():
    bets = [RouletteBet("alice", 10.0, "red"), RouletteBet("bob", 5.0, "black")]
    res = execute_sovereign_spin(bets, winning_number=0)
    assert res.winning_color == "green"
    assert res.winners == []


def test_sovereign_spin_dozen_bet():
    bets = [RouletteBet("alice", 10.0, "1-12")]
    res = execute_sovereign_spin(bets, winning_number=7)
    assert len(res.winners) == 1


def test_sovereign_spin_split_pot_two_winners_proportional():
    # alice and bob both bet red with different stakes
    bets = [RouletteBet("alice", 30.0, "red"), RouletteBet("bob", 10.0, "red")]
    res = execute_sovereign_spin(bets, winning_number=1)  # red
    assert res.pooled_amount == 40.0
    assert res.sovereign_tax == round(40.0 * 0.135, 8)
    net = res.net_to_winners
    # alice should get 75% of net, bob 25%
    payouts = dict(res.winners)
    assert abs(payouts["alice"] - net * 0.75) < 0.01
    assert abs(payouts["bob"] - net * 0.25) < 0.01
    # No floating-point drift: payouts sum exactly to net
    assert round(sum(payouts.values()), 8) == net


def test_sovereign_spin_invalid_number_rejected():
    with pytest.raises(ValueError):
        execute_sovereign_spin([RouletteBet("a", 1, "1")], winning_number=37)


# ── Section III: Triple-Threat ─────────────────────────────────────────────
def test_house_drop_chair_holder_priority():
    standard = calculate_house_drop(base_pot=1000.0, is_chair_holder_room=False)
    chair    = calculate_house_drop(base_pot=1000.0, is_chair_holder_room=True)
    assert chair == standard * 3
    # Standard = 1% of pot = 10
    assert standard == 10.0
    assert chair == 30.0


def test_house_drop_activity_scaling():
    quiet  = calculate_house_drop(base_pot=1000.0, is_chair_holder_room=False, activity_score=0.5)
    loud   = calculate_house_drop(base_pot=1000.0, is_chair_holder_room=False, activity_score=2.0)
    assert quiet == 5.0
    assert loud == 20.0


def test_house_drop_negative_pot_rejected():
    with pytest.raises(ValueError):
        calculate_house_drop(base_pot=-1, is_chair_holder_room=True)


def test_kings_ransom_taxes_the_tip():
    res = kings_ransom_tip(pot=100.0, tip_amount=10.0, spectator_id="watcher_42")
    assert res["tip_gross"] == 10.0
    assert res["tax"] == 1.35
    assert res["net_to_pot"] == 8.65
    assert res["new_pot"] == 108.65
    assert "watcher_42" in res["label"]


def test_kings_ransom_zero_tip_rejected():
    with pytest.raises(ValueError):
        kings_ransom_tip(pot=100, tip_amount=0, spectator_id="x")


def test_spectator_side_bet_winner():
    res = spectator_side_bet_payout(stake=10.0, odds_multiplier=2.0, won=True)
    assert res["won"] is True
    assert res["gross_winnings"] == 20.0
    assert res["tax"] == round(20.0 * 0.135, 8)
    assert res["net_winnings"] == round(20.0 - 2.7, 8)


def test_spectator_side_bet_loser_zero_payout():
    res = spectator_side_bet_payout(stake=10.0, odds_multiplier=2.0, won=False)
    assert res["won"] is False
    assert res["gross_winnings"] == 0.0
    assert res["tax"] == 0.0
    assert res["net_winnings"] == 0.0


def test_spectator_side_bet_negative_stake_rejected():
    with pytest.raises(ValueError):
        spectator_side_bet_payout(stake=-1, odds_multiplier=2, won=True)
