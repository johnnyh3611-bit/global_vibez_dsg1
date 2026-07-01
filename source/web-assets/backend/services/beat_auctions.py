"""
Beat Auctions — v7.0 Phase 8.

Source: /app/memory/locked_specs/v7_OMNI_BLUEPRINT.md §4 (Apex Factor)

Sealed-bid auction for EXCLUSIVE rights to a Beat Vault track. Different
from the Beat Vault's $0.50/use marketplace (Phase 3) — this transfers
exclusive ownership to the highest bidder; the producer can no longer sell
the same beat $0.50/use after the auction settles.

Mechanics:
  • Producer lists a beat with a reserve price + auction window
  • Artists submit sealed bids (private) until window closes
  • At settlement: highest bid wins. If under reserve → auction voids.
  • 70/30 split applies (70% to producer, 30% to platform)
  • Sovereign Tax applies on top
  • Random Beat fallback: if a sealed-bid auction voids, the beat returns
    to the public Beat Vault $0.50/use catalog automatically.
"""
from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional

from services.pricing_master_vault import SOVEREIGN_TAX_RATE


AUCTION_PRODUCER_SHARE: float = 0.70
AUCTION_PLATFORM_SHARE: float = 0.30
DEFAULT_AUCTION_WINDOW_HOURS: int = 24


# ──────────────────────────────────────────────────────────────────────────
# 1. AUCTION + BID MODELS
# ──────────────────────────────────────────────────────────────────────────
AuctionStatus = Literal["live", "settled", "voided"]


@dataclass
class SealedBid:
    bid_id: str
    bidder_id: str
    amount: float
    placed_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class BeatAuction:
    auction_id: str
    beat_id: str
    producer_id: str
    reserve_price: float
    opens_at: str
    closes_at: str
    bids: List[SealedBid] = field(default_factory=list)
    status: AuctionStatus = "live"
    winning_bid_id: Optional[str] = None

    def is_open(self, now: Optional[datetime] = None) -> bool:
        now = now or datetime.now(timezone.utc)
        opens = datetime.fromisoformat(self.opens_at)
        closes = datetime.fromisoformat(self.closes_at)
        return self.status == "live" and opens <= now < closes

    def has_bidder(self, bidder_id: str) -> bool:
        return any(b.bidder_id == bidder_id for b in self.bids)


# ──────────────────────────────────────────────────────────────────────────
# 2. CREATE / BID / SETTLE
# ──────────────────────────────────────────────────────────────────────────
def open_auction(
    beat_id: str, producer_id: str, reserve_price: float,
    window_hours: int = DEFAULT_AUCTION_WINDOW_HOURS,
) -> BeatAuction:
    if reserve_price <= 0:
        raise ValueError("reserve_price must be positive")
    if window_hours < 1 or window_hours > 168:
        raise ValueError("window_hours must be 1..168")
    now = datetime.now(timezone.utc)
    return BeatAuction(
        auction_id=str(uuid.uuid4()),
        beat_id=beat_id, producer_id=producer_id,
        reserve_price=reserve_price,
        opens_at=now.isoformat(),
        closes_at=(now + timedelta(hours=window_hours)).isoformat(),
    )


def submit_sealed_bid(
    auction: BeatAuction, bidder_id: str, amount: float,
) -> SealedBid:
    if not auction.is_open():
        raise ValueError("auction is not open")
    if bidder_id == auction.producer_id:
        raise ValueError("producer cannot bid on their own beat")
    if amount <= 0:
        raise ValueError("bid amount must be positive")
    # Allow multiple bids per bidder (escalation), but the highest one counts.
    bid = SealedBid(bid_id=str(uuid.uuid4()), bidder_id=bidder_id, amount=amount)
    auction.bids.append(bid)
    return bid


def settle_auction(auction: BeatAuction) -> Dict:
    """Close the auction and return settlement payload.
    No bids OR all bids under reserve → voided (status='voided').
    Otherwise the highest bid wins and the 70/30 split + Sovereign Tax fire.
    """
    if auction.status != "live":
        raise ValueError(f"auction is already {auction.status}")
    qualifying = [b for b in auction.bids if b.amount >= auction.reserve_price]
    if not qualifying:
        auction.status = "voided"
        return {
            "auction_id": auction.auction_id,
            "status": "voided",
            "reason": "no_qualifying_bids",
            "fallback_action": "return_to_beat_vault",
            "bid_count": len(auction.bids),
        }

    # Highest amount wins; on ties the earliest bid wins.
    qualifying.sort(key=lambda b: (-b.amount, b.placed_at))
    winning = qualifying[0]
    auction.winning_bid_id = winning.bid_id
    auction.status = "settled"

    gross = winning.amount
    producer_payout = round(gross * AUCTION_PRODUCER_SHARE, 4)
    platform_share = round(gross * AUCTION_PLATFORM_SHARE, 4)
    sovereign_tax = round(gross * SOVEREIGN_TAX_RATE, 4)
    net_to_treasury = round(platform_share - sovereign_tax, 4)

    return {
        "auction_id": auction.auction_id,
        "status": "settled",
        "winning_bid_id": winning.bid_id,
        "winner_id": winning.bidder_id,
        "winning_amount": gross,
        "producer_id": auction.producer_id,
        "producer_payout": producer_payout,
        "platform_share": platform_share,
        "sovereign_tax": sovereign_tax,
        "net_to_treasury": net_to_treasury,
        "qualifying_bid_count": len(qualifying),
        "total_bid_count": len(auction.bids),
    }


# ──────────────────────────────────────────────────────────────────────────
# 3. PUBLIC LISTING (only safe info — never expose individual bid amounts)
# ──────────────────────────────────────────────────────────────────────────
def public_view(auction: BeatAuction) -> Dict:
    """A bidder-safe view: NEVER reveals individual bids, only counts and
    the reserve floor. Sealed-bid integrity demands secrecy until settle."""
    return {
        "auction_id": auction.auction_id,
        "beat_id": auction.beat_id,
        "producer_id": auction.producer_id,
        "reserve_price": auction.reserve_price,
        "opens_at": auction.opens_at,
        "closes_at": auction.closes_at,
        "status": auction.status,
        "bid_count": len(auction.bids),
        "is_open": auction.is_open(),
    }


__all__ = [
    "AUCTION_PRODUCER_SHARE", "AUCTION_PLATFORM_SHARE",
    "DEFAULT_AUCTION_WINDOW_HOURS",
    "SealedBid", "BeatAuction",
    "open_auction", "submit_sealed_bid", "settle_auction",
    "public_view",
]
