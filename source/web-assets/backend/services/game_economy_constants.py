"""
Platform-wide game economy constants.

Single source of truth for the 50-coin platform-wide minimum bet (founder
rule, May 2026). Importing this in every game route prevents the floor
from drifting per-file as it did before May 2026.

Vibe Dice 654 keeps its own carve-out (5 coins) per the documented table
configuration in `routes/vibez_654_prescription.py`.
"""
from __future__ import annotations

# Platform-wide minimum bet across ALL casino games.
PLATFORM_MIN_BET = 50


def format_coins(amount) -> str:
    """Canonical money formatter — always emits the ₵ Cedi/Coin glyph,
    never a `$` dollar sign. Use this in EVERY user-facing string that
    surfaces a bet amount, winnings, or payout."""
    try:
        n = int(round(float(amount)))
    except (TypeError, ValueError):
        return f"₵{amount}"
    return f"₵{n:,}"
