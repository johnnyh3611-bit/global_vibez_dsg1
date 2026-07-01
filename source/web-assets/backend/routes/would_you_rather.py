from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from utils.database import get_database, get_current_user
from data.new_games_data import WOULD_YOU_RATHER_QUESTIONS
from datetime import datetime, timezone
import secrets
secure_random = secrets.SystemRandom()

router = APIRouter(prefix="/games/would-you-rather", tags=["would_you_rather"])

# ==================== MODELS ====================

class VoteSubmission(BaseModel):
    question_id: str
    choice: str  # 'a' or 'b'
    opponent_id: Optional[str] = None  # For 1v1 games

# ==================== ENDPOINTS ====================

@router.get("/random")
async def get_random_question(request: Request) -> Dict[str, Any]:
    """Get a random Would You Rather question"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Select random question
    question = secure_random.choice(WOULD_YOU_RATHER_QUESTIONS)
    
    return {
        "question": question,
        "game_type": "would_you_rather"
    }

@router.get("/question/{question_id}")
async def get_question(question_id: str, request: Request) -> Dict[str, Any]:
    """Get a specific question"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find question by ID
    question = next((q for q in WOULD_YOU_RATHER_QUESTIONS if q["id"] == question_id), None)
    
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    return {
        "question": question,
        "game_type": "would_you_rather"
    }

@router.post("/vote")
async def submit_vote(vote: VoteSubmission, request: Request) -> Dict[str, Any]:
    """Submit a vote for a Would You Rather question"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Find the question
    question = next((q for q in WOULD_YOU_RATHER_QUESTIONS if q["id"] == vote.question_id), None)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Check if already voted
    existing_vote = await db.wyr_votes.find_one({
        "user_id": current_user.user_id,
        "question_id": vote.question_id
    })
    
    if existing_vote:
        # Update vote
        await db.wyr_votes.update_one(
            {"user_id": current_user.user_id, "question_id": vote.question_id},
            {"$set": {
                "choice": vote.choice,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Create new vote
        vote_record = {
            "vote_id": f"wyr_{datetime.now(timezone.utc).timestamp()}",
            "user_id": current_user.user_id,
            "question_id": vote.question_id,
            "choice": vote.choice,
            "opponent_id": vote.opponent_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.wyr_votes.insert_one(vote_record)
    
    # Get vote statistics
    total_votes = await db.wyr_votes.count_documents({"question_id": vote.question_id})
    option_a_votes = await db.wyr_votes.count_documents({
        "question_id": vote.question_id,
        "choice": "a"
    })
    option_b_votes = total_votes - option_a_votes
    
    percentage_a = (option_a_votes / total_votes * 100) if total_votes > 0 else 0
    percentage_b = (option_b_votes / total_votes * 100) if total_votes > 0 else 0
    
    # Check if opponent voted (for 1v1 mode)
    opponent_voted = False
    opponent_choice = None
    match_result = None
    
    if vote.opponent_id:
        opponent_vote = await db.wyr_votes.find_one({
            "user_id": vote.opponent_id,
            "question_id": vote.question_id
        })
        
        if opponent_vote:
            opponent_voted = True
            opponent_choice = opponent_vote.get("choice")
            
            # Determine if choices match
            if opponent_choice == vote.choice:
                match_result = "match"  # Both chose same option
            else:
                match_result = "different"  # Different choices
    
    return {
        "vote_recorded": True,
        "your_choice": vote.choice,
        "statistics": {
            "total_votes": total_votes,
            "option_a": {
                "votes": option_a_votes,
                "percentage": round(percentage_a, 1)
            },
            "option_b": {
                "votes": option_b_votes,
                "percentage": round(percentage_b, 1)
            }
        },
        "opponent_voted": opponent_voted,
        "opponent_choice": opponent_choice if opponent_voted else None,
        "match_result": match_result
    }

@router.get("/stats/{question_id}")
async def get_question_stats(question_id: str, request: Request) -> Dict[str, Any]:
    """Get voting statistics for a question"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get vote statistics
    total_votes = await db.wyr_votes.count_documents({"question_id": question_id})
    option_a_votes = await db.wyr_votes.count_documents({
        "question_id": question_id,
        "choice": "a"
    })
    option_b_votes = total_votes - option_a_votes
    
    percentage_a = (option_a_votes / total_votes * 100) if total_votes > 0 else 0
    percentage_b = (option_b_votes / total_votes * 100) if total_votes > 0 else 0
    
    # Check if current user voted
    user_vote = await db.wyr_votes.find_one({
        "user_id": current_user.user_id,
        "question_id": question_id
    })
    
    return {
        "question_id": question_id,
        "total_votes": total_votes,
        "option_a": {
            "votes": option_a_votes,
            "percentage": round(percentage_a, 1)
        },
        "option_b": {
            "votes": option_b_votes,
            "percentage": round(percentage_b, 1)
        },
        "user_voted": user_vote is not None,
        "user_choice": user_vote.get("choice") if user_vote else None
    }

@router.get("/my-votes")
async def get_my_votes(request: Request, limit: int = 20) -> Dict[str, Any]:
    """Get user's voting history"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    votes = await db.wyr_votes.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enhance with question data
    for vote in votes:
        question = next((q for q in WOULD_YOU_RATHER_QUESTIONS if q["id"] == vote["question_id"]), None)
        if question:
            vote["question_text"] = question["question"]
            vote["option_a_text"] = question["option_a"]
            vote["option_b_text"] = question["option_b"]
    
    return votes
