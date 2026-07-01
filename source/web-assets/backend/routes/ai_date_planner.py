from fastapi import APIRouter, HTTPException, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from services.ai_engine import LlmChat, UserMessage
import json

load_dotenv()

router = APIRouter(prefix="/ai-date-planner", tags=["ai_date_planner"])


# ==================== MODELS ====================

class DatePlanRequest(BaseModel):
    match_id: str
    preferences: Optional[dict] = None  # Optional custom preferences


class DatePlan(BaseModel):
    plan_id: str
    match_id: str
    restaurant_suggestion: dict
    activity_suggestion: dict
    game_suggestion: dict
    full_itinerary: str
    created_at: str


# ==================== AI DATE PLANNER ====================

# ────────────────────────────────────────────────── Prompt template
_DATE_PLAN_PROMPT_TEMPLATE = """You are an expert date planner for Global Vibez DSG, a dating and gaming platform.

Create a personalized date plan for two people based on their profiles:

**Person 1:**
- Name: {u1_name}
- Age: {u1_age}
- Location: {u1_location}
- Interests: {u1_interests}
- Favorite Games: {u1_games}
- Bio: {u1_bio}

**Person 2:**
- Name: {u2_name}
- Age: {u2_age}
- Location: {u2_location}
- Interests: {u2_interests}
- Favorite Games: {u2_games}
- Bio: {u2_bio}

Available Games on Platform (52 total):
Card Games: UNO, Poker, Blackjack, Hearts, Spades, Go Fish, Crazy Eights, Rummy, Gin Rummy, War, Solitaire
Board Games: Chess, Checkers, Connect 4, Tic-Tac-Toe, Reversi
Casino: Roulette, Slots, Darts
Party: Trivia, Truth or Dare, Two Truths & A Lie

Generate a complete date plan with:

1. **Restaurant Suggestion**: Name, type of cuisine, vibe/atmosphere, why it's perfect for them, price range
2. **Activity Suggestion**: An activity or location to visit together (based on their interests), why it's fun, duration
3. **Game Suggestion**: Pick ONE game from the platform they should play together (either as icebreaker or after date), explain why
4. **Full Itinerary**: A complete timeline for the date (e.g., 6pm restaurant, 8pm activity, 9pm game together online)

Be creative, personalized, and enthusiastic! Match their energy and interests.

Return ONLY a JSON object with this exact structure:
{{
  "restaurant": {{
    "name": "Restaurant name",
    "cuisine": "Type of cuisine",
    "vibe": "Atmosphere description",
    "reason": "Why perfect for them",
    "price_range": "$ or $$ or $$$"
  }},
  "activity": {{
    "name": "Activity name",
    "description": "What they'll do",
    "reason": "Why it matches their interests",
    "duration": "How long (e.g., 1-2 hours)"
  }},
  "game": {{
    "name": "Game name (must be from available games list)",
    "game_type": "uno/poker/chess/etc (lowercase, matching platform)",
    "reason": "Why this game for them",
    "when": "When to play (during date, after, as icebreaker)"
  }},
  "itinerary": "Full detailed timeline of the date"
}}
"""

# ────────────────────────────────────────────────── Fallback (LLM unavailable / unparseable)
_FALLBACK_DATE_PLAN: Dict[str, Any] = {
    "restaurant": {
        "name": "Cozy Corner Bistro",
        "cuisine": "Modern American",
        "vibe": "Relaxed and intimate",
        "reason": "Perfect for getting to know each other",
        "price_range": "$$",
    },
    "activity": {
        "name": "Evening Walk",
        "description": "Scenic neighborhood stroll",
        "reason": "Great for conversation",
        "duration": "30-45 minutes",
    },
    "game": {
        "name": "UNO",
        "game_type": "uno",
        "reason": "Fun, fast-paced icebreaker game",
        "when": "After dinner to keep the conversation flowing",
    },
    "itinerary": (
        "6:00 PM - Dinner at restaurant\n"
        "8:00 PM - Activity together\n"
        "9:00 PM - Play UNO online to end the night on a fun note!"
    ),
}


def _profile_fields(profile: dict, default_name: str) -> Dict[str, str]:
    """Stringify a user profile into the placeholders our prompt expects."""
    return {
        "name": profile.get("username") or default_name,
        "age": str(profile.get("age", "N/A")),
        "location": profile.get("location") or "Not specified",
        "interests": ", ".join(profile.get("interests", [])) or "Not specified",
        "games": ", ".join(profile.get("favorite_games", [])) or "Not specified",
        "bio": profile.get("bio") or "Not specified",
    }


def _build_date_plan_prompt(user1: dict, user2: dict) -> str:
    """Compose the GPT prompt — pure, no I/O."""
    u1 = _profile_fields(user1, "User 1")
    u2 = _profile_fields(user2, "User 2")
    return _DATE_PLAN_PROMPT_TEMPLATE.format(
        u1_name=u1["name"], u1_age=u1["age"], u1_location=u1["location"],
        u1_interests=u1["interests"], u1_games=u1["games"], u1_bio=u1["bio"],
        u2_name=u2["name"], u2_age=u2["age"], u2_location=u2["location"],
        u2_interests=u2["interests"], u2_games=u2["games"], u2_bio=u2["bio"],
    )


def _parse_ai_json_response(response_text: str) -> Optional[Dict[str, Any]]:
    """Strip markdown fences and parse JSON. Returns None if unparseable so
    callers can fall back to the static plan."""
    text = response_text.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


async def _ask_llm_for_date_plan(prompt: str) -> str:
    """Single-shot GPT-5.2 call — extracted so tests can monkeypatch easily."""
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    chat = LlmChat(
        api_key=api_key,
        session_id=f"date_plan_{datetime.now().timestamp()}",
        system_message="You are an expert date planner. Always return valid JSON in your responses.",
    ).with_model("openai", "gpt-5.2")
    return await chat.send_message(UserMessage(text=prompt))


async def generate_date_plan(
    user1_profile: dict,
    user2_profile: dict,
    preferences: Optional[dict] = None,  # noqa: ARG001 — reserved for future use
) -> dict:
    """Generate a personalized date plan via GPT-5.2.

    Pipeline: build prompt → call LLM → parse JSON → fall back if unparseable.
    Each step is its own helper so the orchestration here stays readable.
    """
    prompt = _build_date_plan_prompt(user1_profile, user2_profile)
    response = await _ask_llm_for_date_plan(prompt)
    plan = _parse_ai_json_response(response)
    if plan is None:
        print(f"Failed to parse AI response: {response}")
        return _FALLBACK_DATE_PLAN
    return plan


# ==================== ENDPOINTS ====================

@router.post("/generate")
async def create_date_plan(request_data: DatePlanRequest, request: Request) -> Dict[str, Any]:
    """Generate AI-powered date plan for a match"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get match
    match = await db.matches.find_one({
        "match_id": request_data.match_id,
        "both_ids": current_user.user_id
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Get the other user ID
    other_user_id = [uid for uid in match["both_ids"] if uid != current_user.user_id][0]
    
    # Get both user profiles
    user1 = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    user2 = await db.users.find_one({"user_id": other_user_id}, {"_id": 0})
    
    if not user1 or not user2:
        raise HTTPException(status_code=404, detail="User profiles not found")
    
    # Generate date plan with AI
    try:
        ai_plan = await generate_date_plan(user1, user2, request_data.preferences)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to generate date plan. Please try again.")
    
    # Save date plan to database
    date_plan = {
        "plan_id": f"plan_{datetime.now().timestamp()}",
        "match_id": request_data.match_id,
        "user1_id": current_user.user_id,
        "user2_id": other_user_id,
        "restaurant": ai_plan.get("restaurant", {}),
        "activity": ai_plan.get("activity", {}),
        "game": ai_plan.get("game", {}),
        "itinerary": ai_plan.get("itinerary", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.user_id
    }
    
    await db.date_plans.insert_one(date_plan)
    
    return {
        "plan_id": date_plan["plan_id"],
        "restaurant": date_plan["restaurant"],
        "activity": date_plan["activity"],
        "game": date_plan["game"],
        "itinerary": date_plan["itinerary"],
        "message": "🤖 AI Date Plan generated! Ready to make it happen?"
    }


@router.get("/plans/{match_id}")
async def get_date_plans(match_id: str, request: Request) -> Dict[str, Any]:
    """Get all date plans for a specific match"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Verify match exists and user is part of it
    match = await db.matches.find_one({
        "match_id": match_id,
        "both_ids": current_user.user_id
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Get all plans for this match
    plans = await db.date_plans.find({
        "match_id": match_id
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return {"plans": plans, "total": len(plans)}


@router.delete("/plans/{plan_id}")
async def delete_date_plan(plan_id: str, request: Request) -> Dict[str, Any]:
    """Delete a date plan (creator only)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Verify plan exists and user created it
    plan = await db.date_plans.find_one({
        "plan_id": plan_id,
        "created_by": current_user.user_id
    }, {"_id": 0})
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found or not authorized")
    
    await db.date_plans.delete_one({"plan_id": plan_id})
    
    return {"message": "Date plan deleted"}


@router.get("/stats")
async def get_planner_stats(request: Request) -> Dict[str, Any]:
    """Get user's AI Date Planner statistics"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    plans_created = await db.date_plans.count_documents({
        "created_by": current_user.user_id
    })
    
    plans_for_user = await db.date_plans.count_documents({
        "$or": [
            {"user1_id": current_user.user_id},
            {"user2_id": current_user.user_id}
        ]
    })
    
    return {
        "plans_created": plans_created,
        "total_plans": plans_for_user,
        "ai_powered": True
    }
