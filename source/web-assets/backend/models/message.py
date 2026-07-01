from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid
from .user import User


class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    match_id: str
    sender_id: str
    receiver_id: str
    content: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MessageCreate(BaseModel):
    receiver_id: str
    content: str


class Conversation(BaseModel):
    match_id: str
    other_user: User
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    unread_count: int = 0
