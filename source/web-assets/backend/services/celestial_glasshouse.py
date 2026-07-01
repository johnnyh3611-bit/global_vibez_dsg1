"""
Celestial Glasshouse Arena — v7.0 Phase 9.

Source: /app/memory/locked_specs/v7_OMNI_BLUEPRINT.md §4 + Apex Blueprint.

The Arena is the gated VIP space that hosts Apex-tier social content:

  • Beat Auctions (already built — Phase 8 — but the Arena is where
    Vibe Sovereigns/Legends can preview them before public listing)
  • Freestyle Battles (already built — Phase 3 — but Arena hosts the
    headliner brackets)
  • CELEBRITY POWER COUPLE — NEW in v7. Two Apex-tier artists who've shipped
    a Collab Studio together earn "Power Couple" status which unlocks:
      - Arena headliner slot rights
      - Global broadcast eligibility
      - 10% bonus on every Beat Auction win they're involved in

Access gate to the Arena = `compute_vip_tier(...).celestial_glasshouse_access`
(Vibe Legend OR Vibe Sovereign OR Apex tier — i.e. the founder's "top 1%").

Pure Python — DB persistence wired through routes/celestial_glasshouse_routes.py.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional, Tuple

from services.apex_sovereign import compute_vip_tier, VipTier


POWER_COUPLE_AUCTION_BONUS: float = 0.10   # +10% on auction wins
POWER_COUPLE_MIN_COLLAB_STUDIOS: int = 1     # at least one shipped studio


# ──────────────────────────────────────────────────────────────────────────
# 1. ARENA ACCESS GATE
# ──────────────────────────────────────────────────────────────────────────
def can_enter_arena(artist_rank: Optional[str], chair_count: int) -> Dict:
    """Wraps Apex Sovereign tier check + adds an Arena-specific advisory."""
    tier_info = compute_vip_tier(artist_rank=artist_rank, chair_count=chair_count)
    return {
        **tier_info,
        "can_enter": tier_info["celestial_glasshouse_access"],
        "arena_seat_class": (
            "HEADLINER"  if tier_info["tier"] == VipTier.APEX.value else
            "SOVEREIGN"  if tier_info["tier"] == VipTier.VIBE_SOVEREIGN.value else
            "LEGEND"     if tier_info["tier"] == VipTier.VIBE_LEGEND.value else
            "STREET"     # outside the gate, watching from the public floor
        ),
    }


# ──────────────────────────────────────────────────────────────────────────
# 2. POWER COUPLE STATUS
# ──────────────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class PowerCouple:
    couple_id: str
    artist_a_id: str
    artist_b_id: str
    declared_at: str
    collab_studio_ids: Tuple[str, ...]      # which studios prove the relationship
    is_active: bool = True

    def members(self) -> Tuple[str, str]:
        return (self.artist_a_id, self.artist_b_id)


def declare_power_couple(
    artist_a_id: str, artist_b_id: str,
    artist_a_rank: Optional[str], artist_a_chairs: int,
    artist_b_rank: Optional[str], artist_b_chairs: int,
    shared_collab_studio_ids: List[str],
) -> PowerCouple:
    """Both artists must be Apex-tier AND share at least N collab studios."""
    if artist_a_id == artist_b_id:
        raise ValueError("a couple requires two distinct artists")
    a_tier = compute_vip_tier(artist_rank=artist_a_rank, chair_count=artist_a_chairs)
    b_tier = compute_vip_tier(artist_rank=artist_b_rank, chair_count=artist_b_chairs)
    if a_tier["tier"] != VipTier.APEX.value:
        raise ValueError(f"{artist_a_id} must be Apex-tier (current: {a_tier['tier']})")
    if b_tier["tier"] != VipTier.APEX.value:
        raise ValueError(f"{artist_b_id} must be Apex-tier (current: {b_tier['tier']})")
    if len(shared_collab_studio_ids) < POWER_COUPLE_MIN_COLLAB_STUDIOS:
        raise ValueError(
            f"need at least {POWER_COUPLE_MIN_COLLAB_STUDIOS} shared "
            f"collab studio(s), got {len(shared_collab_studio_ids)}"
        )
    return PowerCouple(
        couple_id=str(uuid.uuid4()),
        artist_a_id=artist_a_id,
        artist_b_id=artist_b_id,
        declared_at=datetime.now(timezone.utc).isoformat(),
        collab_studio_ids=tuple(shared_collab_studio_ids),
    )


def power_couple_bonus_payout(
    base_payout: float, winner_id: str, couple: Optional[PowerCouple],
) -> float:
    """Apply the 10% Power Couple bonus if the auction winner is a member of
    an active Power Couple. Idempotent — pure function."""
    if not couple or not couple.is_active:
        return base_payout
    if winner_id not in couple.members():
        return base_payout
    return round(base_payout * (1.0 + POWER_COUPLE_AUCTION_BONUS), 4)


# ──────────────────────────────────────────────────────────────────────────
# 3. ARENA HEADLINER SLOTS (v7.0 — 4 slots/day, headliner-only)
# ──────────────────────────────────────────────────────────────────────────
HEADLINER_SLOTS_PER_DAY: int = 4


@dataclass(frozen=True)
class HeadlinerBooking:
    booking_id: str
    couple_id: str
    slot_index: int           # 0..HEADLINER_SLOTS_PER_DAY-1
    booked_for_date: str       # YYYY-MM-DD
    booked_at: str


def book_headliner_slot(
    couple: PowerCouple, slot_index: int, booked_for_date: str,
    existing_bookings: List[HeadlinerBooking],
) -> HeadlinerBooking:
    if not couple.is_active:
        raise ValueError("couple is no longer active")
    if not (0 <= slot_index < HEADLINER_SLOTS_PER_DAY):
        raise ValueError(f"slot_index must be 0..{HEADLINER_SLOTS_PER_DAY - 1}")
    # Slot can't already be taken on that date
    for b in existing_bookings:
        if b.booked_for_date == booked_for_date and b.slot_index == slot_index:
            raise ValueError("slot already booked for that date")
    return HeadlinerBooking(
        booking_id=str(uuid.uuid4()),
        couple_id=couple.couple_id,
        slot_index=slot_index,
        booked_for_date=booked_for_date,
        booked_at=datetime.now(timezone.utc).isoformat(),
    )


__all__ = [
    "POWER_COUPLE_AUCTION_BONUS", "POWER_COUPLE_MIN_COLLAB_STUDIOS",
    "HEADLINER_SLOTS_PER_DAY",
    "can_enter_arena",
    "PowerCouple", "declare_power_couple", "power_couple_bonus_payout",
    "HeadlinerBooking", "book_headliner_slot",
]
