from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone

class TriviaQuestion(BaseModel):
    id: str
    category: str
    difficulty: Literal["easy", "medium", "hard"]
    question: str
    options: List[dict]  # [{"id": "a", "text": "..."}, ...]
    correct_answer: str  # "a", "b", "c", or "d"
    explanation: Optional[str] = None

class TriviaGameConfig(BaseModel):
    category: Optional[str] = "mixed"  # "mixed" or specific category
    num_questions: int = 10
    difficulty: Optional[str] = "mixed"  # "mixed", "easy", "medium", "hard"

class TriviaGame(BaseModel):
    game_id: str
    user_id: str
    category: str
    num_questions: int
    questions: List[str]  # List of question IDs
    current_question_index: int = 0
    answers: List[dict] = []  # [{"question_id": "...", "user_answer": "a", "is_correct": bool, "time_taken": int}, ...]
    score: int = 0
    status: Literal["in_progress", "completed"] = "in_progress"
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class TriviaAnswer(BaseModel):
    question_id: str
    user_answer: str  # "a", "b", "c", or "d"
    time_taken: Optional[int] = None  # seconds taken to answer

class TriviaGameResult(BaseModel):
    game_id: str
    score: int
    total_questions: int
    correct_answers: int
    percentage: float
    time_taken: int  # total time in seconds
    category: str
    answers_detail: List[dict]
