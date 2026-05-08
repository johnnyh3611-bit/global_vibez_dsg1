from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone


class Vehicle(BaseModel):
    make: str
    model: str
    year: int
    color: str
    plate_number: str
    vehicle_type: str = "sedan"  # sedan, suv, van


class DriverDocuments(BaseModel):
    license_url: Optional[str] = None
    insurance_url: Optional[str] = None
    registration_url: Optional[str] = None
    background_check_status: str = "pending"  # pending, approved, rejected


class Driver(BaseModel):
    driver_id: str
    user_id: str  # Links to User model
    vehicle: Optional[Vehicle] = None
    documents: DriverDocuments = Field(default_factory=DriverDocuments)
    status: str = "pending"  # pending, approved, active, inactive, suspended
    rating: float = 5.0
    total_ratings: int = 0
    total_rides: int = 0
    total_earnings: float = 0.0
    available: bool = False  # Currently accepting rides
    current_location: Optional[dict] = None  # {"lat": float, "lng": float}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None
