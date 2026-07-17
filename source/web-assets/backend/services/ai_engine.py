"""
LlmChat — Gemini-backed chat helper (date planner, coaches, i18n, etc.).

Set on Railway:
  GEMINI_API_KEY=...   (preferred)
  or GOOGLE_API_KEY=...

No Emergent. No OpenAI required.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from pydantic import BaseModel

log = logging.getLogger(__name__)


def _resolve_api_key(explicit: Optional[str] = None) -> Optional[str]:
    return (
        (explicit or "").strip()
        or os.environ.get("GEMINI_API_KEY", "").strip()
        or os.environ.get("GOOGLE_API_KEY", "").strip()
        # legacy alias only — do not document; some old Railway rows may still use it
        or os.environ.get("EMERGENT_LLM_KEY", "").strip()
        or None
    )


# Map historical with_model(provider, model) calls onto Gemini model ids.
# Prefer currently available models for new AI Studio keys (2026).
_MODEL_ALIASES = {
    ("gemini", "gemini-2.5-flash"): "gemini-flash-lite-latest",
    ("gemini", "gemini-2.0-flash"): "gemini-flash-lite-latest",
    ("gemini", "gemini-1.5-flash"): "gemini-flash-lite-latest",
    ("gemini", "gemini-1.5-pro"): "gemini-pro-latest",
    ("gemini", "gemini-3-flash-preview"): "gemini-3-flash-preview",
    ("gemini", "gemini-3.1-flash-lite"): "gemini-3.1-flash-lite",
    ("openai", "gpt-5.2"): "gemini-pro-latest",
    ("openai", "gpt-5.1"): "gemini-pro-latest",
    ("openai", "gpt-4o"): "gemini-pro-latest",
    ("openai", "gpt-4o-mini"): "gemini-flash-lite-latest",
    ("anthropic", "claude-sonnet-4-5-20250929"): "gemini-pro-latest",
    ("anthropic", "claude-3-5-haiku-20241022"): "gemini-flash-lite-latest",
}

DEFAULT_MODEL = "gemini-flash-lite-latest"


class UserMessage(BaseModel):
    text: Optional[str] = None
    content: Optional[str] = None

    def __init__(self, text: Optional[str] = None, content: Optional[str] = None, **kwargs: Any):
        super().__init__(text=text, content=content, **kwargs)

    @property
    def body(self) -> str:
        return (self.text or self.content or "").strip()


class LlmChat:
    def __init__(
        self,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        session_id: Optional[str] = None,
        system_message: Optional[str] = None,
    ):
        self.api_key = _resolve_api_key(api_key)
        self.session_id = session_id
        self.system_message = system_message or "You are a helpful assistant for Global Vibez DSG."
        self.model = model or DEFAULT_MODEL
        self._max_tokens = 2048

    def with_model(self, provider: str, model: str) -> "LlmChat":
        mapped = _MODEL_ALIASES.get((provider, model))
        if mapped:
            self.model = mapped
        elif provider == "gemini":
            self.model = model
        else:
            self.model = DEFAULT_MODEL
            log.info(
                "llm mapped %s/%s → gemini/%s",
                provider,
                model,
                self.model,
            )
        return self

    @staticmethod
    def with_params(max_tokens: int = 2048) -> "LlmChat":
        chat = LlmChat()
        chat._max_tokens = max_tokens
        return chat

    async def send_message(self, message: UserMessage) -> str:
        if not self.api_key:
            raise RuntimeError(
                "AI not configured. Set GEMINI_API_KEY on the backend (Railway Variables)."
            )
        try:
            from google import genai  # noqa: PLC0415
            from google.genai import types  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError("google-genai package not installed") from exc

        client = genai.Client(api_key=self.api_key)
        config = types.GenerateContentConfig(
            system_instruction=self.system_message,
            max_output_tokens=self._max_tokens,
            temperature=0.7,
        )
        # google-genai async client
        resp = await client.aio.models.generate_content(
            model=self.model,
            contents=message.body,
            config=config,
        )
        text = getattr(resp, "text", None) or ""
        if not text and getattr(resp, "candidates", None):
            try:
                parts = resp.candidates[0].content.parts
                text = "".join(getattr(p, "text", "") or "" for p in parts)
            except Exception:
                text = ""
        return (text or "").strip()

    async def chat(self, messages: Any) -> str:
        if isinstance(messages, list) and messages:
            last = messages[-1]
            text = getattr(last, "body", None) or getattr(last, "content", None) or str(last)
            return await self.send_message(UserMessage(text=str(text)))
        return await self.send_message(UserMessage(text=str(messages)))

    def ask(self, message: Any) -> UserMessage:
        import asyncio

        if isinstance(message, str):
            msg = UserMessage(text=message)
        elif isinstance(message, UserMessage):
            msg = message
        else:
            msg = UserMessage(text=str(getattr(message, "content", message)))

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                return UserMessage(content="")
            text = loop.run_until_complete(self.send_message(msg))
        except RuntimeError:
            text = asyncio.run(self.send_message(msg))
        return UserMessage(content=text)
