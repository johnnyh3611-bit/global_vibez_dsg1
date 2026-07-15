import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from models.eld import ELDLog, ELDTrip, GeoPoint, ELDTripStop
from utils.database import get_current_user, get_database

router = APIRouter(prefix="/eld", tags=["eld"])

# In production, set a strong secret and rotate only with a re-sign migration.
ELD_SIGNING_KEY = os.environ.get(
    "ELD_SIGNING_KEY",
    "dev-eld-signing-key-change-in-production",
).encode()

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
        "annotation",
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
    for log in logs:
        expected_hash = _compute_log_hash(log)
        expected_signature = _sign_hash(expected_hash)
        if (
            log.get("log_hash") != expected_hash
            or log.get("signature") != expected_signature
        ):
            broken.append({"log_id": log.get("log_id"), "valid": False})

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


def _interval_minutes(start: datetime, end: datetime) -> float:
    return max(0.0, (end - start).total_seconds() / 60.0)


async def _calculate_hos(
    db, driver_id: str, now: Optional[datetime] = None
) -> Dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    eight_days_ago = now - timedelta(days=8)

    logs = (
        await db.eld_logs.find(
            {
                "driver_id": driver_id,
                "created_at": {"$gte": eight_days_ago.isoformat()},
            },
            {"_id": 0},
        )
        .sort("created_at", 1)
        .to_list(10000)
    )

    if not logs:
        return {
            "driver_id": driver_id,
            "status": "OFF_DUTY",
            "current_driving_minutes": 0,
            "current_on_duty_minutes": 0,
            "remaining_drive_minutes": 11 * 60,
            "remaining_duty_window_minutes": 14 * 60,
            "remaining_8_day_on_duty_minutes": 70 * 60,
            "break_required": False,
            "in_violation": False,
            "violations": [],
        }

    # 1. Find the start of the current duty window: most recent >=10h rest.
    window_start = eight_days_ago
    rest_start = None
    for i in range(len(logs) - 1, -1, -1):
        if logs[i]["status"] in REST_STATUSES:
            if rest_start is None:
                rest_start = _to_dt(logs[i]["created_at"])
            else:
                if (
                    _to_dt(logs[i]["created_at"]) - rest_start
                ).total_seconds() <= 300:
                    rest_start = _to_dt(logs[i]["created_at"])
                else:
                    break
        else:
            if rest_start is not None:
                rest_end = (
                    _to_dt(logs[i + 1]["created_at"])
                    if i + 1 < len(logs)
                    else now
                )
                if (rest_end - rest_start).total_seconds() >= 10 * 3600:
                    window_start = rest_end
                    break
                rest_start = None

    # 2. Accumulate driving / on-duty since window_start.
    current_driving_minutes = 0.0
    current_on_duty_minutes = 0.0
    driving_before_last_break = 0.0
    break_taken = False
    last_break_reset = window_start

    for i, log in enumerate(logs):
        t = _to_dt(log["created_at"])
        if t < window_start:
            continue
        next_t = (
            _to_dt(logs[i + 1]["created_at"]) if i + 1 < len(logs) else now
        )
        if log["status"] in ON_DUTY_STATUSES:
            duration = _interval_minutes(t, next_t)
            current_on_duty_minutes += duration
            if log["status"] == "DRIVING":
                current_driving_minutes += duration
                driving_before_last_break += _interval_minutes(
                    max(t, last_break_reset), next_t
                )
        elif log["status"] in REST_STATUSES:
            if _interval_minutes(t, next_t) >= 30:
                break_taken = True
                driving_before_last_break = 0
                last_break_reset = next_t

    # 3. 8-day rolling on-duty total.
    eight_day_on_duty_minutes = 0.0
    for i, log in enumerate(logs):
        t = _to_dt(log["created_at"])
        if t < eight_days_ago:
            continue
        next_t = (
            _to_dt(logs[i + 1]["created_at"]) if i + 1 < len(logs) else now
        )
        if log["status"] in ON_DUTY_STATUSES:
            eight_day_on_duty_minutes += _interval_minutes(t, next_t)

    remaining_drive = max(0, 11 * 60 - current_driving_minutes)
    remaining_window = max(0, 14 * 60 - current_on_duty_minutes)
    remaining_8_day = max(0, 70 * 60 - eight_day_on_duty_minutes)

    violations = []
    if current_driving_minutes > 11 * 60:
        violations.append("11-hour driving limit exceeded")
    if current_on_duty_minutes > 14 * 60:
        violations.append("14-hour on-duty window exceeded")
    if eight_day_on_duty_minutes > 70 * 60:
        violations.append("70-hour / 8-day limit exceeded")

    # 30-minute break required after 8 cumulative driving hours in window
    break_required = driving_before_last_break >= 8 * 60 and not break_taken
    if break_required:
        violations.append("30-minute break required after 8 hours of driving")

    return {
        "driver_id": driver_id,
        "status": logs[-1]["status"],
        "current_driving_minutes": round(current_driving_minutes, 1),
        "current_on_duty_minutes": round(current_on_duty_minutes, 1),
        "remaining_drive_minutes": round(remaining_drive, 1),
        "remaining_duty_window_minutes": round(remaining_window, 1),
        "remaining_8_day_on_duty_minutes": round(remaining_8_day, 1),
        "break_required": break_required,
        "in_violation": bool(violations),
        "violations": violations,
    }


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

    previous = await _last_driver_log(db, driver["driver_id"])
    previous_hash = previous.get("log_hash") if previous else None

    log = ELDLog(
        log_id=f"eld_{uuid.uuid4().hex[:12]}",
        driver_id=driver["driver_id"],
        trip_id=change.trip_id,
        event_type="status_change",
        status=change.status,
        location=change.location,
        vehicle_miles=change.vehicle_miles,
        engine_hours=change.engine_hours,
        annotation=change.annotation,
        previous_hash=previous_hash,
    )

    sealed = _seal_log(log.model_dump())
    await db.eld_logs.insert_one(sealed)
    sealed.pop("_id", None)

    await db.drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {
            "$set": {
                "eld_status": change.status,
                "eld_last_log_at": sealed["created_at"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    hos = await _calculate_hos(db, driver["driver_id"])
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
        {"user_id": current_user.user_id}, {"_id": 0, "driver_id": 1}
    )
    if not driver:
        raise HTTPException(
            status_code=403, detail="You must be a registered driver"
        )

    return await _calculate_hos(db, driver["driver_id"])


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

    previous = await _last_driver_log(db, driver["driver_id"])
    log = ELDLog(
        log_id=f"eld_{uuid.uuid4().hex[:12]}",
        driver_id=driver["driver_id"],
        trip_id=trip_id,
        event_type="trip_start",
        status="DRIVING",
        previous_hash=previous.get("log_hash") if previous else None,
    )
    sealed = _seal_log(log.model_dump())
    await db.eld_logs.insert_one(sealed)
    sealed.pop("_id", None)

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

    previous = await _last_driver_log(db, driver["driver_id"])
    log = ELDLog(
        log_id=f"eld_{uuid.uuid4().hex[:12]}",
        driver_id=driver["driver_id"],
        trip_id=trip_id,
        event_type="trip_end",
        status="OFF_DUTY",
        previous_hash=previous.get("log_hash") if previous else None,
    )
    sealed = _seal_log(log.model_dump())
    await db.eld_logs.insert_one(sealed)
    sealed.pop("_id", None)

    return {"message": "Trip completed", "trip_id": trip_id, "log": sealed}


@router.post("/trips/{trip_id}/location")
async def ping_trip_location(
    trip_id: str,
    ping: LocationPingRequest,
    request: Request,
) -> Dict[str, Any]:
    """Record a location ping for an active trip."""
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

    previous = await _last_driver_log(db, driver["driver_id"])
    log = ELDLog(
        log_id=f"eld_{uuid.uuid4().hex[:12]}",
        driver_id=driver["driver_id"],
        trip_id=trip_id,
        event_type="location_ping",
        status="DRIVING",
        location=ping.location,
        vehicle_miles=ping.vehicle_miles,
        engine_hours=ping.engine_hours,
        previous_hash=previous.get("log_hash") if previous else None,
    )
    sealed = _seal_log(log.model_dump())
    await db.eld_logs.insert_one(sealed)
    sealed.pop("_id", None)

    return {"message": "Location recorded", "log": sealed}


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
