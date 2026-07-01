"""
Live Commerce — "Tap to Buy" overlay for DSG TV streams (Feb 2026
founder roadmap, item 3/8).

A streamer pins inventory items to their live stream. Viewers tap a
product overlay → checkout via $VIBEZ wallet → vendor & streamer split
the GMV. Plugs into Hungry Vibez / Yellow Pages vendor catalogs.

Split: 70% vendor / 20% streamer / 10% house (1% of house → pool).
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Final

from fastapi import APIRouter, BackgroundTasks, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from routes.dsg_core_system import update_house_pool, HOUSE_TO_POOL_RATE


VENDOR_SPLIT: Final[float] = 0.70
STREAMER_SPLIT: Final[float] = 0.20
HOUSE_SPLIT: Final[float] = 0.10

_MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
_DB_NAME = os.environ.get("DB_NAME", "vibez_global")
_client = AsyncIOMotorClient(_MONGO_URL)
_db = _client[_DB_NAME]
_pins_col = _db["live_commerce_pins"]
_orders_col = _db["live_commerce_orders"]


router = APIRouter(prefix="/live-commerce", tags=["live-commerce"])


class PinProductBody(BaseModel):
    stream_id: str = Field(..., min_length=1)
    streamer_id: str = Field(..., min_length=1)
    vendor_id: str = Field(..., min_length=1)
    product_id: str = Field(..., min_length=1)
    title: str = Field(..., max_length=120)
    price_vibez: int = Field(..., gt=0)
    image_url: str | None = None


@router.post("/pin")
async def pin_product_to_stream(body: PinProductBody):
    """Streamer pins a vendor product to their live stream — appears as
    a Tap-to-Buy overlay for viewers."""
    pin_id = uuid.uuid4().hex
    doc = {
        **body.model_dump(),
        "pin_id": pin_id,
        "pinned_at": datetime.now(timezone.utc).isoformat(),
        "active": True,
    }
    await _pins_col.insert_one(doc)
    doc.pop("_id", None)
    return {"pin_id": pin_id, "status": "pinned", "pin": doc}


@router.get("/stream/{stream_id}/pins")
async def list_pins_for_stream(stream_id: str):
    """All active pinned products for a given live stream."""
    cursor = _pins_col.find(
        {"stream_id": stream_id, "active": True}, {"_id": 0}
    ).sort("pinned_at", -1)
    pins = await cursor.to_list(length=50)
    return {"stream_id": stream_id, "pins": pins, "count": len(pins)}


class TapToBuyBody(BaseModel):
    pin_id: str
    buyer_user_id: str = Field(..., min_length=1)


@router.post("/buy")
async def tap_to_buy(body: TapToBuyBody, background_tasks: BackgroundTasks):
    """Viewer taps a pinned product → settles 70/20/10 split + injects
    1% of house cut into the quarterly pool."""
    pin = await _pins_col.find_one({"pin_id": body.pin_id, "active": True}, {"_id": 0})
    if not pin:
        raise HTTPException(404, "Pin not found or inactive")

    price = pin["price_vibez"]
    vendor_payout = price * VENDOR_SPLIT
    streamer_payout = price * STREAMER_SPLIT
    house_cut = price * HOUSE_SPLIT
    pool_contribution = house_cut * HOUSE_TO_POOL_RATE
    order_id = uuid.uuid4().hex

    await _orders_col.insert_one({
        "order_id": order_id,
        "pin_id": body.pin_id,
        "stream_id": pin["stream_id"],
        "streamer_id": pin["streamer_id"],
        "vendor_id": pin["vendor_id"],
        "product_id": pin["product_id"],
        "buyer_user_id": body.buyer_user_id,
        "price_vibez": price,
        "vendor_payout_vibez": vendor_payout,
        "streamer_payout_vibez": streamer_payout,
        "house_cut_vibez": house_cut,
        "pool_contribution_usd": pool_contribution,
        "settled_at": datetime.now(timezone.utc).isoformat(),
    })
    background_tasks.add_task(
        update_house_pool, pool_contribution, f"live_commerce:{pin['vendor_id']}"
    )
    return {
        "order_id": order_id,
        "status": "settled",
        "ledger": {
            "vendor_vibez": round(vendor_payout, 2),
            "streamer_vibez": round(streamer_payout, 2),
            "house_vibez": round(house_cut, 2),
        },
        "split": {"vendor_pct": 70, "streamer_pct": 20, "house_pct": 10},
    }
