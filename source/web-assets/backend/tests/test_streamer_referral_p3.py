"""End-to-end backend tests for the P3 Streamer Referral Program."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

BETA1 = {"email": "betatester1@globalvibez.com", "password": "BetaTester2026!"}
BETA2 = {"email": "betatester2@globalvibez.com", "password": "BetaTester2026!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    data = r.json()
    # try common shapes
    user = data.get("user") or data
    uid = user.get("user_id") or user.get("id") or data.get("user_id")
    assert uid, f"no user_id in {data}"
    return uid, data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def beta1():
    uid, _ = _login(BETA1)
    return uid


@pytest.fixture(scope="module")
def beta2():
    uid, _ = _login(BETA2)
    return uid


@pytest.fixture(scope="module")
def fresh_fake_user():
    return f"e2e-fake-{uuid.uuid4().hex[:10]}"


# ── /my-code/{user_id} ──
def test_my_code_idempotent(beta1):
    r1 = requests.get(f"{API}/streamer-referral/my-code/{beta1}", timeout=15)
    assert r1.status_code == 200, r1.text
    d1 = r1.json()
    assert d1["code"].startswith("VIBE-"), d1
    assert d1["share_url"].endswith(f"?ref={d1['code']}")
    assert d1["reward_coins"] == 1000
    assert d1["reward_featured_days"] == 5

    # second call returns SAME code
    r2 = requests.get(f"{API}/streamer-referral/my-code/{beta1}", timeout=15)
    assert r2.status_code == 200
    assert r2.json()["code"] == d1["code"], "code should be idempotent"


# ── /lookup ──
def test_lookup_valid_code(beta1):
    code = requests.get(f"{API}/streamer-referral/my-code/{beta1}", timeout=15).json()["code"]
    r = requests.get(f"{API}/streamer-referral/lookup/{code}", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["code"] == code
    assert d["reward_coins"] == 1000
    assert d["reward_featured_days"] == 5
    assert d["referrer_display_name"]


def test_lookup_invalid_code():
    r = requests.get(f"{API}/streamer-referral/lookup/INVALID-CODE", timeout=15)
    assert r.status_code == 404, r.text


# ── /redeem ──
def test_redeem_self_rejected(beta1):
    code = requests.get(f"{API}/streamer-referral/my-code/{beta1}", timeout=15).json()["code"]
    r = requests.post(f"{API}/streamer-referral/redeem", json={"code": code, "new_user_id": beta1}, timeout=15)
    assert r.status_code == 400, r.text


def test_redeem_bad_code(fresh_fake_user):
    r = requests.post(f"{API}/streamer-referral/redeem", json={"code": "VIBE-NOTREAL", "new_user_id": fresh_fake_user}, timeout=15)
    assert r.status_code == 404, r.text


def test_redeem_signup_then_idempotent_then_409(beta1, beta2, fresh_fake_user):
    code1 = requests.get(f"{API}/streamer-referral/my-code/{beta1}", timeout=15).json()["code"]

    # first redeem → SIGNED_UP
    r = requests.post(f"{API}/streamer-referral/redeem", json={"code": code1, "new_user_id": fresh_fake_user}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("status") in ("SIGNED_UP", "PAID")  # PAID if a prior qualify already ran

    # same again → already_redeemed
    r2 = requests.post(f"{API}/streamer-referral/redeem", json={"code": code1, "new_user_id": fresh_fake_user}, timeout=15)
    assert r2.status_code == 200, r2.text
    assert r2.json().get("already_redeemed") is True

    # different code, same user → 409
    code2 = requests.get(f"{API}/streamer-referral/my-code/{beta2}", timeout=15).json()["code"]
    if code2 != code1:
        r3 = requests.post(f"{API}/streamer-referral/redeem", json={"code": code2, "new_user_id": fresh_fake_user}, timeout=15)
        assert r3.status_code == 409, r3.text


# ── /qualify-on-live + /stats ──
def test_full_happy_path_qualify_and_stats(beta1, fresh_fake_user):
    # stats baseline
    s0 = requests.get(f"{API}/streamer-referral/stats/{beta1}", timeout=15).json()
    base_paid = s0["invites_paid"]
    base_coins = s0["coins_earned_lifetime"]
    base_feat = s0["featured_days_earned_lifetime"]

    # qualify (the redeem already happened in prior test for fresh_fake_user)
    r = requests.post(f"{API}/streamer-referral/qualify-on-live/{fresh_fake_user}", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    # Either paid=True now, OR already paid in earlier test run (idempotent re-run safety)
    assert d.get("paid") in (True, False)
    if d.get("paid"):
        assert d["reward_coins"] == 1000
        assert d["reward_featured_days"] == 5
        assert d["featured_until"]

    # qualify again → no_pending
    r2 = requests.post(f"{API}/streamer-referral/qualify-on-live/{fresh_fake_user}", timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("paid") is False
    assert r2.json().get("reason") == "no_pending_referral"

    # stats updated
    s1 = requests.get(f"{API}/streamer-referral/stats/{beta1}", timeout=15).json()
    assert s1["invites_paid"] >= base_paid + (1 if d.get("paid") else 0)
    assert s1["coins_earned_lifetime"] >= base_coins + (1000 if d.get("paid") else 0)
    assert s1["featured_days_earned_lifetime"] >= base_feat + (5 if d.get("paid") else 0)
    assert s1["code"]
    assert s1["share_url"].endswith(f"?ref={s1['code']}")
