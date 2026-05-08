from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone


class GiftCard(BaseModel):
    gift_card_id: str
    code: str  # Unique redemption code
    created_by: str  # user_id of sender
    recipient_email: Optional[str] = None  # If sent via email
    recipient_user_id: Optional[str] = None  # If sent directly to user
    credit_amount: float
    message: Optional[str] = None
    status: str = "active"  # "active", "redeemed", "expired"
    redeemed_by: Optional[str] = None
    redeemed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
