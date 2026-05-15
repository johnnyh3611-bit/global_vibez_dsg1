"""High Roller VIP tier economy constants & helpers.

The standard platform enforces a 50-coin minimum bet
(`services.game_economy_constants.PLATFORM_MIN_BET`). The High Roller
VIP tier deliberately overrides this with a 10,000-coin floor so that
the VIP rooms feel materially different and route serious players to a
dedicated revenue surface.

This module is the SINGLE SOURCE OF TRUTH for High Roller pricing,
minimum bets, and tier metadata. Importing it ensures the rules stay in
sync between the eligibility check, the upgrade Stripe Checkout, and
the per-game min-bet gates.

Pricing model: one-shot 30-day grants (same flow as Featured Streamers
so we reuse the existing webhook plumbing). Renewal extends the window;
multiple grants stack additively. No Stripe subscriptions required.
"""
from __future__ import annotations

from typing import Dict, List

# Minimum bet inside ANY High Roller room — orders of magnitude over the
# 50-coin platform floor on purpose. Locked by the regression shield.
HIGH_ROLLER_MIN_BET: int = 10_000

# VIP grant duration (30 days, mirrors Featured Streamers).
HIGH_ROLLER_GRANT_DAYS: int = 30

# Stripe webhook client_reference_id prefix used to route checkout-
# completed events to the apply_vip_grant() handler.
HIGH_ROLLER_REF_PREFIX: str = "vip:"

# Three VIP tiers. Each grants the same 30-day VIP window — the price
# difference reflects perks (concierge support, custom chip skins,
# higher VIP room caps) which are applied client-side via `tier` flag.
VIP_TIERS: Dict[str, Dict] = {
    "genius": {
        "tier": "genius",
        "label": "Genius",
        "price_usd": 49.00,
        "duration_days": HIGH_ROLLER_GRANT_DAYS,
        "tagline": "Entry-tier VIP. Unlock the High Roller room.",
        "perks": [
            "Access to the High Roller Blackjack table (₵10,000 min bet)",
            "Gold-accented chip skin",
            "Priority queue for full VIP rooms",
            "30-day VIP window",
        ],
    },
    "genesis": {
        "tier": "genesis",
        "label": "Genesis",
        "price_usd": 99.00,
        "duration_days": HIGH_ROLLER_GRANT_DAYS,
        "tagline": "Mid-tier VIP. Concierge dealer + emerald chip skin.",
        "perks": [
            "Everything in Genius",
            "Concierge dealer with personalized greeting",
            "Emerald-accented chip skin",
            "Animated chip-stack reveal",
            "30-day VIP window",
        ],
    },
    "apex": {
        "tier": "apex",
        "label": "Apex",
        "price_usd": 249.00,
        "duration_days": HIGH_ROLLER_GRANT_DAYS,
        "tagline": "Top-tier VIP. Reserved private tables + obsidian-gold finish.",
        "perks": [
            "Everything in Genesis",
            "Reserved private VIP table on request",
            "Obsidian-gold chip skin with parallax glow",
            "Direct line to founder concierge",
            "30-day VIP window",
        ],
    },
}

VIP_TIER_NAMES: List[str] = list(VIP_TIERS.keys())


def tier_price_usd(tier: str) -> float:
    """Return the USD price for a given VIP tier; raises if unknown."""
    if tier not in VIP_TIERS:
        raise ValueError(f"Unknown VIP tier: {tier}")
    return float(VIP_TIERS[tier]["price_usd"])


def is_valid_tier(tier: str) -> bool:
    return tier in VIP_TIERS
