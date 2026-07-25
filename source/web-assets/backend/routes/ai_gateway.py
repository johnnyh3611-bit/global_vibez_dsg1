"""
Unified AI gateway router — ``/api/ai/gateway/*``.

Conversational AI features enter here with a standard context packet:
``{ user_id, balance, mode, room_id, beta_flags }``.

Legacy URLs (``/api/ai/dating-coach``, ``/api/ai-date-planner/*``, …)
remain mounted and should call into ``services.ai_gateway`` handlers.
Vibe-Core stays a separate mediator for disputes/escrow/policy.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.ai_context import normalize_context
from services import ai_gateway as gw

router = APIRouter(prefix="/ai/gateway", tags=["AI Gateway"])


class ContextBody(BaseModel):
    user_id: str = "anonymous"
    balance: float = 0
    mode: str = "game"
    room_id: Optional[str] = None
    beta_flags: Dict[str, Any] = Field(default_factory=dict)


class CompleteRequest(BaseModel):
    system: str = Field(min_length=1, max_length=8000)
    user_text: str = Field(min_length=1, max_length=8000)
    context: Optional[ContextBody] = None
    session_id: Optional[str] = None
    max_tokens: int = Field(default=1024, ge=64, le=4096)
    expect_json: bool = False


class DatingCoachGatewayRequest(BaseModel):
    match_profile: Dict[str, Any]
    conversation_history: List[Dict[str, Any]] = Field(default_factory=list)
    context: Optional[ContextBody] = None


class DatePlanGatewayRequest(BaseModel):
    interests: List[str] = Field(default_factory=list)
    location: str = ""
    budget: str = "$$"
    date_type: str = "casual"
    duration: str = "2-3 hours"
    time_of_day: str = "evening"
    context: Optional[ContextBody] = None


class GuideGatewayRequest(BaseModel):
    room: str = "default"
    path: str = ""
    context: Optional[ContextBody] = None


@router.get("/status")
async def gateway_status() -> Dict[str, Any]:
    return gw.gateway_status()


@router.post("/complete")
async def gateway_complete(body: CompleteRequest) -> Dict[str, Any]:
    ctx = normalize_context(body.context.model_dump() if body.context else None)
    if body.expect_json:
        data = await gw.complete_json(
            system=body.system,
            user_text=body.user_text,
            context=ctx,
            session_id=body.session_id,
            max_tokens=body.max_tokens,
        )
        return {"ok": True, "result": data, "context": ctx.model_dump()}
    data = await gw.complete(
        system=body.system,
        user_text=body.user_text,
        context=ctx,
        session_id=body.session_id,
        max_tokens=body.max_tokens,
    )
    return {"ok": True, **data, "context": ctx.model_dump()}


@router.post("/dating-coach")
async def gateway_dating_coach(body: DatingCoachGatewayRequest) -> Dict[str, Any]:
    data = await gw.handle_dating_coach(
        match_profile=body.match_profile,
        conversation_history=body.conversation_history,
        context=body.context.model_dump() if body.context else None,
    )
    # Never 500 — always return suggestions
    return {
        "suggestions": data.get("suggestions") or gw.COACH_FALLBACK["suggestions"],
        "current_tip": data.get("current_tip") or gw.COACH_FALLBACK["current_tip"],
        "fallback": bool(data.get("fallback")),
    }


@router.post("/date-plan")
async def gateway_date_plan(body: DatePlanGatewayRequest) -> Dict[str, Any]:
    data = await gw.handle_date_plan_prefs(
        interests=body.interests,
        location=body.location,
        budget=body.budget,
        date_type=body.date_type,
        duration=body.duration,
        time_of_day=body.time_of_day,
        context=body.context.model_dump() if body.context else None,
    )
    return {"ok": True, "plan": data, "fallback": bool(data.get("fallback"))}


@router.post("/guide-hint")
async def gateway_guide_hint(body: GuideGatewayRequest) -> Dict[str, Any]:
    return await gw.handle_guide_hint(
        room=body.room,
        path=body.path,
        context=body.context.model_dump() if body.context else None,
    )
