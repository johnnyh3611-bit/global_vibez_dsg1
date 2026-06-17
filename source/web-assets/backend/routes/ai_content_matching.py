"""
AI Content Matching System
Analyzes MY VIBEZ posts to find compatible users based on content style and interests
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone
import json
import os
from utils.database import get_database
from emergentintegrations.llm.chat import LlmChat, UserMessage
import secrets

secure_random = secrets.SystemRandom()

router = APIRouter(prefix="/ai-content-matching", tags=["ai_content_matching"])

# LLM configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Pydantic Models
class ContentAnalysisRequest(BaseModel):
    user_id: str
    force_refresh: bool = False

class CompatibilityRequest(BaseModel):
    user1_id: str
    user2_id: str

class FindMatchesRequest(BaseModel):
    user_id: str
    limit: int = 10

# ========== CONTENT ANALYSIS ==========

def _is_analysis_fresh(user: dict) -> bool:
    """True if the cached content_analysis is < 7 days old."""
    cached = user.get("content_analysis")
    if not cached or not cached.get("analyzed_at"):
        return False
    age_days = (
        datetime.now(timezone.utc)
        - datetime.fromisoformat(cached["analyzed_at"])
    ).days
    return age_days < 7


def _summarize_posts(posts: List[dict]) -> dict:
    """Roll up captions, tags, and content types from a list of posts."""
    summary = {
        "total_posts": len(posts),
        "captions": [p.get("caption", "") for p in posts if p.get("caption")],
        "tags": [],
        "content_types": [],
    }
    for post in posts:
        if post.get("tags"):
            summary["tags"].extend(post["tags"])
        summary["content_types"].append(post.get("type", "unknown"))
    return summary


def _build_analysis_prompt(summary: dict, post_count: int) -> str:
    return (
        f"Analyze this user's social media content and provide insights:\n\n"
        f"Posts: {post_count}\n"
        f"Captions: {summary['captions'][:10]}  \n"
        f"Tags: {list(set(summary['tags']))[:20]}\n"
        f"Content Types: {list(set(summary['content_types']))}\n\n"
        f"Provide a JSON response with:\n"
        f"1. \"interests\" - List of 5-10 main interests (e.g., \"gaming\", \"music\", \"travel\")\n"
        f"2. \"personality_traits\" - List of 5 personality traits (e.g., \"humorous\", \"adventurous\", \"creative\")\n"
        f"3. \"content_style\" - One of: \"casual\", \"professional\", \"artistic\", \"comedic\", \"inspirational\"\n"
        f"4. \"communication_style\" - One of: \"direct\", \"playful\", \"thoughtful\", \"energetic\"\n"
        f"5. \"summary\" - 2-sentence summary of this user's vibe\n\n"
        f"Return ONLY valid JSON."
    )


async def _run_ai_analysis(user_id: str, prompt: str) -> Optional[dict]:
    """Call the LLM and parse its JSON response. Returns None on any error."""
    try:
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"content_analysis_{user_id}",
            system_message="You are an expert at analyzing social media content "
                           "to understand user interests and personality. "
                           "Return ONLY valid JSON.",
        ).with_model("gemini", "gemini-2.5-flash")

        response = await llm.send_message(UserMessage(text=prompt))
        text = response.strip()
        if text.startswith("```json"):
            text = text.split("```json")[1].split("```")[0]
        elif text.startswith("```"):
            text = text.split("```")[1].split("```")[0]
        return json.loads(text)
    except Exception as e:
        print(f"AI analysis error: {e}")
        return None


def _fallback_analysis(summary: dict, post_count: int) -> dict:
    """Tag-based analysis used when the LLM call fails."""
    return {
        "interests": list(set(summary["tags"]))[:10],
        "personality_traits": ["creative", "social", "expressive"],
        "content_style": "casual",
        "communication_style": "playful",
        "summary": f"Active creator with {post_count} posts sharing diverse content.",
    }


@router.post("/analyze-content")
async def analyze_user_content(request: ContentAnalysisRequest) -> Dict[str, Any]:
    """Analyze a user's MY VIBEZ posts using AI to extract interests and personality traits"""
    try:
        db = get_database()
        user = await db.users.find_one({"user_id": request.user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not request.force_refresh and _is_analysis_fresh(user):
            return {
                "success": True,
                "analysis": user["content_analysis"],
                "message": "Using cached analysis",
            }

        posts = await db.my_vibez.find(
            {"user_id": request.user_id}, {"_id": 0},
        ).sort("created_at", -1).limit(20).to_list(20)

        if not posts:
            return {
                "success": False,
                "message": "User has no MY VIBEZ posts to analyze",
            }

        summary = _summarize_posts(posts)
        prompt = _build_analysis_prompt(summary, len(posts))
        analysis = await _run_ai_analysis(request.user_id, prompt) \
            or _fallback_analysis(summary, len(posts))

        analysis["analyzed_at"] = datetime.now(timezone.utc).isoformat()
        analysis["posts_analyzed"] = len(posts)

        await db.users.update_one(
            {"user_id": request.user_id},
            {"$set": {"content_analysis": analysis}},
        )
        return {
            "success": True,
            "analysis": analysis,
            "message": "Content analyzed successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== COMPATIBILITY CALCULATION ==========

@router.post("/calculate-compatibility")
async def calculate_compatibility(request: CompatibilityRequest) -> Dict[str, Any]:
    """Calculate compatibility score between two users based on their content"""
    try:
        db = get_database()
        
        # Get both users' analyses
        user1 = await db.users.find_one({"user_id": request.user1_id}, {"_id": 0})
        user2 = await db.users.find_one({"user_id": request.user2_id}, {"_id": 0})
        
        if not user1 or not user2:
            raise HTTPException(status_code=404, detail="User not found")
        
        analysis1 = user1.get("content_analysis")
        analysis2 = user2.get("content_analysis")
        
        if not analysis1 or not analysis2:
            return {
                "success": False,
                "message": "One or both users need content analysis first"
            }
        
        # Calculate compatibility score
        score = 0
        insights = []
        
        # Shared interests (40% weight)
        shared_interests = set(analysis1.get("interests", [])) & set(analysis2.get("interests", []))
        if shared_interests:
            score += len(shared_interests) * 8  # Max 40 points for 5 shared interests
            insights.append(f"Shared interests: {', '.join(list(shared_interests)[:3])}")
        
        # Personality compatibility (30% weight)
        traits1 = set(analysis1.get("personality_traits", []))
        traits2 = set(analysis2.get("personality_traits", []))
        shared_traits = traits1 & traits2
        if shared_traits:
            score += len(shared_traits) * 6  # Max 30 points for 5 shared traits
            insights.append(f"Similar personalities: {', '.join(list(shared_traits)[:2])}")
        
        # Content style compatibility (20% weight)
        if analysis1.get("content_style") == analysis2.get("content_style"):
            score += 20
            insights.append(f"Both have {analysis1['content_style']} content style")
        
        # Communication style (10% weight)
        if analysis1.get("communication_style") == analysis2.get("communication_style"):
            score += 10
            insights.append("Compatible communication styles")
        
        # Cap at 100
        score = min(score, 100)
        
        # Generate AI match insight
        match_insight = generate_match_insight(analysis1, analysis2, shared_interests)
        
        return {
            "success": True,
            "compatibility_score": score,
            "insights": insights,
            "match_insight": match_insight,
            "shared_interests": list(shared_interests)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== FIND MATCHES ==========

@router.post("/find-matches")
async def find_content_matches(request: FindMatchesRequest) -> Dict[str, Any]:
    """Find compatible users based on content analysis"""
    try:
        db = get_database()
        
        # Get requesting user's analysis
        user = await db.users.find_one({"user_id": request.user_id}, {"_id": 0})
        if not user or not user.get("content_analysis"):
            raise HTTPException(status_code=400, detail="User needs content analysis first")
        
        user_analysis = user["content_analysis"]
        user_interests = set(user_analysis.get("interests", []))
        
        # Find users with content analysis and shared interests
        all_users = await db.users.find(
            {
                "user_id": {"$ne": request.user_id},
                "content_analysis": {"$exists": True}
            },
            {"_id": 0}
        ).limit(100).to_list(100)
        
        # Calculate compatibility with each user
        matches = []
        for other_user in all_users:
            other_analysis = other_user.get("content_analysis", {})
            other_interests = set(other_analysis.get("interests", []))
            
            # Quick compatibility check
            shared = user_interests & other_interests
            if len(shared) > 0:
                # Calculate full compatibility
                compatibility_result = await calculate_compatibility(
                    CompatibilityRequest(
                        user1_id=request.user_id,
                        user2_id=other_user["user_id"]
                    )
                )
                
                if compatibility_result["success"]:
                    matches.append({
                        "user_id": other_user["user_id"],
                        "name": other_user.get("name", "User"),
                        "compatibility_score": compatibility_result["compatibility_score"],
                        "insights": compatibility_result["insights"],
                        "match_insight": compatibility_result["match_insight"],
                        "shared_interests": compatibility_result["shared_interests"]
                    })
        
        # Sort by compatibility score
        matches.sort(key=lambda x: x["compatibility_score"], reverse=True)
        
        return {
            "success": True,
            "matches": matches[:request.limit],
            "count": len(matches)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== HELPER FUNCTIONS ==========

def generate_match_insight(analysis1: Dict, analysis2: Dict, shared_interests: set) -> str:
    """Generate a human-readable match insight"""
    if not shared_interests:
        return "You both have unique content styles that could complement each other!"
    
    interests_str = ", ".join(list(shared_interests)[:3])
    
    insights = [
        f"You both love {interests_str}! Perfect match for shared activities.",
        f"Your mutual interest in {interests_str} creates great conversation starters.",
        f"Both passionate about {interests_str} - you'll never run out of things to talk about!",
        f"Compatible vibes! You both enjoy {interests_str} and have similar content styles."
    ]
    
    import secrets
    return secrets.choice(insights)

# ========== ADMIN/DEBUG ==========

@router.get("/stats")
async def get_matching_stats() -> Dict[str, Any]:
    """Get AI content matching statistics"""
    try:
        db = get_database()
        
        total_users = await db.users.count_documents({})
        analyzed_users = await db.users.count_documents({"content_analysis": {"$exists": True}})
        
        return {
            "success": True,
            "total_users": total_users,
            "analyzed_users": analyzed_users,
            "analysis_coverage": f"{(analyzed_users/total_users*100):.1f}%" if total_users > 0 else "0%"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
