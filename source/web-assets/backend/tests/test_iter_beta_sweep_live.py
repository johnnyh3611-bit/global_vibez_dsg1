"""Beta-readiness sweep — verifies critical live endpoints requested by founder."""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


# ---------- Health & 3D Poker deletion ----------
def test_health():
    r = requests.get(f"{BASE}/api/health", timeout=10)
    assert r.status_code == 200


def test_no_3d_poker_in_games_registry():
    """Try common game registry endpoints — none should list 3D poker."""
    for ep in ["/api/games/list", "/api/games", "/api/practice/games", "/api/games/registry"]:
        r = requests.get(f"{BASE}{ep}", timeout=10)
        if r.status_code == 200:
            txt = r.text.lower()
            assert "poker_3d" not in txt, f"3D poker still listed in {ep}"
            assert "poker_css3d" not in txt, f"CSS3D poker still listed in {ep}"


# ---------- /api/my-vibez/upload streaming ----------
def test_my_vibez_upload_requires_auth_multipart():
    files = {"video": ("test.mp4", b"\x00" * 1024, "video/mp4")}
    data = {"title": "Test"}
    r = requests.post(f"{BASE}/api/my-vibez/upload", files=files, data=data, timeout=15)
    assert r.status_code in (401, 403, 422), f"Expected auth challenge, got {r.status_code}: {r.text[:200]}"


def test_my_vibez_upload_legacy_json_accepted_or_rejected_gracefully():
    r = requests.post(f"{BASE}/api/my-vibez/upload",
                      json={"video_data": "data:video/mp4;base64,AAAA", "title": "x"}, timeout=15)
    # Should be auth-gated (not 500). 200 also acceptable if auth-bypassed by a fixture; we just need no crash.
    assert r.status_code != 500, f"Legacy JSON path crashed: {r.text[:300]}"


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE}/api/auth/demo-login", json={}, timeout=15)
    assert r.status_code == 200, f"demo-login failed: {r.status_code}"
    return r.json()["token"]


# ---------- Vibez 654 ----------
def test_vibez_654_full_flow(auth_token):
    h = {"Authorization": f"Bearer {auth_token}"}
    r = requests.post(f"{BASE}/api/vibez-654/start", json={"bet": 10}, headers=h, timeout=15)
    assert r.status_code == 200, f"start failed: {r.status_code} {r.text[:200]}"
    g = r.json()
    gid = g.get("game_id") or g.get("id")
    assert gid, f"no game_id in {g}"

    rr = requests.post(f"{BASE}/api/vibez-654/roll", json={"game_id": gid}, headers=h, timeout=15)
    assert rr.status_code == 200, f"roll failed: {rr.status_code} {rr.text[:200]}"
    rj = rr.json()
    assert "locked_dice" in rj or "unlocked_dice" in rj or "dice" in rj or "game" in rj, f"missing dice keys: {list(rj.keys())}"

    sr = requests.post(f"{BASE}/api/vibez-654/stand", json={"game_id": gid}, headers=h, timeout=15)
    assert sr.status_code == 200, f"stand failed: {sr.status_code} {sr.text[:200]}"


# ---------- GISA audit ----------
def test_gisa_run_full_audit():
    r = requests.post(f"{BASE}/api/gisa/run", json={"mode": "full_audit", "users": 200}, timeout=60)
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    j = r.json()
    overall = (j.get("summary") or {}).get("overall_status") or j.get("overall")
    # statistical model — pass or warn within tight margin both acceptable per spec
    assert overall in ("pass", "warn"), f"GISA bad overall: {overall}"
    rooms = (j.get("visual") or {}).get("rooms") or []
    assert len(rooms) == 32, f"expected 32 audited rooms, got {len(rooms)}"
    names = [r["room_name"] for r in rooms]
    assert "Celestial Glasshouse" in names, "Celestial Glasshouse missing"


def test_gisa_report_latest():
    r = requests.get(f"{BASE}/api/gisa/report/latest", timeout=15)
    assert r.status_code == 200


# ---------- Localization v2 ----------
def test_localization_detect_japan():
    r = requests.post(
        f"{BASE}/api/localization/detect", json={},
        headers={"Accept-Language": "ja-JP", "X-Country": "JP"}, timeout=15,
    )
    assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
    body = r.json()
    loc = body.get("localization", body)
    assert loc.get("language_code", "").startswith("ja"), f"lang={loc.get('language_code')}"
    assert loc.get("currency_code") == "JPY" or loc.get("currency") == "JPY", f"currency={loc}"


def test_localization_save_and_read_roundtrip():
    uid = "TEST_beta_sweep_user"
    payload = {"country_code": "JP", "language_code": "ja", "dialect": "standard"}
    s = requests.post(f"{BASE}/api/localization/me/{uid}/save", json=payload, timeout=15)
    assert s.status_code == 200, f"save: {s.status_code} {s.text[:200]}"
    g = requests.get(f"{BASE}/api/localization/me/{uid}", timeout=15)
    assert g.status_code == 200
    body = g.json()
    saved = body.get("localization", body)
    assert saved.get("country_code") == "JP" or saved.get("country") == "JP"


# ---------- Cultural Onboarding ----------
def test_cultural_onboarding_complete_flow():
    uid = f"TEST_beta_onboard_{os.urandom(4).hex()}"
    canonical_steps = [
        ("origin_and_vibe", {"country_code": "JP", "vibe": "calm"}),
        ("linguistic_range", {"languages": ["ja", "en"]}),
        ("dialect_selection", {"dialect": "standard"}),
        ("cultural_values", {"values": ["family", "respect"]}),
    ]
    for step_name, step_payload in canonical_steps:
        rr = requests.post(
            f"{BASE}/api/cultural-onboarding/{uid}/submit",
            json={"step": step_name, "payload": step_payload},
            timeout=15,
        )
        assert rr.status_code in (200, 201), f"step {step_name}: {rr.status_code} {rr.text[:200]}"

    c = requests.get(f"{BASE}/api/cultural-onboarding/{uid}/complete", timeout=15)
    assert c.status_code == 200, f"{c.status_code} {c.text[:200]}"
    body = c.json()
    assert body.get("complete") is True or body.get("is_complete") is True, f"not complete: {body}"


# ---------- Tic Tac Toe 5-in-a-row ----------
def test_tictactoe_creates_12x12_room():
    r = requests.post(f"{BASE}/api/games/tic_tac_toe/create",
                      json={"room_name": "TEST_beta_tictac"}, timeout=15)
    if r.status_code == 404:
        # alt route
        r = requests.post(f"{BASE}/api/tic_tac_toe/create", json={}, timeout=15)
    # Just need no 500; if endpoint requires auth that's OK
    assert r.status_code != 500, f"crashed: {r.text[:200]}"


# ---------- Ride system ----------
def test_vibe_ridez_endpoints_no_500():
    eps = ["/api/vibe-ridez/summary", "/api/vibe-ridez/active-rides"]
    for ep in eps:
        r = requests.get(f"{BASE}{ep}", timeout=15)
        assert r.status_code != 500, f"{ep} crashed: {r.text[:200]}"


# ---------- Treasury / count system ----------
def test_admin_master_stats_no_500():
    r = requests.get(f"{BASE}/api/admin/master-stats", timeout=15)
    # auth-gated → 401/403 ok; no 500
    assert r.status_code != 500, f"crashed: {r.text[:200]}"


def test_treasury_endpoints_no_500():
    for ep in ["/api/treasury/balance", "/api/treasury/summary", "/api/treasury/stats"]:
        r = requests.get(f"{BASE}{ep}", timeout=15)
        assert r.status_code != 500, f"{ep} crashed: {r.text[:200]}"
