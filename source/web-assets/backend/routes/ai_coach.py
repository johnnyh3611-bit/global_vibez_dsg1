"""
AI Dating Coach — thin wrapper over the unified AI gateway.

Preserves ``POST /api/ai/dating-coach`` for existing clients.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from services import ai_gateway as gw

router = APIRouter()


class ConversationMessage(BaseModel):
    sender: str
    text: str
    timestamp: Optional[str] = None


class DatingCoachRequest(BaseModel):
    match_profile: Dict
    conversation_history: List[ConversationMessage]
    # Optional standard context packet
    context: Optional[Dict[str, Any]] = None


class DatingCoachResponse(BaseModel):
    suggestions: List[Dict]
    current_tip: Optional[str] = None


@router.post("/ai/dating-coach", response_model=DatingCoachResponse)
async def get_dating_coach_suggestions(request: DatingCoachRequest) -> Dict[str, Any]:
    """AI Dating Coach — always returns suggestions (gateway fallbacks on failure)."""
    history = [m.model_dump() for m in request.conversation_history]
    data = await gw.handle_dating_coach(
        match_profile=request.match_profile,
        conversation_history=history,
        context=request.context,
    )
    return DatingCoachResponse(
        suggestions=data.get("suggestions") or gw.COACH_FALLBACK["suggestions"],
        current_tip=data.get("current_tip") or gw.COACH_FALLBACK["current_tip"],
    )
