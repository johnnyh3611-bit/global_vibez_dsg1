"""Celestial Glasshouse Arena — HTTP routes (v7.0 Phase 9)."""
from __future__ import annotations

from dataclasses import asdict
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.celestial_glasshouse import (
    PowerCouple, declare_power_couple, power_couple_bonus_payout,
    HeadlinerBooking, book_headliner_slot,
    can_enter_arena,
    POWER_COUPLE_AUCTION_BONUS, POWER_COUPLE_MIN_COLLAB_STUDIOS,
    HEADLINER_SLOTS_PER_DAY,
)


arena_router = APIRouter(prefix="/arena", tags=["celestial-glasshouse-v7"])

_POWER_COUPLES: Dict[str, PowerCouple] = {}
_HEADLINER_BOOKINGS: List[HeadlinerBooking] = []


# ── ARENA ACCESS GATE ──────────────────────────────────────────────────
class ArenaAccessRequest(BaseModel):
    artist_rank: Optional[str] = None
    chair_count: int = 0


@arena_router.post("/access-check")
def arena_access_check(req: ArenaAccessRequest) -> Dict:
    return can_enter_arena(req.artist_rank, req.chair_count)


# ── POWER COUPLE ───────────────────────────────────────────────────────
class DeclareCoupleRequest(BaseModel):
    artist_a_id: str
    artist_b_id: str
    artist_a_rank: Optional[str] = None
    artist_a_chairs: int = 0
    artist_b_rank: Optional[str] = None
    artist_b_chairs: int = 0
    shared_collab_studio_ids: List[str]


@arena_router.post("/power-couple/declare")
def power_couple_declare(req: DeclareCoupleRequest) -> Dict:
    try:
        couple = declare_power_couple(
            artist_a_id=req.artist_a_id, artist_b_id=req.artist_b_id,
            artist_a_rank=req.artist_a_rank, artist_a_chairs=req.artist_a_chairs,
            artist_b_rank=req.artist_b_rank, artist_b_chairs=req.artist_b_chairs,
            shared_collab_studio_ids=req.shared_collab_studio_ids,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _POWER_COUPLES[couple.couple_id] = couple
    return {
        "couple_id": couple.couple_id,
        "artist_a_id": couple.artist_a_id,
        "artist_b_id": couple.artist_b_id,
        "declared_at": couple.declared_at,
        "collab_studio_ids": list(couple.collab_studio_ids),
        "is_active": couple.is_active,
    }


@arena_router.get("/power-couple/{couple_id}")
def power_couple_get(couple_id: str) -> Dict:
    couple = _POWER_COUPLES.get(couple_id)
    if not couple:
        raise HTTPException(status_code=404, detail="couple not found")
    return {
        **{k: v for k, v in couple.__dict__.items()},
        "collab_studio_ids": list(couple.collab_studio_ids),
    }


@arena_router.get("/power-couples")
def power_couples_list() -> Dict:
    return {
        "count": len(_POWER_COUPLES),
        "couples": [
            {
                "couple_id": c.couple_id,
                "artist_a_id": c.artist_a_id,
                "artist_b_id": c.artist_b_id,
                "is_active": c.is_active,
                "declared_at": c.declared_at,
            } for c in _POWER_COUPLES.values()
        ],
    }


class BonusPayoutRequest(BaseModel):
    base_payout: float = Field(..., gt=0)
    winner_id: str
    couple_id: Optional[str] = None


@arena_router.post("/power-couple/bonus")
def power_couple_bonus(req: BonusPayoutRequest) -> Dict:
    couple = _POWER_COUPLES.get(req.couple_id) if req.couple_id else None
    final = power_couple_bonus_payout(req.base_payout, req.winner_id, couple)
    bonus_applied = final != req.base_payout
    return {
        "base_payout": req.base_payout,
        "final_payout": final,
        "bonus_applied": bonus_applied,
        "bonus_pct": POWER_COUPLE_AUCTION_BONUS if bonus_applied else 0.0,
    }


# ── HEADLINER SLOTS ────────────────────────────────────────────────────
class BookHeadlinerRequest(BaseModel):
    couple_id: str
    slot_index: int = Field(..., ge=0, le=HEADLINER_SLOTS_PER_DAY - 1)
    booked_for_date: str   # YYYY-MM-DD


@arena_router.post("/headliner/book")
def headliner_book(req: BookHeadlinerRequest) -> Dict:
    couple = _POWER_COUPLES.get(req.couple_id)
    if not couple:
        raise HTTPException(status_code=404, detail="couple not found")
    try:
        booking = book_headliner_slot(
            couple, req.slot_index, req.booked_for_date, _HEADLINER_BOOKINGS,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _HEADLINER_BOOKINGS.append(booking)
    return asdict(booking)


@arena_router.get("/headliner/schedule")
def headliner_schedule(date: Optional[str] = None) -> Dict:
    rows = _HEADLINER_BOOKINGS
    if date:
        rows = [b for b in rows if b.booked_for_date == date]
    return {
        "count": len(rows),
        "slots_per_day": HEADLINER_SLOTS_PER_DAY,
        "bookings": [asdict(b) for b in rows],
    }


@arena_router.get("/constants")
def arena_constants() -> Dict:
    return {
        "power_couple_auction_bonus": POWER_COUPLE_AUCTION_BONUS,
        "power_couple_min_collab_studios": POWER_COUPLE_MIN_COLLAB_STUDIOS,
        "headliner_slots_per_day": HEADLINER_SLOTS_PER_DAY,
    }


__all__ = ["arena_router"]
