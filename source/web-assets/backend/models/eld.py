from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import datetime, timezone


class GeoPoint(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None


class ELDTripStop(BaseModel):
    name: str
    location: GeoPoint
    scheduled_at: Optional[str] = None
    arrived_at: Optional[str] = None


class ELDTrip(BaseModel):
    trip_id: str
    driver_id: str
    vehicle_id: Optional[str] = None
    shipper_id: Optional[str] = None
    customer_id: Optional[str] = None
    load_number: Optional[str] = None
    origin: ELDTripStop
    destination: ELDTripStop
    cargo_description: Optional[str] = None
    status: Literal["planned", "active", "completed", "cancelled"] = "planned"
    share_token: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class ELDLog(BaseModel):
    log_id: str
    driver_id: str
    trip_id: Optional[str] = None
    event_type: Literal[
        "status_change",
        "location_ping",
        "engine_powerup",
        "engine_shutdown",
        "intermediate",
        "trip_start",
        "trip_end",
        "certification",
    ] = "status_change"
    status: Literal[
        "OFF_DUTY",
        "SLEEPER_BERTH",
        "DRIVING",
        "ON_DUTY_NOT_DRIVING",
        "PERSONAL_USE",
        "YARD_MOVE",
    ] = "OFF_DUTY"
    location: Optional[GeoPoint] = None
    vehicle_miles: Optional[float] = None
    engine_hours: Optional[float] = None
    annotation: Optional[str] = None
    previous_hash: Optional[str] = None
    log_hash: Optional[str] = None
    signature: Optional[str] = None
    certified: bool = False
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @field_validator("vehicle_miles", "engine_hours", mode="before")
    @classmethod
    def round_floats(cls, v):
        return round(v, 2) if v is not None else v
