"""Unit tests for Gemini-backed LlmChat helpers (no network)."""
from services.ai_engine import LlmChat, UserMessage, _resolve_api_key


def test_user_message_body():
    assert UserMessage(text="a").body == "a"
    assert UserMessage(content="b").body == "b"


def test_model_alias_stays_on_gemini():
    c = LlmChat().with_model("gemini", "gemini-2.5-flash")
    assert c.model.startswith("gemini")


def test_openai_alias_maps_to_gemini():
    c = LlmChat().with_model("openai", "gpt-4o")
    assert c.model.startswith("gemini")


def test_resolve_prefers_gemini(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "gem-key")
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("EMERGENT_LLM_KEY", raising=False)
    assert _resolve_api_key() == "gem-key"


def test_resolve_google_alias(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("GOOGLE_API_KEY", "google-key")
    monkeypatch.delenv("EMERGENT_LLM_KEY", raising=False)
    assert _resolve_api_key() == "google-key"
