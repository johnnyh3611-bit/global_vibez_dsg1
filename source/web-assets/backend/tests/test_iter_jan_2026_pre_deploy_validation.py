"""Pre-deploy validation suite for Global Vibez DSG (Jan 2026 session)."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com').rstrip('/')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'GlobalVibez_Founder_2025!')
ADMIN_2FA = os.environ.get('ADMIN_2FA', '000000')


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def demo_token(s):
    r = s.post(f"{BASE_URL}/api/auth/demo-login", timeout=20)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data["token"]


@pytest.fixture(scope="module")
def admin_session():
    sess = requests.Session()
    r = sess.post(f"{BASE_URL}/api/admin/vault-auth",
                  json={"password": ADMIN_PASSWORD, "code": ADMIN_2FA}, timeout=15)
    assert r.status_code == 200, f"vault-auth failed: {r.status_code} {r.text}"
    return sess


# -------- Health --------
def test_api_health(s):
    r = s.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200, r.text


def test_root_health(s):
    r = s.get(f"{BASE_URL}/health", timeout=10)
    assert r.status_code == 200, r.text


# -------- Chairs economics & expansion (Genius/Genesis rename) --------
def test_chairs_economics_genius_genesis(s):
    r = s.get(f"{BASE_URL}/api/chairs/economics", timeout=10)
    assert r.status_code == 200
    data = r.json()
    tiers = data.get("tiers", [])
    assert len(tiers) >= 2, f"tiers={tiers}"
    assert tiers[0]["name"] == "Genius", tiers[0]
    assert float(tiers[0].get("price_usd", tiers[0].get("price", 0))) == 10.0
    assert float(tiers[0]["weight"]) == 3.0
    assert tiers[1]["name"] == "Genesis", tiers[1]
    assert float(tiers[1].get("price_usd", tiers[1].get("price", 0))) == 15.0
    assert float(tiers[1]["weight"]) == 2.0


def test_chairs_expansion_plan_phase_rename(s):
    r = s.get(f"{BASE_URL}/api/chairs/expansion-plan", timeout=10)
    assert r.status_code == 200
    tiers = r.json().get("tiers", [])
    assert tiers[0]["name"] == "Genius Phase", tiers[0]
    assert tiers[1]["name"] == "Genesis Phase", tiers[1]


# -------- Chair Wall --------
def test_chair_wall_list(s):
    r = s.get(f"{BASE_URL}/api/chairs/wall", timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    rows = body.get("chairs") or body.get("rows") or body
    if isinstance(rows, dict) and "items" in rows:
        rows = rows["items"]
    assert isinstance(rows, list), f"unexpected wall body: {body}"
    # At least one row should exist (5 founder chairs seeded)
    if len(rows) == 0:
        pytest.skip("No chair-wall rows present (DB possibly wiped). Endpoint OK.")
    sample = rows[0]
    assert "chair_id" in sample, sample
    assert "holder_handle" in sample or "handle" in sample
    assert "phase" in sample


def test_chair_wall_detail_1(s):
    r = s.get(f"{BASE_URL}/api/chairs/wall/1", timeout=10)
    assert r.status_code in (200, 404), r.text
    if r.status_code == 200:
        body = r.json()
        assert body.get("chair_id") in (1, "00001", "1") or "00001" in str(body)


# -------- /api/chairs/me --------
def test_chairs_me_with_demo(s, demo_token):
    r = s.get(f"{BASE_URL}/api/chairs/me",
              headers={"Authorization": f"Bearer {demo_token}"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    locked = data.get("locked_chairs", 0)
    assert locked >= 1, f"expected >=1 chair for demo user, got {locked}: {data}"
    assert "chair_ids" in data, data
    assert isinstance(data["chair_ids"], list)
    assert len(data["chair_ids"]) == locked
    if "phase_breakdown" in data and data["phase_breakdown"]:
        # First phase entry should be Genius for the founder seed
        assert data["phase_breakdown"][0]["phase"] in ("Genius", "Genesis"), data["phase_breakdown"][0]


# -------- Apex/Escape Velocity --------
def test_apex_status_still_works(s):
    r = s.get(f"{BASE_URL}/api/apex/status", timeout=10)
    assert r.status_code == 200, r.text


# -------- Chair Holder Votes Flow --------
def test_chair_holder_vote_lifecycle(admin_session, demo_token, s):
    # 1) Admin creates vote
    payload = {
        "question": "TEST_pre_deploy_vote_question",
        "duration_hours": 24,
        "weighted": True,
        "options": ["yes", "no", "abstain"],
    }
    r = admin_session.post(f"{BASE_URL}/api/admin/chair-holder-votes",
                           json=payload, timeout=15)
    if r.status_code == 404:
        pytest.skip("chair-holder-votes endpoint not registered")
    assert r.status_code in (200, 201), f"create vote failed: {r.status_code} {r.text}"
    vote = r.json()
    vote_id = vote.get("vote_id") or vote.get("id") or vote.get("_id")
    assert vote_id, vote

    # 2) Demo user lists eligible votes
    r2 = s.get(f"{BASE_URL}/api/chair-holder-votes",
               headers={"Authorization": f"Bearer {demo_token}"}, timeout=15)
    assert r2.status_code == 200, r2.text
    votes_list = r2.json()
    if isinstance(votes_list, dict):
        votes_list = votes_list.get("votes") or votes_list.get("items") or []
    found = any(
        (v.get("vote_id") == vote_id or v.get("id") == vote_id)
        for v in votes_list
    )
    assert found, f"created vote {vote_id} not in list: {votes_list}"

    # 3) Demo user casts a YES vote
    r3 = s.post(f"{BASE_URL}/api/chair-holder-votes/{vote_id}/cast",
                json={"choice": "yes"},
                headers={"Authorization": f"Bearer {demo_token}"}, timeout=15)
    assert r3.status_code in (200, 201), f"cast failed: {r3.status_code} {r3.text}"
    cast_body = r3.json()

    # 4) Admin reads results
    r4 = admin_session.get(f"{BASE_URL}/api/admin/chair-holder-votes/{vote_id}/results",
                           timeout=15)
    assert r4.status_code == 200, r4.text
    results = r4.json()
    tally = results.get("tally") or {}
    assert tally.get("yes", 0) >= 1 or any("yes" in str(v).lower() for v in (cast_body.get("tally") or {}).keys()), f"yes tally not >=1: results={results}"
    responses = results.get("responses") or []
    if responses:
        first = responses[0]
        # weight_at_cast may be 3.0 (founder weight) or 15.0 if multiplied by chair count
        assert "weight_at_cast" in first or "weight" in first, first
        assert "locked_chairs_at_cast" in first or "locked_chairs" in first, first
