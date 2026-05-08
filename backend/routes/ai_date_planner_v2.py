"""
AI Date Planner - Uses Gemini 2.5 Flash via Emergent LLM Key
Generates personalized date ideas based on user preferences
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import os
import json
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

router = APIRouter(prefix="/api/ai-date-planner", tags=["ai_date_planner"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'global_vibez_dsg')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Pydantic Models
class DatePlanRequest(BaseModel):
    user_id: str
    interests: List[str]  # e.g., ["food", "adventure", "culture"]
    location: str  # e.g., "San Francisco, CA"
    budget: str  # "low", "medium", "high", "luxury"
    date_type: str  # "first_date", "romantic", "fun", "adventurous"
    duration: str  # "2_hours", "half_day", "full_day"
    time_of_day: Optional[str] = "evening"  # "morning", "afternoon", "evening"

class DatePlan(BaseModel):
    plan_id: str
    user_id: str
    title: str
    description: str
    activities: List[dict]
    estimated_cost: str
    duration: str
    tips: List[str]
    created_at: str

_DATE_PLANNER_SYSTEM_MESSAGE = """You are an expert date planner specializing in creating memorable, personalized dating experiences. 
            Your role is to generate creative, practical, and romantic date ideas tailored to the user's preferences and budget.
            Always provide specific venue suggestions, activities, timing, and helpful tips.
            Format your response as a structured JSON with the following fields:
            - title: A catchy name for the date
            - description: A brief overview (2-3 sentences)
            - activities: Array of objects with {name, location, time, description, cost_estimate}
            - estimated_total_cost: Total estimated cost range
            - tips: Array of helpful tips for making the date special
            
            Return ONLY valid JSON, no markdown formatting."""


def _build_date_plan_prompt(req: "DatePlanRequest") -> str:
    """Build the user-side prompt for the date-plan LLM call."""
    return (
        f"Create a {req.date_type} date plan with the following requirements:\n\n"
        f"**Location:** {req.location}\n"
        f"**Budget:** {req.budget}\n"
        f"**Duration:** {req.duration}\n"
        f"**Time of Day:** {req.time_of_day}\n"
        f"**Interests:** {', '.join(req.interests)}\n\n"
        "Generate a detailed date itinerary with 2-4 activities that flow naturally. Include:\n"
        "1. Specific venue names (restaurants, parks, museums, etc.)\n"
        "2. Approximate timing for each activity\n"
        "3. Cost estimates\n"
        "4. Why each activity fits the date vibe\n"
        "5. Tips for making it special\n\n"
        "Return ONLY the JSON response, no additional text."
    )


def _parse_date_plan_response(response: str) -> dict:
    """Strip markdown fencing and json-load the LLM response. Raises HTTPException on failure."""
    cleaned = response.strip()
    if cleaned.startswith('```'):
        cleaned = '\n'.join(cleaned.split('\n')[1:-1])
    if cleaned.startswith('json'):
        cleaned = cleaned[4:].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"Failed to parse AI response: {response}")
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")


def _build_date_plan_doc(
    req: "DatePlanRequest", data: dict, plan_id: str,
) -> dict:
    """Compose the persistable date-plan document from the LLM-parsed JSON."""
    return {
        "id": plan_id,
        "user_id": req.user_id,
        "title": data.get("title", "Romantic Date"),
        "description": data.get("description", ""),
        "activities": data.get("activities", []),
        "estimated_cost": data.get("estimated_total_cost", ""),
        "duration": req.duration,
        "tips": data.get("tips", []),
        "request_params": {
            "interests": req.interests,
            "location": req.location,
            "budget": req.budget,
            "date_type": req.date_type,
            "time_of_day": req.time_of_day,
        },
        "is_favorite": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/generate")
async def generate_date_plan(request: DatePlanRequest) -> Dict[str, Any]:
    """Generate a personalized date plan using AI"""
    try:
        if not EMERGENT_LLM_KEY:
            raise HTTPException(status_code=500, detail="AI service not configured")

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"date_plan_{request.user_id}_{datetime.now(timezone.utc).timestamp()}",
            system_message=_DATE_PLANNER_SYSTEM_MESSAGE,
        ).with_model("gemini", "gemini-2.5-flash")

        prompt = _build_date_plan_prompt(request)
        response = await chat.send_message(UserMessage(text=prompt))
        data = _parse_date_plan_response(response)

        plan_id = f"plan_{request.user_id}_{datetime.now(timezone.utc).timestamp()}"
        date_plan = _build_date_plan_doc(request, data, plan_id)

        await db.date_plans.insert_one(date_plan)
        # MongoDB injects _id into the inserted dict — strip it before returning.
        date_plan.pop("_id", None)
        return {"success": True, "plan": date_plan}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating date plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/plans/{user_id}")
async def get_user_date_plans(user_id: str, limit: int = 20) -> Dict[str, Any]:
    """Get all date plans for a user"""
    try:
        plans = await db.date_plans.find({
            "user_id": user_id
        }, {"_id": 0}).sort("created_at", -1).to_list(limit)
        
        return {
            "success": True,
            "plans": plans,
            "count": len(plans)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/plan/{plan_id}")
async def get_date_plan(plan_id: str) -> Dict[str, Any]:
    """Get a specific date plan"""
    try:
        plan = await db.date_plans.find_one({"id": plan_id}, {"_id": 0})
        
        if not plan:
            raise HTTPException(status_code=404, detail="Date plan not found")
        
        return {
            "success": True,
            "plan": plan
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/plan/{plan_id}/favorite")
async def toggle_favorite(plan_id: str) -> Dict[str, Any]:
    """Toggle favorite status for a date plan"""
    try:
        plan = await db.date_plans.find_one({"id": plan_id}, {"_id": 0})
        
        if not plan:
            raise HTTPException(status_code=404, detail="Date plan not found")
        
        new_favorite_status = not plan.get("is_favorite", False)
        
        await db.date_plans.update_one(
            {"id": plan_id},
            {"$set": {"is_favorite": new_favorite_status}}
        )
        
        return {
            "success": True,
            "is_favorite": new_favorite_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/plan/{plan_id}")
async def delete_date_plan(plan_id: str) -> Dict[str, Any]:
    """Delete a date plan"""
    try:
        result = await db.date_plans.delete_one({"id": plan_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Date plan not found")
        
        return {
            "success": True,
            "message": "Date plan deleted"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/regenerate/{plan_id}")
async def regenerate_date_plan(plan_id: str) -> Dict[str, Any]:
    """Regenerate a date plan with same parameters"""
    try:
        # Get original plan
        original_plan = await db.date_plans.find_one({"id": plan_id}, {"_id": 0})
        
        if not original_plan:
            raise HTTPException(status_code=404, detail="Date plan not found")
        
        # Extract original parameters
        params = original_plan.get("request_params", {})
        
        # Create new request
        request = DatePlanRequest(
            user_id=original_plan["user_id"],
            interests=params.get("interests", []),
            location=params.get("location", ""),
            budget=params.get("budget", "medium"),
            date_type=params.get("date_type", "romantic"),
            duration=original_plan.get("duration", "half_day"),
            time_of_day=params.get("time_of_day", "evening")
        )
        
        # Generate new plan
        return await generate_date_plan(request)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
