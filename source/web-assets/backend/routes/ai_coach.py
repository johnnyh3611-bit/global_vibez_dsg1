from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import json
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY")

class ConversationMessage(BaseModel):
    sender: str
    text: str
    timestamp: Optional[str] = None

class DatingCoachRequest(BaseModel):
    match_profile: Dict
    conversation_history: List[ConversationMessage]

class DatingCoachResponse(BaseModel):
    suggestions: List[Dict]
    current_tip: Optional[str] = None

_FALLBACK_COACH_RESPONSE = {
    "suggestions": [
        {"text": "Tell me more about your interests!", "category": "question", "confidence": 75},
        {"text": "That's really interesting!", "category": "interest", "confidence": 80},
        {"text": "I'd love to hear more about that!", "category": "question", "confidence": 70},
    ],
    "current_tip": "Ask open-ended questions to keep the conversation flowing.",
}

_HARD_FALLBACK_RESPONSE = {
    "suggestions": [
        {"text": "What do you like to do for fun?", "category": "question", "confidence": 75},
        {"text": "I'd love to hear more about that!", "category": "interest", "confidence": 80},
        {"text": "That sounds amazing!", "category": "compliment", "confidence": 85},
    ],
    "current_tip": "Be genuine and show interest in what they're saying.",
}


def _build_coach_system_prompt(
    match_profile: Dict, history: List[ConversationMessage],
) -> str:
    """Compose the system prompt for the dating coach LLM call."""
    match_summary = (
        f"Match Profile:\n"
        f"- Name: {match_profile.get('name', 'Unknown')}\n"
        f"- Interests: {', '.join(match_profile.get('interests', []))}\n"
        f"- Bio: {match_profile.get('bio', 'No bio')}\n"
    )
    convo = "\n".join(f"{m.sender}: {m.text}" for m in history[-10:])
    return (
        "You are an expert AI Dating Coach. Your role is to provide helpful, "
        "natural conversation suggestions.\n\n"
        f"Context:\n{match_summary}\n"
        f"Recent Conversation:\n{convo}\n\n"
        "Provide 3-4 conversation suggestions that are natural and genuine.\n\n"
        "Respond in JSON format:\n"
        '{\n  "suggestions": [\n    {"text": "suggestion text", "category": "question", "confidence": 85}\n  ],\n'
        '  "current_tip": "one helpful tip"\n}\n'
    )


def _parse_coach_json(text: str) -> Optional[Dict]:
    """Pull the JSON block out of the LLM response, returning None on failure."""
    try:
        cleaned = text.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```")[1].split("```")[0].strip()
        return json.loads(cleaned)
    except (json.JSONDecodeError, IndexError, KeyError):
        return None


@router.post("/ai/dating-coach", response_model=DatingCoachResponse)
async def get_dating_coach_suggestions(request: DatingCoachRequest) -> Dict[str, Any]:
    """
    AI Dating Coach - Provides real-time conversation suggestions.
    Analyzes conversation history and match profile to generate helpful tips.
    """
    try:
        from source.web-assets.backend.services.ai_engine import LlmChat, UserMessage

        system_message = _build_coach_system_prompt(
            request.match_profile, request.conversation_history,
        )
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"dating_coach_{request.match_profile.get('user_id', 'anonymous')}",
            system_message=system_message,
        ).with_model("openai", "gpt-5.1")

        ai_response = await chat.send_message(UserMessage(
            text="Based on this conversation, provide suggestions in JSON format."
        ))
        parsed = _parse_coach_json(ai_response) or _FALLBACK_COACH_RESPONSE
        return DatingCoachResponse(**parsed)

    except Exception as e:
        print(f"AI Dating Coach error: {e}")
        return DatingCoachResponse(**_HARD_FALLBACK_RESPONSE)
