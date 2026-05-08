from fastapi import APIRouter, HTTPException, Request
from typing import List, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone, timedelta
from data.quiz_questions import FRIENDS_QUIZ, DATING_QUIZ

router = APIRouter(prefix="/quiz", tags=["compatibility_quiz"])

# ==================== MODELS ====================

class QuizAnswer(BaseModel):
    question_id: str
    selected_option: str  # option id (a, b, c, d, e)

class QuizSubmission(BaseModel):
    answers: List[QuizAnswer]

# ==================== HELPER FUNCTIONS ====================

def can_retake_quiz(last_taken_date) -> bool:
    """Check if user can retake quiz (3 months restriction)"""
    if not last_taken_date:
        return True
    
    if isinstance(last_taken_date, str):
        last_taken_date = datetime.fromisoformat(last_taken_date)
    
    if last_taken_date.tzinfo is None:
        last_taken_date = last_taken_date.replace(tzinfo=timezone.utc)
    
    three_months_ago = datetime.now(timezone.utc) - timedelta(days=90)
    return last_taken_date < three_months_ago

# ==================== ENDPOINTS ====================

@router.get("/status")
async def get_quiz_status(request: Request) -> Dict[str, Any]:
    """Get user's quiz completion status"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    user_doc = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "quiz_friends_completed": 1, "quiz_dating_completed": 1,
         "quiz_friends_last_taken": 1, "quiz_dating_last_taken": 1}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    friends_last_taken = user_doc.get("quiz_friends_last_taken")
    dating_last_taken = user_doc.get("quiz_dating_last_taken")
    
    return {
        "friends": {
            "completed": user_doc.get("quiz_friends_completed", False),
            "can_retake": can_retake_quiz(friends_last_taken),
            "last_taken": friends_last_taken
        },
        "dating": {
            "completed": user_doc.get("quiz_dating_completed", False),
            "can_retake": can_retake_quiz(dating_last_taken),
            "last_taken": dating_last_taken
        }
    }


@router.get("/friends/questions")
async def get_friends_quiz(request: Request) -> Dict[str, Any]:
    """Get friend compatibility quiz questions"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user can take quiz
    db = get_database()
    user_doc = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "quiz_friends_last_taken": 1}
    )
    
    if user_doc:
        last_taken = user_doc.get("quiz_friends_last_taken")
        if not can_retake_quiz(last_taken):
            raise HTTPException(
                status_code=403,
                detail="You can only retake this quiz every 3 months. This encourages honest answers!"
            )
    
    return {
        "quiz_type": "friends",
        "title": "Friend Compatibility Quiz",
        "description": "Help us find your perfect friend matches! Answer honestly - you can only retake this every 3 months.",
        "total_questions": len(FRIENDS_QUIZ),
        "questions": FRIENDS_QUIZ
    }


@router.get("/dating/questions")
async def get_dating_quiz(request: Request) -> Dict[str, Any]:
    """Get dating compatibility quiz questions"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user can take quiz
    db = get_database()
    user_doc = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, "quiz_dating_last_taken": 1}
    )
    
    if user_doc:
        last_taken = user_doc.get("quiz_dating_last_taken")
        if not can_retake_quiz(last_taken):
            raise HTTPException(
                status_code=403,
                detail="You can only retake this quiz every 3 months. This encourages honest answers!"
            )
    
    return {
        "quiz_type": "dating",
        "title": "Dating Compatibility Quiz",
        "description": "Find your ideal romantic match! Answer honestly - you can only retake this every 3 months.",
        "total_questions": len(DATING_QUIZ),
        "questions": DATING_QUIZ
    }


@router.post("/friends/submit")
async def submit_friends_quiz(submission: QuizSubmission, request: Request) -> Dict[str, Any]:
    """Submit friend compatibility quiz answers"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate answers count
    if len(submission.answers) != len(FRIENDS_QUIZ):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid number of answers. Expected {len(FRIENDS_QUIZ)}, got {len(submission.answers)}"
        )
    
    # Process answers and extract values
    processed_answers = {}
    for answer in submission.answers:
        # Find the question
        question = next((q for q in FRIENDS_QUIZ if q["id"] == answer.question_id), None)
        if not question:
            raise HTTPException(status_code=400, detail=f"Invalid question ID: {answer.question_id}")
        
        # Find the selected option
        option = next((opt for opt in question["options"] if opt["id"] == answer.selected_option), None)
        if not option:
            raise HTTPException(status_code=400, detail=f"Invalid option ID: {answer.selected_option}")
        
        processed_answers[answer.question_id] = {
            "question": question["question"],
            "category": question["category"],
            "selected_option": answer.selected_option,
            "value": option["value"],
            "text": option["text"]
        }
    
    # Store answers in database
    db = get_database()
    now = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "quiz_friends_answers": processed_answers,
            "quiz_friends_completed": True,
            "quiz_friends_last_taken": now
        }}
    )
    
    return {
        "message": "Quiz completed successfully!",
        "quiz_type": "friends",
        "completed_at": now,
        "next_retake_date": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
    }


@router.post("/dating/submit")
async def submit_dating_quiz(submission: QuizSubmission, request: Request) -> Dict[str, Any]:
    """Submit dating compatibility quiz answers"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Validate answers count
    if len(submission.answers) != len(DATING_QUIZ):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid number of answers. Expected {len(DATING_QUIZ)}, got {len(submission.answers)}"
        )
    
    # Process answers and extract values
    processed_answers = {}
    for answer in submission.answers:
        # Find the question
        question = next((q for q in DATING_QUIZ if q["id"] == answer.question_id), None)
        if not question:
            raise HTTPException(status_code=400, detail=f"Invalid question ID: {answer.question_id}")
        
        # Find the selected option
        option = next((opt for opt in question["options"] if opt["id"] == answer.selected_option), None)
        if not option:
            raise HTTPException(status_code=400, detail=f"Invalid option ID: {answer.selected_option}")
        
        processed_answers[answer.question_id] = {
            "question": question["question"],
            "category": question["category"],
            "selected_option": answer.selected_option,
            "value": option["value"],
            "text": option["text"]
        }
    
    # Store answers in database
    db = get_database()
    now = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "quiz_dating_answers": processed_answers,
            "quiz_dating_completed": True,
            "quiz_dating_last_taken": now
        }}
    )
    
    return {
        "message": "Quiz completed successfully!",
        "quiz_type": "dating",
        "completed_at": now,
        "next_retake_date": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
    }


@router.get("/my-answers/{quiz_type}")
async def get_my_quiz_answers(quiz_type: str, request: Request) -> Dict[str, Any]:
    """Get user's quiz answers"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if quiz_type not in ["friends", "dating"]:
        raise HTTPException(status_code=400, detail="Invalid quiz type")
    
    db = get_database()
    field_name = f"quiz_{quiz_type}_answers"
    
    user_doc = await db.users.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0, field_name: 1}
    )
    
    if not user_doc or not user_doc.get(field_name):
        raise HTTPException(status_code=404, detail="Quiz not completed yet")
    
    return {
        "quiz_type": quiz_type,
        "answers": user_doc[field_name]
    }
