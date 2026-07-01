from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone


class UserPreferences(BaseModel):
    min_age: int = 18
    max_age: int = 99
    max_distance: int = 50  # in miles/km
    interested_in: str = "everyone"  # "men", "women", "everyone"


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_id: str
    email: str
    name: str
    password_hash: Optional[str] = None  # For email/password auth (bcrypt hash)
    auth_provider: str = "google"  # "google" or "email"
    picture: Optional[str] = None
    bio: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    interests: List[str] = []
    photos: List[str] = []
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    membership_type: str = "free"  # "free" or "premium"
    profile_completed: bool = False
    referral_code: Optional[str] = None  # User's unique referral code
    referred_by: Optional[str] = None  # Who referred this user
    referral_count: int = 0  # How many people they referred
    premium_expires_at: Optional[datetime] = None  # When premium expires (for referral rewards)
    relationship_intent: Optional[str] = None  # What they're looking for
    interest_categories: List[str] = []  # Interest-based categories
    
    # Trusted Contact for Safety
    trusted_contact_name: Optional[str] = None
    trusted_contact_phone: Optional[str] = None
    trusted_contact_email: Optional[str] = None
    
    # Saved addresses for rides
    home_address: Optional[str] = None
    home_lat: Optional[float] = None
    home_lng: Optional[float] = None
    
    # Profile videos describing what they're looking for
    looking_for_video_friends: Optional[str] = None  # Video URL for friend preferences
    looking_for_video_dating: Optional[str] = None  # Video URL for dating/relationship preferences
    
    # Subscription & Credits
    subscription_tier: str = "free"  # free, plus, premium
    subscription_end_date: Optional[str] = None  # ISO format
    credits_balance: int = 50  # Start with 50 free credits
    last_credit_grant: Optional[str] = None  # Last monthly credit grant date
    
    # Swipe limits for free tier
    swipes_today: int = 0  # Count of swipes today
    swipes_limit: int = 20  # Daily swipe limit
    last_swipe_reset: Optional[str] = None  # Last daily reset date
    
    # Age Verification
    age_verified: bool = False  # Whether user has been age verified
    verification_status: Optional[str] = "unverified"  # unverified, pending, approved, denied
    date_of_birth: Optional[str] = None  # Extracted from verification document
    
    # Driver License Verification (for Vibes Rides)
    is_driver_verified: bool = False  # Whether user has verified driver's license
    driver_license_status: Optional[str] = "unverified"  # unverified, pending, approved, denied
    driver_license_number: Optional[str] = None  # License number (last 4 digits only for privacy)
    license_expiry_date: Optional[str] = None  # License expiration date
    driver_license_state: Optional[str] = None  # State/province of license issuance
    
    # Vehicle Insurance Verification (for Vibes Rides)
    has_insurance: bool = False
    insurance_verification_status: str = "unverified"  # unverified, pending, approved, denied
    insurance_document_url: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    insurance_expiry_date: Optional[str] = None
    insurance_verified_at: Optional[datetime] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_color: Optional[str] = None
    license_plate: Optional[str] = None
    
    # ========== MONETIZATION FIELDS ==========
    
    # B2P Entry Fee (48h trial → $50 paywall)
    trial_started_at: Optional[datetime] = None
    trial_expires_at: Optional[datetime] = None
    entry_fee_paid: bool = False
    entry_fee_amount: Optional[float] = None
    entry_fee_paid_at: Optional[datetime] = None
    access_tier: str = "trial"  # trial, locked, paid, elite
    
    # Battle Pass (Quarterly $20)
    battle_pass_season: Optional[str] = None  # "2026-Q2"
    battle_pass_tier: str = "free"  # free, premium
    battle_pass_xp: int = 0
    battle_pass_level: int = 1
    battle_pass_purchased_at: Optional[datetime] = None
    battle_pass_unlocked_rewards: List[str] = []
    
    # Elite Subscription ($15-25/month)
    elite_subscription_active: bool = False
    elite_subscription_tier: Optional[str] = None  # "elite_monthly", "elite_annual"
    elite_subscription_expires: Optional[datetime] = None
    elite_features: List[str] = []  # ["ghost_mode", "4k_streaming", "priority_matchmaking", "ai_date_coach"]
    
    # Cosmetics (Avatar customization)
    owned_cosmetics: List[str] = []
    equipped_cosmetics: Dict[str, str] = {}  # {"profile_frame": "neon_cyber", "badge": "elite_2026"}
    
    # Guest Pass System
    guest_passes_available: int = 0
    guest_passes_sent: List[str] = []  # List of user_ids who received passes
    
    # Streaming & Creator Economy
    is_streaming: bool = False
    current_stream_id: Optional[str] = None
    streamer_earnings: float = 0.0  # Total earnings from gifts/tips
    vibe_credits: int = 500  # Credits for sending gifts (default 500)
    total_gifts_sent: int = 0
    total_gifts_received: int = 0
    stream_stats: Dict[str, int] = {}  # {"total_streams": 0, "total_duration": 0}
    
    # Moderation & Safety
    is_shadow_banned: bool = False
    shadow_ban_until: Optional[datetime] = None
    is_hardware_banned: bool = False
    hardware_id: Optional[str] = None
    currency_frozen: bool = False
    currency_frozen_until: Optional[datetime] = None
    blocked_users: List[str] = []  # User IDs blocked globally
    muted_users: List[str] = []  # User IDs muted (proximity-based)
    moderation_flags: int = 0  # Number of times flagged
    warning_count: int = 0
    
    # Rewarded Ads
    last_ad_watched: Optional[datetime] = None
    total_ads_watched: int = 0
    total_ad_credits_earned: int = 0
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    interests: Optional[List[str]] = None
    photos: Optional[List[str]] = None
    preferences: Optional[UserPreferences] = None
    relationship_intent: Optional[str] = None
    interest_categories: Optional[List[str]] = None
    trusted_contact_name: Optional[str] = None
    trusted_contact_phone: Optional[str] = None
    trusted_contact_email: Optional[str] = None
    home_address: Optional[str] = None
    home_lat: Optional[float] = None
    home_lng: Optional[float] = None
    looking_for_video_friends: Optional[str] = None
    looking_for_video_dating: Optional[str] = None
    subscription_tier: Optional[str] = None
    credits_balance: Optional[int] = None


class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
