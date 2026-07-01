from fastapi import APIRouter, HTTPException, Request
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import uuid
import secrets
secure_random = secrets.SystemRandom()
from data.dating_show_questions import (
    PARTNER_QUIZ_QUESTIONS,
    ICEBREAKER_QUESTIONS,
    COMPATIBILITY_QUESTIONS,
    COUPLES_TRIVIA,
    COUPLES_WOULD_YOU_RATHER
)

router = APIRouter(prefix="/dating-games", tags=["dating_games"])


# ==================== MODELS ====================

class StartDatingGame(BaseModel):
    game_type: str  # 'partner_quiz', 'icebreaker', 'compatibility', 'couples_trivia', 'would_you_rather'
    partner_id: str
    tournament_id: Optional[str] = None
    opponent_couple_ids: Optional[List[str]] = None  # [player1_id, player2_id]


class AnswerSubmission(BaseModel):
    game_id: str
    question_id: str
    answer: str
    player_id: str  # Which partner is answering


class ChatMessage(BaseModel):
    game_id: str
    message: str
    sender_id: str


class Reaction(BaseModel):
    game_id: str
    reaction: str  # 'love', 'laugh', 'surprise', 'thinking'
    sender_id: str


# ==================== ENDPOINTS ====================

@router.post("/start")
async def start_dating_game(game_data: StartDatingGame, request: Request) -> Dict[str, Any]:
    """Start a dating show-style game"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Verify match/friendship exists
    if game_data.game_type in ['partner_quiz', 'icebreaker', 'compatibility']:
        match = await db.matches.find_one({
            "both_ids": {"$all": [current_user.user_id, game_data.partner_id]}
        })
        if not match:
            raise HTTPException(status_code=400, detail="You must be matched with this person")
    
    # Select questions based on game type
    questions = []
    if game_data.game_type == 'partner_quiz':
        questions = secure_random.sample(PARTNER_QUIZ_QUESTIONS, min(10, len(PARTNER_QUIZ_QUESTIONS)))
    elif game_data.game_type == 'icebreaker':
        questions = secure_random.sample(ICEBREAKER_QUESTIONS, min(10, len(ICEBREAKER_QUESTIONS)))
    elif game_data.game_type == 'compatibility':
        questions = secure_random.sample(COMPATIBILITY_QUESTIONS, min(10, len(COMPATIBILITY_QUESTIONS)))
    elif game_data.game_type == 'couples_trivia':
        questions = secure_random.sample(COUPLES_TRIVIA, min(10, len(COUPLES_TRIVIA)))
    elif game_data.game_type == 'would_you_rather':
        questions = secure_random.sample(COUPLES_WOULD_YOU_RATHER, min(5, len(COUPLES_WOULD_YOU_RATHER)))
    
    # Create game
    game = {
        "game_id": f"dating_game_{uuid.uuid4().hex[:12]}",
        "game_type": game_data.game_type,
        "couple_1": [current_user.user_id, game_data.partner_id],
        "couple_2": game_data.opponent_couple_ids or [],
        "tournament_id": game_data.tournament_id,
        "questions": questions,
        "current_question": 0,
        "answers": {},  # {question_id: {player1_id: answer, player2_id: answer}}
        "scores": {
            "couple_1": 0,
            "couple_2": 0
        },
        "compatibility_score": 0,  # For compatibility game
        "status": "in_progress",
        "chat_messages": [],
        "reactions": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None
    }
    
    await db.dating_games.insert_one(game)
    
    return {
        "game_id": game["game_id"],
        "game_type": game_data.game_type,
        "questions": questions,
        "message": "Game started!"
    }


@router.get("/game/{game_id}")
async def get_dating_game(game_id: str, request: Request) -> Dict[str, Any]:
    """Get current game state"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    game = await db.dating_games.find_one({"game_id": game_id}, {"_id": 0})
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check if user is part of this game
    all_players = game["couple_1"] + game["couple_2"]
    if current_user.user_id not in all_players:
        raise HTTPException(status_code=403, detail="You are not part of this game")
    
    return game


@router.post("/answer")
async def submit_answer(answer: AnswerSubmission, request: Request) -> Dict[str, Any]:
    """Submit an answer to a question"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    game = await db.dating_games.find_one({"game_id": answer.game_id}, {"_id": 0})
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Game is not in progress")
    
    # Store answer
    if answer.question_id not in game["answers"]:
        game["answers"][answer.question_id] = {}
    
    game["answers"][answer.question_id][answer.player_id] = answer.answer
    
    # Calculate scores for different game types
    if game["game_type"] == "partner_quiz":
        # Check if partners' answers match
        question_answers = game["answers"][answer.question_id]
        if len(question_answers) == 2:
            # Both partners answered
            answers_list = list(question_answers.values())
            if answers_list[0].lower() == answers_list[1].lower():
                # Answers match! Award points
                if answer.player_id in game["couple_1"]:
                    game["scores"]["couple_1"] += 10
                else:
                    game["scores"]["couple_2"] += 10
    
    elif game["game_type"] == "couples_trivia":
        # Check if answer is correct
        question = next((q for q in game["questions"] if q["id"] == answer.question_id), None)
        if question and answer.answer == question["correct"]:
            if answer.player_id in game["couple_1"]:
                game["scores"]["couple_1"] += 10
            else:
                game["scores"]["couple_2"] += 10
    
    elif game["game_type"] == "compatibility":
        # Calculate compatibility when both answer
        question_answers = game["answers"][answer.question_id]
        if len(question_answers) == 2:
            answers_list = list(question_answers.values())
            if answers_list[0] == answers_list[1]:
                game["compatibility_score"] += 10
    
    # Check if all questions answered
    total_questions = len(game["questions"])
    total_players = len(game["couple_1"]) + len(game["couple_2"])
    expected_answers = total_questions * total_players
    current_answers = sum(len(answers) for answers in game["answers"].values())
    
    if current_answers >= expected_answers:
        game["status"] = "completed"
        game["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    # Update game
    await db.dating_games.update_one(
        {"game_id": answer.game_id},
        {"$set": {
            "answers": game["answers"],
            "scores": game["scores"],
            "compatibility_score": game["compatibility_score"],
            "status": game["status"],
            "completed_at": game.get("completed_at")
        }}
    )
    
    return {
        "success": True,
        "scores": game["scores"],
        "compatibility_score": game["compatibility_score"],
        "status": game["status"]
    }


@router.post("/chat")
async def send_chat_message(chat: ChatMessage, request: Request) -> Dict[str, Any]:
    """Send a chat message during the game (Premium Feature)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user has premium access for chat
    from utils.premium_features import can_use_chat, get_upgrade_message
    if not can_use_chat(current_user):
        upgrade_info = get_upgrade_message("tournament_chat")
        raise HTTPException(
            status_code=403, 
            detail={
                "error": "premium_required",
                "message": upgrade_info["message"],
                "description": upgrade_info["description"],
                "feature": upgrade_info["feature"],
                "min_tier": upgrade_info["min_tier"],
                "current_tier": current_user.subscription_tier
            }
        )
    
    db = get_database()
    
    message = {
        "message_id": str(uuid.uuid4()),
        "sender_id": chat.sender_id,
        "message": chat.message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.dating_games.update_one(
        {"game_id": chat.game_id},
        {"$push": {"chat_messages": message}}
    )
    
    return {"success": True, "message": message}


@router.post("/reaction")
async def send_reaction(reaction: Reaction, request: Request) -> Dict[str, Any]:
    """Send a reaction/emoji during the game"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    reaction_data = {
        "reaction_id": str(uuid.uuid4()),
        "sender_id": reaction.sender_id,
        "reaction": reaction.reaction,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.dating_games.update_one(
        {"game_id": reaction.game_id},
        {"$push": {"reactions": reaction_data}}
    )
    
    return {"success": True, "reaction": reaction_data}


@router.get("/stats/{user_id}")
async def get_dating_game_stats(user_id: str, request: Request) -> Dict[str, Any]:
    """Get user's dating game statistics"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get all completed games for this user
    games = await db.dating_games.find({
        "$or": [
            {"couple_1": user_id},
            {"couple_2": user_id}
        ],
        "status": "completed"
    }, {"_id": 0}).to_list(1000)
    
    total_games = len(games)
    wins = 0
    total_compatibility = 0
    
    for game in games:
        if user_id in game["couple_1"]:
            if game["scores"]["couple_1"] > game["scores"]["couple_2"]:
                wins += 1
        else:
            if game["scores"]["couple_2"] > game["scores"]["couple_1"]:
                wins += 1
        
        if game["game_type"] == "compatibility":
            total_compatibility += game.get("compatibility_score", 0)
    
    avg_compatibility = total_compatibility / total_games if total_games > 0 else 0
    
    return {
        "total_games": total_games,
        "wins": wins,
        "losses": total_games - wins,
        "win_rate": (wins / total_games * 100) if total_games > 0 else 0,
        "average_compatibility": avg_compatibility
    }
