"""
iter116 — validates POST /api/chat/translate used by the new
useAutoTranslate hook / TranslatedSubtitle component.

Also re-runs the iter115 voice-mirror dock surfaces (endpoint still exists).
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestChatTranslate:
    def test_translate_fr_to_en(self, client):
        r = client.post(f"{BASE_URL}/api/chat/translate",
                        json={"text": "Bonjour, comment ça va?", "target_lang": "EN"},
                        timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["original"] == "Bonjour, comment ça va?"
        assert "Hello" in data["translated"] or "hello" in data["translated"].lower()
        assert data["target_lang"] == "EN"
        assert data["same_language"] is False

    def test_translate_same_language(self, client):
        r = client.post(f"{BASE_URL}/api/chat/translate",
                        json={"text": "Hello world, how are you today?", "target_lang": "EN"},
                        timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["same_language"] is True
        assert data["target_lang"] == "EN"

    def test_translate_es_to_en(self, client):
        r = client.post(f"{BASE_URL}/api/chat/translate",
                        json={"text": "Hola amigo, ¿cómo estás hoy?", "target_lang": "EN"},
                        timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["same_language"] is False
        assert len(data["translated"]) > 0
        assert "amigo" not in data["translated"].lower() or "friend" in data["translated"].lower()

    def test_translate_en_to_fr(self, client):
        r = client.post(f"{BASE_URL}/api/chat/translate",
                        json={"text": "Good morning, have a nice day!", "target_lang": "FR"},
                        timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["target_lang"] == "FR"
        assert data["same_language"] is False
        assert len(data["translated"]) > 0

    def test_translate_missing_text(self, client):
        r = client.post(f"{BASE_URL}/api/chat/translate",
                        json={"target_lang": "EN"},
                        timeout=15)
        # Should be 4xx
        assert r.status_code in (400, 422)

    def test_translate_endpoint_response_shape(self, client):
        """Explicitly validates the 4-key shape the frontend hook relies on."""
        r = client.post(f"{BASE_URL}/api/chat/translate",
                        json={"text": "Guten Tag", "target_lang": "EN"},
                        timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("original", "translated", "target_lang", "same_language"):
            assert k in data, f"missing {k} in response: {data}"


class TestVoiceMirrorRegression:
    """iter115 regression — voice-mirror speak-phrase still 200."""

    def test_speak_phrase_es(self, client):
        r = client.post(f"{BASE_URL}/api/voice-mirror/speak-phrase",
                        json={"text": "Buenos dias amigo", "target_lang": "EN", "user_id": "TEST_iter116_user"},
                        timeout=45)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "translated" in data
        assert "target_lang" in data
