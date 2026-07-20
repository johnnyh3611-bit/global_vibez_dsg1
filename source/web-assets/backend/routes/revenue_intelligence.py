"""
Revenue Intelligence — Vibe Velocity + VIP tiered access.

  GET  /revenue/vibe-velocity     — conversion signals by room/spot
  GET  /revenue/vip/status        — Founding Member / VIP access
  POST /revenue/vip/tables/enter  — gate higher-stakes tables
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_current_user, get_database
from services.payment_beta_gate import user_is_payment_beta_allowed

router = APIRouter(tags=["revenue-intelligence"])

# Higher-stakes VIP tables — credit floor + founding/VIP flag.
VIP_TABLES = {
    "vip_spades_high": {
        "table_id": "vip_spades_high",
        "label": "VIP Spades High Stakes",
        "min_credits": 5_000,
        "entry_coins": 500,
        "requires_founding_or_vip": True,
    },
    "vip_venue_preferred": {
        "table_id": "vip_venue_preferred",
        "label": "Preferred Venue Seating",
        "min_credits": 2_000,
        "entry_coins": 250,
        "requires_founding_or_vip": True,
    },
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


class VipEnter(BaseModel):
    table_id: str
    room_path: Optional[str] = None


@router.get("/revenue/vibe-velocity")
async def vibe_velocity(days: int = 7) -> Dict[str, Any]:
    """
    Track which spots/rooms convert free → paid.
    Aggregates sponsorship conversions, live-event entries, and room personalization.
    """
    db = get_database()
    since = (_now() - timedelta(days=max(1, min(days, 90)))).isoformat()

    spot_rows = await db.venue_sponsored_spots.find(
        {},
        {
            "_id": 0,
            "spot_id": 1,
            "venue_name": 1,
            "tier_id": 1,
            "conversions": 1,
            "commission_vibe_total": 1,
            "status": 1,
        },
    ).to_list(length=100)

    event_entries = await db.vibe_live_entries.count_documents({"at": {"$gte": since}})
    entry_rows = await db.vibe_live_entries.find(
        {"at": {"$gte": since}}, {"_id": 0, "coins": 1}
    ).to_list(length=5_000)
    event_coins = sum(int(row.get("coins") or 0) for row in entry_rows)

    rewarded = await db.vibe_rewarded_actions.count_documents({"at": {"$gte": since}})
    personalize = await db.hosted_room_themes.count_documents(
        {"updated_at": {"$gte": since}}
    )
    predictions = await db.stream_predictions.count_documents({"at": {"$gte": since}})

    # Rank spots by conversions (underperformers first for re-skin guidance).
    ranked = sorted(
        spot_rows,
        key=lambda s: (
            -int(s.get("conversions") or 0),
            -int(s.get("commission_vibe_total") or 0),
        ),
    )
    under = [s for s in ranked if int(s.get("conversions") or 0) == 0 and s.get("status") == "active"]

    return {
        "window_days": days,
        "since": since,
        "sponsored_spots": ranked[:40],
        "underperforming_spots": under[:20],
        "signals": {
            "live_event_entries": event_entries,
            "live_event_coins_spent": event_coins,
            "rewarded_actions": rewarded,
            "room_personalizations": personalize,
            "stream_predictions": predictions,
        },
        "guidance": (
            "Re-skin or lower credit requirements on underperforming spots; "
            "boost carousel_weight on high-conversion Partner/Flagship venues."
        ),
    }


@router.get("/revenue/vip/status")
async def vip_status(http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    doc = await db.users.find_one(
        {"user_id": user.user_id},
        {
            "_id": 0,
            "email": 1,
            "user_id": 1,
            "credits_balance": 1,
            "token_balance": 1,
            "is_founding_member": 1,
            "is_beta_tester": 1,
            "is_admin": 1,
            "vip_tier": 1,
            "membership_type": 1,
        },
    ) or {}
    allowed = user_is_payment_beta_allowed(doc)
    vip_tier = doc.get("vip_tier") or (
        "founding" if allowed else ("premium" if doc.get("membership_type") == "premium" else "standard")
    )
    balance = int(doc.get("credits_balance") or doc.get("token_balance") or 0)
    tables = []
    for t in VIP_TABLES.values():
        eligible = balance >= t["min_credits"]
        if t["requires_founding_or_vip"]:
            eligible = eligible and (allowed or vip_tier in ("founding", "vip", "elite"))
        tables.append({**t, "eligible": eligible})
    return {
        "user_id": user.user_id,
        "vip_tier": vip_tier,
        "founding_member": allowed,
        "credits_balance": balance,
        "tables": tables,
    }


@router.post("/revenue/vip/tables/enter")
async def enter_vip_table(payload: VipEnter, http_request: Request) -> Dict[str, Any]:
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    table = VIP_TABLES.get(payload.table_id)
    if not table:
        raise HTTPException(404, "Unknown VIP table")
    db = get_database()
    doc = await db.users.find_one(
        {"user_id": user.user_id},
        {
            "_id": 0,
            "email": 1,
            "user_id": 1,
            "credits_balance": 1,
            "token_balance": 1,
            "is_founding_member": 1,
            "is_beta_tester": 1,
            "is_admin": 1,
            "vip_tier": 1,
            "membership_type": 1,
        },
    ) or {}
    allowed = user_is_payment_beta_allowed(doc)
    vip_tier = doc.get("vip_tier") or ("founding" if allowed else "standard")
    balance = int(doc.get("credits_balance") or doc.get("token_balance") or 0)
    if balance < table["min_credits"]:
        raise HTTPException(
            402,
            f"VIP table needs ₵{table['min_credits']:,} balance "
            f"(you have ₵{balance:,}).",
        )
    if table["requires_founding_or_vip"] and not (
        allowed or vip_tier in ("founding", "vip", "elite")
    ):
        raise HTTPException(
            403,
            {
                "error": "vip_restricted",
                "message": (
                    "Preferred seating and high-stakes tables are for "
                    "Founding Members / VIP during the beta."
                ),
            },
        )

    from utils.wallet_fields import pick_wallet_field_for_debit  # noqa: PLC0415

    try:
        field, _ = pick_wallet_field_for_debit(doc, table["entry_coins"])
    except ValueError:
        raise HTTPException(402, f"Need ₵{table['entry_coins']:,} entry fee")
    await db.users.update_one(
        {"user_id": user.user_id}, {"$inc": {field: -table["entry_coins"]}}
    )
    seat = {
        "seat_id": f"vip_{payload.table_id}_{user.user_id[:8]}",
        "table_id": payload.table_id,
        "user_id": user.user_id,
        "entry_coins": table["entry_coins"],
        "room_path": payload.room_path,
        "at": _now().isoformat(),
    }
    await db.vip_table_entries.insert_one(dict(seat))
    seat.pop("_id", None)
    return {"ok": True, "seat": seat, "table": table}
