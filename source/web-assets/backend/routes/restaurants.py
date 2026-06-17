from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any
from utils.database import get_database, get_current_user
from models.restaurant import (
    RestaurantSubmission, MenuItemSubmission, 
    ReviewSubmission, RestaurantApproval
)
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/restaurants", tags=["restaurants"])

# ==================== PUBLIC ENDPOINTS ====================

@router.get("/list")
async def list_restaurants(
    city: Optional[str] = None,
    zip_code: Optional[str] = None,
    venue_type: Optional[str] = None,
    cuisine_type: Optional[str] = None,
    ambiance: Optional[str] = None,
    price_range: Optional[str] = None,
    user_lat: Optional[float] = None,
    user_lng: Optional[float] = None,
    radius_miles: float = 25,
    limit: int = 50
) -> Dict[str, Any]:
    """Get list of approved date spots with filters. Paid subscribers (Neon Purple Vibe-Ring) shown first in user's location."""
    db = get_database()
    
    query = {"listing_status": "approved"}
    
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if zip_code:
        query["zip_code"] = zip_code
    if venue_type and venue_type != "all":
        # "restaurant" or "entertainment" — entertainment covers bars, lounges,
        # live music, pool halls, bowling, arcades, clubs, rooftops.
        query["venue_type"] = venue_type
    if cuisine_type:
        query["cuisine_type"] = cuisine_type
    if ambiance:
        query["ambiance"] = ambiance
    if price_range:
        query["price_range"] = price_range
    
    # Get all matching restaurants
    all_restaurants = await db.restaurants.find(query, {"_id": 0}).to_list(limit * 2)
    
    # If user location provided, prioritize paid subscribers in their zone
    if user_lat is not None and user_lng is not None:
        import math
        
        def distance(lat1, lon1, lat2, lon2):
            """Calculate distance in miles between two points"""
            if lat2 is None or lon2 is None:
                return float('inf')
            R = 3959  # Earth radius in miles
            dlat = math.radians(lat2 - lat1)
            dlon = math.radians(lon2 - lon1)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            return R * c
        
        # Calculate distance and categorize
        nearby_paid = []
        nearby_free = []
        far_restaurants = []
        
        for restaurant in all_restaurants:
            dist = distance(user_lat, user_lng, restaurant.get("latitude"), restaurant.get("longitude"))
            restaurant["distance_miles"] = round(dist, 1) if dist != float('inf') else None
            
            if dist <= radius_miles:
                # Check if subscription is active
                now = datetime.now(timezone.utc).isoformat()
                is_paid = restaurant.get("subscription_active") and (
                    restaurant.get("subscription_expires_at") is None or 
                    restaurant.get("subscription_expires_at") > now
                )
                
                if is_paid:
                    nearby_paid.append(restaurant)
                else:
                    nearby_free.append(restaurant)
            else:
                far_restaurants.append(restaurant)
        
        # Sort each group by rating
        nearby_paid.sort(key=lambda x: x.get("average_rating", 0), reverse=True)
        nearby_free.sort(key=lambda x: x.get("average_rating", 0), reverse=True)
        far_restaurants.sort(key=lambda x: x.get("average_rating", 0), reverse=True)
        
        # Priority order: Nearby Paid → Nearby Free → Far Restaurants
        restaurants = (nearby_paid + nearby_free + far_restaurants)[:limit]
    else:
        # No location provided, just sort by subscription status then rating
        restaurants = sorted(
            all_restaurants,
            key=lambda x: (not x.get("subscription_active", False), -x.get("average_rating", 0))
        )[:limit]
    
    return {"restaurants": restaurants, "count": len(restaurants)}


@router.get("/promoted")
async def get_promoted_restaurants(limit: int = 10) -> Dict[str, Any]:
    """Get promoted/sponsored date spots"""
    db = get_database()
    
    now = datetime.now(timezone.utc).isoformat()
    
    restaurants = await db.restaurants.find(
        {
            "listing_status": "approved",
            "is_promoted": True,
            "$or": [
                {"promotion_expires_at": None},
                {"promotion_expires_at": {"$gt": now}}
            ]
        },
        {"_id": 0}
    ).sort("average_rating", -1).limit(limit).to_list(limit)
    
    return {"promoted_restaurants": restaurants, "count": len(restaurants)}


@router.get("/{restaurant_id}")
async def get_restaurant_detail(restaurant_id: str, request: Request) -> Dict[str, Any]:
    """Get restaurant details including menu and reviews.

    Shadow-gates restricted-category menu items (alcohol / tobacco) for
    users who haven't completed the 21+ Age Verification Protocol. Items
    are STRIPPED from the response (not just disabled) per the
    Legal_Age_Verification_Protocol.pdf spec.
    """
    db = get_database()
    
    restaurant = await db.restaurants.find_one(
        {"restaurant_id": restaurant_id},
        {"_id": 0}
    )
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Increment view count
    await db.restaurants.update_one(
        {"restaurant_id": restaurant_id},
        {"$inc": {"view_count": 1}}
    )
    
    # Get recent reviews
    reviews = await db.restaurant_reviews.find(
        {"restaurant_id": restaurant_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Enrich reviews with user info
    for review in reviews:
        user = await db.users.find_one(
            {"user_id": review["user_id"]},
            {"_id": 0, "name": 1, "picture": 1}
        )
        if user:
            review["user_name"] = user.get("name")
            review["user_picture"] = user.get("picture")
    
    restaurant["reviews"] = reviews

    # Age-verification shadow-gate. Logged-out users + unverified users
    # have alcohol/tobacco items removed entirely from the response.
    try:
        from services.age_verification import shadow_filter_menu, is_eligible_for_restricted, get_status as avp_status  # noqa: PLC0415
        viewer = await get_current_user(request)
        eligible = False
        if viewer:
            uid = getattr(viewer, "user_id", None) or getattr(viewer, "id", None)
            if uid:
                rec = await avp_status(db, str(uid))
                eligible = is_eligible_for_restricted(rec.get("age"), rec.get("status", "not_submitted"))
        menu_items = restaurant.get("menu_items") or []
        restaurant["menu_items"] = shadow_filter_menu(menu_items, eligible)
        restaurant["age_gate"] = {
            "eligible_for_restricted": eligible,
            "min_age": 21,
            "restricted_categories": ["alcohol", "tobacco"],
        }
    except Exception:
        # Never block the restaurant page on AVP plumbing issues — fall
        # back to filtering out restricted items if the gate can't decide.
        menu_items = restaurant.get("menu_items") or []
        restaurant["menu_items"] = [
            i for i in menu_items
            if str(i.get("category", "")).lower() not in ("alcohol", "tobacco")
        ]
        restaurant["age_gate"] = {
            "eligible_for_restricted": False,
            "min_age": 21,
            "restricted_categories": ["alcohol", "tobacco"],
        }
    
    return restaurant


# ==================== USER SUBMISSION ENDPOINTS ====================

@router.post("/submit")
async def submit_restaurant(submission: RestaurantSubmission, request: Request) -> Dict[str, Any]:
    """Submit a restaurant for listing (requires monthly subscription for priority)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check for duplicate submissions
    existing = await db.restaurants.find_one({
        "name": submission.name,
        "address": submission.address
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="This restaurant is already listed. Please search for it in the directory."
        )
    
    # Create restaurant record
    restaurant_id = f"rest_{uuid.uuid4().hex[:12]}"
    
    restaurant = {
        "restaurant_id": restaurant_id,
        "name": submission.name,
        "description": submission.description,
        "address": submission.address,
        "city": submission.city,
        "state": submission.state,
        "zip_code": submission.zip_code,
        "country": "USA",
        "phone": submission.phone,
        "email": submission.email,
        "website": submission.website,
        "reservation_link": submission.reservation_link,
        "cuisine_type": submission.cuisine_type,
        "ambiance": submission.ambiance,
        "price_range": submission.price_range,
        "average_meal_cost": submission.average_meal_cost,
        "photos": submission.photos,
        "cover_photo": submission.cover_photo,
        "menu_items": [],
        "special_offers": submission.special_offers,
        "features": submission.features,
        "hours_of_operation": submission.hours_of_operation,
        "submitted_by": current_user.user_id,
        "submitter_type": submission.submitter_type,
        "listing_status": "pending",  # Requires admin approval
        "subscription_active": False,  # Starts inactive until payment
        "monthly_subscription_fee": 49.99,  # $49.99/month for priority
        "subscription_started_at": None,
        "subscription_expires_at": None,
        "subscription_id": None,
        "is_promoted": False,
        "average_rating": 0.0,
        "review_count": 0,
        "view_count": 0,
        "date_plan_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.restaurants.insert_one(restaurant)
    
    return {
        "message": "Restaurant submitted successfully! Subscribe for priority placement in your zone.",
        "restaurant_id": restaurant_id,
        "monthly_subscription_fee": 49.99,
        "subscription_benefits": [
            "1st priority when users search in your location",
            "Featured in AI Date Planner suggestions",
            "Priority placement in 'near me' searches",
            "Analytics dashboard access"
        ]
    }


@router.post("/{restaurant_id}/menu/add")
async def add_menu_item(restaurant_id: str, menu_item: MenuItemSubmission, request: Request) -> Dict[str, Any]:
    """Add menu item to restaurant"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if user owns this restaurant
    restaurant = await db.restaurants.find_one(
        {"restaurant_id": restaurant_id},
        {"_id": 0}
    )
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    if restaurant["submitted_by"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only add menu items to your own restaurant")
    
    # Create menu item
    item = {
        "item_id": f"item_{uuid.uuid4().hex[:8]}",
        "name": menu_item.name,
        "description": menu_item.description,
        "price": menu_item.price,
        "category": menu_item.category,
        "dietary_tags": menu_item.dietary_tags,
        "photo_url": menu_item.photo_url
    }
    
    # Add to restaurant
    await db.restaurants.update_one(
        {"restaurant_id": restaurant_id},
        {
            "$push": {"menu_items": item},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Menu item added successfully", "item": item}


# ==================== REVIEW ENDPOINTS ====================

@router.post("/{restaurant_id}/review")
async def submit_review(restaurant_id: str, review_data: ReviewSubmission, request: Request) -> Dict[str, Any]:
    """Submit a review for a restaurant (only if visited via AI date planner)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Check if restaurant exists
    restaurant = await db.restaurants.find_one({"restaurant_id": restaurant_id})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Verify user visited this restaurant via AI date planner
    date_plan = await db.date_plans.find_one({
        "user_id": current_user.user_id,
        "restaurants": restaurant_id,
        "status": "completed"
    })
    
    if not date_plan:
        raise HTTPException(
            status_code=403,
            detail="You can only review restaurants you visited through our AI Date Planner"
        )
    
    # Check if user already reviewed this restaurant
    existing_review = await db.restaurant_reviews.find_one({
        "user_id": current_user.user_id,
        "restaurant_id": restaurant_id
    })
    
    if existing_review:
        raise HTTPException(status_code=400, detail="You've already reviewed this restaurant")
    
    # Create review
    review_id = f"review_{uuid.uuid4().hex[:12]}"
    
    review = {
        "review_id": review_id,
        "restaurant_id": restaurant_id,
        "user_id": current_user.user_id,
        "rating": review_data.rating,
        "review_text": review_data.review_text,
        "photos": review_data.photos,
        "tags": review_data.tags,
        "date_visited": review_data.date_visited,
        "verified_visit": True,  # Always true since checked via date planner
        "helpful_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.restaurant_reviews.insert_one(review)
    
    # Update restaurant average rating
    all_reviews = await db.restaurant_reviews.find(
        {"restaurant_id": restaurant_id},
        {"_id": 0, "rating": 1}
    ).to_list(10000)
    
    if all_reviews:
        avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews)
        await db.restaurants.update_one(
            {"restaurant_id": restaurant_id},
            {
                "$set": {
                    "average_rating": round(avg_rating, 1),
                    "review_count": len(all_reviews)
                }
            }
        )
    
    return {"message": "Review submitted successfully", "review_id": review_id}


# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/pending")
async def get_pending_restaurants(request: Request, limit: int = 50) -> Dict[str, Any]:
    """Get pending restaurant submissions (ADMIN ONLY)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    
    db = get_database()
    
    # Show all pending submissions (subscription not required for approval)
    pending = await db.restaurants.find(
        {"listing_status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).limit(limit).to_list(limit)
    
    # Enrich with submitter info
    for restaurant in pending:
        user = await db.users.find_one(
            {"user_id": restaurant["submitted_by"]},
            {"_id": 0, "name": 1, "email": 1}
        )
        if user:
            restaurant["submitter_info"] = user
    
    return {"pending_restaurants": pending, "count": len(pending)}


@router.post("/admin/approve")
async def approve_restaurant(approval: RestaurantApproval, request: Request) -> Dict[str, Any]:
    """Approve or reject a restaurant listing (ADMIN ONLY)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    
    db = get_database()
    
    restaurant = await db.restaurants.find_one(
        {"restaurant_id": approval.restaurant_id},
        {"_id": 0}
    )
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    update_data = {
        "listing_status": approval.status,
        "approved_by": current_user.user_id,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if approval.status == "rejected":
        update_data["rejection_reason"] = approval.rejection_reason
    
    await db.restaurants.update_one(
        {"restaurant_id": approval.restaurant_id},
        {"$set": update_data}
    )
    
    return {
        "message": f"Restaurant {approval.status}",
        "restaurant_id": approval.restaurant_id
    }


@router.get("/admin/stats")
async def get_restaurant_stats(request: Request) -> Dict[str, Any]:
    """Get restaurant platform statistics (ADMIN ONLY)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Admin guard (May 2026 — security lockdown).
    from utils.admin_guard import is_admin
    current_user = await get_current_user(request)
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin only")
    
    db = get_database()
    
    total_restaurants = await db.restaurants.count_documents({})
    approved_restaurants = await db.restaurants.count_documents({"listing_status": "approved"})
    pending_restaurants = await db.restaurants.count_documents({"listing_status": "pending"})
    promoted_restaurants = await db.restaurants.count_documents({"is_promoted": True})
    total_reviews = await db.restaurant_reviews.count_documents({})
    
    return {
        "total_restaurants": total_restaurants,
        "approved_restaurants": approved_restaurants,
        "pending_restaurants": pending_restaurants,
        "promoted_restaurants": promoted_restaurants,
        "total_reviews": total_reviews
    }
