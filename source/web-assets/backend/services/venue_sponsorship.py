"""
Venue Partnership / Sponsored Vibez Spots — chair-economy B2B layer.

Turns Vibez Spots into premium sponsored inventory:
  • Sponsorship tiers (spotlight / partner / flagship)
  • Carousel premium visibility
  • Commission on user conversions (bookings + perk redemptions)

Collections:
  venue_sponsored_spots   — inventory + tier + perk copy
  venue_sponsorship_ledger — commission + conversion audit
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

# Monthly USD list price + platform commission on each conversion (bps of fee).
SPONSORSHIP_TIERS: Dict[str, Dict[str, Any]] = {
    "spotlight": {
        "id": "spotlight",
        "label": "Spotlight",
        "usd_month": 49.0,
        "carousel_weight": 10,
        "platform_commission_bps": 500,  # 5% of booking fee
        "perks": ["Carousel pin", "Sponsored badge"],
        "exclusive_perk_slots": 1,
    },
    "partner": {
        "id": "partner",
        "label": "Partner",
        "usd_month": 99.0,
        "carousel_weight": 25,
        "platform_commission_bps": 800,  # 8%
        "perks": [
            "Priority carousel",
            "Platform-only perk (reserved table / free drink)",
            "Sponsored badge",
        ],
        "exclusive_perk_slots": 3,
    },
    "flagship": {
        "id": "flagship",
        "label": "Flagship",
        "usd_month": 199.0,
        "carousel_weight": 50,
        "platform_commission_bps": 1000,  # 10%
        "perks": [
            "Top carousel slot",
            "Game-room shout-out inventory",
            "VIP preferred seating tag",
            "Exclusive perk pack",
        ],
        "exclusive_perk_slots": 6,
    },
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def tier_catalog() -> List[Dict[str, Any]]:
    return [dict(v) for v in SPONSORSHIP_TIERS.values()]


def resolve_tier(tier_id: str) -> Dict[str, Any]:
    key = (tier_id or "").strip().lower()
    if key not in SPONSORSHIP_TIERS:
        raise ValueError(f"Unknown sponsorship tier: {tier_id}")
    return dict(SPONSORSHIP_TIERS[key])


def expires_in_days(days: int = 30) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


async def list_active_sponsored_spots(
    db: Any, *, limit: int = 12, city: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Carousel feed — active, non-expired, sorted by tier weight then freshness."""
    now = utc_now_iso()
    query: Dict[str, Any] = {
        "status": "active",
        "$or": [{"expires_at": None}, {"expires_at": {"$gt": now}}],
    }
    if city:
        query["city"] = {"$regex": f"^{city.strip()}$", "$options": "i"}

    rows = await db.venue_sponsored_spots.find(query, {"_id": 0}).to_list(length=200)
    rows.sort(
        key=lambda r: (
            -int(r.get("carousel_weight") or 0),
            r.get("activated_at") or r.get("created_at") or "",
        ),
        reverse=False,
    )
    return rows[: max(1, min(int(limit), 40))]


async def record_conversion(
    db: Any,
    *,
    spot_id: str,
    user_id: str,
    kind: str,
    amount_vibe: int = 0,
    booking_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    When a user converts through a sponsored spot (booking complete / perk claim),
    credit the platform commission ledger and (if linked) ambassador cut.
    Idempotent on (kind, booking_id|user+spot+day) for booking completes.
    """
    spot = await db.venue_sponsored_spots.find_one(
        {"spot_id": spot_id, "status": "active"}, {"_id": 0}
    )
    if not spot:
        return None

    event_key = (
        f"conv::{kind}::{booking_id}"
        if booking_id
        else f"conv::{kind}::{spot_id}::{user_id}::{utc_now_iso()[:10]}"
    )
    existing = await db.venue_sponsorship_ledger.find_one(
        {"event_key": event_key}, {"_id": 0}
    )
    if existing:
        return existing

    bps = int(spot.get("platform_commission_bps") or 500)
    commission_vibe = max(0, int(round(amount_vibe * bps / 10_000))) if amount_vibe else 0

    # Optional ambassador share from linked vibe_sponsors row (bps of platform cut).
    ambassador_user_id = spot.get("ambassador_user_id")
    ambassador_bps = int(spot.get("ambassador_commission_bps") or 0)
    ambassador_vibe = 0
    if ambassador_user_id and commission_vibe and ambassador_bps > 0:
        ambassador_vibe = max(0, int(round(commission_vibe * ambassador_bps / 10_000)))
        if ambassador_vibe:
            from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415

            amb = await db.users.find_one(
                {"user_id": ambassador_user_id},
                {"_id": 0, "token_balance": 1, "credits_balance": 1},
            ) or {}
            field = pick_wallet_field_for_credit(amb)
            await db.users.update_one(
                {"user_id": ambassador_user_id},
                {"$inc": {field: ambassador_vibe}},
            )

    row = {
        "event_id": f"vsl_{event_key[-40:]}",
        "event_key": event_key,
        "kind": kind,
        "spot_id": spot_id,
        "venue_name": spot.get("venue_name"),
        "tier_id": spot.get("tier_id"),
        "user_id": user_id,
        "booking_id": booking_id,
        "amount_vibe": amount_vibe,
        "platform_commission_bps": bps,
        "platform_commission_vibe": commission_vibe,
        "ambassador_user_id": ambassador_user_id,
        "ambassador_commission_vibe": ambassador_vibe,
        "metadata": metadata or {},
        "at": utc_now_iso(),
    }
    await db.venue_sponsorship_ledger.insert_one(dict(row))
    await db.venue_sponsored_spots.update_one(
        {"spot_id": spot_id},
        {
            "$inc": {
                "conversions": 1,
                "commission_vibe_total": commission_vibe,
            },
            "$set": {"last_conversion_at": utc_now_iso()},
        },
    )
    row.pop("_id", None)
    return row
