from pydantic import BaseModel, Field, ConfigDict
from typing import Dict
from datetime import datetime, timezone
import uuid


class PaymentPackage(BaseModel):
    package_id: str
    origin_url: str


class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    transaction_id: str = Field(default_factory=lambda: f"txn_{uuid.uuid4().hex[:12]}")
    user_id: str
    session_id: str
    amount: float
    currency: str
    payment_status: str  # "pending", "paid", "failed", "expired"
    metadata: Dict[str, str]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
