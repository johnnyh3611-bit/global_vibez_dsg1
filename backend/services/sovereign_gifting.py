"""
DSG Sovereign Gifting & Luxury System — Volume III
───────────────────────────────────────────────────
Source: DSG_Sovereign_Gifting_Luxury_System.pdf (founder spec, Feb 2026).

⚠️  SPEC INCONSISTENCY NOTE
The PDF header reads "60/30/10 Sovereign Split" but the body specifies
60% / 27.5% / 12.5% (which math-balances to 100%). The code snippet in
the same PDF uses `tax = price * 0.135`. We implement the BODY split
(60/27.5/12.5) because it is the only version that sums to 100%, and
we treat this gift-purchase split as DISTINCT from the global 13.5%
SOVEREIGN_TAX_RATE used on bets/transfers. They are different concepts:
  - Gift purchase split → 60% creator / 27.5% treasury / 12.5% burn
  - Bet / transfer tax  → 13.5% Sovereign Tax (services/pricing_master_vault.py)

Pure module: gift catalog + transaction processor + buff registry.

Tested by backend/tests/test_sovereign_gifting.py.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


# ── Sovereign Split (60/27.5/12.5 — body spec) ──────────────────────────────
GIFT_CREATOR_PCT: float = 0.60      # 60% to creator/driver
GIFT_TREASURY_PCT: float = 0.275    # 27.5% to treasury + chair-holder dividends
GIFT_BURN_PCT: float = 0.125        # 12.5% permanent supply burn

# Sanity assertion at import time — fails loud if anyone edits these wrong
assert abs(GIFT_CREATOR_PCT + GIFT_TREASURY_PCT + GIFT_BURN_PCT - 1.0) < 1e-9, \
    "Gift split must sum to 100%"


@dataclass
class GiftSplit:
    """Result of running a gift purchase through the Sovereign Split."""
    item_id: str
    buyer_id: str
    recipient_id: str
    price: float
    creator_share: float    # 60%  → recipient creator
    treasury_share: float   # 27.5% → platform + chair-holder dividends
    burn_share: float       # 12.5% → permanent burn (scarcity trigger)


def process_luxury_gift(
    item_id: str,
    price: float,
    buyer_id: str,
    recipient_id: str,
) -> GiftSplit:
    """
    Implement the spec-verbatim luxury gift transaction:

        function processLuxuryGift(buyer, recipient, itemID) {
          let item = SovereignStore.getItem(itemID);
          let tax = item.price * 0.135;       // ← see SPEC INCONSISTENCY note
          let net = item.price - tax;
          BurnEngine.execute(tax);
          AssetLoader.spawn3DPrefab(item.unityModel, recipient.avatarSeat);
          recipient.applyBuff(item.statBoost, item.duration);
        }

    We honor the body's 60/27.5/12.5 split. Caller is responsible for:
      - Deducting `price` from buyer
      - Crediting `creator_share` to recipient
      - Routing `treasury_share` to the treasury wallet
      - Calling burn engine with `burn_share`
      - Applying any buff returned by lookup_gift_buff(item_id)
    """
    if price <= 0:
        raise ValueError("price must be positive")
    if not item_id:
        raise ValueError("item_id required")
    if not buyer_id or not recipient_id:
        raise ValueError("buyer_id and recipient_id required")

    creator = round(price * GIFT_CREATOR_PCT, 8)
    treasury = round(price * GIFT_TREASURY_PCT, 8)
    # Floor the burn into whatever's left so 60+27.5+12.5 always adds to price exactly
    burn = round(price - creator - treasury, 8)

    return GiftSplit(
        item_id=item_id,
        buyer_id=buyer_id,
        recipient_id=recipient_id,
        price=round(price, 8),
        creator_share=creator,
        treasury_share=treasury,
        burn_share=burn,
    )


# ── 3D Emoji Hierarchy + Buff Registry ──────────────────────────────────────
@dataclass
class GiftBuff:
    """Performance boost a gift confers on the recipient."""
    item_id: str
    name: str
    visual_effect: str
    boost_type: str      # 'mining_speed' | 'tax_rebate' | 'mining_speed'
    boost_value: float   # +10% = 0.10
    duration_minutes: int
    rebate_count: int = 0   # for tax-rebate gifts: how many games it covers


# Verbatim from spec table:
GIFT_REGISTRY: Dict[str, GiftBuff] = {
    "sovereign_crown": GiftBuff(
        item_id="sovereign_crown",
        name="Sovereign Crown",
        visual_effect="3D Holographic crown with neon particles.",
        boost_type="mining_speed",
        boost_value=0.10,           # +10% mining speed
        duration_minutes=30,
    ),
    "cyber_cigar": GiftBuff(
        item_id="cyber_cigar",
        name="Cyber-Cigar",
        visual_effect="Avatar smokes 'Nebula' stars; galaxy-trails.",
        boost_type="mining_speed",
        boost_value=0.05,           # +5% mining speed while active
        duration_minutes=0,         # 0 = "while active" (route layer manages)
    ),
    "infinity_decanter": GiftBuff(
        item_id="infinity_decanter",
        name="Infinity Decanter",
        visual_effect="Robotic arm pours glowing liquid for the table.",
        boost_type="tax_rebate",
        boost_value=0.10,           # 10% tax rebate
        duration_minutes=0,
        rebate_count=3,             # next 3 games
    ),
}


def lookup_gift_buff(item_id: str) -> Optional[GiftBuff]:
    """Look up the buff a gift confers. None if the item has no buff."""
    return GIFT_REGISTRY.get(item_id)


# ── VibeRidez "World-Wrap" Protocol ─────────────────────────────────────────
# Spec verbatim: drivers receive these gift effects.
@dataclass
class DriverGiftEffect:
    name: str
    visual: str            # what the map renders
    performance: str       # mechanical effect (queue priority, etc.)
    haptic: bool           # passenger haptic feedback


VIBERIDEZ_GIFTS: Dict[str, DriverGiftEffect] = {
    "neon_underglow": DriverGiftEffect(
        name="Neon Underglow",
        visual="Driver's car icon on the map pulses with TRON-style light trails.",
        performance="cosmetic",
        haptic=False,
    ),
    "priority_fuel": DriverGiftEffect(
        name="Priority Fuel",
        visual="Driver moves to front of queue.",
        performance="queue_priority_high_pay_rides",
        haptic=False,
    ),
    "haptic_sync": DriverGiftEffect(
        name="Haptic Sync",
        visual="Heavy-Gravity pulse fired on passenger phone.",
        performance="cosmetic",
        haptic=True,
    ),
}


__all__ = [
    "GIFT_CREATOR_PCT", "GIFT_TREASURY_PCT", "GIFT_BURN_PCT",
    "GiftSplit", "process_luxury_gift",
    "GiftBuff", "GIFT_REGISTRY", "lookup_gift_buff",
    "DriverGiftEffect", "VIBERIDEZ_GIFTS",
]
