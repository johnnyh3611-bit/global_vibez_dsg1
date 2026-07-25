"""
Unified AI gateway — single entry for conversational LLM calls.

All feature handlers should call ``complete()`` (or ``complete_json()``)
instead of constructing LlmChat ad-hoc. Vibe-Core mediation stays in
``routes.vibe_core_orchestrator`` and only uses this for the LLM pass —
never for escrow/dispute policy execution.

Guarantees:
  * Context packet injected into every prompt
  * Hard execution timeout (default 20s)
  * Static fallback on any failure (never raise raw provider errors)
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, Optional

from services.ai_context import AiContextPacket, normalize_context
from services.ai_engine import LlmChat, UserMessage, _resolve_api_key

log = logging.getLogger(__name__)

DEFAULT_TIMEOUT_S = 20.0

STATIC_FALLBACK_TEXT = (
    "AI is temporarily unavailable. Please try again in a moment, "
    "or continue without suggestions."
)

STATIC_FALLBACK_JSON: Dict[str, Any] = {
    "ok": False,
    "fallback": True,
    "message": STATIC_FALLBACK_TEXT,
}


def ai_configured() -> bool:
    return bool(_resolve_api_key())


def gateway_status() -> Dict[str, Any]:
    return {
        "configured": ai_configured(),
        "provider": "gemini",
        "timeout_s": DEFAULT_TIMEOUT_S,
        "context_fields": ["user_id", "balance", "mode", "room_id", "beta_flags"],
        "docs": "POST /api/ai/gateway/complete",
    }


async def complete(
    *,
    system: str,
    user_text: str,
    context: Optional[AiContextPacket] = None,
    session_id: Optional[str] = None,
    max_tokens: int = 1024,
    timeout_s: float = DEFAULT_TIMEOUT_S,
    fallback: str = STATIC_FALLBACK_TEXT,
    model_hint: str = "flash",
) -> Dict[str, Any]:
    """Run one LLM completion with timeout + fallback.

    Returns ``{ text, fallback, timed_out, error? }`` — never raises for
    provider failures.
    """
    ctx = context or AiContextPacket()
    system_full = f"{system.strip()}\n\n{ctx.as_prompt_block()}"
    if not ai_configured():
        log.warning("ai_gateway complete: no GEMINI_API_KEY — returning fallback")
        return {"text": fallback, "fallback": True, "timed_out": False, "error": "not_configured"}

    chat = LlmChat(
        session_id=session_id or f"gw-{ctx.user_id}-{ctx.mode}",
        system_message=system_full,
    )
    if model_hint == "pro":
        chat.with_model("gemini", "gemini-1.5-pro")
    else:
        chat.with_model("gemini", "gemini-2.0-flash")
    chat._max_tokens = max_tokens

    try:
        text = await asyncio.wait_for(
            chat.send_message(UserMessage(text=user_text)),
            timeout=timeout_s,
        )
        return {
            "text": (text or "").strip() or fallback,
            "fallback": not bool((text or "").strip()),
            "timed_out": False,
        }
    except asyncio.TimeoutError:
        log.error("ai_gateway TIMEOUT after %.1fs session=%s", timeout_s, session_id)
        return {
            "text": fallback,
            "fallback": True,
            "timed_out": True,
            "error": "timeout",
        }
    except Exception as exc:  # noqa: BLE001
        log.error("ai_gateway FAILED session=%s err=%s", session_id, exc)
        return {
            "text": fallback,
            "fallback": True,
            "timed_out": False,
            "error": str(exc)[:200],
        }


async def complete_json(
    *,
    system: str,
    user_text: str,
    context: Optional[AiContextPacket] = None,
    session_id: Optional[str] = None,
    max_tokens: int = 1024,
    timeout_s: float = DEFAULT_TIMEOUT_S,
    fallback: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Like ``complete`` but parses JSON from the model; on failure returns fallback."""
    fb = dict(fallback or STATIC_FALLBACK_JSON)
    result = await complete(
        system=system + "\nRespond with valid JSON only.",
        user_text=user_text,
        context=context,
        session_id=session_id,
        max_tokens=max_tokens,
        timeout_s=timeout_s,
        fallback=json.dumps(fb),
    )
    if result.get("fallback") and result.get("error") in ("not_configured", "timeout"):
        return {**fb, "fallback": True, "timed_out": bool(result.get("timed_out"))}

    text = result.get("text") or ""
    parsed = _extract_json(text)
    if parsed is None:
        return {**fb, "fallback": True, "timed_out": False, "error": "invalid_json"}
    parsed.setdefault("fallback", False)
    parsed.setdefault("timed_out", False)
    return parsed


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    cleaned = (text or "").strip()
    if not cleaned:
        return None
    try:
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0].strip()
        elif cleaned.startswith("```"):
            cleaned = cleaned.split("```", 1)[1].split("```", 1)[0].strip()
        data = json.loads(cleaned)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, IndexError, TypeError):
        # best-effort: find first { … }
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            try:
                data = json.loads(cleaned[start : end + 1])
                return data if isinstance(data, dict) else None
            except json.JSONDecodeError:
                return None
        return None


# ── Feature handlers (called exclusively via the gateway router) ─────────

COACH_FALLBACK = {
    "suggestions": [
        {"text": "What do you like to do for fun?", "category": "question", "confidence": 75},
        {"text": "I'd love to hear more about that!", "category": "interest", "confidence": 80},
        {"text": "That sounds amazing!", "category": "compliment", "confidence": 85},
    ],
    "current_tip": "Be genuine and show interest in what they're saying.",
    "fallback": True,
}

DATE_PLAN_FALLBACK = {
    "restaurant": {
        "name": "Cozy Corner Bistro",
        "cuisine": "Modern American",
        "vibe": "Warm and conversational",
        "reason": "Easy atmosphere for a first meet",
        "price_range": "$$",
    },
    "activity": {
        "name": "Evening stroll",
        "description": "A short walk to keep the conversation going",
        "reason": "Low pressure after dinner",
        "duration": "30-45 minutes",
    },
    "game": {
        "name": "Spades",
        "game_type": "spades",
        "reason": "Partnership play builds teamwork vibes",
        "when": "after the date online",
    },
    "itinerary": "Meet for dinner, take a short walk, then play a game together on Global Vibez.",
    "fallback": True,
}


async def handle_dating_coach(
    *,
    match_profile: Dict[str, Any],
    conversation_history: list,
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    ctx = normalize_context(context, user_id=str(match_profile.get("user_id") or "anonymous"))
    ctx.mode = "date"
    match_summary = (
        f"Match Profile:\n"
        f"- Name: {match_profile.get('name', 'Unknown')}\n"
        f"- Interests: {', '.join(match_profile.get('interests', []) or [])}\n"
        f"- Bio: {match_profile.get('bio', 'No bio')}\n"
    )
    convo_lines = []
    for m in (conversation_history or [])[-10:]:
        if isinstance(m, dict):
            convo_lines.append(f"{m.get('sender', '?')}: {m.get('text', '')}")
        else:
            convo_lines.append(f"{getattr(m, 'sender', '?')}: {getattr(m, 'text', '')}")
    convo = "\n".join(convo_lines) or "(no messages yet)"
    system = (
        "You are an expert AI Dating Coach for Global Vibez DSG. "
        "Provide helpful, natural conversation suggestions.\n\n"
        f"Context:\n{match_summary}\n"
        f"Recent Conversation:\n{convo}\n\n"
        "Provide 3-4 conversation suggestions that are natural and genuine.\n"
        'JSON shape: {"suggestions":[{"text":"...","category":"question","confidence":85}],'
        '"current_tip":"..."}'
    )
    return await complete_json(
        system=system,
        user_text="Based on this conversation, provide suggestions in JSON format.",
        context=ctx,
        session_id=f"dating_coach_{ctx.user_id}",
        fallback=COACH_FALLBACK,
    )


async def handle_date_plan_prefs(
    *,
    interests: list,
    location: str,
    budget: str,
    date_type: str,
    duration: str,
    time_of_day: str = "",
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    ctx = normalize_context(context)
    ctx.mode = "date"
    system = (
        "You are the Global Vibez date planner. Build a concise date plan as JSON "
        "with keys: restaurant, activity, game, itinerary (same nested shapes as "
        "the platform date planner)."
    )
    user_text = (
        f"Interests: {', '.join(interests or []) or 'general'}\n"
        f"Location: {location or 'unspecified'}\n"
        f"Budget: {budget or '$$'}\n"
        f"Date type: {date_type or 'casual'}\n"
        f"Duration: {duration or '2-3 hours'}\n"
        f"Time of day: {time_of_day or 'evening'}"
    )
    return await complete_json(
        system=system,
        user_text=user_text,
        context=ctx,
        session_id=f"date_plan_{ctx.user_id}",
        fallback=DATE_PLAN_FALLBACK,
        max_tokens=1500,
    )


async def handle_guide_hint(
    *,
    room: str,
    path: str = "",
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Conversational guide — prefers static catalog via ai_guide when possible."""
    ctx = normalize_context(context)
    # Prefer static catalog (no LLM) for known rooms
    try:
        from routes.ai_guide import HINTS  # noqa: PLC0415
        key = (room or "").strip().lower()
        if key in HINTS:
            return {
                "hint": HINTS[key],
                "room": key,
                "source": "catalog",
                "fallback": False,
            }
    except Exception:
        pass

    result = await complete(
        system=(
            "You are the Global Vibez AI Navigator. Give one short, friendly hint "
            "(max 2 sentences) for the user about the room they are in."
        ),
        user_text=f"Room: {room or 'unknown'}. Path: {path or '/'}.",
        context=ctx,
        session_id=f"guide_{ctx.user_id}",
        fallback="Explore Play, Date, Watch, or Earn from the main doors — or open Beta Hub for experiments.",
        max_tokens=256,
    )
    return {
        "hint": result["text"],
        "room": room,
        "source": "gateway",
        "fallback": result.get("fallback", False),
        "timed_out": result.get("timed_out", False),
    }
