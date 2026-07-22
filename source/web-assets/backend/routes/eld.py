import hashlib
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from models.eld import ELDLog, ELDTrip, GeoPoint, ELDTripStop, HOSStatusResponse
from services.eld_hos import (
    CycleType,
    calculate_hos_from_logs,
    resolve_motion_status,
    SPEED_DRIVING_MPH,
)
from utils.database import get_current_user, get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/eld", tags=["eld"])

# In production, set a strong secret and rotate only with a re-sign migration.
# Weak/default values are flagged at startup via services.security_secrets.
_ELD_KEY_RAW = (os.environ.get("ELD_SIGNING_KEY") or "").strip()
if not _ELD_KEY_RAW:
    _ELD_KEY_RAW = "dev-eld-signing-key-change-in-production"
    logger.warning(
        "ELD_SIGNING_KEY unset — using insecure development default. "
        "Set a strong secret before production (openssl rand -hex 32)."
    )
elif (
    _ELD_KEY_RAW
    in {
        "dev-eld-signing-key-change-in-production",
        "change-me-eld-signing-key-production",
        "changeme",
        "eld-signing-key",
    }
    or len(_ELD_KEY_RAW) < 24
):
    logger.warning(
        "ELD_SIGNING_KEY looks weak/default — replace before production."
    )
ELD_SIGNING_KEY = _ELD_KEY_RAW.encode()

DUTY_STATUSES = [
    "OFF_DUTY",
    "SLEEPER_BERTH",
    "DRIVING",
    "ON_DUTY_NOT_DRIVING",
    "PERSONAL_USE",
    "YARD_MOVE",
]
ON_DUTY_STATUSES = {"DRIVING", "ON_DUTY_NOT_DRIVING", "YARD_MOVE"}
REST_STATUSES = {"OFF_DUTY", "SLEEPER_BERTH"}


# ───────────────────────────────
# Helpers: tamper-evident hash chain
# ───────────────────────────────


def _canonical_json(payload: Dict[str, Any]) -> str:
    """Deterministic JSON used for hashing."""
    return json.dumps(
        payload,
        sort_keys=True,
        ensure_ascii=True,
        separators=(",", ":"),
        default=str,
    )


def _hash_fields(log: Dict[str, Any]) -> Dict[str, Any]:
    """Return a dict of the fields that participate in the log hash."""
    keys = [
        "log_id",
        "driver_id",
        "trip_id",
        "event_type",
        "status",
        "location",
        "vehicle_miles",
        "engine_hours",
        "speed_mph",
        "annotation",
        "original_log_id",
        "amendment_reason",
        "previous_hash",
        "certified",
        "created_at",
    ]
    return {k: log.get(k) for k in keys if log.get(k) is not None}


def _compute_log_hash(log: Dict[str, Any]) -> str:
    payload = _hash_fields(log)
    return hashlib.sha256(_canonical_json(payload).encode()).hexdigest()


def _sign_hash(log_hash: str) -> str:
    return hmac.new(
        ELD_SIGNING_KEY, log_hash.encode(), hashlib.sha256
    ).hexdigest()


def _seal_log(log: Dict[str, Any]) -> Dict[str, Any]:
    log = dict(log)
    log["log_hash"] = _compute_log_hash(log)
    log["signature"] = _sign_hash(log["log_hash"])
    return log


async def _last_driver_log(db, driver_id: str) -> Optional[Dict[str, Any]]:
    return await db.eld_logs.find_one(
        {"driver_id": driver_id},
        {"_id": 0},
        sort=[("created_at", -1)],
    )


async def _verify_driver_hash_chain(db, driver_id: str) -> Dict[str, Any]:
    logs = (
        await db.eld_logs.find(
            {"driver_id": driver_id},
            {"_id": 0},
        )
        .sort("created_at", 1)
        .to_list(10000)
    )

    broken = []
    prev_hash = None
    for log in logs:
        expected_hash = _compute_log_hash(log)
        expected_signature = _sign_hash(expected_hash)
        link_ok = True
        if prev_hash is not None and log.get("previous_hash") != prev_hash:
            link_ok = False
        if (
            log.get("log_hash") != expected_hash
            or log.get("signature") != expected_signature
            or not link_ok
        ):
            broken.append(
                {
                    "log_id": log.get("log_id"),
                    "valid": False,
                    "hash_ok": log.get("log_hash") == expected_hash,
                    "signature_ok": log.get("signature") == expected_signature,
                    "chain_ok": link_ok,
                }
            )
        prev_hash = log.get("log_hash")

    return {
        "driver_id": driver_id,
        "log_count": len(logs),
        "broken_count": len(broken),
        "valid": len(broken) == 0,
        "broken_log_ids": broken,
    }


# ───────────────────────────────
# Helpers: HOS calculations
# ───────────────────────────────


def _to_dt(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


async def _load_hos_logs(db, driver_id: str, days: int = 8) -> list:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    return (
        await db.eld_logs.find(
            {
                "driver_id": driver_id,
                "created_at": {"$gte": since.isoformat()},
            },
            {"_id": 0},
        )
        .sort("created_at", 1)
        .to_list(10000)
    )


async def _upsert_hos_state(db, driver_id: str, hos: Dict[str, Any]) -> None:
    """Persist real-time counters to eld_hos_state (product schema)."""
    doc = {
        "driver_id": driver_id,
        "current_status": hos.get("status", "OFF_DUTY"),
        "status_start_time": hos.get("status_start_time"),
        "cycle": hos.get("cycle", "70_8"),
        "driving_time_today_minutes": hos.get("driving_time_today_minutes", 0),
        "on_duty_window_minutes": hos.get("on_duty_window_minutes", 0),
        "time_since_last_break_minutes": hos.get(
            "time_since_last_break_minutes", 0
        ),
        "rolling_8_day_duty_minutes": hos.get("rolling_8_day_duty_minutes", 0),
        "driving_minutes_remaining": hos.get("driving_minutes_remaining", 0),
        "duty_window_minutes_remaining": hos.get(
            "duty_window_minutes_remaining", 0
        ),
        "cycle_70hr_minutes_remaining": hos.get(
            "cycle_70hr_minutes_remaining", 0
        ),
        "requires_break": hos.get("requires_break", False),
        "in_violation": hos.get("in_violation", False),
        "violations": hos.get("violations", []),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.eld_hos_state.update_one(
        {"driver_id": driver_id},
        {"$set": doc},
        upsert=True,
    )


async def _calculate_hos(
    db,
    driver_id: str,
    now: Optional[datetime] = None,
    cycle: CycleType = "70_8",
) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    days = 7 if cycle == "60_7" else 8
    logs = await _load_hos_logs(db, driver_id, days=days)
    hos = calculate_hos_from_logs(
        logs, now=now, cycle=cycle, driver_id=driver_id
    )
    try:
        await _upsert_hos_state(db, driver_id, hos)
    except Exception:
        # Counters are best-effort — never fail the primary HOS read.
        pass
    return hos


async def _append_sealed_log(
    db,
    *,
    driver_id: str,
    status: str,
    event_type: str = "status_change",
    trip_id: Optional[str] = None,
    location: Optional[GeoPoint] = None,
    vehicle_miles: Optional[float] = None,
    engine_hours: Optional[float] = None,
    speed_mph: Optional[float] = None,
    annotation: Optional[str] = None,
    original_log_id: Optional[str] = None,
    amendment_reason: Optional[str] = None,
) -> Dict[str, Any]:
    previous = await _last_driver_log(db, driver_id)
    previous_hash = previous.get("log_hash") if previous else None
    log = ELDLog(
        log_id=f"eld_{uuid.uuid4().hex[:12]}",
        driver_id=driver_id,
        trip_id=trip_id,
        event_type=event_type,  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
        location=location,
        vehicle_miles=vehicle_miles,
        engine_hours=engine_hours,
        speed_mph=speed_mph,
        annotation=annotation,
        original_log_id=original_log_id,
        amendment_reason=amendment_reason,
        previous_hash=previous_hash,
    )
    sealed = _seal_log(log.model_dump())
    await db.eld_logs.insert_one(sealed)
    sealed.pop("_id", None)

    await db.drivers.update_one(
        {"driver_id": driver_id},
        {
            "$set": {
                "eld_status": status,
                "eld_last_log_at": sealed["created_at"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    return sealed


# ───────────────────────────────
# Pydantic request models
# ───────────────────────────────


class DutyStatusChange(BaseModel):
    status: str
    trip_id: Optional[str] = None
    location: Optional[GeoPoint] = None
    vehicle_miles: Optional[float] = None
    engine_hours: Optional[float] = None
    annotation: Optional[str] = None


class CreateTripRequest(BaseModel):
    driver_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    shipper_id: Optional[str] = None
    customer_id: Optional[str] = None
    load_number: Optional[str] = None
    origin: ELDTripStop
    destination: ELDTripStop
    cargo_description: Optional[str] = None


class LocationPingRequest(BaseModel):
    location: GeoPoint
    vehicle_miles: Optional[float] = None
    engine_hours: Optional[float] = None
    speed_mph: Optional[float] = None


class AmendLogRequest(BaseModel):
    status: str
    annotation: str
    amendment_reason: str
    location: Optional[GeoPoint] = None


class TransferRequest(BaseModel):
    method: str  # "email" | "web_service"
    recipient: str
    start: Optional[str] = None
    end: Optional[str] = None
    cycle: str = "70_8"
    comment: Optional[str] = None


class CertifyRequest(BaseModel):
    date_from: str
    date_to: str


# ───────────────────────────────
# Routes
# ───────────────────────────────


@router.post("/duty-status")
async def change_duty_status(
    change: DutyStatusChange, request: Request
) -> Dict[str, Any]:
    """Driver changes duty status. Writes a tamper-evident ELD log."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id}, {"_id": 0}
    )
    if not driver:
        raise HTTPException(
            status_code=403, detail="You must be a registered driver"
        )

    if change.status not in DUTY_STATUSES:
        raise HTTPException(
            status_code=400, detail=f"Invalid duty status: {change.status}"
        )

    sealed = await _append_sealed_log(
        db,
        driver_id=driver["driver_id"],
        status=change.status,
        event_type="status_change",
        trip_id=change.trip_id,
        location=change.location,
        vehicle_miles=change.vehicle_miles,
        engine_hours=change.engine_hours,
        annotation=change.annotation,
    )

    cycle = driver.get("eld_cycle", "70_8")
    if cycle not in ("70_8", "60_7"):
        cycle = "70_8"
    hos = await _calculate_hos(db, driver["driver_id"], cycle=cycle)
    return {"log": sealed, "hos": hos}


@router.get("/logs")
async def get_driver_logs(
    request: Request,
    driver_id: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """Retrieve ELD logs. Drivers see their own; admins can pass driver_id."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from utils.admin_guard import is_admin

    is_user_admin = is_admin(current_user)

    db = get_database()
    target_driver_id = driver_id
    if target_driver_id and not is_user_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can query another driver's logs",
        )

    if not target_driver_id:
        driver = await db.drivers.find_one(
            {"user_id": current_user.user_id}, {"_id": 0, "driver_id": 1}
        )
        if not driver:
            raise HTTPException(
                status_code=403, detail="You are not a registered driver"
            )
        target_driver_id = driver["driver_id"]

    query: Dict[str, Any] = {"driver_id": target_driver_id}
    if start or end:
        query["created_at"] = {}
        if start:
            query["created_at"]["$gte"] = start
        if end:
            query["created_at"]["$lte"] = end

    logs = (
        await db.eld_logs.find(query, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(limit)
    )
    return {"driver_id": target_driver_id, "count": len(logs), "logs": logs}


@router.get("/hos")
async def get_hos_status(request: Request) -> Dict[str, Any]:
    """Get current Hours-of-Service status for the authenticated driver."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id}, {"_id": 0, "driver_id": 1, "eld_cycle": 1}
    )
    if not driver:
        raise HTTPException(
            status_code=403, detail="You must be a registered driver"
        )

    cycle = driver.get("eld_cycle", "70_8")
    if cycle not in ("70_8", "60_7"):
        cycle = "70_8"
    return await _calculate_hos(db, driver["driver_id"], cycle=cycle)


@router.get("/hos/{driver_id}", response_model=HOSStatusResponse)
async def get_driver_hos(driver_id: str, request: Request) -> HOSStatusResponse:
    """
    HOS snapshot for a driver id.

    Drivers may only request their own id. Admins may query any driver.
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from utils.admin_guard import is_admin

    db = get_database()
    if not is_admin(current_user):
        me = await db.drivers.find_one(
            {"user_id": current_user.user_id}, {"_id": 0, "driver_id": 1}
        )
        if not me or me.get("driver_id") != driver_id:
            raise HTTPException(
                status_code=403, detail="Cannot view another driver's HOS"
            )

    driver = await db.drivers.find_one({"driver_id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    cycle = driver.get("eld_cycle", "70_8")
    if cycle not in ("70_8", "60_7"):
        cycle = "70_8"
    hos = await _calculate_hos(db, driver_id, cycle=cycle)
    return HOSStatusResponse(
        driver_id=driver_id,
        driving_minutes_remaining=hos["driving_minutes_remaining"],
        duty_window_minutes_remaining=hos["duty_window_minutes_remaining"],
        cycle_70hr_minutes_remaining=hos["cycle_70hr_minutes_remaining"],
        requires_break=hos["requires_break"],
        status=hos.get("status"),
        in_violation=hos.get("in_violation", False),
        violations=hos.get("violations", []),
    )


@router.post("/trips")
async def create_trip(
    trip_req: CreateTripRequest, request: Request
) -> Dict[str, Any]:
    """Create a new ELD freight / delivery trip.

    - Drivers can create trips for themselves.
    - Shippers / customers can create unassigned loads.
    - Admins can create trips and optionally assign a driver_id.
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from utils.admin_guard import is_admin

    db = get_database()

    user_is_admin = is_admin(current_user)
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id}, {"_id": 0}
    )

    assigned_driver_id: Optional[str] = None
    if trip_req.driver_id:
        if not user_is_admin:
            raise HTTPException(
                status_code=403, detail="Only admins can pre-assign a driver"
            )
        assigned_driver_id = trip_req.driver_id
    elif driver:
        assigned_driver_id = driver["driver_id"]

    shipper_id = trip_req.shipper_id
    if not user_is_admin:
        shipper_id = shipper_id or current_user.user_id

    trip = ELDTrip(
        trip_id=f"trip_{uuid.uuid4().hex[:12]}",
        driver_id=assigned_driver_id,
        vehicle_id=trip_req.vehicle_id,
        shipper_id=shipper_id,
        customer_id=trip_req.customer_id,
        load_number=trip_req.load_number,
        origin=trip_req.origin,
        destination=trip_req.destination,
        cargo_description=trip_req.cargo_description,
        share_token=hashlib.sha256(uuid.uuid4().bytes).hexdigest()[:24],
    )

    await db.eld_trips.insert_one(trip.model_dump())
    return {"trip": trip.model_dump()}


@router.get("/trips")
async def list_trips(
    request: Request,
    status: Optional[str] = None,
    available: Optional[bool] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    """List trips visible to the current user.

    Drivers see their assigned trips plus available unassigned loads.
    Shippers / customers see loads they created.
    Admins see all trips.
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from utils.admin_guard import is_admin

    db = get_database()

    query: Dict[str, Any] = {}
    user_is_admin = is_admin(current_user)

    if not user_is_admin:
        driver = await db.drivers.find_one(
            {"user_id": current_user.user_id}, {"_id": 0, "driver_id": 1}
        )
        driver_id = driver["driver_id"] if driver else None

        if driver_id and available:
            query["driver_id"] = None
            query["status"] = "planned"
        elif driver_id:
            query["$or"] = [
                {"driver_id": driver_id},
                {"shipper_id": current_user.user_id},
                {"customer_id": current_user.user_id},
            ]
        else:
            query["$or"] = [
                {"shipper_id": current_user.user_id},
                {"customer_id": current_user.user_id},
            ]

    if status:
        query["status"] = status

    trips = (
        await db.eld_trips.find(query, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(limit)
    )
    return {"trips": trips, "count": len(trips)}


@router.get("/trips/{trip_id}")
async def get_trip(trip_id: str, request: Request) -> Dict[str, Any]:
    """Get trip details and latest location."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from utils.admin_guard import is_admin

    db = get_database()

    trip = await db.eld_trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    user_is_admin = is_admin(current_user)
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id}, {"_id": 0, "driver_id": 1}
    )
    driver_id = driver["driver_id"] if driver else None

    if not user_is_admin:
        can_view = (
            current_user.user_id == trip.get("shipper_id")
            or current_user.user_id == trip.get("customer_id")
            or driver_id == trip.get("driver_id")
            or (driver_id and trip.get("driver_id") is None)
        )
        if not can_view:
            raise HTTPException(status_code=403, detail="Access denied")

    latest_ping = await db.eld_logs.find_one(
        {"trip_id": trip_id, "event_type": "location_ping"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )

    hos = {}
    if trip.get("driver_id"):
        hos = await _calculate_hos(db, trip["driver_id"])

    return {"trip": trip, "latest_ping": latest_ping, "hos": hos}


@router.post("/trips/{trip_id}/assign")
async def assign_trip(trip_id: str, request: Request) -> Dict[str, Any]:
    """Driver claims an unassigned load."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id}, {"_id": 0}
    )
    if not driver:
        raise HTTPException(
            status_code=403, detail="You must be a registered driver"
        )

    trip = await db.eld_trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.get("driver_id") and trip["driver_id"] != driver["driver_id"]:
        raise HTTPException(
            status_code=403, detail="Load already assigned to another driver"
        )

    now = datetime.now(timezone.utc).isoformat()
    await db.eld_trips.update_one(
        {"trip_id": trip_id},
        {
            "$set": {
                "driver_id": driver["driver_id"],
                "status": "assigned",
                "updated_at": now,
            }
        },
    )

    trip["driver_id"] = driver["driver_id"]
    trip["status"] = "assigned"
    return {"message": "Load assigned", "trip": trip}


@router.post("/trips/{trip_id}/start")
async def start_trip(trip_id: str, request: Request) -> Dict[str, Any]:
    """Driver starts an assigned or unassigned load."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id}, {"_id": 0}
    )
    if not driver:
        raise HTTPException(
            status_code=403, detail="You must be a registered driver"
        )

    trip = await db.eld_trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if trip.get("driver_id") and trip["driver_id"] != driver["driver_id"]:
        raise HTTPException(
            status_code=403, detail="Load assigned to another driver"
        )

    now = datetime.now(timezone.utc).isoformat()
    update_fields: Dict[str, Any] = {
        "status": "active",
        "started_at": now,
        "updated_at": now,
    }
    if not trip.get("driver_id"):
        update_fields["driver_id"] = driver["driver_id"]

    await db.eld_trips.update_one(
        {"trip_id": trip_id}, {"$set": update_fields}
    )

    sealed = await _append_sealed_log(
        db,
        driver_id=driver["driver_id"],
        status="DRIVING",
        event_type="trip_start",
        trip_id=trip_id,
    )

    return {"message": "Trip started", "trip_id": trip_id, "log": sealed}


@router.post("/trips/{trip_id}/complete")
async def complete_trip(trip_id: str, request: Request) -> Dict[str, Any]:
    """Driver marks a trip as completed."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id}, {"_id": 0}
    )
    if not driver:
        raise HTTPException(
            status_code=403, detail="You must be a registered driver"
        )

    trip = await db.eld_trips.find_one(
        {"trip_id": trip_id, "driver_id": driver["driver_id"]}, {"_id": 0}
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    now = datetime.now(timezone.utc).isoformat()
    await db.eld_trips.update_one(
        {"trip_id": trip_id},
        {
            "$set": {
                "status": "completed",
                "completed_at": now,
                "updated_at": now,
            }
        },
    )

    sealed = await _append_sealed_log(
        db,
        driver_id=driver["driver_id"],
        status="OFF_DUTY",
        event_type="trip_end",
        trip_id=trip_id,
    )

    return {"message": "Trip completed", "trip_id": trip_id, "log": sealed}


@router.post("/trips/{trip_id}/location")
async def ping_trip_location(
    trip_id: str,
    ping: LocationPingRequest,
    request: Request,
) -> Dict[str, Any]:
    """Record a location ping for an active trip.

    Automatic motion detection (FMCSA ELD):
      • speed ≥ 5 mph → auto-switch to DRIVING if not already
      • speed < 5 mph after ≥5 minutes stopped → ON_DUTY_NOT_DRIVING
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id}, {"_id": 0}
    )
    if not driver:
        raise HTTPException(
            status_code=403, detail="You must be a registered driver"
        )

    trip = await db.eld_trips.find_one(
        {"trip_id": trip_id, "driver_id": driver["driver_id"]}, {"_id": 0}
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    now = datetime.now(timezone.utc)
    current_status = driver.get("eld_status") or "OFF_DUTY"
    auto_logs: list = []

    # Track last time the vehicle was moving (≥5 mph).
    if ping.speed_mph is not None and ping.speed_mph >= SPEED_DRIVING_MPH:
        await db.drivers.update_one(
            {"driver_id": driver["driver_id"]},
            {"$set": {"eld_last_moving_at": now.isoformat()}},
        )
        seconds_since_moving = 0.0
    else:
        last_moving = driver.get("eld_last_moving_at")
        if last_moving:
            seconds_since_moving = (
                now - _to_dt(last_moving)
            ).total_seconds()
        else:
            seconds_since_moving = None

    new_status = resolve_motion_status(
        current_status=current_status,
        speed_mph=ping.speed_mph,
        seconds_since_moving=seconds_since_moving,
    )
    if new_status and new_status != current_status:
        sealed_auto = await _append_sealed_log(
            db,
            driver_id=driver["driver_id"],
            status=new_status,
            event_type="auto_motion",
            trip_id=trip_id,
            location=ping.location,
            vehicle_miles=ping.vehicle_miles,
            engine_hours=ping.engine_hours,
            speed_mph=ping.speed_mph,
            annotation=(
                f"Auto status from speed={ping.speed_mph} mph "
                f"(threshold {SPEED_DRIVING_MPH} mph)"
            ),
        )
        auto_logs.append(sealed_auto)
        current_status = new_status

    sealed = await _append_sealed_log(
        db,
        driver_id=driver["driver_id"],
        status=current_status,
        event_type="location_ping",
        trip_id=trip_id,
        location=ping.location,
        vehicle_miles=ping.vehicle_miles,
        engine_hours=ping.engine_hours,
        speed_mph=ping.speed_mph,
    )

    hos = await _calculate_hos(db, driver["driver_id"])
    return {
        "message": "Location recorded",
        "log": sealed,
        "auto_status_logs": auto_logs,
        "hos": hos,
    }


@router.get("/trips/{trip_id}/track")
async def track_trip(
    trip_id: str, request: Request, token: Optional[str] = None
) -> Dict[str, Any]:
    """Customer / shipper view of a trip's latest location and HOS status.

    Authenticated stakeholders can view directly. A public share token can
    also be used.
    """
    current_user = await get_current_user(request)
    db = get_database()

    trip = await db.eld_trips.find_one({"trip_id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    allowed = False
    if token and token == trip.get("share_token"):
        allowed = True
    if current_user:
        from utils.admin_guard import is_admin

        if is_admin(current_user):
            allowed = True
        if current_user.user_id in {
            trip.get("shipper_id"),
            trip.get("customer_id"),
        }:
            allowed = True

    if not allowed:
        raise HTTPException(status_code=403, detail="Access denied")

    pings = (
        await db.eld_logs.find(
            {"trip_id": trip_id, "event_type": "location_ping"},
            {"_id": 0},
        )
        .sort("created_at", -1)
        .limit(100)
        .to_list(100)
    )

    hos = {}
    if trip.get("driver_id"):
        hos = await _calculate_hos(db, trip["driver_id"])

    return {
        "trip": trip,
        "location_history": list(reversed(pings)),
        "hos": hos,
    }


# ───────────────────────────────
# Certification / amendments / roadside transfer
# ───────────────────────────────


@router.post("/logs/certify")
async def certify_logs(
    body: CertifyRequest, request: Request
) -> Dict[str, Any]:
    """Driver certifies that logs for a date range are true and correct."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id}, {"_id": 0}
    )
    if not driver:
        raise HTTPException(
            status_code=403, detail="You must be a registered driver"
        )

    now = datetime.now(timezone.utc).isoformat()
    result = await db.eld_logs.update_many(
        {
            "driver_id": driver["driver_id"],
            "created_at": {"$gte": body.date_from, "$lte": body.date_to},
            "certified": {"$ne": True},
        },
        {"$set": {"certified": True, "certified_at": now}},
    )

    await _append_sealed_log(
        db,
        driver_id=driver["driver_id"],
        status=driver.get("eld_status") or "OFF_DUTY",
        event_type="certification",
        annotation=f"Certified logs {body.date_from} → {body.date_to}",
    )

    return {
        "status": "certified",
        "date_from": body.date_from,
        "date_to": body.date_to,
        "modified_count": result.modified_count,
    }


@router.post("/logs/{log_id}/amend")
async def amend_log(
    log_id: str, body: AmendLogRequest, request: Request
) -> Dict[str, Any]:
    """
    Amend a historical duty-status log without overwriting the original.

    FMCSA: edits retain an audit trail — original stays sealed; we append an
    amendment event that points at it, with a required reason.
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if body.status not in DUTY_STATUSES:
        raise HTTPException(
            status_code=400, detail=f"Invalid duty status: {body.status}"
        )
    reason = (body.amendment_reason or "").strip()
    if len(reason) < 3:
        raise HTTPException(
            status_code=400, detail="amendment_reason is required"
        )

    db = get_database()
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id}, {"_id": 0}
    )
    if not driver:
        raise HTTPException(
            status_code=403, detail="You must be a registered driver"
        )

    original = await db.eld_logs.find_one(
        {"log_id": log_id, "driver_id": driver["driver_id"]},
        {"_id": 0},
    )
    if not original:
        raise HTTPException(status_code=404, detail="Log entry not found")
    if original.get("event_type") == "amendment":
        raise HTTPException(
            status_code=400, detail="Cannot amend an amendment record"
        )
    if original.get("event_type") not in (
        "status_change",
        "auto_motion",
        None,
    ):
        raise HTTPException(
            status_code=400, detail="Only duty-status logs can be amended"
        )

    # Mark original as amended — do not rewrite sealed payload fields.
    await db.eld_logs.update_one(
        {"log_id": log_id},
        {
            "$set": {
                "amended": True,
                "amended_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    sealed = await _append_sealed_log(
        db,
        driver_id=driver["driver_id"],
        status=body.status,
        event_type="amendment",
        trip_id=original.get("trip_id"),
        location=body.location or (
            GeoPoint(**original["location"])
            if isinstance(original.get("location"), dict)
            else None
        ),
        vehicle_miles=original.get("vehicle_miles"),
        engine_hours=original.get("engine_hours"),
        annotation=body.annotation,
        original_log_id=log_id,
        amendment_reason=reason,
    )
    hos = await _calculate_hos(db, driver["driver_id"])

    return {
        "status": "amended",
        "original_log_id": log_id,
        "amendment": sealed,
        "hos": hos,
        "message": "Original log retained; amendment appended with audit trail",
    }


@router.post("/transfer")
async def transfer_eld_data(
    body: TransferRequest, request: Request
) -> Dict[str, Any]:
    """
    Secure ELD data transfer for roadside inspection.

    Builds an FMCSA-style output package (driver identity, duty logs, HOS
    clocks) and delivers via Email or Web Services.
    """
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    method = (body.method or "").strip().lower()
    if method not in ("email", "web_service"):
        raise HTTPException(
            status_code=400,
            detail="method must be 'email' or 'web_service'",
        )
    recipient = (body.recipient or "").strip()
    if not recipient:
        raise HTTPException(status_code=400, detail="recipient is required")

    db = get_database()
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id}, {"_id": 0}
    )
    if not driver:
        raise HTTPException(
            status_code=403, detail="You must be a registered driver"
        )

    date_from = body.start or (
        datetime.now(timezone.utc) - timedelta(days=8)
    ).isoformat()
    date_to = body.end or datetime.now(timezone.utc).isoformat()

    cycle = body.cycle if body.cycle in ("70_8", "60_7") else "70_8"
    logs: List[Dict[str, Any]] = (
        await db.eld_logs.find(
            {
                "driver_id": driver["driver_id"],
                "created_at": {"$gte": date_from, "$lte": date_to},
            },
            {"_id": 0},
        )
        .sort("created_at", 1)
        .to_list(5000)
    )
    hos = await _calculate_hos(db, driver["driver_id"], cycle=cycle)
    user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "password": 0, "email": 1, "display_name": 1, "name": 1},
    )

    package = {
        "schema": "FMCSA_ELD_OUTPUT_V1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "comment": body.comment,
        "driver": {
            "driver_id": driver["driver_id"],
            "user_id": current_user.user_id,
            "email": (user or {}).get("email"),
            "display_name": (user or {}).get("display_name")
            or (user or {}).get("name"),
            "cdl_number": driver.get("cdl_number"),
        },
        "period": {"from": date_from, "to": date_to},
        "hos_summary": hos,
        "eld_records": [
            {
                "log_id": lg.get("log_id"),
                "event_type": lg.get("event_type"),
                "status": lg.get("status"),
                "created_at": lg.get("created_at"),
                "location": lg.get("location"),
                "vehicle_miles": lg.get("vehicle_miles"),
                "engine_hours": lg.get("engine_hours"),
                "speed_mph": lg.get("speed_mph"),
                "trip_id": lg.get("trip_id"),
                "certified": lg.get("certified", False),
                "log_hash": lg.get("log_hash"),
                "previous_hash": lg.get("previous_hash"),
                "original_log_id": lg.get("original_log_id"),
                "amendment_reason": lg.get("amendment_reason"),
                "annotation": lg.get("annotation"),
            }
            for lg in logs
        ],
        "record_count": len(logs),
        "hash_chain_tip": logs[-1].get("log_hash") if logs else None,
    }

    transfer_id = f"xfer_{uuid.uuid4().hex[:12]}"
    transfer_doc: Dict[str, Any] = {
        "id": transfer_id,
        "driver_id": driver["driver_id"],
        "method": method,
        "recipient": recipient,
        "date_from": date_from,
        "date_to": date_to,
        "record_count": len(logs),
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    delivered = False
    delivery_detail = None

    if method == "email":
        try:
            import asyncio

            import resend

            api_key = os.environ.get("RESEND_API_KEY")
            sender = os.environ.get(
                "RESEND_SENDER_EMAIL", "onboarding@resend.dev"
            )
            if not api_key:
                raise RuntimeError("RESEND_API_KEY not configured")
            resend.api_key = api_key
            params = {
                "from": sender,
                "to": [recipient],
                "subject": (
                    f"ELD Output Transfer — Driver {driver['driver_id'][:8]}"
                ),
                "text": (
                    f"FMCSA ELD output package ({len(logs)} records)\n"
                    f"Period: {date_from} → {date_to}\n"
                    f"Transfer ID: {transfer_id}\n"
                    f"Comment: {body.comment or 'n/a'}\n\n"
                    f"{json.dumps(package, indent=2, default=str)[:100000]}"
                ),
            }
            await asyncio.to_thread(resend.Emails.send, params)
            delivered = True
            transfer_doc["status"] = "sent"
        except Exception as exc:
            logger.warning(
                "ELD email transfer queued (mailer unavailable): %s", exc
            )
            transfer_doc["status"] = "queued_local"
            transfer_doc["package"] = package
            delivery_detail = str(exc)
    else:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    recipient,
                    json=package,
                    headers={
                        "Content-Type": "application/json",
                        "X-ELD-Transfer-Id": transfer_id,
                        "X-ELD-Schema": "FMCSA_ELD_OUTPUT_V1",
                    },
                )
            transfer_doc["http_status"] = resp.status_code
            if resp.status_code < 300:
                delivered = True
                transfer_doc["status"] = "sent"
            else:
                transfer_doc["status"] = "failed"
                delivery_detail = f"HTTP {resp.status_code}: {resp.text[:300]}"
        except Exception as exc:
            transfer_doc["status"] = "failed"
            delivery_detail = str(exc)
            logger.error("ELD web_service transfer failed: %s", exc)

    if delivery_detail:
        transfer_doc["delivery_detail"] = delivery_detail

    await db.eld_transfers.insert_one(transfer_doc)

    await _append_sealed_log(
        db,
        driver_id=driver["driver_id"],
        status=driver.get("eld_status") or "OFF_DUTY",
        event_type="intermediate",
        annotation=(
            f"ELD transfer {method} → status={transfer_doc['status']} "
            f"id={transfer_id}"
        ),
    )

    return {
        "transfer_id": transfer_id,
        "method": method,
        "status": transfer_doc["status"],
        "delivered": delivered,
        "record_count": len(logs),
        "schema": "FMCSA_ELD_OUTPUT_V1",
        "delivery_detail": delivery_detail,
    }


# ───────────────────────────────
# Admin / audit routes
# ───────────────────────────────


@router.get("/admin/audit/{driver_id}")
async def audit_driver_eld(driver_id: str, request: Request) -> Dict[str, Any]:
    """Verify the ELD hash chain for a driver. Admin only."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from utils.admin_guard import is_admin

    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")

    db = get_database()
    return await _verify_driver_hash_chain(db, driver_id)


@router.get("/admin/trips")
async def admin_list_trips(
    request: Request,
    status: Optional[str] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    """Admin view of all ELD trips."""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    from utils.admin_guard import is_admin

    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")

    db = get_database()
    query = {}
    if status:
        query["status"] = status

    trips = (
        await db.eld_trips.find(query, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
        .to_list(limit)
    )
    return {"trips": trips, "count": len(trips)}
