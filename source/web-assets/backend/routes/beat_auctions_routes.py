"""Beat Auctions — HTTP routes (v7.0 Phase 8)."""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.beat_auctions import (
    BeatAuction, open_auction, submit_sealed_bid, settle_auction, public_view,
    AUCTION_PRODUCER_SHARE, AUCTION_PLATFORM_SHARE, DEFAULT_AUCTION_WINDOW_HOURS,
)


auctions_router = APIRouter(prefix="/auctions", tags=["beat-auctions-v7"])

_AUCTIONS: Dict[str, BeatAuction] = {}


class OpenAuctionRequest(BaseModel):
    beat_id: str
    producer_id: str
    reserve_price: float = Field(..., gt=0)
    window_hours: int = Field(default=DEFAULT_AUCTION_WINDOW_HOURS, ge=1, le=168)


@auctions_router.post("/open")
def auction_open(req: OpenAuctionRequest) -> Dict:
    try:
        auction = open_auction(req.beat_id, req.producer_id, req.reserve_price, req.window_hours)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _AUCTIONS[auction.auction_id] = auction
    return public_view(auction)


class SubmitBidRequest(BaseModel):
    auction_id: str
    bidder_id: str
    amount: float = Field(..., gt=0)


@auctions_router.post("/bid")
def auction_bid(req: SubmitBidRequest) -> Dict:
    auction = _AUCTIONS.get(req.auction_id)
    if not auction:
        raise HTTPException(status_code=404, detail="auction not found")
    try:
        bid = submit_sealed_bid(auction, req.bidder_id, req.amount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "bid_id": bid.bid_id,
        "auction_id": auction.auction_id,
        "bid_count": len(auction.bids),
        # Note: amount NOT returned — sealed-bid privacy
    }


@auctions_router.post("/settle")
def auction_settle(auction_id: str) -> Dict:
    auction = _AUCTIONS.get(auction_id)
    if not auction:
        raise HTTPException(status_code=404, detail="auction not found")
    try:
        return settle_auction(auction)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@auctions_router.get("/{auction_id}")
def auction_get(auction_id: str) -> Dict:
    auction = _AUCTIONS.get(auction_id)
    if not auction:
        raise HTTPException(status_code=404, detail="auction not found")
    return public_view(auction)


@auctions_router.get("/")
def auctions_list(status: Optional[str] = None) -> Dict:
    rows = [public_view(a) for a in _AUCTIONS.values()]
    if status:
        rows = [r for r in rows if r["status"] == status]
    return {"count": len(rows), "auctions": rows}


@auctions_router.get("/constants/splits")
def auction_constants() -> Dict:
    return {
        "producer_share": AUCTION_PRODUCER_SHARE,
        "platform_share": AUCTION_PLATFORM_SHARE,
        "default_window_hours": DEFAULT_AUCTION_WINDOW_HOURS,
    }


__all__ = ["auctions_router"]
