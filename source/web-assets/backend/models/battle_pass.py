from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone


class BattlePassReward(BaseModel):
    """Individual reward in the Battle Pass system"""
    reward_id: str
    level: int
    tier: str  # "free" or "premium"
    type: str  # "coins", "cosmetic", "xp_boost", "profile_frame", "badge"
    name: str
    description: str
    value: int  # For coins, or cosmetic_id for cosmetics
    image_url: Optional[str] = None
    claimed: bool = False


class BattlePassSeason(BaseModel):
    """Battle Pass season configuration"""
    season_id: str  # "2026-Q2"
    name: str  # "Neon Dreams Season"
    start_date: datetime
    end_date: datetime
    price_usd: float = 20.00
    max_level: int = 100
    free_rewards: List[BattlePassReward] = []
    premium_rewards: List[BattlePassReward] = []
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BattlePassProgress(BaseModel):
    """User's Battle Pass progression"""
    user_id: str
    season_id: str
    tier: str  # "free" or "premium"
    current_xp: int = 0
    current_level: int = 1
    claimed_rewards: List[str] = []  # List of reward_ids
    purchased_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
