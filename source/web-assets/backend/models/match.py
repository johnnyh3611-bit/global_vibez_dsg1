from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from .user import User


class Match(BaseModel):
    model_config = ConfigDict(extra="ignore")

    match_id: str = Field(default_factory=lambda: f"match_{uuid.uuid4().hex[:12]}")
    user_id_1: str
    user_id_2: str
    both_ids: List[str]  # For easy querying
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MatchResponse(BaseModel):
    is_match: bool
    match_id: Optional[str] = None
    matched_user: Optional[User] = None
