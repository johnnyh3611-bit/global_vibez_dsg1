from services.ai_engine import LlmChat, UserMessage, _resolve_api_key

def test_user_message_body():
    assert UserMessage(text="a").body == "a"
    assert UserMessage(content="b").body == "b"

def test_model_alias_gemini_to_openai():
    c = LlmChat().with_model("gemini", "gemini-2.5-flash")
    assert c.model == "gpt-4o-mini"

def test_resolve_prefers_openai(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-openai")
    monkeypatch.delenv("EMERGENT_LLM_KEY", raising=False)
    assert _resolve_api_key() == "sk-openai"

def test_resolve_alias(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("EMERGENT_LLM_KEY", "sk-alias")
    assert _resolve_api_key() == "sk-alias"
