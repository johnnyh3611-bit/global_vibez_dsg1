"""
Pricing Master Vault v1.0
─────────────────────────
Source of truth: "DSG Economy: The Sovereign Exchange — Official Purchase
Metrics & Tiered Rewards v1.0" (Founder spec, Feb 2026).

Spec rules (locked, do not drift):

  Base conversion
  ──────────────
  • $1.00 USD = 2,500 ₵ (Vibe Credits, off-chain)
  • 4:1 DSG bridge → 1 $DSG token  =  4 ₵
                  → 2,500 ₵        =  625 $DSG

  Six Vibe Packs
  ──────────────
  $1   Ignition       2,500    →   625 $DSG  · Entry Access
  $5   Frequency     12,500    → 3,125 $DSG  · +1 Profile Boost
  $10  Momentum      25,000    → 6,250 $DSG  · 24hr Mining Pulse
  $20  Architect     50,000    → 12,500 $DSG · Referral Node Open + 5% network mining override
  $50  Dynasty      125,000    → 31,250 $DSG · Elite Room Access
  $100 Legacy Vault 300,000*   → 75,000 $DSG · Permanent Elite Status
       (*250,000 base + 50,000 high-volume bonus)

  Tier gating
  ───────────
  • Explorers      → may purchase Ignition, Frequency only.
                     Hard cap: 100,000 $DSG lifetime accumulated.
  • Ambassadors    → may purchase Ignition, Frequency, Momentum,
                     Architect, Dynasty. Architect purchase activates
                     the 5% network mining override.
  • Chair Holders  → may purchase ALL packs, including repeat
                     purchases of Legacy Vault, up to a
                     5,000,000 $DSG lifetime ceiling.

  Sovereign Tax
  ─────────────
  13.5% applied to every transaction and game-bet (already enforced
  by services/sovereign_engine.py). Tax revenue routes to Treasury +
  Ambassador Dividends.

  Supply
  ──────
  Total $DSG supply: 3,000,000,000 (3 billion).

This module is pure / deterministic. No DB calls. No I/O. Routes layer
is responsible for persistence + Stripe checkout. Tested by
backend/tests/test_pricing_master_vault.py.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

# ── Universal constants ──────────────────────────────────────────────────────
USD_TO_CREDITS_RATE: int = 2_500          # $1 USD → 2,500 ₵
DSG_BRIDGE_RATIO: int = 4                 # 4 ₵ → 1 $DSG
SOVEREIGN_TAX_RATE: float = 0.135         # 13.5% (also locked in sovereign_engine.py)
TOTAL_DSG_SUPPLY: int = 3_000_000_000     # 3B hard cap
EXPLORER_DSG_CAP: int = 100_000           # Explorer lifetime $DSG ceiling
CHAIR_HOLDER_DSG_CEILING: int = 5_000_000 # Chair-holder lifetime $DSG ceiling

# ── Tier identifiers ─────────────────────────────────────────────────────────
TIER_EXPLORER: str = "explorer"
TIER_AMBASSADOR: str = "ambassador"
TIER_CHAIR_HOLDER: str = "chair_holder"

ALL_TIERS: Tuple[str, ...] = (TIER_EXPLORER, TIER_AMBASSADOR, TIER_CHAIR_HOLDER)


# ── The six Vibe Packs (spec-locked) ─────────────────────────────────────────
PACKS: Dict[str, Dict] = {
    "ignition": {
        "pack_id":       "ignition",
        "name":          "The Ignition",
        "usd_amount":    1.00,
        "base_credits":  2_500,
        "bonus_credits": 0,
        "credits":       2_500,
        "dsg_bridge":    625,
        "perk":          "Entry Access",
        "min_tier":      TIER_EXPLORER,
        "popular":       False,
    },
    "frequency": {
        "pack_id":       "frequency",
        "name":          "The Frequency",
        "usd_amount":    5.00,
        "base_credits":  12_500,
        "bonus_credits": 0,
        "credits":       12_500,
        "dsg_bridge":    3_125,
        "perk":          "+1 Profile Boost",
        "min_tier":      TIER_EXPLORER,
        "popular":       False,
    },
    "momentum": {
        "pack_id":       "momentum",
        "name":          "The Momentum",
        "usd_amount":    10.00,
        "base_credits":  25_000,
        "bonus_credits": 0,
        "credits":       25_000,
        "dsg_bridge":    6_250,
        "perk":          "24hr Mining Pulse",
        "min_tier":      TIER_AMBASSADOR,
        "popular":       True,
    },
    "architect": {
        "pack_id":       "architect",
        "name":          "The Architect",
        "usd_amount":    20.00,
        "base_credits":  50_000,
        "bonus_credits": 0,
        "credits":       50_000,
        "dsg_bridge":    12_500,
        "perk":          "Referral Node Open + 5% Network Mining Override",
        "min_tier":      TIER_AMBASSADOR,
        "popular":       True,
        "activates_mining_override": True,
    },
    "dynasty": {
        "pack_id":       "dynasty",
        "name":          "The Dynasty",
        "usd_amount":    50.00,
        "base_credits":  125_000,
        "bonus_credits": 0,
        "credits":       125_000,
        "dsg_bridge":    31_250,
        "perk":          "Elite Room Access",
        "min_tier":      TIER_AMBASSADOR,
        "popular":       False,
    },
    "legacy_vault": {
        "pack_id":       "legacy_vault",
        "name":          "The Legacy Vault",
        "usd_amount":    100.00,
        "base_credits":  250_000,
        "bonus_credits": 50_000,
        "credits":       300_000,
        "dsg_bridge":    75_000,
        "perk":          "Permanent Elite Status (250k base + 50k bonus)",
        "min_tier":      TIER_CHAIR_HOLDER,
        "repeat_purchase_allowed": True,
        "dsg_lifetime_ceiling": CHAIR_HOLDER_DSG_CEILING,
        "popular":       False,
    },
}

# Tier → which pack_ids the tier may purchase
TIER_PACK_ELIGIBILITY: Dict[str, Tuple[str, ...]] = {
    TIER_EXPLORER:     ("ignition", "frequency"),
    TIER_AMBASSADOR:   ("ignition", "frequency", "momentum", "architect", "dynasty"),
    TIER_CHAIR_HOLDER: ("ignition", "frequency", "momentum", "architect", "dynasty", "legacy_vault"),
}


# ── Pure helpers ─────────────────────────────────────────────────────────────
def list_packs() -> List[Dict]:
    """Return all 6 packs as a list ordered by USD amount ascending."""
    return [PACKS[k] for k in ("ignition", "frequency", "momentum", "architect", "dynasty", "legacy_vault")]


def get_pack(pack_id: str) -> Optional[Dict]:
    """Return a pack dict by id, or None if not found."""
    return PACKS.get(pack_id)


def usd_to_credits(usd: float) -> int:
    """Apply the base $1 = 2,500 ₵ rate. No bonuses."""
    if usd < 0:
        raise ValueError("usd must be non-negative")
    return int(round(usd * USD_TO_CREDITS_RATE))


def credits_to_dsg(credits: int) -> int:
    """Apply the 4:1 DSG bridge ratio. Floors fractional DSG."""
    if credits < 0:
        raise ValueError("credits must be non-negative")
    return credits // DSG_BRIDGE_RATIO


def derive_user_tier(user: Dict) -> str:
    """
    Derive a user's tier from their existing user record.

    Order of precedence:
      1. holder_chair_count > 0      → chair_holder
      2. is_ambassador True OR
         lifetime_pack_purchases     → ambassador
         contains 'architect' / 'momentum' / 'dynasty'
      3. otherwise                   → explorer

    The route layer is responsible for setting `is_ambassador = True`
    on a user document when an Ambassador-tier pack is purchased.
    """
    if int(user.get("holder_chair_count", 0) or 0) > 0:
        return TIER_CHAIR_HOLDER

    if bool(user.get("is_ambassador")):
        return TIER_AMBASSADOR

    purchases = user.get("lifetime_pack_purchases") or []
    ambassador_packs = {"momentum", "architect", "dynasty"}
    if any(p in ambassador_packs for p in purchases):
        return TIER_AMBASSADOR

    return TIER_EXPLORER


def is_pack_purchasable(pack_id: str, user_tier: str, lifetime_dsg_acquired: int = 0,
                        legacy_vault_purchase_count: int = 0) -> Tuple[bool, str]:
    """
    Determine whether a user of `user_tier` may purchase `pack_id` right now.

    Returns (allowed: bool, reason: str).
    `reason` is human-readable on denial; empty string on allow.

    Spec enforcement:
      • Explorers blocked from any pack outside their eligibility list.
      • Explorers also rejected if buying would push them past
        EXPLORER_DSG_CAP (100,000 $DSG lifetime).
      • Legacy Vault repeat-purchase only allowed for chair holders, and
        capped at CHAIR_HOLDER_DSG_CEILING (5,000,000 $DSG lifetime).
    """
    pack = PACKS.get(pack_id)
    if not pack:
        return False, f"Unknown pack: {pack_id}"

    if user_tier not in ALL_TIERS:
        return False, f"Unknown tier: {user_tier}"

    eligible_packs = TIER_PACK_ELIGIBILITY[user_tier]
    if pack_id not in eligible_packs:
        return False, (
            f"Tier '{user_tier}' is not permitted to purchase '{pack['name']}'. "
            f"This pack requires tier '{pack['min_tier']}' or higher."
        )

    incoming_dsg = pack["dsg_bridge"]

    # Explorer 100k $DSG lifetime cap
    if user_tier == TIER_EXPLORER:
        if lifetime_dsg_acquired + incoming_dsg > EXPLORER_DSG_CAP:
            return False, (
                f"Explorer lifetime $DSG cap is {EXPLORER_DSG_CAP:,}. "
                f"You currently have {lifetime_dsg_acquired:,}; this purchase "
                f"would add {incoming_dsg:,}. Upgrade tier to continue."
            )

    # Chair-holder Legacy Vault 5M $DSG lifetime ceiling
    if pack_id == "legacy_vault" and user_tier == TIER_CHAIR_HOLDER:
        if lifetime_dsg_acquired + incoming_dsg > CHAIR_HOLDER_DSG_CEILING:
            return False, (
                f"Chair-holder $DSG ceiling is {CHAIR_HOLDER_DSG_CEILING:,}. "
                f"Your current lifetime $DSG is {lifetime_dsg_acquired:,}; this "
                f"would breach the ceiling."
            )

    return True, ""


def apply_sovereign_tax(amount: float) -> Dict[str, float]:
    """
    Compute the 13.5% Sovereign Tax split for an in-app transaction or bet.

    Returns {gross, tax, net}. Caller is responsible for routing `tax` to
    the Treasury + Ambassador Dividend pool via the existing
    services/sovereign_engine.py pipeline.
    """
    if amount < 0:
        raise ValueError("amount must be non-negative")
    tax = round(amount * SOVEREIGN_TAX_RATE, 8)
    return {
        "gross": float(amount),
        "tax_rate": SOVEREIGN_TAX_RATE,
        "tax": tax,
        "net": round(float(amount) - tax, 8),
    }


__all__ = [
    "PACKS",
    "TIER_PACK_ELIGIBILITY",
    "USD_TO_CREDITS_RATE",
    "DSG_BRIDGE_RATIO",
    "SOVEREIGN_TAX_RATE",
    "TOTAL_DSG_SUPPLY",
    "EXPLORER_DSG_CAP",
    "CHAIR_HOLDER_DSG_CEILING",
    "TIER_EXPLORER",
    "TIER_AMBASSADOR",
    "TIER_CHAIR_HOLDER",
    "ALL_TIERS",
    "list_packs",
    "get_pack",
    "usd_to_credits",
    "credits_to_dsg",
    "derive_user_tier",
    "is_pack_purchasable",
    "apply_sovereign_tax",
]
