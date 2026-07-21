"""
OpenAI Whisper STT + TTS helpers for Voice Mirror / Voice Coach.

Uses the official `openai` package and OPENAI_API_KEY directly.
No Emergent / emergentintegrations dependency.
"""
from __future__ import annotations

import logging
import os
from io import BytesIO
from typing import Any, Dict, Optional

log = logging.getLogger(__name__)

OPENAI_TTS_VOICES = ("alloy", "echo", "fable", "onyx", "nova", "shimmer")


def resolve_openai_api_key(explicit: Optional[str] = None) -> Optional[str]:
    key = (explicit or "").strip() or os.environ.get("OPENAI_API_KEY", "").strip()
    return key or None


def _require_openai_api_key(explicit: Optional[str] = None) -> str:
    key = resolve_openai_api_key(explicit)
    if not key:
        raise RuntimeError(
            "OPENAI_API_KEY not configured. Set it on the backend for Whisper STT / OpenAI TTS."
        )
    return key


async def whisper_transcribe(
    audio_bytes: bytes,
    *,
    filename: str = "clip.webm",
    language: Optional[str] = None,
    prompt: Optional[str] = None,
    response_format: str = "verbose_json",
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Transcribe audio with OpenAI Whisper. Returns {text, language}.
    """
    from openai import AsyncOpenAI  # noqa: PLC0415

    client = AsyncOpenAI(api_key=_require_openai_api_key(api_key))
    buf = BytesIO(audio_bytes)
    buf.name = filename

    kwargs: Dict[str, Any] = {
        "model": "whisper-1",
        "file": buf,
        "response_format": response_format,
    }
    if language:
        kwargs["language"] = language
    if prompt:
        kwargs["prompt"] = prompt

    resp = await client.audio.transcriptions.create(**kwargs)

    if isinstance(resp, dict):
        text = resp.get("text", "") or ""
        lang = resp.get("language", "") or ""
    elif isinstance(resp, str):
        text = resp
        lang = language or ""
    else:
        text = getattr(resp, "text", "") or ""
        lang = getattr(resp, "language", "") or language or ""
    return {"text": text, "language": lang}


async def openai_tts(
    text: str,
    voice: str = "nova",
    *,
    model: str = "tts-1",
    response_format: str = "mp3",
    api_key: Optional[str] = None,
) -> bytes:
    """Synthesize speech with OpenAI TTS. Returns raw audio bytes (default MP3)."""
    from openai import AsyncOpenAI  # noqa: PLC0415

    client = AsyncOpenAI(api_key=_require_openai_api_key(api_key))
    voice_safe = voice if voice in OPENAI_TTS_VOICES else "nova"
    resp = await client.audio.speech.create(
        model=model,
        voice=voice_safe,
        input=text,
        response_format=response_format,
    )
    # openai SDK: HttpxBinaryResponseContent has .read() / .aread() / .content
    if hasattr(resp, "aread"):
        return await resp.aread()
    if hasattr(resp, "read"):
        data = resp.read()
        if hasattr(data, "__await__"):
            return await data
        return data
    content = getattr(resp, "content", None)
    if content is not None:
        return content
    raise RuntimeError("Unexpected OpenAI TTS response shape")
