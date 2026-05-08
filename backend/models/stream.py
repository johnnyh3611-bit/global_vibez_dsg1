from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone


class Stream(BaseModel):
    """Live streaming session"""
    stream_id: str
    streamer_user_id: str
    streamer_name: str
    title: str
    description: Optional[str] = None
    category: str  # "gaming", "dating", "social", "tournaments"
    status: str = "live"  # "live", "ended", "offline"
    viewer_count: int = 0
    total_gifts_received: int = 0
    total_earnings: float = 0.0
    thumbnail_url: Optional[str] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StreamGift(BaseModel):
    """Gift sent to streamer during live stream"""
    gift_id: str
    stream_id: str
    viewer_user_id: str
    viewer_name: str
    streamer_user_id: str
    streamer_name: str
    gift_type: str  # "LAVA_BOARD", "CHAMPAGNE_POP", etc.
    gift_name: str
    credit_amount: int  # Total credits spent
    streamer_cut: float  # 70% to streamer
    platform_cut: float  # 30% to platform
    visual_effect: str  # "ray_traced_aura_gold", "lava_floor", etc.
    message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PlatformLedger(BaseModel):
    """Platform earnings ledger"""
    ledger_id: str
    amount: float
    source: str  # "stream_gift", "subscription", "tournament_rake", "hub_rental"
    from_user_id: str
    stream_id: Optional[str] = None
    description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StreamViewer(BaseModel):
    """Current viewer in stream"""
    user_id: str
    username: str
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
