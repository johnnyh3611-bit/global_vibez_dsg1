from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import uuid
import math

router = APIRouter(prefix="/rides", tags=["rides"])


# ==================== MODELS ====================

class LocationData(BaseModel):
    address: str
    latitude: float
    longitude: float

class RequestRide(BaseModel):
    pickup_location: LocationData
    dropoff_location: LocationData
    use_trusted_contact: bool = True

class AcceptRide(BaseModel):
    ride_id: str

class UpdateRideStatus(BaseModel):
    ride_id: str
    status: str  # arriving, in_progress, completed

class AddTip(BaseModel):
    ride_id: str
    tip_amount: float

class RateRide(BaseModel):
    ride_id: str
    rating: int  # 1-5
    comment: Optional[str] = None


# ==================== HELPERS ====================

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in miles using Haversine formula"""
    R = 3959  # Earth's radius in miles
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    distance = R * c
    return round(distance, 2)


def calculate_ride_cost(distance_miles):
    """Calculate ride cost in credits based on distance"""
    base_fare = 1.50
    per_mile = 1.20
    per_minute = 0.25
    service_fee = 1.80
    
    # Estimate duration (assume average 25 mph)
    estimated_duration = (distance_miles / 25) * 60  # in minutes
    
    total_cost = base_fare + (distance_miles * per_mile) + (estimated_duration * per_minute) + service_fee
    
    # Round to nearest credit
    return round(total_cost, 1)


def calculate_driver_earning(credit_cost):
    """Calculate driver earnings (60% of ride cost)"""
    return round(credit_cost * 0.60, 2)


def calculate_platform_fee(credit_cost):
    """Calculate platform fee (40% of ride cost)"""
    return round(credit_cost * 0.40, 2)


# ==================== ENDPOINTS ====================

@router.post("/request")
async def request_ride(ride_data: RequestRide, request: Request) -> Dict[str, Any]:
    """Request a ride"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Calculate distance
    distance = calculate_distance(
        ride_data.pickup_location.latitude,
        ride_data.pickup_location.longitude,
        ride_data.dropoff_location.latitude,
        ride_data.dropoff_location.longitude
    )
    
    # Calculate cost
    credit_cost = calculate_ride_cost(distance)
    
    # Check user has enough credits
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if user.get("credit_balance", 0) < credit_cost:
        raise HTTPException(status_code=400, detail=f"Insufficient credits. Need {credit_cost} credits.")
    
    # Get trusted contact if enabled
    trusted_contact_id = None
    if ride_data.use_trusted_contact:
        if user.get("trusted_contact_name"):
            trusted_contact_id = "external"  # External contact (phone/email)
    
    # Create ride
    ride = {
        "ride_id": f"ride_{uuid.uuid4().hex[:12]}",
        "rider_id": current_user.user_id,
        "driver_id": None,
        "pickup_location": ride_data.pickup_location.dict(),
        "dropoff_location": ride_data.dropoff_location.dict(),
        "distance_miles": distance,
        "estimated_duration_minutes": int((distance / 25) * 60),
        "credit_cost": credit_cost,
        "driver_earning": calculate_driver_earning(credit_cost),
        "platform_fee": calculate_platform_fee(credit_cost),
        "tip_amount": 0.0,
        "status": "requested",
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None,
        "started_at": None,
        "completed_at": None,
        "cancelled_at": None,
        "rider_rating": None,
        "driver_rating": None,
        "trusted_contact_id": trusted_contact_id,
        "trusted_contact_notified": False
    }
    
    await db.rides.insert_one(ride)
    
    # Notify trusted contact if exists
    if trusted_contact_id:
        # In production, send SMS/email to trusted contact
        # For now, just mark as notified
        await db.rides.update_one(
            {"ride_id": ride["ride_id"]},
            {"$set": {"trusted_contact_notified": True}}
        )
    
    return {
        "message": "Ride requested",
        "ride": ride,
        "estimated_cost": credit_cost
    }


@router.post("/accept")
async def accept_ride(accept_data: AcceptRide, request: Request) -> Dict[str, Any]:
    """Driver accepts a ride"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get driver profile
    driver = await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=403, detail="Not a driver")
    
    if driver["status"] != "approved" or not driver.get("available"):
        raise HTTPException(status_code=403, detail="Driver not available")
    
    # Get ride
    ride = await db.rides.find_one({"ride_id": accept_data.ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["status"] != "requested":
        raise HTTPException(status_code=400, detail="Ride already accepted")
    
    # Assign driver to ride
    await db.rides.update_one(
        {"ride_id": accept_data.ride_id},
        {"$set": {
            "driver_id": driver["driver_id"],
            "status": "accepted",
            "accepted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update driver availability
    await db.drivers.update_one(
        {"driver_id": driver["driver_id"]},
        {"$set": {"available": False}}
    )
    
    # Get updated ride with rider info
    updated_ride = await db.rides.find_one({"ride_id": accept_data.ride_id}, {"_id": 0})
    rider = await db.users.find_one(
        {"user_id": updated_ride["rider_id"]},
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1, "trusted_contact_name": 1, "trusted_contact_phone": 1}
    )
    updated_ride["rider"] = rider
    
    return {
        "message": "Ride accepted",
        "ride": updated_ride
    }


@router.put("/status")
async def update_ride_status(status_data: UpdateRideStatus, request: Request) -> Dict[str, Any]:
    """Update ride status (driver only)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get driver profile
    driver = await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=403, detail="Not a driver")
    
    # Get ride
    ride = await db.rides.find_one({"ride_id": status_data.ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["driver_id"] != driver["driver_id"]:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    # Update status
    update_data = {"status": status_data.status}
    
    if status_data.status == "in_progress":
        update_data["started_at"] = datetime.now(timezone.utc).isoformat()
    elif status_data.status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        # Deduct credits from rider
        await db.users.update_one(
            {"user_id": ride["rider_id"]},
            {"$inc": {"credit_balance": -ride["credit_cost"]}}
        )
        
        # Add earnings to driver (will be available for payout)
        await db.drivers.update_one(
            {"driver_id": driver["driver_id"]},
            {"$inc": {
                "total_earnings": ride["driver_earning"],
                "total_rides": 1
            }}
        )
        
        # Create transactions
        rider_txn = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": ride["rider_id"],
            "type": "ride_payment",
            "amount": -ride["credit_cost"],
            "description": f"Ride from {ride['pickup_location']['address'][:30]}... to {ride['dropoff_location']['address'][:30]}...",
            "reference_id": ride["ride_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        driver_txn = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": current_user.user_id,
            "type": "driver_earning",
            "amount": ride["driver_earning"],
            "description": f"Ride earnings (60% of {ride['credit_cost']} credits)",
            "reference_id": ride["ride_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.transactions.insert_many([rider_txn, driver_txn])
        
        # Make driver available again
        await db.drivers.update_one(
            {"driver_id": driver["driver_id"]},
            {"$set": {"available": True}}
        )
    
    await db.rides.update_one(
        {"ride_id": status_data.ride_id},
        {"$set": update_data}
    )
    
    return {"message": f"Ride status updated to {status_data.status}"}


@router.post("/tip")
async def add_tip(tip_data: AddTip, request: Request) -> Dict[str, Any]:
    """Add tip to completed ride"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get ride
    ride = await db.rides.find_one({"ride_id": tip_data.ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["rider_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    if ride["status"] != "completed":
        raise HTTPException(status_code=400, detail="Ride not completed")
    
    # Check user has credits
    user = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if user.get("credit_balance", 0) < tip_data.tip_amount:
        raise HTTPException(status_code=400, detail="Insufficient credits for tip")
    
    # Deduct tip from rider
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$inc": {"credit_balance": -tip_data.tip_amount}}
    )
    
    # Add tip to driver earnings
    await db.drivers.update_one(
        {"driver_id": ride["driver_id"]},
        {"$inc": {"total_earnings": tip_data.tip_amount}}
    )
    
    # Update ride
    await db.rides.update_one(
        {"ride_id": tip_data.ride_id},
        {"$set": {"tip_amount": tip_data.tip_amount}}
    )
    
    # Create transactions
    rider_txn = {
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "type": "ride_payment",
        "amount": -tip_data.tip_amount,
        "description": f"Tip for ride {tip_data.ride_id}",
        "reference_id": tip_data.ride_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    driver_user = await db.users.find_one({"user_id": ride["driver_id"]}, {"_id": 0})
    if driver_user:
        driver_txn = {
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": driver_user["user_id"],
            "type": "driver_earning",
            "amount": tip_data.tip_amount,
            "description": f"Tip from ride {tip_data.ride_id}",
            "reference_id": tip_data.ride_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.transactions.insert_one(driver_txn)
    
    await db.transactions.insert_one(rider_txn)
    
    return {"message": "Tip added successfully"}


@router.post("/rate")
async def rate_ride(rating_data: RateRide, request: Request) -> Dict[str, Any]:
    """Rate a completed ride"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get ride
    ride = await db.rides.find_one({"ride_id": rating_data.ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed rides")
    
    is_rider = ride["rider_id"] == current_user.user_id
    is_driver = ride["driver_id"] == await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0, "driver_id": 1}).get("driver_id") if await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0}) else None
    
    if not (is_rider or is_driver):
        raise HTTPException(status_code=403, detail="Not part of this ride")
    
    rating = {
        "rating": rating_data.rating,
        "comment": rating_data.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    if is_rider:
        # Rider rating driver
        if ride.get("rider_rating"):
            raise HTTPException(status_code=400, detail="Already rated")
        
        await db.rides.update_one(
            {"ride_id": rating_data.ride_id},
            {"$set": {"rider_rating": rating}}
        )
        
        # Update driver rating
        driver = await db.drivers.find_one({"driver_id": ride["driver_id"]}, {"_id": 0})
        new_total = driver["total_ratings"] + 1
        new_rating = ((driver["rating"] * driver["total_ratings"]) + rating_data.rating) / new_total
        
        await db.drivers.update_one(
            {"driver_id": ride["driver_id"]},
            {"$set": {
                "rating": round(new_rating, 2),
                "total_ratings": new_total
            }}
        )
    else:
        # Driver rating rider
        if ride.get("driver_rating"):
            raise HTTPException(status_code=400, detail="Already rated")
        
        await db.rides.update_one(
            {"ride_id": rating_data.ride_id},
            {"$set": {"driver_rating": rating}}
        )
    
    return {"message": "Rating submitted"}


@router.get("/my-rides")
async def get_my_rides(request: Request, limit: int = 50) -> Dict[str, Any]:
    """Get user's ride history"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    rides = await db.rides.find({
        "rider_id": current_user.user_id
    }, {"_id": 0}).sort("requested_at", -1).to_list(limit)
    
    # Get driver info for each ride
    for ride in rides:
        if ride.get("driver_id"):
            driver = await db.drivers.find_one(
                {"driver_id": ride["driver_id"]},
                {"_id": 0}
            )
            if driver:
                driver_user = await db.users.find_one(
                    {"user_id": driver["user_id"]},
                    {"_id": 0, "name": 1, "picture": 1}
                )
                ride["driver"] = {
                    "driver_id": driver["driver_id"],
                    "name": driver_user.get("name"),
                    "picture": driver_user.get("picture"),
                    "rating": driver.get("rating"),
                    "vehicle": driver.get("vehicle")
                }
    
    return {"rides": rides}


@router.get("/{ride_id}")
async def get_ride(ride_id: str, request: Request) -> Dict[str, Any]:
    """Get ride details"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check access
    is_rider = ride["rider_id"] == current_user.user_id
    driver = await db.drivers.find_one({"user_id": current_user.user_id}, {"_id": 0})
    is_driver = driver and ride.get("driver_id") == driver.get("driver_id")
    
    if not (is_rider or is_driver):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Add user details
    if is_rider and ride.get("driver_id"):
        driver_doc = await db.drivers.find_one({"driver_id": ride["driver_id"]}, {"_id": 0})
        if driver_doc:
            driver_user = await db.users.find_one(
                {"user_id": driver_doc["user_id"]},
                {"_id": 0, "name": 1, "picture": 1}
            )
            ride["driver"] = {
                "driver_id": driver_doc["driver_id"],
                "name": driver_user.get("name"),
                "picture": driver_user.get("picture"),
                "rating": driver_doc.get("rating"),
                "vehicle": driver_doc.get("vehicle")
            }
    
    if is_driver:
        rider = await db.users.find_one(
            {"user_id": ride["rider_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
        )
        ride["rider"] = rider
    
    return {"ride": ride}


@router.post("/{ride_id}/cancel")
async def cancel_ride(ride_id: str, request: Request) -> Dict[str, Any]:
    """Cancel a ride"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["rider_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your ride")
    
    if ride["status"] not in ["requested", "accepted", "arriving"]:
        raise HTTPException(status_code=400, detail="Cannot cancel ride at this stage")
    
    await db.rides.update_one(
        {"ride_id": ride_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # If driver was assigned, make them available again
    if ride.get("driver_id"):
        await db.drivers.update_one(
            {"driver_id": ride["driver_id"]},
            {"$set": {"available": True}}
        )
    
    return {"message": "Ride cancelled"}
