"""Unit tests for OpenAI Whisper STT / TTS helpers (no network)."""
import pytest

from services import openai_audio


def test_resolve_openai_api_key_prefers_env(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key")
    assert openai_audio.resolve_openai_api_key() == "sk-test-key"


def test_resolve_openai_api_key_explicit_wins(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-env")
    assert openai_audio.resolve_openai_api_key("sk-explicit") == "sk-explicit"


def test_resolve_openai_api_key_missing(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert openai_audio.resolve_openai_api_key() is None


@pytest.mark.asyncio
async def test_whisper_transcribe_requires_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        await openai_audio.whisper_transcribe(b"fake-audio")


@pytest.mark.asyncio
async def test_whisper_transcribe_uses_async_openai(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    class FakeResp:
        text = "hello world"
        language = "en"

    class FakeTranscriptions:
        async def create(self, **kwargs):
            assert kwargs["model"] == "whisper-1"
            assert kwargs["file"].name == "clip.webm"
            return FakeResp()

    class FakeAudio:
        transcriptions = FakeTranscriptions()

    class FakeClient:
        def __init__(self, api_key=None):
            assert api_key == "sk-test"
            self.audio = FakeAudio()

    import sys
    import types

    fake_openai = types.ModuleType("openai")
    fake_openai.AsyncOpenAI = FakeClient
    monkeypatch.setitem(sys.modules, "openai", fake_openai)

    result = await openai_audio.whisper_transcribe(b"\x00\x01\x02")
    assert result == {"text": "hello world", "language": "en"}


@pytest.mark.asyncio
async def test_openai_tts_falls_back_unknown_voice(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    seen = {}

    class FakeSpeechResp:
        async def aread(self):
            return b"mp3-bytes"

    class FakeSpeech:
        async def create(self, **kwargs):
            seen.update(kwargs)
            return FakeSpeechResp()

    class FakeAudio:
        speech = FakeSpeech()

    class FakeClient:
        def __init__(self, api_key=None):
            self.audio = FakeAudio()

    import sys
    import types

    fake_openai = types.ModuleType("openai")
    fake_openai.AsyncOpenAI = FakeClient
    monkeypatch.setitem(sys.modules, "openai", fake_openai)

    out = await openai_audio.openai_tts("hola", voice="ballad")
    assert out == b"mp3-bytes"
    assert seen["voice"] == "nova"
    assert seen["model"] == "tts-1"


def test_voice_mirror_no_emergent_import():
    from pathlib import Path

    src = Path(__file__).resolve().parents[1] / "routes" / "voice_mirror.py"
    body = src.read_text(encoding="utf-8")
    assert "from emergentintegrations" not in body
    assert "import emergentintegrations" not in body
    assert "EMERGENT_LLM_KEY" not in body
    assert "whisper_transcribe" in body
    assert "openai_tts" in body
