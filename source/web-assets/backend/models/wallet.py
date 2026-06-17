from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone


class Transaction(BaseModel):
    transaction_id: str
    user_id: str
    type: str  # "purchase", "gift_sent", "gift_received", "ride_payment", "driver_earning", "refund"
    amount: float  # Credit amount
    currency_amount: Optional[float] = None  # USD amount for purchases
    description: str
    reference_id: Optional[str] = None  # ride_id, gift_card_id, etc.
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Wallet(BaseModel):
    user_id: str
    credit_balance: float = 0.0
    total_spent: float = 0.0
    total_earned: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
