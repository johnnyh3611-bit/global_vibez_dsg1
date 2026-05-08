from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import uuid
import os

router = APIRouter(prefix="/planner", tags=["date_planner"])

@router.post("/generate-date-plan")
async def generate_date_plan(request: Request) -> Dict[str, Any]:
    """Generate AI-powered date plan with restaurant integration"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    restaurant_id = body.get("restaurant_id")
    budget = body.get("budget", "moderate")
    location = body.get("location")
    
    db = get_database()
    
    # Get restaurant details
    restaurant = await db.restaurants.find_one(
        {"restaurant_id": restaurant_id},
        {"_id": 0}
    )
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Get user profile for personalization
    user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "interests": 1, "interest_categories": 1}
    )
    
    # Build AI prompt
    budget_map = {
        "economy": "budget-friendly (under $50 total)",
        "moderate": "moderate ($50-150 total)",
        "upscale": "upscale ($150-300 total)"
    }
    
    prompt = f"""Create a complete romantic date plan for a couple in {location or restaurant['city']}.

RESTAURANT DETAILS:
- Name: {restaurant['name']}
- Cuisine: {', '.join(restaurant.get('cuisine_type', []))}
- Ambiance: {', '.join(restaurant.get('ambiance', []))}
- Price Range: {restaurant.get('price_range')}
- Special: {restaurant.get('special_offers', 'None')}
- Address: {restaurant['address']}

REQUIREMENTS:
- Budget: {budget_map.get(budget, 'moderate')}
- Include this restaurant as the main dinner spot
- Suggest 2 activities: one before dinner (afternoon) and one after dinner (evening)
- Make it romantic and memorable

USER INTERESTS: {', '.join(user.get('interests', [])[:5]) if user else 'General'}

Generate a complete date itinerary in this JSON format:
{{
  "date_title": "Romantic evening title",
  "total_estimated_cost": "$120-150",
  "duration": "4-5 hours",
  "timeline": [
    {{
      "time": "5:00 PM",
      "activity": "Activity name",
      "location": "Place name",
      "description": "What to do",
      "duration": "1 hour",
      "cost": "$20-30",
      "why": "Why this fits the date"
    }}
  ],
  "restaurant_highlight": {{
    "time": "7:00 PM",
    "name": "{restaurant['name']}",
    "why_perfect": "Why this restaurant is perfect for the date",
    "recommended_dishes": ["dish1", "dish2"],
    "ambiance_note": "What makes the ambiance special"
  }},
  "tips": ["Tip 1", "Tip 2", "Tip 3"]
}}"""

    try:
        # Call OpenAI API
        from emergentintegrations.openai import chat_completion
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        response = chat_completion(
            api_key=api_key,
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a romantic date planning expert. Generate creative, memorable date plans with specific venues and activities."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            response_format={"type": "json_object"}
        )
        
        import json
        date_plan = json.loads(response["choices"][0]["message"]["content"])
        
        # Save date plan to database
        plan_id = f"plan_{uuid.uuid4().hex[:12]}"
        
        date_plan_record = {
            "plan_id": plan_id,
            "user_id": current_user.user_id,
            "restaurant_id": restaurant_id,
            "restaurant_name": restaurant['name'],
            "location": location or restaurant['city'],
            "budget": budget,
            "date_plan": date_plan,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.date_plans.insert_one(date_plan_record)
        
        return {
            "plan_id": plan_id,
            "restaurant": {
                "restaurant_id": restaurant_id,
                "name": restaurant['name'],
                "address": restaurant['address'],
                "city": restaurant['city'],
                "cover_photo": restaurant.get('cover_photo'),
                "cuisine_type": restaurant.get('cuisine_type', []),
                "ambiance": restaurant.get('ambiance', []),
                "price_range": restaurant.get('price_range')
            },
            "date_plan": date_plan
        }
        
    except Exception as e:
        print(f"Error generating date plan: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate date plan: {str(e)}")


@router.post("/accept-date-plan/{plan_id}")
async def accept_date_plan(plan_id: str, request: Request) -> Dict[str, Any]:
    """Accept a date plan and mark restaurant for review eligibility"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get plan
    plan = await db.date_plans.find_one({"plan_id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Date plan not found")
    
    if plan["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your date plan")
    
    # Update plan status
    await db.date_plans.update_one(
        {"plan_id": plan_id},
        {
            "$set": {
                "status": "accepted",
                "accepted_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Increment restaurant's date_plan_count
    await db.restaurants.update_one(
        {"restaurant_id": plan["restaurant_id"]},
        {"$inc": {"date_plan_count": 1}}
    )
    
    return {
        "message": "Date plan accepted! Enjoy your date!",
        "plan_id": plan_id,
        "restaurant_name": plan["restaurant_name"],
        "tip": "After your date, you can leave a verified review!"
    }


@router.post("/complete-date/{plan_id}")
async def complete_date(plan_id: str, request: Request) -> Dict[str, Any]:
    """Mark date as completed - enables review"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    plan = await db.date_plans.find_one({"plan_id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Date plan not found")
    
    if plan["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your date plan")
    
    await db.date_plans.update_one(
        {"plan_id": plan_id},
        {
            "$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "message": "Date marked as completed!",
        "can_review": True,
        "restaurant_id": plan["restaurant_id"]
    }
