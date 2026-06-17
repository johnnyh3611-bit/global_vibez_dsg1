"""
Dynamic Pricing System
Surge pricing for premium rooms during peak hours
Feature #5 of 35
"""
from typing import Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timezone

router = APIRouter(prefix="/dynamic-pricing", tags=["pricing"])

# Base prices for different room types
BASE_PRICES = {
    "standard": 0,      # Free
    "premium": 10.00,   # $10 entry
    "vip": 25.00,       # $25 entry
    "diamond": 50.00    # $50 entry
}

# Peak hours (UTC): 18:00 - 02:00 (6 PM - 2 AM)
PEAK_HOURS = list(range(18, 24)) + list(range(0, 3))

# Weekend multiplier
WEEKEND_MULTIPLIER = 1.3

# High demand multiplier (when room is >80% full)
HIGH_DEMAND_MULTIPLIER = 1.5

class GetPriceRequest(BaseModel):
    room_type: str
    current_occupancy: int
    max_occupancy: int

@router.post("/calculate-price")
async def calculate_dynamic_price(request: GetPriceRequest) -> Dict[str, Any]:
    """
    Calculate current price for a room based on:
    - Time of day (peak hours)
    - Day of week (weekends)
    - Current demand (occupancy)
    """
    base_price = BASE_PRICES.get(request.room_type, 0)
    
    # Start with base price
    current_price = base_price
    multipliers = []
    
    # Peak hours multiplier
    current_hour = datetime.now(timezone.utc).hour
    if current_hour in PEAK_HOURS:
        current_price *= 1.25
        multipliers.append("Peak Hours (+25%)")
    
    # Weekend multiplier
    day_of_week = datetime.now(timezone.utc).weekday()
    if day_of_week >= 5:  # Saturday = 5, Sunday = 6
        current_price *= WEEKEND_MULTIPLIER
        multipliers.append(f"Weekend (+{int((WEEKEND_MULTIPLIER - 1) * 100)}%)")
    
    # High demand multiplier
    occupancy_rate = request.current_occupancy / request.max_occupancy
    if occupancy_rate > 0.8:
        current_price *= HIGH_DEMAND_MULTIPLIER
        multipliers.append(f"High Demand (+{int((HIGH_DEMAND_MULTIPLIER - 1) * 100)}%)")
    
    return {
        "success": True,
        "room_type": request.room_type,
        "base_price": base_price,
        "current_price": round(current_price, 2),
        "multipliers_applied": multipliers,
        "occupancy_rate": round(occupancy_rate * 100, 1),
        "is_peak_time": current_hour in PEAK_HOURS
    }

@router.get("/pricing-schedule")
async def get_pricing_schedule() -> Dict[str, Any]:
    """Get pricing schedule and rules"""
    return {
        "success": True,
        "base_prices": BASE_PRICES,
        "peak_hours_utc": PEAK_HOURS,
        "weekend_multiplier": WEEKEND_MULTIPLIER,
        "high_demand_threshold": 0.8,
        "high_demand_multiplier": HIGH_DEMAND_MULTIPLIER
    }

@router.get("/current-prices")
async def get_all_current_prices() -> Dict[str, Any]:
    """Get current prices for all room types"""
    # db = get_database()  # Reserved for future database price calculation
    
    prices = {}
    for room_type in BASE_PRICES:
        # Get average occupancy from database (simplified)
        avg_occupancy = 0.6  # TODO: Calculate from actual room data
        
        price_calc = await calculate_dynamic_price(GetPriceRequest(
            room_type=room_type,
            current_occupancy=int(avg_occupancy * 100),
            max_occupancy=100
        ))
        
        prices[room_type] = price_calc
    
    return {
        "success": True,
        "prices": prices,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
