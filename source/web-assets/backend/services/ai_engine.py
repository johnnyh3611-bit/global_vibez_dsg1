"""
LlmChat — OpenAI-backed chat helper used by date planner, coaches, i18n, etc.

Set OPENAI_API_KEY on Railway (or locally). Older EMERGENT_LLM_KEY env name
is accepted as an alias only so existing deploys keep working.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

# Prefer OPENAI_API_KEY; accept legacy alias if still present in env.
def _resolve_api_key(explicit: Optional[str] = None) -> Optional[str]:
    return (
        (explicit or "").strip()
        or os.environ.get("OPENAI_API_KEY", "").strip()
        or os.environ.get("EMERGENT_LLM_KEY", "").strip()
        or None
    )


# Map historical provider/model pairs onto current OpenAI chat models.
_MODEL_ALIASES = {
    ("openai", "gpt-5.2"): "gpt-4o",
    ("openai", "gpt-5.1"): "gpt-4o",
    ("openai", "gpt-4o"): "gpt-4o",
    ("openai", "gpt-4o-mini"): "gpt-4o-mini",
    ("gemini", "gemini-2.5-flash"): "gpt-4o-mini",
    ("anthropic", "claude-sonnet-4-5-20250929"): "gpt-4o",
    ("anthropic", "claude-3-5-haiku-20241022"): "gpt-4o-mini",
}

DEFAULT_MODEL = "gpt-4o-mini"


class UserMessage(BaseModel):
    """Accept both `text=` (common) and `content=` callers."""

    text: Optional[str] = None
    content: Optional[str] = None

    def __init__(self, text: Optional[str] = None, content: Optional[str] = None, **kwargs: Any):
        # Support UserMessage("plain string") and UserMessage(prompt) positional misuse
        if text is None and content is None and kwargs:
            # UserMessage(some_kw=...) unlikely; ignore
            pass
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
        self._provider = "openai"

    def with_model(self, provider: str, model: str) -> "LlmChat":
        self._provider = provider or "openai"
        mapped = _MODEL_ALIASES.get((provider, model))
        if mapped:
            self.model = mapped
        elif provider == "openai":
            self.model = model
        else:
            # Non-OpenAI providers aren't wired — use a solid OpenAI default.
            self.model = DEFAULT_MODEL
            log.info(
                "llm provider=%s model=%s mapped to openai/%s",
                provider,
                model,
                self.model,
            )
        return self

    @staticmethod
    def with_params(max_tokens: int = 2048) -> "LlmChat":
        chat = LlmChat()
        chat._max_tokens = max_tokens  # type: ignore[attr-defined]
        return chat

    def _max(self) -> int:
        return int(getattr(self, "_max_tokens", 2048))

    async def send_message(self, message: UserMessage) -> str:
        if not self.api_key:
            raise RuntimeError(
                "AI not configured. Set OPENAI_API_KEY on the backend (Railway Variables)."
            )
        try:
            from openai import AsyncOpenAI  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError("openai package not installed") from exc

        client = AsyncOpenAI(api_key=self.api_key)
        messages = [
            {"role": "system", "content": self.system_message},
            {"role": "user", "content": message.body},
        ]
        resp = await client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=self._max(),
            temperature=0.7,
        )
        return (resp.choices[0].message.content or "").strip()

    async def chat(self, messages: Any) -> str:
        # Legacy shape used by older callers
        if isinstance(messages, list) and messages:
            last = messages[-1]
            text = getattr(last, "body", None) or getattr(last, "content", None) or str(last)
            return await self.send_message(UserMessage(text=str(text)))
        return await self.send_message(UserMessage(text=str(messages)))

    def ask(self, message: Any) -> UserMessage:
        """
        Sync helper used by a few game AI paths.
        Prefer send_message in async routes.
        """
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
                # Can't block; return empty and let callers fall back
                return UserMessage(content="")
            text = loop.run_until_complete(self.send_message(msg))
        except RuntimeError:
            text = asyncio.run(self.send_message(msg))
        return UserMessage(content=text)
