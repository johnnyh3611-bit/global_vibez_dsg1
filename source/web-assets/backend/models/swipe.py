from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timezone
import uuid


class Swipe(BaseModel):
    model_config = ConfigDict(extra="ignore")

    swipe_id: str = Field(default_factory=lambda: f"swipe_{uuid.uuid4().hex[:12]}")
    user_id: str
    target_user_id: str
    action: str  # "like" or "dislike"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SwipeAction(BaseModel):
    target_user_id: str
    action: str  # "like" or "dislike"
