"""
Vibe Spots — Room bookings with 35% Cancellation Protection (Master Blueprint
PDF, page 1).

CANCELLATION RULE
=================
  • Host keeps 35% of the booked fee (compensation for the held slot).
  • Client gets 65% refund.
  • Solana smart-contract execution stub is callable but no-ops when
    SOLANA_MAINNET_UNLOCKED env-flag is unset (locked until founder
    types the `project complete` phrase per the handoff brief).

Endpoints (mounted under /api):
  POST /api/vibe-spots/book              — book a slot, lock funds
  POST /api/vibe-spots/cancel            — cancel + apply 65/35 split
  POST /api/vibe-spots/complete          — host marks the slot complete → release full fee to host
  GET  /api/vibe-spots/mine              — caller's bookings (both as host and as guest)
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

router = APIRouter()

HOST_RETAIN_PCT = 0.35
CLIENT_REFUND_PCT = 0.65
SOLANA_UNLOCKED = os.environ.get("SOLANA_MAINNET_UNLOCKED", "0") == "1"


class BookPayload(BaseModel):
    host_user_id: str
    spot_id: str
    starts_at: str  # ISO8601
    fee_vibe: int = Field(ge=1, le=10_000_000)
    notes: Optional[str] = None


class CancelPayload(BaseModel):
    booking_id: str


class CompletePayload(BaseModel):
    booking_id: str


async def _execute_solana_escrow(booking: Dict[str, Any], action: str) -> Optional[str]:
    """STUB — returns a mock tx id when mainnet is locked. When mainnet
    unlocks (env flag), wire the real Solana program call here."""
    if not SOLANA_UNLOCKED:
        return None  # off-chain ledger only
    return f"sol_tx_{uuid.uuid4().hex[:24]}"


@router.post("/vibe-spots/book")
async def book_spot(payload: BookPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if payload.host_user_id == user.user_id:
        raise HTTPException(400, "Cannot book your own spot.")

    db = get_database()

    # Debit the guest (the booker) up-front — funds are now "in escrow".
    from utils.wallet_fields import pick_wallet_field_for_debit  # noqa: PLC0415
    u = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    try:
        field, _bal = pick_wallet_field_for_debit(u, payload.fee_vibe)
    except ValueError:
        raise HTTPException(402, "Insufficient ₵ balance to book this spot.")
    await db.users.update_one({"user_id": user.user_id}, {"$inc": {field: -payload.fee_vibe}})

    booking = {
        "booking_id": f"vs_{uuid.uuid4().hex[:12]}",
        "spot_id": payload.spot_id,
        "host_user_id": payload.host_user_id,
        "guest_user_id": user.user_id,
        "starts_at": payload.starts_at,
        "fee_vibe": payload.fee_vibe,
        "notes": payload.notes,
        "status": "booked",
        "escrow_tx": None,
        "booked_at": datetime.now(timezone.utc).isoformat(),
        "settled_at": None,
        "settlement": None,
    }
    booking["escrow_tx"] = await _execute_solana_escrow(booking, "lock")
    await db.vibe_spot_bookings.insert_one(booking)
    booking.pop("_id", None)
    return booking


@router.post("/vibe-spots/cancel")
async def cancel_spot(payload: CancelPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    booking = await db.vibe_spot_bookings.find_one(
        {"booking_id": payload.booking_id}, {"_id": 0}
    )
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking["status"] != "booked":
        raise HTTPException(400, f"Booking already {booking['status']}")
    # Either party may cancel — applies the same 65/35 split.
    if user.user_id not in (booking["guest_user_id"], booking["host_user_id"]):
        raise HTTPException(403, "Not your booking")

    host_keep = int(round(booking["fee_vibe"] * HOST_RETAIN_PCT))
    guest_refund = booking["fee_vibe"] - host_keep  # ensures sum == fee

    from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415
    host_doc = await db.users.find_one(
        {"user_id": booking["host_user_id"]},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    guest_doc = await db.users.find_one(
        {"user_id": booking["guest_user_id"]},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    host_field = pick_wallet_field_for_credit(host_doc)
    guest_field = pick_wallet_field_for_credit(guest_doc)
    await db.users.update_one(
        {"user_id": booking["host_user_id"]},
        {"$inc": {host_field: host_keep}},
    )
    await db.users.update_one(
        {"user_id": booking["guest_user_id"]},
        {"$inc": {guest_field: guest_refund}},
    )

    settlement = {
        "host_keep_vibe": host_keep,
        "guest_refund_vibe": guest_refund,
        "cancelled_by": user.user_id,
        "settlement_tx": await _execute_solana_escrow(booking, "cancel"),
    }
    await db.vibe_spot_bookings.update_one(
        {"booking_id": payload.booking_id},
        {"$set": {
            "status": "cancelled",
            "settled_at": datetime.now(timezone.utc).isoformat(),
            "settlement": settlement,
        }},
    )
    return {**booking, "status": "cancelled", "settlement": settlement}


@router.post("/vibe-spots/complete")
async def complete_spot(payload: CompletePayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    booking = await db.vibe_spot_bookings.find_one(
        {"booking_id": payload.booking_id}, {"_id": 0}
    )
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking["status"] != "booked":
        raise HTTPException(400, f"Booking already {booking['status']}")
    if user.user_id != booking["host_user_id"]:
        raise HTTPException(403, "Only the host can mark complete")

    # Host gets the full fee, taxed by Sovereign Tax on the net winnings.
    from services.sovereign_validator import apply_sovereign_tax  # noqa: PLC0415
    tax_split = apply_sovereign_tax(booking["fee_vibe"])
    from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415
    host_doc = await db.users.find_one(
        {"user_id": booking["host_user_id"]},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    host_field = pick_wallet_field_for_credit(host_doc)
    await db.users.update_one(
        {"user_id": booking["host_user_id"]},
        {"$inc": {host_field: tax_split["net"]}},
    )

    settlement = {
        "host_payout_vibe": tax_split["net"],
        "sovereign_tax_vibe": tax_split["tax"],
        "settlement_tx": await _execute_solana_escrow(booking, "complete"),
    }
    await db.vibe_spot_bookings.update_one(
        {"booking_id": payload.booking_id},
        {"$set": {
            "status": "completed",
            "settled_at": datetime.now(timezone.utc).isoformat(),
            "settlement": settlement,
        }},
    )
    return {**booking, "status": "completed", "settlement": settlement}


@router.get("/vibe-spots/mine")
async def my_bookings(http_request: Request, limit: int = 25):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    cursor = db.vibe_spot_bookings.find(
        {"$or": [{"host_user_id": user.user_id}, {"guest_user_id": user.user_id}]},
        {"_id": 0},
    ).sort("booked_at", -1).limit(max(1, min(int(limit), 100)))
    rows: List[Dict[str, Any]] = await cursor.to_list(length=100)
    return {"count": len(rows), "rows": rows, "solana_mainnet_unlocked": SOLANA_UNLOCKED}
