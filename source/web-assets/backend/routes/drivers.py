from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/drivers", tags=["drivers"])


# ==================== MODELS ====================

class VehicleInfo(BaseModel):
    make: str
    model: str
    year: int
    color: str
    plate_number: str
    vehicle_type: str = "sedan"

class DriverRegistration(BaseModel):
    vehicle: VehicleInfo
    license_url: Optional[str] = None
    insurance_url: Optional[str] = None
    registration_url: Optional[str] = None

class UpdateDriverStatus(BaseModel):
    available: bool

class UpdateLocation(BaseModel):
    latitude: float
    longitude: float

class RateDriver(BaseModel):
    driver_id: str
    ride_id: str
    rating: int  # 1-5
    comment: Optional[str] = None


# ==================== ENDPOINTS ====================

@router.post("/register")
async def register_as_driver(driver_data: DriverRegistration, request: Request) -> Dict[str, Any]:
    """Register as a driver"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if already a driver
    existing_driver = await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if existing_driver:
        raise HTTPException(status_code=400, detail="Already registered as driver")
    
    # Create driver profile
    driver = {
        "driver_id": f"drv_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "vehicle": driver_data.vehicle.dict(),
        "documents": {
            "license_url": driver_data.license_url,
            "insurance_url": driver_data.insurance_url,
            "registration_url": driver_data.registration_url,
            "background_check_status": "pending"
        },
        "status": "pending",
        "rating": 5.0,
        "total_ratings": 0,
        "total_rides": 0,
        "total_earnings": 0.0,
        "available": False,
        "current_location": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": None
    }
    
    await db.drivers.insert_one(driver)
    
    return {
        "message": "Driver registration submitted",
        "driver": driver,
        "status": "pending"
    }


@router.get("/me")
async def get_my_driver_profile(request: Request) -> Dict[str, Any]:
    """Get my driver profile"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    driver = await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if not driver:
        return {"is_driver": False, "driver": None}
    
    return {"is_driver": True, "driver": driver}


@router.put("/availability")
async def update_availability(status_data: UpdateDriverStatus, request: Request) -> Dict[str, Any]:
    """Update driver availability"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    driver = await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if not driver:
        raise HTTPException(status_code=404, detail="Not registered as driver")
    
    if driver["status"] != "approved":
        raise HTTPException(status_code=403, detail="Driver not approved yet")
    
    await db.drivers.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"available": status_data.available}}
    )
    
    return {"message": f"Availability set to {status_data.available}"}


@router.put("/location")
async def update_driver_location(location_data: UpdateLocation, request: Request) -> Dict[str, Any]:
    """Update driver's current location"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    driver = await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if not driver:
        raise HTTPException(status_code=404, detail="Not registered as driver")
    
    await db.drivers.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "current_location": {
                "lat": location_data.latitude,
                "lng": location_data.longitude,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }}
    )
    
    return {"message": "Location updated"}


@router.get("/earnings")
async def get_driver_earnings(request: Request) -> Dict[str, Any]:
    """Get driver earnings summary"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    driver = await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if not driver:
        raise HTTPException(status_code=404, detail="Not registered as driver")
    
    # Get completed rides
    completed_rides = await db.rides.find({
        "driver_id": driver["driver_id"],
        "status": "completed"
    }, {"_id": 0}).to_list(1000)
    
    total_earnings = sum(ride.get("driver_earning", 0) + ride.get("tip_amount", 0) for ride in completed_rides)
    total_tips = sum(ride.get("tip_amount", 0) for ride in completed_rides)
    
    return {
        "total_rides": len(completed_rides),
        "total_earnings": total_earnings,
        "total_tips": total_tips,
        "earnings_without_tips": total_earnings - total_tips,
        "average_per_ride": total_earnings / len(completed_rides) if completed_rides else 0,
        "rating": driver.get("rating", 5.0),
        "total_ratings": driver.get("total_ratings", 0)
    }


@router.get("/rides/active")
async def get_active_rides(request: Request) -> Dict[str, Any]:
    """Get active ride requests for driver"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    driver = await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if not driver:
        raise HTTPException(status_code=404, detail="Not registered as driver")
    
    # Get rides assigned to this driver or available rides nearby
    assigned_rides = await db.rides.find({
        "driver_id": driver["driver_id"],
        "status": {"$in": ["accepted", "arriving", "in_progress"]}
    }, {"_id": 0}).to_list(10)
    
    # Get available ride requests (not yet accepted)
    if driver.get("available"):
        available_rides = await db.rides.find({
            "status": "requested",
            "driver_id": None
        }, {"_id": 0}).sort("requested_at", 1).to_list(20)
    else:
        available_rides = []
    
    # Get rider info for all rides
    for ride in assigned_rides + available_rides:
        rider = await db.users.find_one(
            {"user_id": ride["rider_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
        )
        ride["rider"] = rider
    
    return {
        "assigned_rides": assigned_rides,
        "available_rides": available_rides
    }


@router.get("/rides/history")
async def get_ride_history(request: Request, limit: int = 50) -> Dict[str, Any]:
    """Get driver's ride history"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    driver = await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if not driver:
        raise HTTPException(status_code=404, detail="Not registered as driver")
    
    rides = await db.rides.find({
        "driver_id": driver["driver_id"],
        "status": {"$in": ["completed", "cancelled"]}
    }, {"_id": 0}).sort("completed_at", -1).to_list(limit)
    
    # Get rider info
    for ride in rides:
        rider = await db.users.find_one(
            {"user_id": ride["rider_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
        )
        ride["rider"] = rider
    
    return {"rides": rides}


@router.get("/{driver_id}")
async def get_driver_profile(driver_id: str) -> Dict[str, Any]:
    """Get public driver profile"""
    db = get_database()
    driver = await db.drivers.find_one({"driver_id": driver_id}, {"_id": 0})
    
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Get user info
    user = await db.users.find_one(
        {"user_id": driver["user_id"]},
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
    )
    
    return {
        "driver_id": driver["driver_id"],
        "name": user.get("name"),
        "picture": user.get("picture"),
        "rating": driver.get("rating", 5.0),
        "total_ratings": driver.get("total_ratings", 0),
        "total_rides": driver.get("total_rides", 0),
        "vehicle": driver.get("vehicle"),
        "status": driver.get("status")
    }
