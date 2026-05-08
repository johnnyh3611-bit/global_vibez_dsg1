"""Iter109: Voice Mirror enhancements (B/C/D) backend tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

USER_ID = f"TEST_iter109_{int(time.time())}"


@pytest.fixture(scope="module")
def cleanup():
    yield
    # cleanup history & pref
    try:
        requests.delete(f"{API}/voice-mirror/history", params={"user_id": USER_ID}, timeout=15)
    except Exception:
        pass


# ---------- (B) Voice picker ----------
class TestVoicePicker:
    def test_get_voices_no_user(self, cleanup):
        r = requests.get(f"{API}/voice-mirror/voices", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "voices" in body and "current" in body
        assert body["current"] is None
        assert len(body["voices"]) == 6
        ids = {v["id"] for v in body["voices"]}
        assert ids == {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}
        for v in body["voices"]:
            assert "label" in v and "vibe" in v

    def test_get_voices_with_user_returns_default(self, cleanup):
        r = requests.get(f"{API}/voice-mirror/voices", params={"user_id": USER_ID}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["current"] in {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}

    def test_set_voice_invalid(self, cleanup):
        r = requests.post(
            f"{API}/voice-mirror/voices/set",
            json={"user_id": USER_ID, "voice": "robot"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_set_voice_valid_and_persist(self, cleanup):
        r = requests.post(
            f"{API}/voice-mirror/voices/set",
            json={"user_id": USER_ID, "voice": "nova"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json().get("voice") == "nova"

        # GET echoes saved value
        r2 = requests.get(f"{API}/voice-mirror/voices", params={"user_id": USER_ID}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["current"] == "nova"


# ---------- (D) Phrase packs + speak-phrase ----------
class TestPhrasePacks:
    def test_get_phrase_packs(self, cleanup):
        r = requests.get(f"{API}/voice-mirror/phrase-packs", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "packs" in body
        ids = {p["id"] for p in body["packs"]}
        assert ids == {"gaming", "dating", "travel"}
        for p in body["packs"]:
            assert "label" in p and "emoji" in p
            assert isinstance(p["phrases"], list) and len(p["phrases"]) == 10

    def test_speak_phrase_empty_text(self, cleanup):
        r = requests.post(
            f"{API}/voice-mirror/speak-phrase",
            json={"user_id": USER_ID, "text": "", "target_lang": "ES"},
            timeout=30,
        )
        assert r.status_code == 400

    def test_speak_phrase_translates_to_spanish(self, cleanup):
        r = requests.post(
            f"{API}/voice-mirror/speak-phrase",
            json={"user_id": USER_ID, "text": "Good game!", "target_lang": "ES"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["original"] == "Good game!"
        assert body["target_lang"] == "ES"
        assert body["voice"] in {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}
        # translation should be non-empty (Claude translation), audio may be empty if TTS hiccups
        assert isinstance(body["translated"], str) and len(body["translated"]) > 0
        # NOTE: TTS may 502 occasionally - main agent flagged this is acceptable
        if not body.get("tts_error"):
            assert len(body.get("audio_base64", "")) > 100


# ---------- (C) History ----------
class TestHistory:
    def test_history_missing_user_id(self, cleanup):
        # FastAPI returns 422 if required query param missing; test empty value → 400
        r = requests.get(f"{API}/voice-mirror/history", params={"user_id": ""}, timeout=15)
        assert r.status_code in (400, 422)

    def test_history_after_phrase_then_clear(self, cleanup):
        # Trigger one speak-phrase to ensure a row is written
        requests.post(
            f"{API}/voice-mirror/speak-phrase",
            json={"user_id": USER_ID, "text": "Your turn.", "target_lang": "ES"},
            timeout=60,
        )
        time.sleep(0.5)

        r = requests.get(f"{API}/voice-mirror/history", params={"user_id": USER_ID, "limit": 50}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "count" in body and "rows" in body
        assert body["count"] >= 1
        # newest first
        if len(body["rows"]) >= 2:
            assert body["rows"][0]["created_at"] >= body["rows"][1]["created_at"]
        # audio_base64 must be excluded
        for row in body["rows"]:
            assert "audio_base64" not in row
            assert "_id" not in row
            assert row["user_id"] == USER_ID

        # DELETE empties
        d = requests.delete(f"{API}/voice-mirror/history", params={"user_id": USER_ID}, timeout=15)
        assert d.status_code == 200
        assert d.json().get("deleted", 0) >= 1

        r2 = requests.get(f"{API}/voice-mirror/history", params={"user_id": USER_ID}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["count"] == 0

    def test_delete_history_empty_user(self, cleanup):
        r = requests.delete(f"{API}/voice-mirror/history", params={"user_id": ""}, timeout=15)
        assert r.status_code in (400, 422)
