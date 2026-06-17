"""
DSG Guard — Safety & Operations Module
─────────────────────────────────────────────────────────────────────
Implements the founder-locked "Global Vibez DSG: Safety & Operations
Code" PDF (May 2026). Single source of truth for:

  1. Driver / VibeShopper / Hungry Vibez enrollment screening fields
  2. VibeShoppers task-dispatch payload schema (with the canonical
     fare split: driver 70%, sovereign tax 13.5%, liquidity pool 10%)
  3. Vibe Yellow Pages "Sponsored Partner" render contract
  4. Real-time safety rails — 1.5 mi route deviation, 15s acceptance
     window, GPS-coordinate-match escrow release

These are PUBLISHED CONSTANTS — the `/api/dsg-guard/safety-rails`
endpoint exposes them so any client (mobile, web, partner audit) can
read the source of truth without scraping code.

Endpoints (mounted under /api):
  GET  /dsg-guard/safety-rails               — public; returns constants
  GET  /dsg-guard/payout-structure           — public; the 70/13.5/10 split
  POST /dsg-guard/enrollment/submit          — auth; submit screening form
  GET  /dsg-guard/enrollment/status          — auth; check own status
  POST /dsg-guard/dispatch/build             — auth; produce a fully-formed
                                                VibeShopper dispatch payload
  POST /dsg-guard/route-deviation/check      — auth; classify a GPS sample
                                                against the 1.5-mile rail
"""
from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Final

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dsg-guard", tags=["dsg-guard"])


# ─────────────────────────────────────── Locked constants ──
# These mirror the "Real-Time Safety Rails" + "Payout Structure"
# blocks of the PDF. Any drift requires a founder-signed amendment.

ROUTE_DEVIATION_LIMIT_MILES: Final[float] = 1.5
ACCEPTANCE_WINDOW_SECONDS:    Final[int]   = 15
ESCROW_RELEASE_GPS_MATCH_M:   Final[int]   = 50  # within 50m = "coordinate match"

# VibeShoppers payout split (PDF §VibeShopper Dispatch Payload):
#   driver 70%, sovereign tax 13.5%, liquidity pool 10%.
# Remainder (6.5%) flows to the same insurance/referral/platform
# buckets as the rides splitter so we don't lose ledger parity.
DSG_PAYOUT_DRIVER:         Final[float] = 0.70
DSG_PAYOUT_SOVEREIGN_TAX:  Final[float] = 0.135
DSG_PAYOUT_LIQUIDITY_POOL: Final[float] = 0.10
DSG_PAYOUT_RESIDUAL:       Final[float] = round(
    1.0 - DSG_PAYOUT_DRIVER - DSG_PAYOUT_SOVEREIGN_TAX - DSG_PAYOUT_LIQUIDITY_POOL,
    6,
)  # = 0.065

SECURITY_STATUS_VERIFIED: Final[str] = "DSG_GUARD_VERIFIED"
SECURITY_STATUS_PENDING:  Final[str] = "DSG_GUARD_PENDING"
SECURITY_STATUS_REJECTED: Final[str] = "DSG_GUARD_REJECTED"


# ─────────────────────────────────────── Schemas ──

class IdentityFields(BaseModel):
    """PDF §Field Category - Identity."""
    legal_name: str
    ssn_last4: str = Field(..., pattern=r"^\d{4}$",
                           description="Last 4 of SSN — full SSN never stored at rest")
    drivers_license_number: str
    drivers_license_state: str
    date_of_birth: str  # ISO YYYY-MM-DD


class VehicleMetadata(BaseModel):
    """PDF §Field Category - Vehicle Metadata."""
    year: int = Field(..., ge=1980, le=2030)
    make: str
    model: str
    vin: str = Field(..., min_length=11, max_length=17)
    primary_color: str
    license_plate: str


class Residency(BaseModel):
    """PDF §Field Category - Residency."""
    verified_physical_address: str
    geo_pinned_home_base: Dict[str, float]  # {"lat":..,"lon":..}


class EmergencyContact(BaseModel):
    """PDF §Field Category - Emergency."""
    primary_safety_contact_name: str
    verified_phone: str


class DSGGuardEnrollment(BaseModel):
    """Full DSG Guard enrollment submission (PDF §Enrollment & Screening Form).

    Mandatory for VibeRidez, Hungry Vibez, AND VibeShopper applicants —
    any of those three pillars route through this single intake.
    """
    role: str = Field(..., pattern=r"^(viberidez|hungryvibes|vibeshopper)$",
                      description="Which fleet the applicant is joining")
    identity: IdentityFields
    vehicle: VehicleMetadata
    residency: Residency
    emergency: EmergencyContact


class VibeShopperDispatchRequest(BaseModel):
    """Build a dispatch payload that exactly matches the PDF schema."""
    task_type: str = "GROCERY_RETAIL"
    driver_id: str
    store_id: str
    rider_id: Optional[str] = None
    estimated_fare_usd: float = Field(..., gt=0)


class GPSPoint(BaseModel):
    lat: float
    lon: float


class RouteDeviationCheck(BaseModel):
    expected: GPSPoint
    actual:   GPSPoint
    ride_id:  str


# ─────────────────────────────────────── Helpers ──

def _haversine_miles(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    """Great-circle distance between two GPS points, in miles."""
    R = 3958.8  # Earth radius, miles
    phi1 = math.radians(a_lat)
    phi2 = math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat)
    dlam = math.radians(b_lon - a_lon)
    h = (math.sin(dphi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(h))


def _payout_breakdown(gross_usd: float) -> Dict[str, float]:
    """Apply the locked 70 / 13.5 / 10 / 6.5 split to a gross fare.

    Numbers are rounded to cents; the residual takes the rounding
    error so the buckets always sum to `gross_usd`.
    """
    driver = round(gross_usd * DSG_PAYOUT_DRIVER, 2)
    tax    = round(gross_usd * DSG_PAYOUT_SOVEREIGN_TAX, 2)
    pool   = round(gross_usd * DSG_PAYOUT_LIQUIDITY_POOL, 2)
    residual = round(gross_usd - driver - tax - pool, 2)
    return {
        "driver":         driver,
        "sovereign_tax":  tax,
        "liquidity_pool": pool,
        "residual":       residual,  # platform/insurance/referral
        "gross":          round(gross_usd, 2),
    }


# ─────────────────────────────────────── Endpoints ──

@router.get("/safety-rails")
async def get_safety_rails() -> Dict[str, Any]:
    """Public: real-time safety rail constants."""
    return {
        "route_deviation_limit_miles": ROUTE_DEVIATION_LIMIT_MILES,
        "acceptance_window_seconds": ACCEPTANCE_WINDOW_SECONDS,
        "escrow_release_gps_match_meters": ESCROW_RELEASE_GPS_MATCH_M,
        "spec_doc": "GlobalVibez_Safety_and_Operations_Code.pdf (May 2026)",
        "locked": True,
    }


@router.get("/payout-structure")
async def get_payout_structure() -> Dict[str, Any]:
    """Public: the canonical VibeShoppers fare split."""
    return {
        "fare_split":     DSG_PAYOUT_DRIVER,
        "sovereign_tax":  DSG_PAYOUT_SOVEREIGN_TAX,
        "liquidity_pool": DSG_PAYOUT_LIQUIDITY_POOL,
        "residual":       DSG_PAYOUT_RESIDUAL,
        "spec_doc":       "GlobalVibez_Safety_and_Operations_Code.pdf",
        "locked":         True,
    }


@router.post("/enrollment/submit")
async def submit_enrollment(form: DSGGuardEnrollment, request: Request) -> Dict[str, Any]:
    """Submit a full DSG Guard enrollment. Stores PENDING and returns the id."""
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    db = get_database()

    enrollment_id = f"dsg_{uuid.uuid4().hex[:12]}"
    record = {
        "enrollment_id": enrollment_id,
        "user_id": user.user_id if user else None,
        "role": form.role,
        "identity":  form.identity.model_dump(),
        "vehicle":   form.vehicle.model_dump(),
        "residency": form.residency.model_dump(),
        "emergency": form.emergency.model_dump(),
        "security_status": SECURITY_STATUS_PENDING,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
    }
    await db.dsg_guard_enrollments.insert_one(record)

    return {
        "enrollment_id": enrollment_id,
        "security_status": SECURITY_STATUS_PENDING,
        "next_step": "Awaiting DSG Guard review (typically <24h)",
    }


@router.get("/enrollment/status")
async def get_enrollment_status(request: Request) -> Dict[str, Any]:
    """Return the current DSG Guard status of the authenticated user."""
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    rec = await db.dsg_guard_enrollments.find_one(
        {"user_id": user.user_id},
        {"_id": 0, "identity.ssn_last4": 0},
        sort=[("submitted_at", -1)],
    )
    if not rec:
        return {"security_status": "NOT_ENROLLED", "enrolled": False}
    return {
        "enrolled": True,
        "security_status": rec.get("security_status", SECURITY_STATUS_PENDING),
        "submitted_at": rec.get("submitted_at"),
        "role": rec.get("role"),
    }


@router.post("/dispatch/build")
async def build_dispatch(req: VibeShopperDispatchRequest, request: Request) -> Dict[str, Any]:
    """Produce a VibeShopper dispatch payload that EXACTLY matches the PDF schema."""
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()

    drv = await db.dsg_guard_enrollments.find_one(
        {"user_id": req.driver_id, "role": {"$in": ["viberidez", "vibeshopper"]}},
        {"_id": 0, "vehicle": 1, "security_status": 1},
        sort=[("submitted_at", -1)],
    )

    security_status = (drv or {}).get("security_status", SECURITY_STATUS_PENDING)
    vehicle_match: Dict[str, str] = {}
    if drv and drv.get("vehicle"):
        v = drv["vehicle"]
        vehicle_match = {
            "plate": v.get("license_plate", ""),
            "color": v.get("primary_color", ""),
        }

    payout = _payout_breakdown(req.estimated_fare_usd)

    payload = {
        "dispatch_id": f"V-SHOP-{uuid.uuid4().hex[:6].upper()}",
        "task_type": req.task_type,
        "security_status": security_status,
        "vehicle_match": vehicle_match,
        "payout_structure": {
            "fare_split":     DSG_PAYOUT_DRIVER,
            "sovereign_tax":  DSG_PAYOUT_SOVEREIGN_TAX,
            "liquidity_pool": DSG_PAYOUT_LIQUIDITY_POOL,
        },
        "payout_breakdown_usd": payout,
        "store_id": req.store_id,
        "rider_id": req.rider_id,
        "blocked": security_status != SECURITY_STATUS_VERIFIED,
        "issued_at": datetime.now(timezone.utc).isoformat(),
    }
    return payload


@router.post("/route-deviation/check")
async def check_route_deviation(check: RouteDeviationCheck, request: Request) -> Dict[str, Any]:
    """Compare a GPS sample against the planned route. >1.5mi triggers auto-security."""
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    miles = _haversine_miles(
        check.expected.lat, check.expected.lon,
        check.actual.lat,   check.actual.lon,
    )
    triggered = miles > ROUTE_DEVIATION_LIMIT_MILES

    if triggered:
        db = get_database()
        await db.dsg_guard_safety_alerts.insert_one({
            "alert_id": f"alert_{uuid.uuid4().hex[:10]}",
            "ride_id": check.ride_id,
            "user_id": user.user_id,
            "kind": "route_deviation",
            "miles": round(miles, 3),
            "limit_miles": ROUTE_DEVIATION_LIMIT_MILES,
            "expected": check.expected.model_dump(),
            "actual":   check.actual.model_dump(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    return {
        "deviation_miles": round(miles, 3),
        "limit_miles": ROUTE_DEVIATION_LIMIT_MILES,
        "auto_security_triggered": triggered,
    }


# ─────────────────────────────────────── Module health ──

def get_locked_constants_dict() -> Dict[str, Any]:
    """Used by `regression_shield.py` to assert the PDF constants
    haven't drifted at runtime."""
    return {
        "ROUTE_DEVIATION_LIMIT_MILES": ROUTE_DEVIATION_LIMIT_MILES,
        "ACCEPTANCE_WINDOW_SECONDS":   ACCEPTANCE_WINDOW_SECONDS,
        "ESCROW_RELEASE_GPS_MATCH_M":  ESCROW_RELEASE_GPS_MATCH_M,
        "DSG_PAYOUT_DRIVER":           DSG_PAYOUT_DRIVER,
        "DSG_PAYOUT_SOVEREIGN_TAX":    DSG_PAYOUT_SOVEREIGN_TAX,
        "DSG_PAYOUT_LIQUIDITY_POOL":   DSG_PAYOUT_LIQUIDITY_POOL,
    }
