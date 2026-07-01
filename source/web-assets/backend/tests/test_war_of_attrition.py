"""
Lock-in tests for DSG "War of Attrition" Logic v1.0.
Source: Global_Vibez_Sovereign_Final_Constitution_v10.pdf (founder spec, Feb 2026).
"""
import pytest

from services.sovereign_game_logic import TieContender
from services.war_of_attrition import (
    RollResult,
    AttritionOutcome,
    initiate_shootout,
    compute_tie_tax_multiplier,
    reopen_spectator_side_action,
)
from services.pricing_master_vault import SOVEREIGN_TAX_RATE


# Deterministic roll helpers for testing --------------------------------
def roller_always_a_wins():
    def _r(a, b):
        return RollResult(is_tie=False, winner=a)
    return _r


def roller_always_b_wins():
    def _r(a, b):
        return RollResult(is_tie=False, winner=b)
    return _r


def roller_tie_n_then_a(n: int):
    state = {"ties": 0}
    def _r(a, b):
        if state["ties"] < n:
            state["ties"] += 1
            return RollResult(is_tie=True)
        return RollResult(is_tie=False, winner=a)
    return _r


# ── Section 1: Infinite Stake Loop ─────────────────────────────────────────
def test_no_tie_single_round_a_wins():
    a = TieContender("alice", 10.0)
    b = TieContender("bob", 10.0)
    out = initiate_shootout(a, b, current_pot=20.0, bounty=2.0,
                            roll_fn=roller_always_a_wins())
    assert out.status == "winner"
    assert out.winner.player_id == "alice"
    assert out.rounds_played == 1
    # 20 + 2*2 = 24
    assert out.final_pot == 24.0
    assert a.balance == 8.0 and b.balance == 8.0


def test_three_ties_then_a_wins():
    a = TieContender("alice", 100.0)
    b = TieContender("bob", 100.0)
    out = initiate_shootout(a, b, current_pot=10.0, bounty=2.0,
                            roll_fn=roller_tie_n_then_a(3))
    assert out.status == "winner"
    assert out.rounds_played == 4  # 3 ties + 1 resolution round
    # pot starts at 10, +4 per round × 4 rounds = 26
    assert out.final_pot == 26.0
    # Each player re-anted 4 times: 100 - 8 = 92
    assert a.balance == 92.0 and b.balance == 92.0


def test_bankruptcy_during_loop():
    a = TieContender("alice", 3.0)  # can cover 2.0 once; not twice
    b = TieContender("bob", 100.0)
    # Tie 1 → re-ante (a: 1.0) → Tie 2 → a cannot cover → bankruptcy
    out = initiate_shootout(a, b, current_pot=0.0, bounty=2.0,
                            roll_fn=roller_tie_n_then_a(5))
    assert out.status == "bankruptcy"
    assert out.winner.player_id == "bob"
    assert out.loser.player_id == "alice"
    # a had 3.0, could cover once (goes to 1.0), then can't cover 2.0 again
    assert a.balance == 1.0


def test_both_bankrupt():
    a = TieContender("alice", 0.5)
    b = TieContender("bob", 0.5)
    out = initiate_shootout(a, b, current_pot=0.0, bounty=2.0,
                            roll_fn=roller_always_a_wins())
    assert out.status == "all_bankrupt"
    assert out.winner is None and out.loser is None


def test_max_rounds_cap_enforced():
    def always_tie(a, b): return RollResult(is_tie=True)
    a = TieContender("a", 1_000_000.0)
    b = TieContender("b", 1_000_000.0)
    with pytest.raises(RuntimeError):
        initiate_shootout(a, b, 0, 1.0, roll_fn=always_tie, max_rounds=5)


def test_negative_bounty_rejected():
    a = TieContender("a", 10)
    b = TieContender("b", 10)
    with pytest.raises(ValueError):
        initiate_shootout(a, b, 0, -1, roll_fn=roller_always_a_wins())


def test_events_trace_every_round():
    a = TieContender("alice", 100.0)
    b = TieContender("bob", 100.0)
    out = initiate_shootout(a, b, current_pot=10.0, bounty=2.0,
                            roll_fn=roller_tie_n_then_a(2))
    types = [e["type"] for e in out.events]
    assert types.count("attrition.reentry") == 3
    assert types.count("attrition.resolved") == 1


# ── Section 2: Sovereign Tax Multiplier ────────────────────────────────────
def test_spec_example_tie_1():
    # Verbatim from PDF: "Original Pot: $10 (Tax: $1.35)  ·  Tie 1: Pot $20 (Tax: $2.70)"
    # Interpretation: bounty = 5 (so 2*bounty = 10 per tie).
    r = compute_tie_tax_multiplier(original_pot=10.0, tie_rounds=1, bounty=5.0)
    assert r["baseline_tax"] == 1.35
    assert r["per_tie_tax"] == 1.35  # 10 × 0.135
    assert r["total_tax"] == 2.70
    assert r["multiplier"] == 2.0


def test_spec_example_tie_2():
    # "Tie 2: Pot $30 (Tax: $4.05)"
    r = compute_tie_tax_multiplier(original_pot=10.0, tie_rounds=2, bounty=5.0)
    assert r["total_tax"] == 4.05
    assert r["multiplier"] == 3.0  # 300% of baseline = spec claim


def test_zero_pot_zero_multiplier():
    r = compute_tie_tax_multiplier(original_pot=0, tie_rounds=0, bounty=0)
    assert r["multiplier"] == 0.0


def test_tax_rate_matches_pricing_vault():
    r = compute_tie_tax_multiplier(original_pot=100.0, tie_rounds=0, bounty=0)
    assert r["tax_rate"] == SOVEREIGN_TAX_RATE == 0.135


def test_total_tax_matches_live_loop():
    """Live loop total_tax must equal static projection for same inputs."""
    a = TieContender("alice", 1000.0)
    b = TieContender("bob", 1000.0)
    out = initiate_shootout(a, b, current_pot=10.0, bounty=5.0,
                            roll_fn=roller_tie_n_then_a(2))
    # Live loop runs 3 rounds (2 ties + 1 win), each adds 2*5*0.135 = 1.35 tax
    assert out.total_tax == round(3 * 1.35, 8)


# ── Section 3: Spectator Side-Action ───────────────────────────────────────
def test_spectator_event_payload():
    alice = TieContender("alice", 10.0)
    bob = TieContender("bob", 10.0)
    ev = reopen_spectator_side_action(
        room_id="room_42", round_number=3,
        contenders=[alice, bob], current_pot=20.0,
    )
    assert ev["type"] == "attrition.spectator_window_open"
    assert ev["room_id"] == "room_42"
    assert ev["round_number"] == 3
    assert ev["current_pot"] == 20.0
    assert "Ride the Winner" in ev["label"]
    assert len(ev["contenders"]) == 2
