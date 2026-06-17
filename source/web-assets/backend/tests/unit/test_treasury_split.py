"""Unit tests for the pure 40-30-30 split calculator (no DB)."""
from __future__ import annotations

import math
import pytest

from services.treasury_split import (
    DEFAULT_FOUNDER_CAP_AMOUNT_USD,
    DEFAULT_FOUNDER_CAP_TRIGGER_MRR_USD,
    TreasuryConfig,
    calculate_split,
)


def _approx(a: float, b: float, *, tol: float = 1e-6) -> bool:
    return math.isclose(a, b, abs_tol=tol)


class TestSplitMath:
    def test_default_split_sums_to_gross(self):
        r = calculate_split(1000.0)
        assert _approx(r.team_usd + r.ops_usd + r.reserve_usd, 1000.0)

    def test_default_buckets(self):
        r = calculate_split(1000.0)
        assert _approx(r.team_usd, 300.0)        # 30%
        assert _approx(r.ops_usd, 400.0)         # 40%
        assert _approx(r.reserve_usd, 300.0)     # 30%

    def test_team_subsplit_13_17(self):
        r = calculate_split(1000.0)
        # 13% of gross + 17% of gross = 30% (= team bucket)
        assert _approx(r.founder_usd, 130.0)
        assert _approx(r.core_team_usd, 170.0)
        assert _approx(r.founder_usd + r.core_team_usd, r.team_usd)

    def test_zero_gross_returns_zero(self):
        r = calculate_split(0.0)
        assert r.team_usd == 0.0 and r.ops_usd == 0.0 and r.reserve_usd == 0.0

    def test_negative_gross_raises(self):
        with pytest.raises(ValueError):
            calculate_split(-50.0)


class TestFounderCap:
    def test_cap_does_not_engage_below_trigger(self):
        # MRR is below the $1M trigger → no cap applied.
        r = calculate_split(
            5_000.0,
            current_month_revenue_usd=500_000.0,  # below trigger
            current_month_founder_paid_usd=0.0,
        )
        assert r.founder_capped is False
        assert _approx(r.founder_usd, 650.0)   # 13% of 5k
        assert r.founder_overflow_to_chair_pool_usd == 0.0

    def test_cap_engages_above_trigger_and_redirects_overflow(self):
        # MRR ≥ trigger AND founder already paid the full $20k cap →
        # entire 13% slice should overflow into the reserve.
        r = calculate_split(
            10_000.0,
            current_month_revenue_usd=DEFAULT_FOUNDER_CAP_TRIGGER_MRR_USD + 1,
            current_month_founder_paid_usd=DEFAULT_FOUNDER_CAP_AMOUNT_USD,
        )
        assert r.founder_capped is True
        assert _approx(r.founder_usd, 0.0)
        assert _approx(r.founder_overflow_to_chair_pool_usd, 1300.0)
        # Reserve should absorb the overflow on top of its 30% share.
        assert _approx(r.reserve_usd, 3000.0 + 1300.0)
        # Buckets must still sum (reserve carries the redirected founder $).
        assert _approx(r.team_usd + r.ops_usd + r.reserve_usd, 11_300.0)

    def test_cap_partial_headroom(self):
        # $19,000 already paid this month, $1,000 headroom remaining.
        # Tx of $20,000 → founder normally gets 13% = $2,600 →
        # only $1,000 of headroom available, $1,600 overflows.
        r = calculate_split(
            20_000.0,
            current_month_revenue_usd=DEFAULT_FOUNDER_CAP_TRIGGER_MRR_USD + 1,
            current_month_founder_paid_usd=19_000.0,
        )
        assert r.founder_capped is True
        assert _approx(r.founder_usd, 1000.0)
        assert _approx(r.founder_overflow_to_chair_pool_usd, 1600.0)

    def test_cap_disabled_means_no_cap_even_above_trigger(self):
        cfg = TreasuryConfig(auto_cap_enabled=False)
        r = calculate_split(
            10_000.0,
            config=cfg,
            current_month_revenue_usd=2_000_000.0,
            current_month_founder_paid_usd=DEFAULT_FOUNDER_CAP_AMOUNT_USD,
        )
        assert r.founder_capped is False
        assert _approx(r.founder_usd, 1300.0)


class TestConfigValidation:
    def test_buckets_must_total_100(self):
        with pytest.raises(ValueError):
            calculate_split(100.0, config=TreasuryConfig(team_pct=30, ops_pct=40, reserve_pct=20))

    def test_team_subsplit_must_match_team_pct(self):
        # founder_pct + core_team_pct must equal team_pct
        with pytest.raises(ValueError):
            calculate_split(
                100.0,
                config=TreasuryConfig(founder_pct=15, core_team_pct=10),
            )
