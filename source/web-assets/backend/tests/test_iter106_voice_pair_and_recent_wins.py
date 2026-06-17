"""Tests for iteration 106 features:
- GET /api/mining/recent-wins (public ticker)
- Voice Mirror Pair room endpoints: create, join, get, set-lang, send, inbox, leave
"""
import os
import base64
import requests

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if url:
        return url.rstrip("/")
    # Fallback: read frontend/.env
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")

BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"


# ----- MINING RECENT WINS -----
class TestMiningRecentWins:
    def test_public_no_auth_default(self):
        r = requests.get(f"{API}/mining/recent-wins", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "count" in data and "rows" in data
        assert isinstance(data["rows"], list)
        assert data["count"] == len(data["rows"])
        for row in data["rows"]:
            assert "username" in row
            assert "mined" in row
            assert "game_type" in row
            assert "at" in row

    def test_limit_cap_at_50(self):
        r = requests.get(f"{API}/mining/recent-wins?limit=9999", timeout=10)
        assert r.status_code == 200
        assert len(r.json()["rows"]) <= 50

    def test_limit_default_20(self):
        r = requests.get(f"{API}/mining/recent-wins", timeout=10)
        assert r.status_code == 200
        assert len(r.json()["rows"]) <= 20

    def test_window_hours_accepted(self):
        r = requests.get(f"{API}/mining/recent-wins?window_hours=168", timeout=10)
        assert r.status_code == 200


# ----- VOICE MIRROR PAIR -----
class TestVoicePair:
    def test_create_pair_room_shape(self):
        payload = {"user_id": "TEST_iter106_alice", "user_name": "Alice", "native_lang": "en"}
        r = requests.post(f"{API}/voice-mirror/pair/create", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "room_id" in d
        assert "pair_code" in d
        code = d["pair_code"]
        assert len(code) == 6
        assert code.isupper()
        for ch in code:
            assert ch not in "0O1IL"
        assert d["is_full"] is False
        assert isinstance(d["participants"], list)
        assert len(d["participants"]) == 1
        assert d["participants"][0]["user_id"] == "TEST_iter106_alice"
        assert d["participants"][0]["native_lang"] == "EN"
        assert d["you"] is not None and d["you"]["user_id"] == "TEST_iter106_alice"

    def test_pair_code_uniqueness_5_rapid_creates(self):
        codes = set()
        for i in range(5):
            payload = {"user_id": f"TEST_iter106_uniq_{i}", "user_name": f"U{i}", "native_lang": "EN"}
            r = requests.post(f"{API}/voice-mirror/pair/create", json=payload, timeout=10)
            assert r.status_code == 200
            codes.add(r.json()["pair_code"])
        assert len(codes) == 5

    def test_join_full_flow(self):
        # create
        r = requests.post(f"{API}/voice-mirror/pair/create",
                          json={"user_id": "TEST_iter106_A", "user_name": "A", "native_lang": "EN"},
                          timeout=10)
        assert r.status_code == 200
        room = r.json()
        code = room["pair_code"]
        room_id = room["room_id"]

        # join
        r = requests.post(f"{API}/voice-mirror/pair/join",
                          json={"user_id": "TEST_iter106_B", "user_name": "B",
                                "native_lang": "es", "pair_code": code},
                          timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_full"] is True
        assert len(d["participants"]) == 2
        assert d["you"]["native_lang"] == "ES"

        # invalid code → 404
        bad = requests.post(f"{API}/voice-mirror/pair/join",
                            json={"user_id": "X", "pair_code": "ZZZZZZ", "native_lang": "EN"},
                            timeout=10)
        assert bad.status_code == 404

        # third joiner → 409
        third = requests.post(f"{API}/voice-mirror/pair/join",
                              json={"user_id": "TEST_iter106_C", "pair_code": code, "native_lang": "EN"},
                              timeout=10)
        assert third.status_code == 409

        # rejoin same user with updated lang → 200
        rj = requests.post(f"{API}/voice-mirror/pair/join",
                           json={"user_id": "TEST_iter106_B", "pair_code": code,
                                 "native_lang": "fr"},
                           timeout=10)
        assert rj.status_code == 200
        assert rj.json()["you"]["native_lang"] == "FR"

        return room_id, code

    def test_get_room_404_and_200(self):
        r = requests.get(f"{API}/voice-mirror/pair/nonexistentroomid?user_id=x", timeout=10)
        assert r.status_code == 404

        c = requests.post(f"{API}/voice-mirror/pair/create",
                          json={"user_id": "TEST_iter106_getA", "native_lang": "EN"}, timeout=10)
        rid = c.json()["room_id"]
        r = requests.get(f"{API}/voice-mirror/pair/{rid}?user_id=TEST_iter106_getA", timeout=10)
        assert r.status_code == 200
        assert r.json()["you"]["user_id"] == "TEST_iter106_getA"

    def test_set_lang_403_and_200(self):
        c = requests.post(f"{API}/voice-mirror/pair/create",
                          json={"user_id": "TEST_iter106_langA", "native_lang": "EN"}, timeout=10)
        rid = c.json()["room_id"]

        # intruder → 403
        r = requests.post(f"{API}/voice-mirror/pair/{rid}/set-lang",
                          json={"user_id": "STRANGER", "native_lang": "ES"}, timeout=10)
        assert r.status_code == 403

        # self → 200
        r = requests.post(f"{API}/voice-mirror/pair/{rid}/set-lang",
                          json={"user_id": "TEST_iter106_langA", "native_lang": "de"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["you"]["native_lang"] == "DE"

    def test_send_guards(self):
        c = requests.post(f"{API}/voice-mirror/pair/create",
                          json={"user_id": "TEST_iter106_sendA", "native_lang": "EN"}, timeout=10)
        rid = c.json()["room_id"]

        # not in room → 403
        r = requests.post(f"{API}/voice-mirror/pair/{rid}/send",
                          json={"user_id": "STRANGER", "audio_base64": "AAAA"}, timeout=15)
        assert r.status_code == 403

        # bad base64 → 400
        r = requests.post(f"{API}/voice-mirror/pair/{rid}/send",
                          json={"user_id": "TEST_iter106_sendA",
                                "audio_base64": "!!!not_base64!!!"}, timeout=15)
        assert r.status_code == 400

        # tiny valid b64 (fake audio) → 200 empty OR 502 from STT, but NEVER 500
        tiny = base64.b64encode(b"\x00\x00\x00\x00").decode()
        r = requests.post(f"{API}/voice-mirror/pair/{rid}/send",
                          json={"user_id": "TEST_iter106_sendA", "audio_base64": tiny}, timeout=30)
        assert r.status_code in (200, 502), f"Unexpected {r.status_code}: {r.text}"

    def test_inbox_guards(self):
        c = requests.post(f"{API}/voice-mirror/pair/create",
                          json={"user_id": "TEST_iter106_inboxA", "native_lang": "EN"}, timeout=10)
        rid = c.json()["room_id"]

        # missing room → 404
        r = requests.get(f"{API}/voice-mirror/pair/nonexistent/inbox?user_id=x&since_ms=0", timeout=10)
        assert r.status_code == 404

        # intruder → 403
        r = requests.get(f"{API}/voice-mirror/pair/{rid}/inbox?user_id=STRANGER&since_ms=0", timeout=10)
        assert r.status_code == 403

        # valid, empty → 200
        r = requests.get(f"{API}/voice-mirror/pair/{rid}/inbox?user_id=TEST_iter106_inboxA&since_ms=0", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] == 0
        assert d["messages"] == []
        assert "server_ms" in d

    def test_leave_idempotent(self):
        c = requests.post(f"{API}/voice-mirror/pair/create",
                          json={"user_id": "TEST_iter106_leaveA", "native_lang": "EN"}, timeout=10)
        rid = c.json()["room_id"]
        r = requests.post(f"{API}/voice-mirror/pair/{rid}/leave",
                          json={"user_id": "TEST_iter106_leaveA"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # second leave → still 200 (room auto-deleted, but leave endpoint is idempotent)
        r2 = requests.post(f"{API}/voice-mirror/pair/{rid}/leave",
                           json={"user_id": "TEST_iter106_leaveA"}, timeout=10)
        assert r2.status_code == 200
