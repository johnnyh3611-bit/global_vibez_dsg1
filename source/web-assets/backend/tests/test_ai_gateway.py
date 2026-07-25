"""Unit tests for the unified AI gateway (no live Gemini calls)."""
from __future__ import annotations

import pytest

from services.ai_context import normalize_context
from services import ai_gateway as gw


def test_normalize_context_aliases():
    ctx = normalize_context(
        {"user_id": "u1", "balance": 100, "mode": "dating", "room_id": "r1"}
    )
    assert ctx.mode == "date"
    assert ctx.user_id == "u1"
    assert "mode=date" in ctx.as_prompt_block()


def test_gateway_status_shape():
    status = gw.gateway_status()
    assert "configured" in status
    assert status["provider"] == "gemini"
    assert "user_id" in status["context_fields"]


@pytest.mark.asyncio
async def test_complete_returns_fallback_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("EMERGENT_LLM_KEY", raising=False)
    result = await gw.complete(
        system="You are helpful",
        user_text="hi",
        context=normalize_context({"user_id": "u", "mode": "game"}),
    )
    assert result["fallback"] is True
    assert result["error"] == "not_configured"
    assert "unavailable" in result["text"].lower() or "temporarily" in result["text"].lower()


@pytest.mark.asyncio
async def test_dating_coach_never_raises_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("EMERGENT_LLM_KEY", raising=False)
    data = await gw.handle_dating_coach(
        match_profile={"name": "Ada", "interests": ["chess"]},
        conversation_history=[{"sender": "me", "text": "hey"}],
        context={"user_id": "u1", "mode": "date", "balance": 50},
    )
    assert data.get("suggestions")
    assert data.get("fallback") is True


@pytest.mark.asyncio
async def test_date_plan_prefs_fallback(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("EMERGENT_LLM_KEY", raising=False)
    plan = await gw.handle_date_plan_prefs(
        interests=["music"],
        location="Austin",
        budget="$$",
        date_type="casual",
        duration="2h",
        context={"user_id": "u1", "mode": "date"},
    )
    assert plan.get("restaurant")
    assert plan.get("fallback") is True
