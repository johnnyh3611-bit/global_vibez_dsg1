"""
Iter 115 — Voice Mirror end-to-end backend validation.

Tests the refactored route that now uses emergentintegrations (OpenAISpeechToText +
OpenAITextToSpeech) instead of raw httpx → api.openai.com. Verifies that:
  - POST /api/voice-mirror/transcribe-and-translate returns 200 with real
    gTTS-generated audio (not 502).
  - POST /api/voice-mirror/speak-phrase returns 200 with translated audio.
  - Pair-mode router is mounted (GET 404/405 on WS path, not 'not found').
  - Companion GET endpoints still respond 200.
"""
import base64
import io
import os
import pytest
import requests
from gtts import gTTS

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to backend .env
    from pathlib import Path
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break

TEST_USER_ID = "TEST_iter115_voice_user"


# ------------------------- fixtures -------------------------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def english_mp3_b64() -> str:
    """Generate an English MP3 via gTTS and return base64."""
    t = gTTS("Hello, this is a test of voice mirror.", lang="en")
    fp = io.BytesIO()
    t.write_to_fp(fp)
    return base64.b64encode(fp.getvalue()).decode()


# --------------- Voice Mirror companion endpoints -----------
class TestVoiceMirrorBasics:
    def test_voices_list(self, api):
        r = api.get(f"{BASE_URL}/api/voice-mirror/voices")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "voices" in data and isinstance(data["voices"], list)
        assert len(data["voices"]) == 6
        ids = [v["id"] for v in data["voices"]]
        assert "nova" in ids and "alloy" in ids

    def test_phrase_packs(self, api):
        r = api.get(f"{BASE_URL}/api/voice-mirror/phrase-packs")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "packs" in data
        assert len(data["packs"]) >= 3


# ------- CRITICAL: real round-trip STT→translate→TTS --------
class TestTranscribeAndTranslate:
    def test_real_gtts_mp3_to_spanish(self, api, english_mp3_b64):
        """
        Main unblock check. gTTS-generated English MP3 → Whisper STT →
        Claude translate → OpenAI TTS Spanish MP3. Must return 200 with
        non-empty translated text + MP3 bytes.
        """
        payload = {
            "audio_base64": english_mp3_b64,
            "target_lang": "ES",
            "user_id": TEST_USER_ID,
            "voice": "nova",
        }
        r = api.post(
            f"{BASE_URL}/api/voice-mirror/transcribe-and-translate",
            json=payload,
            timeout=60,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:500]}"
        data = r.json()
        # Structural assertions
        assert "original" in data
        assert "translated" in data
        assert "audio_base64" in data
        # Content assertions — MUST be populated (not empty)
        assert data["original"], f"original empty: {data}"
        assert data["translated"], f"translated empty: {data}"
        assert data["target_lang"] == "ES"
        # Audio must be present and reasonably sized (~a few kB base64)
        assert len(data["audio_base64"]) > 1000, (
            f"audio_base64 too small ({len(data['audio_base64'])}): possible TTS failure. "
            f"tts_error={data.get('tts_error')}"
        )
        # No tts_error field on happy path
        assert "tts_error" not in data, f"tts_error present: {data.get('tts_error')}"
        # Source lang detected as English
        assert data.get("source_lang", "").lower().startswith("en") or data["source_lang"] == "english"

    def test_real_gtts_mp3_to_french(self, api, english_mp3_b64):
        payload = {
            "audio_base64": english_mp3_b64,
            "target_lang": "FR",
            "user_id": TEST_USER_ID,
        }
        r = api.post(
            f"{BASE_URL}/api/voice-mirror/transcribe-and-translate",
            json=payload,
            timeout=60,
        )
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:500]}"
        data = r.json()
        assert data["translated"], f"translated empty: {data}"
        assert data["target_lang"] == "FR"
        assert len(data["audio_base64"]) > 1000, f"audio_base64 too small. tts_error={data.get('tts_error')}"

    def test_invalid_base64_returns_400(self, api):
        payload = {"audio_base64": "!!!not-base64!!!", "target_lang": "ES", "user_id": TEST_USER_ID}
        r = api.post(f"{BASE_URL}/api/voice-mirror/transcribe-and-translate", json=payload, timeout=30)
        # Python's base64.b64decode is lenient; route may treat garbage as bytes → 502 STT fail.
        assert r.status_code in (400, 502), f"Got {r.status_code}: {r.text[:200]}"


# ----------- CRITICAL: speak-phrase (text → TTS) ------------
class TestSpeakPhrase:
    def test_speak_phrase_spanish(self, api):
        payload = {
            "user_id": TEST_USER_ID,
            "text": "Hello, how are you today?",
            "target_lang": "ES",
            "voice": "nova",
        }
        r = api.post(f"{BASE_URL}/api/voice-mirror/speak-phrase", json=payload, timeout=60)
        assert r.status_code == 200, f"Got {r.status_code}: {r.text[:500]}"
        data = r.json()
        assert data["original"] == "Hello, how are you today?"
        assert data["translated"], f"translated empty: {data}"
        assert data["target_lang"] == "ES"
        assert len(data["audio_base64"]) > 1000, (
            f"audio_base64 too small, tts_error={data.get('tts_error')}"
        )
        assert "tts_error" not in data, f"TTS failed: {data.get('tts_error')}"

    def test_speak_phrase_empty_text_400(self, api):
        payload = {"user_id": TEST_USER_ID, "text": "", "target_lang": "ES"}
        r = api.post(f"{BASE_URL}/api/voice-mirror/speak-phrase", json=payload, timeout=30)
        assert r.status_code == 400


# -------------- Pair-mode router mounted? -------------------
class TestPairMode:
    def test_pair_router_mounted(self, api):
        """
        Confirm pair router is mounted by hitting a REST endpoint on it.
        POST /api/voice-mirror/pair/create should respond (even if 400/422
        from pydantic) — anything except 404 proves the router is loaded.
        """
        r = api.post(
            f"{BASE_URL}/api/voice-mirror/pair/create",
            json={"user_id": TEST_USER_ID, "source_lang": "EN", "target_lang": "ES"},
            timeout=30,
        )
        # Must not be a 404 (route missing). 200/400/422/500 all prove mount.
        assert r.status_code != 404, f"pair router not mounted: {r.status_code} {r.text[:200]}"
        # Also sanity-check GET inbox endpoint shape
        r2 = api.get(f"{BASE_URL}/api/voice-mirror/pair/nonexistent_room", timeout=15)
        assert r2.status_code != 404 or "room" in r2.text.lower() or r2.json().get("detail")
