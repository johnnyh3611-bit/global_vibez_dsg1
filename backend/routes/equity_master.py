"""
Equity Master — Crewmate Architecture, 30% Revenue Split, Diamond Market Logic
(Global_Vibez_DSG_Equity_Master.pdf, Feb 2026).

Locks every economic constant from the Equity Master PDF and exposes them
as a public read-only API plus a deterministic dividend / valuation
calculator. Numbers are encoded as `Final` and cross-verified at boot
inside `routes/immutable_core.py` so the server refuses to start if any
drift is detected.

Constants locked here (all from PDF):
  • OWNERSHIP_REVENUE_SHARE          = 0.30   (30% of gross to ownership pool)
  • DIVIDEND_DISTRIBUTION_QUARTERLY  = 3      (months between payouts)
  • VIBEZ_PAYOUT_BONUS               = 0.05   (+5% vs SOL/USDC)
  • YIELD_BASIS                      = 0.10   (Price = AnnualDiv / 0.10)
  • GENIUS_PHASE_FLOOR_USD           = 20     ($20 Walking Ads)
  • GENESIS_PHASE_FLOOR_USD          = 100    ($100 floor)
  • DIAMOND_VALUE_REFERENCE_USD      = 180    ($180 @ $5M monthly gross)
  • SCARCITY_PREMIUM_MIN             = 0.20   (20% on locked chairs)
  • SCARCITY_PREMIUM_MAX             = 0.30   (30% on locked chairs)
  • TOTAL_CHAIRS_BASELINE            = 1_000_000
  • WALKING_ADS_COHORT_SIZE          = 50_000
  • CREWMATE_CHAIR_CAPS              = Pit Boss / Vibe Scout / Treasurer = 250
  • REVENUE_CATEGORIES               = ("casino", "ridez", "tv_ads", "yellow_pages")

Endpoints:
  GET  /api/equity-master/constants            → all locked numbers
  GET  /api/equity-master/crewmate-roles       → 4 roles with caps & focus areas
  GET  /api/equity-master/dividend?monthly_gross=5000000
                                                → dividend / chair / valuation
  POST /api/equity-master/valuation            → custom revenue → price
"""
from __future__ import annotations

from typing import Final

from fastapi import APIRouter
from pydantic import BaseModel, Field


# ── Locked constants ─────────────────────────────────────────────────────
OWNERSHIP_REVENUE_SHARE: Final[float] = 0.30
DIVIDEND_DISTRIBUTION_MONTHS: Final[int] = 3
VIBEZ_PAYOUT_BONUS: Final[float] = 0.05
YIELD_BASIS: Final[float] = 0.10

GENIUS_PHASE_FLOOR_USD: Final[int] = 20
GENESIS_PHASE_FLOOR_USD: Final[int] = 100
DIAMOND_VALUE_REFERENCE_USD: Final[int] = 180

SCARCITY_PREMIUM_MIN: Final[float] = 0.20
SCARCITY_PREMIUM_MAX: Final[float] = 0.30

TOTAL_CHAIRS_BASELINE: Final[int] = 1_000_000
WALKING_ADS_COHORT_SIZE: Final[int] = 50_000

REVENUE_CATEGORIES: Final[tuple[str, ...]] = (
    "casino",
    "ridez",
    "tv_ads",
    "yellow_pages",
)

CREWMATE_CHAIR_CAPS: Final[dict[str, int | None]] = {
    "founder": None,  # Infinite
    "pit_boss": 250,
    "vibe_scout": 250,
    "treasurer": 250,
}

CREWMATE_ROLES: Final[list[dict]] = [
    {
        "id": "founder",
        "label": "Founder",
        "focus_area": "Root Access · Final Approval · Vision",
        "chair_cap": None,
        "chair_cap_display": "Infinite",
        "emoji": "👑",
    },
    {
        "id": "pit_boss",
        "label": "Pit Boss",
        "focus_area": "Casino Ops · Game Disputes · Room Monitoring",
        "chair_cap": 250,
        "chair_cap_display": "250",
        "emoji": "🎲",
    },
    {
        "id": "vibe_scout",
        "label": "Vibe Scout",
        "focus_area": "Media / TV Oversight · AI Content Approval",
        "chair_cap": 250,
        "chair_cap_display": "250",
        "emoji": "📡",
    },
    {
        "id": "treasurer",
        "label": "Treasurer",
        "focus_area": "Ledger Integrity · Token Liquidity · SOL Settlement",
        "chair_cap": 250,
        "chair_cap_display": "250",
        "emoji": "🔑",
    },
]

# Sanity locks — any drift in these tuples flips the immutable-core check.
EXPECTED = {
    "OWNERSHIP_REVENUE_SHARE": 0.30,
    "DIVIDEND_DISTRIBUTION_MONTHS": 3,
    "VIBEZ_PAYOUT_BONUS": 0.05,
    "YIELD_BASIS": 0.10,
    "GENIUS_PHASE_FLOOR_USD": 20,
    "GENESIS_PHASE_FLOOR_USD": 100,
    "DIAMOND_VALUE_REFERENCE_USD": 180,
    "SCARCITY_PREMIUM_MIN": 0.20,
    "SCARCITY_PREMIUM_MAX": 0.30,
    "TOTAL_CHAIRS_BASELINE": 1_000_000,
    "WALKING_ADS_COHORT_SIZE": 50_000,
    "PIT_BOSS_CAP": 250,
    "VIBE_SCOUT_CAP": 250,
    "TREASURER_CAP": 250,
}


def verify_equity_locks() -> None:
    """Boot-time check. Cross-called from `routes/immutable_core.py`'s
    verify_locks() — refuses to start if any number drifted."""
    actual = {
        "OWNERSHIP_REVENUE_SHARE": OWNERSHIP_REVENUE_SHARE,
        "DIVIDEND_DISTRIBUTION_MONTHS": DIVIDEND_DISTRIBUTION_MONTHS,
        "VIBEZ_PAYOUT_BONUS": VIBEZ_PAYOUT_BONUS,
        "YIELD_BASIS": YIELD_BASIS,
        "GENIUS_PHASE_FLOOR_USD": GENIUS_PHASE_FLOOR_USD,
        "GENESIS_PHASE_FLOOR_USD": GENESIS_PHASE_FLOOR_USD,
        "DIAMOND_VALUE_REFERENCE_USD": DIAMOND_VALUE_REFERENCE_USD,
        "SCARCITY_PREMIUM_MIN": SCARCITY_PREMIUM_MIN,
        "SCARCITY_PREMIUM_MAX": SCARCITY_PREMIUM_MAX,
        "TOTAL_CHAIRS_BASELINE": TOTAL_CHAIRS_BASELINE,
        "WALKING_ADS_COHORT_SIZE": WALKING_ADS_COHORT_SIZE,
        "PIT_BOSS_CAP": CREWMATE_CHAIR_CAPS["pit_boss"],
        "VIBE_SCOUT_CAP": CREWMATE_CHAIR_CAPS["vibe_scout"],
        "TREASURER_CAP": CREWMATE_CHAIR_CAPS["treasurer"],
    }
    for k, v in actual.items():
        if v != EXPECTED[k]:
            raise RuntimeError(
                f"EquityMaster lock violation: {k} expected {EXPECTED[k]}, got {v}"
            )


# Run the check at import time so any drift surfaces during route mount.
verify_equity_locks()


# ── Math helpers ─────────────────────────────────────────────────────────
def compute_dividend(
    monthly_gross_usd: float,
    total_chairs: int = TOTAL_CHAIRS_BASELINE,
) -> dict:
    """Apply the Equity Master valuation formula.

    monthly_dividend_per_chair = (monthly_gross * 0.30) / total_chairs
    annual_dividend_per_chair  = monthly_dividend * 12
    current_price              = annual_dividend / 0.10
    """
    if monthly_gross_usd < 0:
        monthly_gross_usd = 0
    if total_chairs <= 0:
        total_chairs = TOTAL_CHAIRS_BASELINE

    monthly_pool = monthly_gross_usd * OWNERSHIP_REVENUE_SHARE
    monthly_div_per_chair = monthly_pool / total_chairs
    annual_div_per_chair = monthly_div_per_chair * 12
    current_price = annual_div_per_chair / YIELD_BASIS

    # Quarterly distribution amount per chair (what users actually receive).
    quarterly_div_per_chair = monthly_div_per_chair * DIVIDEND_DISTRIBUTION_MONTHS

    # Floor logic — never below Genesis once the math justifies it.
    floor_phase = (
        "diamond" if current_price >= DIAMOND_VALUE_REFERENCE_USD
        else "genesis" if current_price >= GENESIS_PHASE_FLOOR_USD
        else "genius"
    )
    effective_price = max(
        current_price,
        GENESIS_PHASE_FLOOR_USD if floor_phase != "genius" else GENIUS_PHASE_FLOOR_USD,
    )

    return {
        "monthly_gross_usd": monthly_gross_usd,
        "total_chairs": total_chairs,
        "monthly_pool_usd": round(monthly_pool, 2),
        "monthly_dividend_per_chair_usd": round(monthly_div_per_chair, 4),
        "quarterly_dividend_per_chair_usd": round(quarterly_div_per_chair, 2),
        "annual_dividend_per_chair_usd": round(annual_div_per_chair, 2),
        "current_price_usd": round(current_price, 2),
        "effective_price_usd": round(effective_price, 2),
        "floor_phase": floor_phase,
        "scarcity_premium_range_pct": [
            int(SCARCITY_PREMIUM_MIN * 100),
            int(SCARCITY_PREMIUM_MAX * 100),
        ],
        "vibez_payout_bonus_pct": int(VIBEZ_PAYOUT_BONUS * 100),
        "valuation_formula": "current_price = (annual_dividend_per_chair) / 0.10",
    }


# ── Router ───────────────────────────────────────────────────────────────
router = APIRouter(prefix="/equity-master", tags=["equity-master"])


@router.get("/constants")
async def get_constants():
    """Public read-only view of every locked equity number."""
    return {
        "ownership_revenue_share": OWNERSHIP_REVENUE_SHARE,
        "ownership_revenue_share_pct": "30%",
        "dividend_distribution_months": DIVIDEND_DISTRIBUTION_MONTHS,
        "dividend_distribution_cadence": "quarterly",
        "vibez_payout_bonus": VIBEZ_PAYOUT_BONUS,
        "vibez_payout_bonus_pct": "5%",
        "yield_basis": YIELD_BASIS,
        "yield_basis_pct": "10%",
        "phases": {
            "genius_floor_usd": GENIUS_PHASE_FLOOR_USD,
            "genesis_floor_usd": GENESIS_PHASE_FLOOR_USD,
            "diamond_reference_usd": DIAMOND_VALUE_REFERENCE_USD,
            "diamond_reference_monthly_gross_usd": 5_000_000,
        },
        "scarcity_premium_pct": {
            "min": int(SCARCITY_PREMIUM_MIN * 100),
            "max": int(SCARCITY_PREMIUM_MAX * 100),
        },
        "total_chairs_baseline": TOTAL_CHAIRS_BASELINE,
        "walking_ads_cohort_size": WALKING_ADS_COHORT_SIZE,
        "revenue_categories": list(REVENUE_CATEGORIES),
        "crewmate_chair_caps": {
            k: (v if v is not None else "infinite")
            for k, v in CREWMATE_CHAIR_CAPS.items()
        },
        "locked": True,
        "spec_doc": "Global_Vibez_DSG_Equity_Master.pdf",
    }


@router.get("/crewmate-roles")
async def get_crewmate_roles():
    """4 crewmate tiers with chair caps + focus areas (PDF §Roles)."""
    return {"roles": CREWMATE_ROLES, "total": len(CREWMATE_ROLES)}


class ValuationRequest(BaseModel):
    monthly_gross_usd: float = Field(..., ge=0)
    total_chairs: int = Field(default=TOTAL_CHAIRS_BASELINE, gt=0)


@router.post("/valuation")
async def post_valuation(body: ValuationRequest):
    """Custom dividend/valuation calculator (price for arbitrary gross)."""
    return compute_dividend(body.monthly_gross_usd, body.total_chairs)


@router.get("/dividend")
async def get_dividend(monthly_gross: float = 5_000_000):
    """Quick GET helper — defaults to the $5M Diamond reference scenario."""
    return compute_dividend(monthly_gross)
