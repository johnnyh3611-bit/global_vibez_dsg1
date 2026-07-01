from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone


class Cosmetic(BaseModel):
    """Cosmetic item (profile frames, badges, card backs, emotes)"""
    cosmetic_id: str
    name: str
    type: str  # "profile_frame", "badge", "card_back", "emote", "avatar_skin"
    rarity: str  # "common", "rare", "epic", "legendary", "mythic"
    description: str
    price_coins: Optional[int] = None  # None if Battle Pass exclusive
    battle_pass_season: Optional[str] = None  # Which season unlocks it
    battle_pass_level: Optional[int] = None  # Which level unlocks it
    battle_pass_tier: Optional[str] = None  # "free" or "premium"
    image_url: str
    preview_url: Optional[str] = None
    available: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CosmeticPurchase(BaseModel):
    """Record of cosmetic purchase"""
    purchase_id: str
    user_id: str
    cosmetic_id: str
    price_paid: int  # Coins spent
    method: str  # "coins", "battle_pass"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
