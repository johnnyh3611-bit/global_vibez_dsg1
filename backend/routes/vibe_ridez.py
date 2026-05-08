"""
Vibe Ridez - Ride-sharing/Carpooling for Dates
Backend routes for driver registration, ride posting, booking, and tracking
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from uuid import uuid4

from utils.auth_dependencies import get_current_user_from_session, verify_user_id
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

router = APIRouter(prefix="/vibe-ridez", tags=["Vibe Ridez"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.environ.get("DB_NAME", "global_vibez_dsg")]

# Stripe
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY")
stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY)

# Models
class Vehicle(BaseModel):
    make: str
    model: str
    year: int
    color: str
    plate_number: str
    seats: int = 4

class DriverProfile(BaseModel):
    driver_id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    username: str
    phone_number: str
    license_number: str
    license_verified: bool = False
    vehicle: Vehicle
    rating: float = 5.0
    total_rides: int = 0
    bio: Optional[str] = None
    profile_photo: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Request body model for driver registration
class DriverRegistrationRequest(BaseModel):
    phone_number: str
    license_number: str
    vehicle: Vehicle
    bio: Optional[str] = None
    profile_photo: Optional[str] = None
    # These are sent by frontend but we get them from session
    user_id: Optional[str] = None
    username: Optional[str] = None

class RideLocation(BaseModel):
    address: str
    latitude: float
    longitude: float
    city: str
    state: str

class Ride(BaseModel):
    ride_id: str = Field(default_factory=lambda: str(uuid4()))
    driver_id: str
    driver_username: str
    driver_photo: Optional[str] = None
    driver_rating: float = 5.0
    vehicle_info: str  # "2020 Tesla Model 3 - White"
    
    # Route
    pickup_location: RideLocation
    dropoff_location: RideLocation
    departure_time: datetime
    
    # Details
    available_seats: int
    price_per_seat: float
    total_distance_miles: Optional[float] = None
    estimated_duration_mins: Optional[int] = None
    
    # Passengers
    passenger_ids: List[str] = []
    passenger_usernames: List[str] = []
    max_passengers: int
    
    # Status
    status: str = "scheduled"  # scheduled, active, completed, cancelled
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Booking(BaseModel):
    booking_id: str = Field(default_factory=lambda: str(uuid4()))
    ride_id: str
    passenger_id: str
    passenger_username: str
    seats_booked: int = 1
    price_paid: float
    status: str = "pending"  # pending, confirmed, completed, cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Rating(BaseModel):
    rating_id: str = Field(default_factory=lambda: str(uuid4()))
    ride_id: str
    from_user_id: str
    to_user_id: str
    rating: int  # 1-5
    review: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Request body model for ride creation
class CreateRideRequest(BaseModel):
    driver_id: Optional[str] = None  # Sent by frontend but we get from session
    pickup_location: RideLocation
    dropoff_location: RideLocation
    departure_time: str  # ISO format
    available_seats: int
    price_per_seat: float
    notes: Optional[str] = None

# Request body model for ride booking
class BookRideRequest(BaseModel):
    ride_id: str
    passenger_id: Optional[str] = None  # Sent by frontend but we get from session
    passenger_username: Optional[str] = None  # Sent by frontend but we get from session
    seats_requested: int = 1
    payment_method: str = "card"   # "card" (default) | "coins"

# ==================== DRIVER ENDPOINTS ====================

@router.post("/driver/register")
async def register_driver(
    request_body: DriverRegistrationRequest,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Register as a driver (requires authentication)
    """
    try:
        user_id = current_user["user_id"]
        username = current_user.get("name", "Driver")
        
        # Check if already registered
        existing = await db.vibe_ridez_drivers.find_one({"user_id": user_id})
        if existing:
            raise HTTPException(status_code=400, detail="Already registered as driver")
        
        driver = {
            "driver_id": str(uuid4()),
            "user_id": user_id,
            "username": username,
            "phone_number": request_body.phone_number,
            "license_number": request_body.license_number,
            "license_verified": False,  # Manual verification needed
            "vehicle": request_body.vehicle.dict(),
            "rating": 5.0,
            "total_rides": 0,
            "bio": request_body.bio,
            "profile_photo": request_body.profile_photo,
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.vibe_ridez_drivers.insert_one(driver)
        
        return {
            "success": True,
            "driver_id": driver["driver_id"],
            "message": "Driver registration submitted. Verification pending."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/driver/me")
async def get_my_driver_profile(
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Returns the authenticated user's driver profile if they have one.
    Used by the /become-a-driver landing page to detect the
    'pending_review' / 'approved' state and surface the correct CTA.
    """
    try:
        user_id = current_user["user_id"]
        driver = await db.vibe_ridez_drivers.find_one(
            {"user_id": user_id},
            {"_id": 0},
        )
        return {"driver": driver}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/driver/{user_id}")
async def get_driver_profile(
    user_id: str,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Get driver profile (requires authentication)
    """
    try:
        # Verify the user can only access their own profile
        verify_user_id(user_id, current_user)
        
        driver = await db.vibe_ridez_drivers.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        return {"success": True, "driver": driver}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/driver/update")
async def update_driver_profile(
    bio: str = None,
    profile_photo: str = None,
    vehicle: Vehicle = None,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Update driver profile (requires authentication)
    """
    try:
        user_id = current_user["user_id"]
        
        update_fields = {}
        if bio is not None:
            update_fields["bio"] = bio
        if profile_photo is not None:
            update_fields["profile_photo"] = profile_photo
        if vehicle is not None:
            update_fields["vehicle"] = vehicle.dict()
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        result = await db.vibe_ridez_drivers.update_one(
            {"user_id": user_id},
            {"$set": update_fields}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        return {"success": True, "message": "Profile updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== RIDE ENDPOINTS ====================

@router.post("/ride/create")
async def create_ride(
    request_body: CreateRideRequest,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Post a new ride (requires authentication, driver only)
    """
    try:
        user_id = current_user["user_id"]
        
        # Get driver info - verify user is a registered driver
        driver = await db.vibe_ridez_drivers.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if not driver:
            raise HTTPException(status_code=403, detail="You must be a registered driver to create rides")
        
        if not driver.get("license_verified"):
            raise HTTPException(status_code=403, detail="Driver license not verified")
        
        # Create vehicle info string
        vehicle = driver["vehicle"]
        vehicle_info = f"{vehicle['year']} {vehicle['make']} {vehicle['model']} - {vehicle['color']}"
        
        ride = {
            "ride_id": str(uuid4()),
            "driver_id": driver["driver_id"],
            "driver_user_id": user_id,
            "driver_username": driver["username"],
            "driver_photo": driver.get("profile_photo"),
            "driver_rating": driver.get("rating", 5.0),
            "vehicle_info": vehicle_info,
            "pickup_location": request_body.pickup_location.dict(),
            "dropoff_location": request_body.dropoff_location.dict(),
            "departure_time": datetime.fromisoformat(request_body.departure_time.replace('Z', '+00:00')),
            "available_seats": request_body.available_seats,
            "price_per_seat": request_body.price_per_seat,
            "total_distance_miles": None,  # Calculate with Mapbox
            "estimated_duration_mins": None,  # Calculate with Mapbox
            "passenger_ids": [],
            "passenger_usernames": [],
            "max_passengers": request_body.available_seats,
            "status": "scheduled",
            "notes": request_body.notes,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.vibe_ridez_rides.insert_one(ride)
        
        return {
            "success": True,
            "ride_id": ride["ride_id"],
            "message": "Ride posted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rides/search")
async def search_rides(
    from_city: str = None,
    to_city: str = None,
    departure_date: str = None,
    min_seats: int = 1
) -> Dict[str, Any]:
    """
    Search for available rides
    """
    try:
        query = {
            "status": "scheduled",
            "available_seats": {"$gte": min_seats}
        }
        
        if from_city:
            query["pickup_location.city"] = {"$regex": from_city, "$options": "i"}
        
        if to_city:
            query["dropoff_location.city"] = {"$regex": to_city, "$options": "i"}
        
        if departure_date:
            # Search rides on specific date
            date_start = datetime.fromisoformat(departure_date + "T00:00:00+00:00")
            date_end = datetime.fromisoformat(departure_date + "T23:59:59+00:00")
            query["departure_time"] = {"$gte": date_start, "$lte": date_end}
        
        rides = await db.vibe_ridez_rides.find(
            query,
            {"_id": 0}
        ).sort("departure_time", 1).limit(50).to_list(length=50)
        
        return {
            "success": True,
            "rides": rides,
            "count": len(rides)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ride/{ride_id}")
async def get_ride(ride_id: str) -> Dict[str, Any]:
    """
    Get ride details
    """
    try:
        ride = await db.vibe_ridez_rides.find_one(
            {"ride_id": ride_id},
            {"_id": 0}
        )
        
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        
        return {"success": True, "ride": ride}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rides/driver/{driver_id}")
async def get_driver_rides(driver_id: str, status: str = None) -> Dict[str, Any]:
    """
    Get all rides for a driver
    """
    try:
        query = {"driver_id": driver_id}
        if status:
            query["status"] = status
        
        rides = await db.vibe_ridez_rides.find(
            query,
            {"_id": 0}
        ).sort("departure_time", -1).to_list(length=100)
        
        return {"success": True, "rides": rides}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== BOOKING ENDPOINTS ====================

@router.post("/ride/book")
async def book_ride(
    request_body: BookRideRequest,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Book a ride as passenger (requires authentication)
    """
    try:
        passenger_id = current_user["user_id"]
        passenger_username = current_user.get("name", "Passenger")
        
        # Get ride
        ride = await db.vibe_ridez_rides.find_one({"ride_id": request_body.ride_id})
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        
        # Check if user is trying to book their own ride
        if ride.get("driver_user_id") == passenger_id:
            raise HTTPException(status_code=400, detail="Cannot book your own ride")
        
        # Check availability
        if ride["available_seats"] < request_body.seats_requested:
            raise HTTPException(status_code=400, detail="Not enough seats available")
        
        if ride["status"] != "scheduled":
            raise HTTPException(status_code=400, detail="Ride is not available for booking")
        
        if passenger_id in ride["passenger_ids"]:
            raise HTTPException(status_code=400, detail="Already booked this ride")
        
        # Calculate price
        total_price = ride["price_per_seat"] * request_body.seats_requested

        # If paying in Vibez Coins, debit the wallet up-front. The frontend
        # catches the 402 and pops the top-up modal so the rider can recover
        # in two taps without leaving the booking page.
        coins_paid: Optional[int] = None
        if request_body.payment_method == "coins":
            from services.coin_wallet import usd_to_coins, debit_coins
            coins_due = usd_to_coins(float(total_price))
            debit = await debit_coins(
                db, passenger_id, coins_due,
                reason="vibe_ridez_seat_booking",
                metadata={
                    "ride_id": request_body.ride_id,
                    "seats": request_body.seats_requested,
                },
            )
            if not debit["ok"]:
                raise HTTPException(
                    status_code=402,
                    detail=f"Insufficient Vibez Coins (need ₵{coins_due}, have ₵{debit['balance_after']})",
                )
            coins_paid = coins_due

        # Create booking
        booking = {
            "booking_id": str(uuid4()),
            "ride_id": request_body.ride_id,
            "passenger_id": passenger_id,
            "passenger_username": passenger_username,
            "seats_booked": request_body.seats_requested,
            "price_paid": total_price,
            "payment_method": request_body.payment_method,
            "coins_paid": coins_paid,
            "status": "confirmed",
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.vibe_ridez_bookings.insert_one(booking)
        
        # Update ride
        await db.vibe_ridez_rides.update_one(
            {"ride_id": request_body.ride_id},
            {
                "$push": {
                    "passenger_ids": passenger_id,
                    "passenger_usernames": passenger_username
                },
                "$inc": {"available_seats": -request_body.seats_requested}
            }
        )
        
        return {
            "success": True,
            "booking_id": booking["booking_id"],
            "total_price": total_price,
            "message": "Ride booked successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/bookings/passenger/{passenger_id}")
async def get_passenger_bookings(
    passenger_id: str,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Get all bookings for a passenger (requires authentication)
    """
    try:
        # Verify the user can only access their own bookings
        verify_user_id(passenger_id, current_user)
        
        bookings = await db.vibe_ridez_bookings.find(
            {"passenger_id": passenger_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(length=100)
        
        # Get ride details for each booking
        for booking in bookings:
            ride = await db.vibe_ridez_rides.find_one(
                {"ride_id": booking["ride_id"]},
                {"_id": 0}
            )
            booking["ride_details"] = ride
        
        return {"success": True, "bookings": bookings}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/booking/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Cancel a booking (requires authentication)
    """
    try:
        user_id = current_user["user_id"]
        
        booking = await db.vibe_ridez_bookings.find_one({"booking_id": booking_id})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        if booking["passenger_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Update booking status
        await db.vibe_ridez_bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"status": "cancelled"}}
        )
        
        # Return seats to ride
        await db.vibe_ridez_rides.update_one(
            {"ride_id": booking["ride_id"]},
            {
                "$pull": {
                    "passenger_ids": booking["passenger_id"],
                    "passenger_usernames": booking["passenger_username"]
                },
                "$inc": {"available_seats": booking["seats_booked"]}
            }
        )
        
        return {"success": True, "message": "Booking cancelled"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== RATING ENDPOINTS ====================

@router.post("/rating/submit")
async def submit_rating(
    ride_id: str,
    to_user_id: str,
    rating: int,
    review: str = None,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Submit rating after ride (requires authentication)
    """
    try:
        from_user_id = current_user["user_id"]
        
        if rating < 1 or rating > 5:
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        
        # Create rating
        rating_doc = {
            "rating_id": str(uuid4()),
            "ride_id": ride_id,
            "from_user_id": from_user_id,
            "to_user_id": to_user_id,
            "rating": rating,
            "review": review,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.vibe_ridez_ratings.insert_one(rating_doc)
        
        # Update driver's average rating
        driver = await db.vibe_ridez_drivers.find_one({"user_id": to_user_id})
        if driver:
            # Calculate new average
            all_ratings = await db.vibe_ridez_ratings.find(
                {"to_user_id": to_user_id},
                {"rating": 1}
            ).to_list(length=1000)
            
            if all_ratings:
                avg_rating = sum(r["rating"] for r in all_ratings) / len(all_ratings)
                await db.vibe_ridez_drivers.update_one(
                    {"user_id": to_user_id},
                    {"$set": {"rating": round(avg_rating, 1)}}
                )
        
        return {"success": True, "message": "Rating submitted"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ratings/{user_id}")
async def get_user_ratings(
    user_id: str,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Get all ratings for a user/driver (requires authentication)
    """
    try:
        # Users can view ratings for any driver (public info for safety)
        # But we still require authentication to prevent abuse
        ratings = await db.vibe_ridez_ratings.find(
            {"to_user_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(50).to_list(length=50)
        
        return {"ratings": ratings}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== PAYMENT ENDPOINTS ====================

@router.post("/payment/create-checkout")
async def create_payment_checkout(
    ride_id: str,
    seats_requested: int = 1,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Create Stripe checkout session for ride payment
    """
    try:
        passenger_id = current_user["user_id"]
        
        # Get ride details
        ride = await db.vibe_ridez_rides.find_one(
            {"ride_id": ride_id},
            {"_id": 0}
        )
        
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        
        # Calculate total
        total_price = ride["price_per_seat"] * seats_requested
        # emergentintegrations expects amount in dollars, not cents
        
        # Create checkout session
        checkout_request = CheckoutSessionRequest(
            amount=total_price,
            currency="usd",
            success_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/vibe-ridez/payment/success?ride_id={ride_id}&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/vibe-ridez/payment/cancel?ride_id={ride_id}",
            metadata={
                "ride_id": ride_id,
                "passenger_id": passenger_id,
                "seats_requested": str(seats_requested),
                "driver_id": ride["driver_id"]
            }
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store payment intent
        await db.vibe_ridez_payments.insert_one({
            "payment_id": str(uuid4()),
            "ride_id": ride_id,
            "passenger_id": passenger_id,
            "driver_id": ride["driver_id"],
            "amount": total_price,
            "seats": seats_requested,
            "stripe_session_id": session.session_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "success": True,
            "session_id": session.session_id,
            "checkout_url": session.url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payment/status/{session_id}")
async def check_payment_status(
    session_id: str,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Check payment status
    """
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update payment record
        if status.status == "complete":
            payment = await db.vibe_ridez_payments.find_one(
                {"stripe_session_id": session_id}
            )
            
            if payment and payment["status"] == "pending":
                # Update payment status
                await db.vibe_ridez_payments.update_one(
                    {"stripe_session_id": session_id},
                    {"$set": {
                        "status": "paid",
                        "paid_at": datetime.now(timezone.utc)
                    }}
                )
                
                # Create booking (payment confirmed)
                booking = {
                    "booking_id": str(uuid4()),
                    "ride_id": payment["ride_id"],
                    "passenger_id": payment["passenger_id"],
                    "passenger_username": current_user.get("name", "Passenger"),
                    "seats_booked": payment["seats"],
                    "price_paid": payment["amount"],
                    "status": "confirmed",
                    "payment_id": payment["payment_id"],
                    "created_at": datetime.now(timezone.utc)
                }
                
                await db.vibe_ridez_bookings.insert_one(booking)
                
                # Update ride availability
                await db.vibe_ridez_rides.update_one(
                    {"ride_id": payment["ride_id"]},
                    {
                        "$push": {
                            "passenger_ids": payment["passenger_id"],
                            "passenger_usernames": current_user.get("name", "Passenger")
                        },
                        "$inc": {"available_seats": -payment["seats"]}
                    }
                )
        
        return {
            "success": True,
            "status": status.status,
            "payment_status": status.payment_status
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/payment/payout-driver/{ride_id}")
async def payout_driver(
    ride_id: str,
    current_user: dict = Depends(get_current_user_from_session)
):
    """
    Process payout to driver after ride completion (internal use)
    """
    try:
        # Verify ride is completed
        ride = await db.vibe_ridez_rides.find_one({"ride_id": ride_id})
        
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        
        if ride["status"] != "completed":
            raise HTTPException(status_code=400, detail="Ride not completed yet")
        
        # Get all paid bookings for this ride
        payments = await db.vibe_ridez_payments.find(
            {
                "ride_id": ride_id,
                "status": "paid",
                "payout_status": {"$exists": False}
            },
            {"_id": 0}
        ).to_list(length=100)
        
        total_payout = sum(p["amount"] for p in payments)
        platform_fee = total_payout * 0.15  # 15% platform fee
        driver_payout = total_payout - platform_fee
        
        # Mark payments as paid out
        for payment in payments:
            await db.vibe_ridez_payments.update_one(
                {"payment_id": payment["payment_id"]},
                {"$set": {
                    "payout_status": "completed",
                    "payout_amount": driver_payout,
                    "platform_fee": platform_fee,
                    "payout_at": datetime.now(timezone.utc)
                }}
            )
        
        # Update driver earnings
        await db.vibe_ridez_drivers.update_one(
            {"driver_id": ride["driver_id"]},
            {"$inc": {"total_earnings": driver_payout}}
        )
        
        return {
            "success": True,
            "total_collected": total_payout,
            "platform_fee": platform_fee,
            "driver_payout": driver_payout,
            "message": "Driver payout processed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
