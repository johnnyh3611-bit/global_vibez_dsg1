from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional, Dict, Any
from utils.database import get_database, get_current_user
from models.trivia import TriviaGameConfig, TriviaAnswer
from data.trivia_questions import TRIVIA_QUESTIONS, TRIVIA_CATEGORIES
from datetime import datetime, timezone
import uuid
import secrets
import random
secure_random = secrets.SystemRandom()

router = APIRouter(prefix="/trivia", tags=["trivia"])

# ==================== HELPER FUNCTIONS ====================

def get_questions_by_criteria(category: str, difficulty: str, num_questions: int) -> List[dict]:
    """Get random questions based on category and difficulty"""
    filtered_questions = TRIVIA_QUESTIONS
    
    # Filter by category
    if category != "mixed":
        filtered_questions = [q for q in filtered_questions if q["category"] == category]
    
    # Filter by difficulty
    if difficulty != "mixed":
        filtered_questions = [q for q in filtered_questions if q["difficulty"] == difficulty]
    
    # If not enough questions, use all available
    if len(filtered_questions) < num_questions:
        num_questions = len(filtered_questions)
    
    # Randomly select questions
    selected = random.sample(filtered_questions, num_questions)
    return selected

def calculate_score(correct_answers: int, total_questions: int, difficulty: str = "mixed") -> int:
    """Calculate score based on correct answers and difficulty"""
    base_points = 10
    difficulty_multiplier = {"easy": 1, "medium": 1.5, "hard": 2, "mixed": 1.2}
    multiplier = difficulty_multiplier.get(difficulty, 1)
    return int(correct_answers * base_points * multiplier)

# ==================== ENDPOINTS ====================

@router.get("/categories")
async def get_trivia_categories() -> Dict[str, Any]:
    """Get all available trivia categories"""
    return {"categories": TRIVIA_CATEGORIES}

@router.post("/start")
async def start_trivia_game(config: TriviaGameConfig, request: Request) -> Dict[str, Any]:
    """Start a new trivia game"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get questions based on config
    questions = get_questions_by_criteria(
        config.category,
        config.difficulty,
        config.num_questions
    )
    
    if not questions:
        raise HTTPException(status_code=400, detail="No questions available for selected criteria")
    
    # Create game
    game_id = f"trivia_{uuid.uuid4().hex[:12]}"
    game = {
        "game_id": game_id,
        "user_id": current_user.user_id,
        "category": config.category,
        "difficulty": config.difficulty,
        "num_questions": len(questions),
        "questions": [q["id"] for q in questions],
        "question_data": questions,  # Store full question data
        "current_question_index": 0,
        "answers": [],
        "score": 0,
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None
    }
    
    await db.trivia_games.insert_one(game)
    
    # Return game info without correct answers
    return {
        "game_id": game_id,
        "category": config.category,
        "num_questions": len(questions),
        "first_question": {
            "id": questions[0]["id"],
            "category": questions[0]["category"],
            "difficulty": questions[0]["difficulty"],
            "question": questions[0]["question"],
            "options": questions[0]["options"],
            "question_number": 1
        }
    }

@router.get("/game/{game_id}")
async def get_trivia_game(game_id: str, request: Request) -> Dict[str, Any]:
    """Get current game state"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    game = await db.trivia_games.find_one(
        {"game_id": game_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # If game is completed, return results
    if game["status"] == "completed":
        return {
            "status": "completed",
            "score": game["score"],
            "total_questions": game["num_questions"],
            "correct_answers": len([a for a in game["answers"] if a["is_correct"]]),
            "game_id": game_id
        }
    
    # Return current question
    current_idx = game["current_question_index"]
    if current_idx >= len(game["question_data"]):
        raise HTTPException(status_code=400, detail="No more questions")
    
    current_question = game["question_data"][current_idx]
    
    return {
        "status": "in_progress",
        "game_id": game_id,
        "current_question": {
            "id": current_question["id"],
            "category": current_question["category"],
            "difficulty": current_question["difficulty"],
            "question": current_question["question"],
            "options": current_question["options"],
            "question_number": current_idx + 1,
            "total_questions": game["num_questions"]
        },
        "score": game["score"],
        "answers_count": len(game["answers"])
    }

@router.post("/game/{game_id}/answer")
async def submit_trivia_answer(game_id: str, answer: TriviaAnswer, request: Request) -> Dict[str, Any]:
    """Submit an answer for the current question"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    game = await db.trivia_games.find_one(
        {"game_id": game_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] == "completed":
        raise HTTPException(status_code=400, detail="Game already completed")
    
    # Get current question
    current_idx = game["current_question_index"]
    current_question = game["question_data"][current_idx]
    
    if current_question["id"] != answer.question_id:
        raise HTTPException(status_code=400, detail="Question ID mismatch")
    
    # Check if answer is correct
    is_correct = answer.user_answer == current_question["correct_answer"]
    
    # Calculate points
    points = 0
    if is_correct:
        difficulty_points = {"easy": 10, "medium": 15, "hard": 20}
        points = difficulty_points.get(current_question["difficulty"], 10)
    
    # Record answer
    answer_record = {
        "question_id": answer.question_id,
        "user_answer": answer.user_answer,
        "correct_answer": current_question["correct_answer"],
        "is_correct": is_correct,
        "points": points,
        "time_taken": answer.time_taken,
        "explanation": current_question.get("explanation")
    }
    
    # Update game
    new_score = game["score"] + points
    new_answers = game["answers"] + [answer_record]
    new_idx = current_idx + 1
    
    # Check if game is completed
    is_completed = new_idx >= game["num_questions"]
    
    update_data = {
        "answers": new_answers,
        "score": new_score,
        "current_question_index": new_idx
    }
    
    if is_completed:
        update_data["status"] = "completed"
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.trivia_games.update_one(
        {"game_id": game_id},
        {"$set": update_data}
    )
    
    # Prepare response
    response = {
        "is_correct": is_correct,
        "correct_answer": current_question["correct_answer"],
        "explanation": current_question.get("explanation"),
        "points_earned": points,
        "new_score": new_score,
        "question_number": current_idx + 1,
        "total_questions": game["num_questions"]
    }
    
    # If not completed, include next question
    if not is_completed:
        next_question = game["question_data"][new_idx]
        response["next_question"] = {
            "id": next_question["id"],
            "category": next_question["category"],
            "difficulty": next_question["difficulty"],
            "question": next_question["question"],
            "options": next_question["options"],
            "question_number": new_idx + 1
        }
    else:
        response["game_completed"] = True
        correct_count = len([a for a in new_answers if a["is_correct"]])
        response["final_results"] = {
            "score": new_score,
            "correct_answers": correct_count,
            "total_questions": game["num_questions"],
            "percentage": round((correct_count / game["num_questions"]) * 100, 1)
        }
    
    return response

@router.get("/game/{game_id}/results")
async def get_trivia_results(game_id: str, request: Request) -> Dict[str, Any]:
    """Get detailed results for a completed game"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    game = await db.trivia_games.find_one(
        {"game_id": game_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "completed":
        raise HTTPException(status_code=400, detail="Game not completed yet")
    
    # Calculate statistics
    correct_count = len([a for a in game["answers"] if a["is_correct"]])
    total_time = sum([a.get("time_taken", 0) for a in game["answers"]])
    
    # Get user name for leaderboard context
    user = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "name": 1}
    )
    
    return {
        "game_id": game_id,
        "user_name": user.get("name") if user else "Player",
        "score": game["score"],
        "total_questions": game["num_questions"],
        "correct_answers": correct_count,
        "incorrect_answers": game["num_questions"] - correct_count,
        "percentage": round((correct_count / game["num_questions"]) * 100, 1),
        "total_time": total_time,
        "category": game["category"],
        "difficulty": game.get("difficulty", "mixed"),
        "started_at": game["started_at"],
        "completed_at": game["completed_at"],
        "answers_detail": game["answers"]
    }

@router.get("/leaderboard")
async def get_trivia_leaderboard(category: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
    """Get global trivia leaderboard"""
    db = get_database()
    
    # Build query
    query = {"status": "completed"}
    if category and category != "mixed":
        query["category"] = category
    
    # Get top scores
    games = await db.trivia_games.find(query, {"_id": 0}).sort("score", -1).limit(limit).to_list(limit)
    
    # Enrich with user data
    leaderboard = []
    for game in games:
        user = await db.users.find_one(
            {"user_id": game["user_id"]},
            {"_id": 0, "name": 1, "picture": 1}
        )
        
        correct_count = len([a for a in game["answers"] if a["is_correct"]])
        
        leaderboard.append({
            "game_id": game["game_id"],
            "user_name": user.get("name", "Anonymous") if user else "Anonymous",
            "user_picture": user.get("picture") if user else None,
            "score": game["score"],
            "correct_answers": correct_count,
            "total_questions": game["num_questions"],
            "percentage": round((correct_count / game["num_questions"]) * 100, 1),
            "category": game["category"],
            "completed_at": game["completed_at"]
        })
    
    return {
        "leaderboard": leaderboard,
        "category": category or "all"
    }

@router.get("/stats")
async def get_user_trivia_stats(request: Request) -> Dict[str, Any]:
    """Get user's trivia statistics"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get all completed games for user
    games = await db.trivia_games.find(
        {"user_id": current_user.user_id, "status": "completed"},
        {"_id": 0}
    ).to_list(1000)
    
    if not games:
        return {
            "total_games": 0,
            "total_score": 0,
            "average_score": 0,
            "total_correct": 0,
            "total_questions": 0,
            "accuracy": 0,
            "best_score": 0,
            "favorite_category": None
        }
    
    # Calculate stats
    total_score = sum([g["score"] for g in games])
    total_correct = sum([len([a for a in g["answers"] if a["is_correct"]]) for g in games])
    total_questions = sum([g["num_questions"] for g in games])
    best_score = max([g["score"] for g in games])
    
    # Find favorite category
    category_counts = {}
    for game in games:
        cat = game["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1
    favorite_category = max(category_counts, key=category_counts.get) if category_counts else None
    
    return {
        "total_games": len(games),
        "total_score": total_score,
        "average_score": round(total_score / len(games), 1),
        "total_correct": total_correct,
        "total_questions": total_questions,
        "accuracy": round((total_correct / total_questions) * 100, 1) if total_questions > 0 else 0,
        "best_score": best_score,
        "favorite_category": favorite_category,
        "category_breakdown": category_counts
    }
