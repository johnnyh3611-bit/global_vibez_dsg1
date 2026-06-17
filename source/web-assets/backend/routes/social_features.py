"""
Private Vibe Suite & Winner's Circle
Advanced social features for dating and post-game interactions
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from datetime import datetime
import uuid

# 2026-05-16 — `get_database` was being called on every route below
# but never imported, which would 500 every request to this router.
# Discovered via code-review audit + pyflakes scan; pinned by
# `test_no_actual_eval_builtin_in_backend`/social-features regression.
from utils.database import get_database

router = APIRouter()

# Active private suites — Mongo-backed (May 2026 lockdown)
# These dicts are kept ONLY for legacy `from social_features import PRIVATE_SUITES`
# style imports elsewhere in the codebase. All real state is in Mongo.
PRIVATE_SUITES: Dict[str, Any] = {}
WINNER_INTERVIEWS: Dict[str, Any] = {}

class PrivateSuiteRequest(BaseModel):
    player1_id: str
    player2_id: str
    suite_type: str = "glass"  # glass, luxury, neon, cosmic
    game_preferences: Optional[List[str]] = ["Bid_Whist", "Matrix_TicTacToe"]

class WinnerInterviewRequest(BaseModel):
    table_id: str
    winner_id: str
    game_type: str
    final_score: Optional[str] = None

# ============================================================================
# PRIVATE VIBE SUITE
# ============================================================================

@router.post("/suite/create")
async def create_private_suite(request: PrivateSuiteRequest) -> Dict[str, Any]:
    """
    Create a private suite for 2 players (dating mode)
    Isolated instance with custom atmosphere
    """
    suite_id = str(uuid.uuid4())
    
    suite = {
        "suite_id": suite_id,
        "player1_id": request.player1_id,
        "player2_id": request.player2_id,
        "suite_type": request.suite_type,
        "game_preferences": request.game_preferences,
        "created_at": datetime.now().isoformat(),
        "status": "ACTIVE",
        "location": {
            "z_offset": 5000,  # UE5: 5000 units above main hub
            "instance_id": f"suite_{suite_id[:8]}"
        },
        "atmosphere": get_suite_atmosphere(request.suite_type),
        "shared_wallet": 0.0,  # Partner mode: shared coin pool
        "vibe_score": 0  # Increases with successful interactions
    }
    
    PRIVATE_SUITES_DB = get_database().social_private_suites
    await PRIVATE_SUITES_DB.insert_one({**suite})

    return {
        "success": True,
        "suite_id": suite_id,
        "teleport_coordinates": {
            "player1": [0, 0, 5100],
            "player2": [100, 0, 5100]
        },
        "atmosphere": suite["atmosphere"],
        "message": f"Private {request.suite_type} suite created. Enjoy your time together!"
    }

@router.get("/suite/{suite_id}/state")
async def get_suite_state(suite_id: str) -> Dict[str, Any]:
    """Get current private suite state"""
    suite = await get_database().social_private_suites.find_one({"suite_id": suite_id}, {"_id": 0})
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")

    return {
        "suite_id": suite_id,
        "players": [suite["player1_id"], suite["player2_id"]],
        "status": suite["status"],
        "vibe_score": suite["vibe_score"],
        "shared_wallet": suite["shared_wallet"],
        "atmosphere": suite["atmosphere"],
        "uptime_minutes": calculate_uptime(suite["created_at"])
    }

@router.post("/suite/{suite_id}/close")
async def close_suite(suite_id: str) -> Dict[str, Any]:
    """Close private suite and return players to main hub"""
    db = get_database()
    suite = await db.social_private_suites.find_one({"suite_id": suite_id}, {"_id": 0})
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")

    await db.social_private_suites.update_one(
        {"suite_id": suite_id},
        {"$set": {"status": "CLOSED", "closed_at": datetime.now().isoformat()}},
    )

    # Award bonus coins for time spent together
    time_bonus = calculate_time_bonus(suite["created_at"])
    vibe_bonus = suite["vibe_score"] * 10

    return {
        "success": True,
        "time_spent_minutes": calculate_uptime(suite["created_at"]),
        "time_bonus": time_bonus,
        "vibe_bonus": vibe_bonus,
        "total_earnings": time_bonus + vibe_bonus,
        "message": "Suite closed. Hope you had a great vibe!"
    }

@router.post("/suite/{suite_id}/vibe-boost")
async def boost_vibe_score(suite_id: str, action: str) -> Dict[str, Any]:
    """
    Increase vibe score for positive interactions
    Actions: gift_sent, game_won_together, chat_reaction, compliment
    """
    db = get_database()
    suite = await db.social_private_suites.find_one({"suite_id": suite_id}, {"_id": 0})
    if not suite:
        raise HTTPException(status_code=404, detail="Suite not found")

    vibe_points = {
        "gift_sent": 5,
        "game_won_together": 10,
        "chat_reaction": 2,
        "compliment": 3,
        "song_shared": 4
    }

    points = vibe_points.get(action, 1)
    new_score = int(suite.get("vibe_score", 0)) + points
    await db.social_private_suites.update_one(
        {"suite_id": suite_id},
        {"$inc": {"vibe_score": points}},
    )

    return {
        "action": action,
        "points_earned": points,
        "total_vibe_score": new_score,
        "vibe_tier": get_vibe_tier(new_score)
    }

# ============================================================================
# WINNER'S CIRCLE INTERVIEW
# ============================================================================

@router.post("/winners-circle/start")
async def start_winner_interview(request: WinnerInterviewRequest) -> Dict[str, Any]:
    """
    Start post-game dealer interview with winner
    Live-streamed to spectators
    """
    interview_id = str(uuid.uuid4())
    
    interview = {
        "interview_id": interview_id,
        "table_id": request.table_id,
        "winner_id": request.winner_id,
        "game_type": request.game_type,
        "final_score": request.final_score,
        "started_at": datetime.now().isoformat(),
        "status": "LIVE",
        "questions_asked": [],
        "spectator_count": 0,
        "dealer_animation": "MT_Interview_Focus"
    }
    
    WINNER_INTERVIEWS[interview_id] = interview  # legacy mirror
    await get_database().social_winner_interviews.insert_one({**interview})

    # Generate interview questions based on game type
    questions = generate_interview_questions(request.game_type, request.final_score)
    
    return {
        "success": True,
        "interview_id": interview_id,
        "status": "LIVE",
        "dealer_message": "Congratulations on your victory! Let's talk about that game.",
        "questions": questions,
        "dealer_camera_target": request.winner_id  # UE5: Dealer looks at winner
    }

@router.post("/winners-circle/{interview_id}/answer")
async def record_answer(interview_id: str, question_index: int, answer: str) -> Dict[str, Any]:
    """Record player's answer to interview question"""
    db = get_database()
    interview = await db.social_winner_interviews.find_one({"interview_id": interview_id}, {"_id": 0})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    new_q = {
        "question_index": question_index,
        "answer": answer,
        "timestamp": datetime.now().isoformat(),
    }
    await db.social_winner_interviews.update_one(
        {"interview_id": interview_id},
        {"$push": {"questions_asked": new_q}},
    )

    # Dealer reaction based on answer length/quality
    if len(answer) > 50:
        dealer_reaction = "MT_Approving_Nod"
        message = "Great insight! The crowd loves it."
    else:
        dealer_reaction = "MT_Encouraging_Smile"
        message = "Tell us more about that move."

    return {
        "recorded": True,
        "dealer_animation": dealer_reaction,
        "dealer_message": message,
        "next_question_index": question_index + 1
    }

@router.post("/winners-circle/{interview_id}/end")
async def end_interview(interview_id: str) -> Dict[str, Any]:
    """End winner's circle interview"""
    db = get_database()
    interview = await db.social_winner_interviews.find_one({"interview_id": interview_id}, {"_id": 0})
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    ended_at = datetime.now().isoformat()
    await db.social_winner_interviews.update_one(
        {"interview_id": interview_id},
        {"$set": {"status": "COMPLETED", "ended_at": ended_at}},
    )

    questions_count = len(interview.get("questions_asked", []))
    fame_points = questions_count * 10

    return {
        "success": True,
        "duration_minutes": calculate_uptime(interview["started_at"]),
        "questions_answered": questions_count,
        "fame_points_earned": fame_points,
        "dealer_message": "Thank you for sharing your strategy with us. Congratulations again!",
        "dealer_animation": "MT_Farewell_Bow"
    }

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_suite_atmosphere(suite_type: str) -> Dict:
    """Define atmosphere settings for different suite types"""
    atmospheres = {
        "glass": {
            "lighting": "soft_cyan",
            "music": "ambient_chill",
            "particle_effects": "floating_crystals",
            "table_material": "holographic_glass"
        },
        "luxury": {
            "lighting": "warm_gold",
            "music": "smooth_jazz",
            "particle_effects": "gold_sparkles",
            "table_material": "polished_mahogany"
        },
        "neon": {
            "lighting": "vibrant_purple",
            "music": "synthwave",
            "particle_effects": "neon_trails",
            "table_material": "glowing_acrylic"
        },
        "cosmic": {
            "lighting": "deep_space",
            "music": "ethereal_ambient",
            "particle_effects": "stars_nebula",
            "table_material": "cosmic_marble"
        }
    }
    
    return atmospheres.get(suite_type, atmospheres["glass"])

def calculate_uptime(created_at: str) -> int:
    """Calculate minutes since creation"""
    from datetime import datetime
    start = datetime.fromisoformat(created_at)
    now = datetime.now()
    delta = now - start
    return int(delta.total_seconds() / 60)

def calculate_time_bonus(created_at: str) -> float:
    """Award bonus coins for time spent in suite"""
    minutes = calculate_uptime(created_at)
    # 10 GV Coins per minute, max 500
    return min(minutes * 10, 500)

def get_vibe_tier(score: int) -> str:
    """Get vibe tier based on score"""
    if score >= 100:
        return "Cosmic Connection"
    elif score >= 50:
        return "High Vibe"
    elif score >= 20:
        return "Good Energy"
    else:
        return "Getting Started"

def generate_interview_questions(game_type: str, final_score: str) -> List[str]:
    """Generate game-specific interview questions"""
    questions = {
        "Poker_Holdem": [
            "What was your strategy for that final hand?",
            "Did you bluff at any point during the game?",
            "How did you read your opponents?"
        ],
        "Bid_Whist": [
            "That ten-for-200 bid was bold! What made you go for it?",
            "How did you decide what to bury from the kitty?",
            "Downtown or Uptown - which do you prefer and why?"
        ],
        "Matrix_TicTacToe": [
            "How did you navigate around the blockers?",
            "What was your winning strategy?",
            "Did you plan your moves ahead or play reactively?"
        ],
        "Baccarat": [
            "Banker or Player - where do you usually bet?",
            "What's your approach to the third-card rules?",
            "Any superstitions you follow at the table?"
        ]
    }
    
    return questions.get(game_type, [
        "How did it feel to win?",
        "What was the turning point of the game?",
        "Any advice for players watching?"
    ])
