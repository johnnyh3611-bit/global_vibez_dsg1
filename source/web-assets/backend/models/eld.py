from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, List
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
    status: Literal["planned", "assigned", "active", "completed", "cancelled"] = "planned"
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
        "amendment",
        "auto_motion",
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
    speed_mph: Optional[float] = None
    annotation: Optional[str] = None
    # Tamper-proof amendment trail — originals are never overwritten.
    original_log_id: Optional[str] = None
    amendment_reason: Optional[str] = None
    previous_hash: Optional[str] = None
    log_hash: Optional[str] = None
    signature: Optional[str] = None
    certified: bool = False
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    @field_validator("vehicle_miles", "engine_hours", "speed_mph", mode="before")
    @classmethod
    def round_floats(cls, v):
        return round(v, 2) if v is not None else v


class ELDHosState(BaseModel):
    """Real-time HOS counters document (eld_hos_state collection)."""

    driver_id: str
    current_status: str = "OFF_DUTY"
    status_start_time: Optional[str] = None
    cycle: Literal["70_8", "60_7"] = "70_8"
    driving_time_today_minutes: float = 0
    on_duty_window_minutes: float = 0
    time_since_last_break_minutes: float = 0
    rolling_8_day_duty_minutes: float = 0
    driving_minutes_remaining: float = 11 * 60
    duty_window_minutes_remaining: float = 14 * 60
    cycle_70hr_minutes_remaining: float = 70 * 60
    requires_break: bool = False
    in_violation: bool = False
    violations: List[str] = Field(default_factory=list)
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class HOSStatusResponse(BaseModel):
    driver_id: str
    driving_minutes_remaining: float
    duty_window_minutes_remaining: float
    cycle_70hr_minutes_remaining: float
    requires_break: bool
    status: Optional[str] = None
    in_violation: bool = False
    violations: List[str] = Field(default_factory=list)
