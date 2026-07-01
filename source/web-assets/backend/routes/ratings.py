"""
Driver Ratings & Reviews System
Rate drivers after rides, view ratings, calculate averages
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
from utils.database import get_database, get_current_user

router = APIRouter(prefix="/ratings", tags=["ratings"])

class RideRatingRequest(BaseModel):
    ride_id: str
    driver_id: str
    rating: int  # 1-5 stars
    review_text: Optional[str] = None
    review_tags: Optional[List[str]] = None  # ["safe_driving", "friendly", "clean_vehicle", "on_time"]

class DriverRatingResponse(BaseModel):
    driver_id: str
    average_rating: float
    total_ratings: int
    rating_breakdown: dict  # {5: 10, 4: 5, 3: 2, 2: 1, 1: 0}
    recent_reviews: List[dict]

# ==================== SUBMIT RATING ====================

@router.post("/ride")
async def rate_ride(rating_data: RideRatingRequest, request: Request) -> Dict[str, Any]:
    """Submit a rating for a completed ride"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Validate rating range
    if not (1 <= rating_data.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    # Check if ride exists and user was the passenger
    ride = await db.rides.find_one({
        "ride_id": rating_data.ride_id,
        "passenger_id": current_user.user_id
    }, {"_id": 0})
    
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or you were not the passenger")
    
    # Check if ride is completed
    if ride.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed rides")
    
    # Check if user already rated this ride
    existing_rating = await db.ride_ratings.find_one({
        "ride_id": rating_data.ride_id,
        "passenger_id": current_user.user_id
    }, {"_id": 0})
    
    if existing_rating:
        raise HTTPException(status_code=400, detail="You have already rated this ride")
    
    # Create rating
    rating = {
        "rating_id": f"rating_{uuid.uuid4().hex[:16]}",
        "ride_id": rating_data.ride_id,
        "driver_id": rating_data.driver_id,
        "passenger_id": current_user.user_id,
        "rating": rating_data.rating,
        "review_text": rating_data.review_text,
        "review_tags": rating_data.review_tags or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "helpful_count": 0
    }
    
    await db.ride_ratings.insert_one(rating)
    
    # Update driver's average rating
    await update_driver_rating(db, rating_data.driver_id)
    
    return {
        "success": True,
        "message": "Rating submitted successfully",
        "rating": rating
    }


# ==================== GET DRIVER RATINGS ====================

@router.get("/driver/{driver_id}")
async def get_driver_ratings(driver_id: str, limit: int = 10) -> Dict[str, Any]:
    """Get ratings and reviews for a specific driver"""
    db = get_database()
    
    # Get all ratings for this driver
    all_ratings = await db.ride_ratings.find(
        {"driver_id": driver_id},
        {"_id": 0}
    ).to_list(1000)
    
    if not all_ratings:
        return {
            "driver_id": driver_id,
            "average_rating": 0,
            "total_ratings": 0,
            "rating_breakdown": {5: 0, 4: 0, 3: 0, 2: 0, 1: 0},
            "recent_reviews": []
        }
    
    # Calculate statistics
    total_ratings = len(all_ratings)
    average_rating = sum(r["rating"] for r in all_ratings) / total_ratings
    
    # Rating breakdown
    rating_breakdown = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    for rating in all_ratings:
        rating_breakdown[rating["rating"]] += 1
    
    # Get recent reviews with text
    recent_reviews = [
        r for r in all_ratings 
        if r.get("review_text")
    ]
    recent_reviews.sort(key=lambda x: x["created_at"], reverse=True)
    recent_reviews = recent_reviews[:limit]
    
    # Enrich with passenger info
    for review in recent_reviews:
        passenger = await db.users.find_one(
            {"user_id": review["passenger_id"]},
            {"_id": 0, "name": 1, "photos": 1}
        )
        if passenger:
            review["passenger_name"] = passenger.get("name", "Anonymous")
            review["passenger_photo"] = passenger.get("photos", [None])[0]
    
    return {
        "driver_id": driver_id,
        "average_rating": round(average_rating, 2),
        "total_ratings": total_ratings,
        "rating_breakdown": rating_breakdown,
        "recent_reviews": recent_reviews
    }


# ==================== GET MY RATINGS (AS DRIVER) ====================

@router.get("/my-ratings")
async def get_my_ratings(request: Request) -> Dict[str, Any]:
    """Get all ratings received as a driver"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if user is a driver
    driver = await db.drivers.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not driver:
        raise HTTPException(status_code=403, detail="You are not registered as a driver")
    
    # Get driver ratings
    ratings = await db.ride_ratings.find(
        {"driver_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate average
    if ratings:
        average_rating = sum(r["rating"] for r in ratings) / len(ratings)
    else:
        average_rating = 0
    
    # Enrich with passenger info
    for rating in ratings:
        passenger = await db.users.find_one(
            {"user_id": rating["passenger_id"]},
            {"_id": 0, "name": 1, "photos": 1}
        )
        if passenger:
            rating["passenger_name"] = passenger.get("name", "Anonymous")
            rating["passenger_photo"] = passenger.get("photos", [None])[0]
    
    return {
        "average_rating": round(average_rating, 2),
        "total_ratings": len(ratings),
        "ratings": ratings
    }


# ==================== HELPER FUNCTION ====================

async def update_driver_rating(db, driver_id: str) -> Dict[str, Any]:
    """Recalculate and update driver's average rating"""
    all_ratings = await db.ride_ratings.find(
        {"driver_id": driver_id},
        {"_id": 0, "rating": 1}
    ).to_list(1000)
    
    if all_ratings:
        average_rating = sum(r["rating"] for r in all_ratings) / len(all_ratings)
        total_ratings = len(all_ratings)
    else:
        average_rating = 0
        total_ratings = 0
    
    # Update driver record
    await db.drivers.update_one(
        {"user_id": driver_id},
        {"$set": {
            "average_rating": round(average_rating, 2),
            "total_ratings": total_ratings,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
