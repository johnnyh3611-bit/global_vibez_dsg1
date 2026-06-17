"""
Receipt OCR + 15% Merchant Boost (P2 — May 2026).

Users upload a HungryVibes / VibeRidez receipt; we OCR-verify the
merchant + amount; on validation we credit a +15% Vibe Coin bonus
back to the user, and stamp the merchant with a "boost month" flag
that doubles their search-rank weight in YellowPages.

OCR pipeline: stub-mode for now (any properly-formatted URL passes;
real OCR via OpenAI vision when EMERGENT_LLM_KEY budget is restored).
The interface is identical so swapping in real OCR is a 5-line
backend change.

ENDPOINTS:
  POST /api/receipts/submit          — submit a receipt for verification
  GET  /api/receipts/my-receipts     — caller's verified receipts + bonuses
  GET  /api/receipts/merchant-boosts — public list of currently-boosted merchants
"""
from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, HttpUrl

from utils.database import get_database, get_current_user

router = APIRouter()

BONUS_PCT = 0.15  # 15% bonus on every verified receipt
BOOST_DAYS = 30  # merchant boost duration
DAILY_RECEIPT_CAP = 5  # anti-abuse


class ReceiptPayload(BaseModel):
    image_url: HttpUrl
    merchant_id: str = Field(min_length=2, max_length=64)
    amount_usd: float = Field(gt=0, le=10_000)
    occurred_at_iso: Optional[str] = Field(default=None, max_length=40)


def _stub_ocr(url: str, merchant_id: str, amount: float) -> Dict[str, Any]:
    """Stub OCR pipeline — accepts any https image URL ending in a
    recognized format. Real implementation will swap this with an
    OpenAI Vision call once Universal Key budget is restored."""
    if not re.match(r"^https?://.+\.(jpe?g|png|webp|heic|pdf)(\?.*)?$", url, re.IGNORECASE):
        return {"valid": False, "reason": "image_format_unrecognized"}
    if amount < 1:
        return {"valid": False, "reason": "amount_too_small"}
    return {"valid": True, "merchant_match": True, "amount_detected": amount, "engine": "stub"}


@router.post("/receipts/submit")
async def submit_receipt(payload: ReceiptPayload, http_request: Request):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Sign in to submit a receipt")
    db = get_database()

    # Anti-abuse: daily cap per user.
    today = datetime.now(timezone.utc).date().isoformat()
    daily_count = await db.receipt_submissions.count_documents({
        "user_id": user.user_id,
        "submitted_at_day": today,
    })
    if daily_count >= DAILY_RECEIPT_CAP:
        raise HTTPException(429, f"Daily cap of {DAILY_RECEIPT_CAP} receipts reached")

    # OCR verify.
    ocr = _stub_ocr(str(payload.image_url), payload.merchant_id, payload.amount_usd)
    record: Dict[str, Any] = {
        "receipt_id": f"r_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "merchant_id": payload.merchant_id,
        "amount_usd": payload.amount_usd,
        "image_url": str(payload.image_url),
        "occurred_at_iso": payload.occurred_at_iso,
        "submitted_at_iso": datetime.now(timezone.utc).isoformat(),
        "submitted_at_day": today,
        "ocr": ocr,
        "status": "verified" if ocr["valid"] else "rejected",
    }

    if not ocr["valid"]:
        await db.receipt_submissions.insert_one(record)
        return {"status": "rejected", "reason": ocr["reason"]}

    # Credit 15% bonus in ₵ VIBE (1 USD ≈ 100 ₵).
    bonus_vibe = int(payload.amount_usd * 100 * BONUS_PCT)
    from utils.wallet_fields import pick_wallet_field_for_credit  # noqa: PLC0415
    uw = await db.users.find_one(
        {"user_id": user.user_id}, {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    field = pick_wallet_field_for_credit(uw)
    await db.users.update_one(
        {"user_id": user.user_id}, {"$inc": {field: bonus_vibe}},
    )
    record["bonus_vibe_credited"] = bonus_vibe
    await db.receipt_submissions.insert_one(record)

    # Merchant boost: extend window to NOW + 30d.
    boost_until = (datetime.now(timezone.utc) + timedelta(days=BOOST_DAYS)).isoformat()
    await db.merchant_boosts.update_one(
        {"merchant_id": payload.merchant_id},
        {"$set": {
            "merchant_id": payload.merchant_id,
            "boosted_until": boost_until,
            "last_receipt_at": datetime.now(timezone.utc).isoformat(),
        }, "$inc": {"receipts_count": 1}},
        upsert=True,
    )

    return {
        "status": "verified",
        "receipt_id": record["receipt_id"],
        "bonus_vibe": bonus_vibe,
        "merchant_boost_until": boost_until,
    }


@router.get("/receipts/my-receipts")
async def my_receipts(http_request: Request, limit: int = 20):
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Sign in")
    db = get_database()
    rows = await db.receipt_submissions.find(
        {"user_id": user.user_id}, {"_id": 0},
    ).sort("submitted_at_iso", -1).to_list(min(max(limit, 1), 50))
    return {"count": len(rows), "rows": rows}


@router.get("/receipts/merchant-boosts")
async def merchant_boosts():
    """Public — list merchants currently inside their boost window."""
    db = get_database()
    now_iso = datetime.now(timezone.utc).isoformat()
    rows = await db.merchant_boosts.find(
        {"boosted_until": {"$gte": now_iso}}, {"_id": 0},
    ).sort("boosted_until", -1).to_list(50)
    return {"count": len(rows), "rows": rows}
