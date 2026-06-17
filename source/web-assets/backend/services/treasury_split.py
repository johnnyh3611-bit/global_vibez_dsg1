"""
Vibez Treasury — pure split calculator + ledger writer.

Implements the 40-30-30 revenue allocation model:
  - 30% Team (subdivided: 13% Founder's Draw + 17% Core Team)
  - 40% Platform Operations (servers, marketing, RPC, etc.)
  - 30% Reserve (war chest + chair-holder rewards pool)

Auto-cap rule (Pro-Founder Tip):
  - Once monthly platform revenue exceeds $1,000,000 USD, the Founder's
    Draw is capped at $20,000 / month. Any overflow flows into the
    Chair Holder Rewards Pool (a sub-bucket of the Reserve).

This module is INTENTIONALLY pure — no DB writes, no I/O, no Solana RPC.
That keeps it trivial to unit-test and reason about. The persistence
layer is in `routes/treasury.py`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional


# ─────────────────────────────────────────── canonical defaults
# Admins can override these via /api/admin/treasury/config (see routes).
DEFAULT_TEAM_PCT = 30.0
DEFAULT_OPS_PCT = 40.0
DEFAULT_RESERVE_PCT = 30.0

DEFAULT_FOUNDER_PCT_OF_GROSS = 13.0      # 13% of GROSS revenue
DEFAULT_CORE_TEAM_PCT_OF_GROSS = 17.0    # 17% of GROSS revenue (sums to 30% team bucket)

# Auto-cap thresholds.
DEFAULT_FOUNDER_CAP_TRIGGER_MRR_USD = 1_000_000.0
DEFAULT_FOUNDER_CAP_AMOUNT_USD = 20_000.0


@dataclass
class TreasuryConfig:
    """Tunable percentages — persisted in `treasury_config` collection."""
    team_pct: float = DEFAULT_TEAM_PCT
    ops_pct: float = DEFAULT_OPS_PCT
    reserve_pct: float = DEFAULT_RESERVE_PCT
    founder_pct: float = DEFAULT_FOUNDER_PCT_OF_GROSS
    core_team_pct: float = DEFAULT_CORE_TEAM_PCT_OF_GROSS
    founder_cap_trigger_mrr_usd: float = DEFAULT_FOUNDER_CAP_TRIGGER_MRR_USD
    founder_cap_amount_usd: float = DEFAULT_FOUNDER_CAP_AMOUNT_USD
    auto_cap_enabled: bool = True
    # External integration handles (filled in once user provides creds).
    squads_address: Optional[str] = None
    streamflow_api_key_present: bool = False
    usdc_swap_enabled: bool = False

    def validate(self) -> None:
        total = self.team_pct + self.ops_pct + self.reserve_pct
        if abs(total - 100.0) > 0.01:
            raise ValueError(f"team+ops+reserve must equal 100%, got {total}")
        if abs((self.founder_pct + self.core_team_pct) - self.team_pct) > 0.01:
            raise ValueError(
                f"founder_pct ({self.founder_pct}) + core_team_pct "
                f"({self.core_team_pct}) must equal team_pct ({self.team_pct})"
            )
        for name, val in (("team_pct", self.team_pct), ("ops_pct", self.ops_pct),
                          ("reserve_pct", self.reserve_pct), ("founder_pct", self.founder_pct),
                          ("core_team_pct", self.core_team_pct)):
            if val < 0 or val > 100:
                raise ValueError(f"{name} must be 0-100, got {val}")


@dataclass
class SplitResult:
    """A single transaction's allocation breakdown (all amounts in USD)."""
    gross_usd: float
    team_usd: float
    ops_usd: float
    reserve_usd: float
    # Sub-split inside the team bucket.
    founder_usd: float
    core_team_usd: float
    # Founder cap accounting.
    founder_capped: bool = False
    founder_overflow_to_chair_pool_usd: float = 0.0
    # Echo back the config snapshot for audit trails.
    config_snapshot: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "gross_usd": round(self.gross_usd, 4),
            "buckets": {
                "team": round(self.team_usd, 4),
                "operations": round(self.ops_usd, 4),
                "reserve": round(self.reserve_usd, 4),
            },
            "team_sub_split": {
                "founder": round(self.founder_usd, 4),
                "core_team": round(self.core_team_usd, 4),
            },
            "founder_cap": {
                "triggered": self.founder_capped,
                "overflow_to_chair_pool_usd": round(
                    self.founder_overflow_to_chair_pool_usd, 4
                ),
            },
            "config_snapshot": self.config_snapshot,
        }


def calculate_split(
    gross_usd: float,
    *,
    config: Optional[TreasuryConfig] = None,
    current_month_founder_paid_usd: float = 0.0,
    current_month_revenue_usd: float = 0.0,
) -> SplitResult:
    """
    Apply the 40-30-30 split + founder cap rule to a single transaction.

    Args:
        gross_usd: Transaction gross in USD.
        config: Active treasury config (defaults to module constants).
        current_month_founder_paid_usd: How much the founder has already
            been paid this month (used to enforce the $20k/month cap).
        current_month_revenue_usd: Platform MRR so far this month (used to
            decide whether the cap trigger fires).

    Returns:
        SplitResult with all bucket amounts.
    """
    if gross_usd < 0:
        raise ValueError("gross_usd must be non-negative")

    cfg = config or TreasuryConfig()
    cfg.validate()

    # Top-level 40-30-30.
    team_usd = gross_usd * (cfg.team_pct / 100.0)
    ops_usd = gross_usd * (cfg.ops_pct / 100.0)
    reserve_usd = gross_usd * (cfg.reserve_pct / 100.0)

    # Sub-split inside team bucket — proportional to founder/core team pct.
    founder_share_of_team = cfg.founder_pct / cfg.team_pct
    raw_founder_usd = team_usd * founder_share_of_team
    raw_core_team_usd = team_usd - raw_founder_usd

    # Founder cap rule.
    founder_capped = False
    overflow = 0.0
    final_founder_usd = raw_founder_usd

    cap_trigger_met = (
        cfg.auto_cap_enabled
        and current_month_revenue_usd >= cfg.founder_cap_trigger_mrr_usd
    )
    if cap_trigger_met:
        # Compute remaining headroom under the monthly cap.
        headroom = max(cfg.founder_cap_amount_usd - current_month_founder_paid_usd, 0.0)
        if raw_founder_usd > headroom:
            final_founder_usd = headroom
            overflow = raw_founder_usd - headroom
            founder_capped = True

    # Overflow lands in the Reserve bucket as the Chair Holder Rewards Pool
    # (still part of the 30% reserve allocation, just earmarked).
    final_reserve_usd = reserve_usd + overflow

    return SplitResult(
        gross_usd=gross_usd,
        team_usd=team_usd,
        ops_usd=ops_usd,
        reserve_usd=final_reserve_usd,
        founder_usd=final_founder_usd,
        core_team_usd=raw_core_team_usd,
        founder_capped=founder_capped,
        founder_overflow_to_chair_pool_usd=overflow,
        config_snapshot={
            "team_pct": cfg.team_pct,
            "ops_pct": cfg.ops_pct,
            "reserve_pct": cfg.reserve_pct,
            "founder_pct": cfg.founder_pct,
            "core_team_pct": cfg.core_team_pct,
            "founder_cap_trigger_mrr_usd": cfg.founder_cap_trigger_mrr_usd,
            "founder_cap_amount_usd": cfg.founder_cap_amount_usd,
            "auto_cap_enabled": cfg.auto_cap_enabled,
        },
    )
