from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone


class ModerationAction(BaseModel):
    """Record of moderation action taken"""
    action_id: str
    user_id: str  # User being moderated
    moderator_id: Optional[str] = None  # "system" for auto-actions
    action_type: str  # "shadow_ban", "hardware_ban", "currency_freeze", "warning"
    reason: str  # "harassment", "minor_on_platform", "cheating_gaming", "spam"
    description: str
    severity: str  # "low", "medium", "high", "critical"
    duration_hours: Optional[int] = None  # For temporary bans
    expires_at: Optional[datetime] = None
    evidence: List[str] = []  # URLs, message IDs, etc.
    status: str = "active"  # "active", "expired", "overturned"
    review_time: str  # "instant", "<2h", "<24h"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_at: Optional[datetime] = None


class UserReport(BaseModel):
    """User-submitted report"""
    report_id: str
    reporter_user_id: str
    reported_user_id: str
    report_type: str  # "harassment", "inappropriate_content", "cheating", "minor", "spam"
    description: str
    context: str  # "dating_chat", "game_match", "stream_comment", "profile"
    evidence_urls: List[str] = []
    status: str = "pending"  # "pending", "under_review", "action_taken", "dismissed"
    assigned_to: Optional[str] = None  # Moderator ID
    resolution: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None


class BlockedUser(BaseModel):
    """Global block record (cross-platform)"""
    block_id: str
    blocker_user_id: str
    blocked_user_id: str
    reason: Optional[str] = None
    contexts: List[str] = ["dating", "gaming", "streaming"]  # Syncs across all
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MutedUser(BaseModel):
    """Proximity-based mute (3D avatar distance)"""
    mute_id: str
    muter_user_id: str
    muted_user_id: str
    proximity_distance: int = 15  # meters in 3D space
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
