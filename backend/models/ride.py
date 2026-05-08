from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone


class Location(BaseModel):
    address: str
    latitude: float
    longitude: float


class RideRating(BaseModel):
    rating: int  # 1-5
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Ride(BaseModel):
    ride_id: str
    rider_id: str  # user_id requesting ride
    driver_id: Optional[str] = None
    pickup_location: Location
    dropoff_location: Location
    distance_miles: float
    estimated_duration_minutes: int
    credit_cost: float
    driver_earning: float  # 40% of credit cost
    platform_fee: float  # 60% of credit cost
    tip_amount: float = 0.0
    status: str = "requested"  # requested, accepted, arriving, in_progress, completed, cancelled
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    accepted_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    rider_rating: Optional[RideRating] = None
    driver_rating: Optional[RideRating] = None
    trusted_contact_id: Optional[str] = None  # If rider has trusted contact
    trusted_contact_notified: bool = False
