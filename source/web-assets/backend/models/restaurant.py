from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone

class MenuItem(BaseModel):
    item_id: str
    name: str
    description: Optional[str] = None
    price: float
    category: str  # appetizer, main, dessert, drinks, etc.
    dietary_tags: List[str] = []  # vegetarian, vegan, gluten-free, etc.
    photo_url: Optional[str] = None

class Restaurant(BaseModel):
    restaurant_id: str
    name: str
    description: Optional[str] = None
    address: str
    city: str
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: str = "USA"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Contact Info
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    reservation_link: Optional[str] = None
    
    # Details
    cuisine_type: List[str] = []  # Italian, Japanese, Mexican, etc.
    ambiance: List[str] = []  # romantic, casual, family-friendly, upscale, etc.
    price_range: Literal["$", "$$", "$$$", "$$$$"] = "$$"
    average_meal_cost: Optional[float] = None  # Average cost per person
    
    # Media
    photos: List[str] = []  # List of photo URLs
    cover_photo: Optional[str] = None
    
    # Menu
    menu_items: List[MenuItem] = []
    
    # Special Features
    special_offers: Optional[str] = None  # "20% off for couples", "Free dessert", etc.
    features: List[str] = []  # "outdoor seating", "live music", "private dining", etc.
    
    # Hours
    hours_of_operation: Optional[str] = None  # Can be JSON string or text
    
    # Listing Management
    submitted_by: str  # user_id of submitter
    submitter_type: Literal["business", "user"] = "user"  # Business owner or regular user
    listing_status: Literal["pending", "approved", "rejected", "suspended"] = "pending"
    
    # Monthly Subscription (replaces one-time fee)
    subscription_active: bool = False  # Whether monthly subscription is active
    monthly_subscription_fee: float = 49.99  # Monthly fee for priority placement
    subscription_started_at: Optional[str] = None
    subscription_expires_at: Optional[str] = None  # Next billing date
    subscription_id: Optional[str] = None  # Stripe subscription ID
    
    # Promotion (included with subscription)
    is_promoted: bool = False  # Automatically true for paid subscribers in their zone
    
    # Admin
    approved_by: Optional[str] = None  # Admin user_id
    approved_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    
    # Stats
    average_rating: float = 0.0
    review_count: int = 0
    view_count: int = 0
    date_plan_count: int = 0  # How many times used in AI date plans
    
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class RestaurantSubmission(BaseModel):
    name: str
    description: Optional[str] = None
    address: str
    city: str
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    reservation_link: Optional[str] = None
    cuisine_type: List[str] = []
    ambiance: List[str] = []
    price_range: Literal["$", "$$", "$$$", "$$$$"] = "$$"
    average_meal_cost: Optional[float] = None
    photos: List[str] = []
    cover_photo: Optional[str] = None
    special_offers: Optional[str] = None
    features: List[str] = []
    hours_of_operation: Optional[str] = None
    submitter_type: Literal["business", "user"] = "user"

class MenuItemSubmission(BaseModel):
    restaurant_id: str
    name: str
    description: Optional[str] = None
    price: float
    category: str
    dietary_tags: List[str] = []
    photo_url: Optional[str] = None

class RestaurantReview(BaseModel):
    review_id: str
    restaurant_id: str
    user_id: str
    rating: int  # 1-5 stars
    review_text: Optional[str] = None
    photos: List[str] = []
    tags: List[str] = []  # romantic, loud, expensive, great_service, etc.
    date_visited: str  # ISO date string
    verified_visit: bool = False  # True if visited via AI date planner
    helpful_count: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ReviewSubmission(BaseModel):
    restaurant_id: str
    rating: int  # 1-5 stars
    review_text: Optional[str] = None
    photos: List[str] = []
    tags: List[str] = []
    date_visited: str

class RestaurantApproval(BaseModel):
    restaurant_id: str
    status: Literal["approved", "rejected"]
    rejection_reason: Optional[str] = None
