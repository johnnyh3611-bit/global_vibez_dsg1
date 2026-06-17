"""Iteration test: Final 3-tier chair ladder (Genius/Genesis/Apex) + v12 Sovereign.
Feb 7 2026 production readiness sweep.
"""
from __future__ import annotations

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def demo_token() -> str:
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", timeout=30)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert "token" in data and "user_id" in data, f"missing token/user_id: {data}"
    return data["token"]


# ----- Chair Ladder -----
def test_chairs_phase_is_genius_20_weight3_cap100():
    r = requests.get(f"{BASE_URL}/api/chairs/phase", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert d.get("phase") == "Genius"
    assert d.get("price_usd") == 20
    assert d.get("weight") == 3
    assert d.get("limit") == 50000
    assert "100" in (d.get("tagline") or ""), f"tagline missing 100-chair cap: {d.get('tagline')}"


def test_chairs_expansion_plan_is_final_3_tier():
    r = requests.get(f"{BASE_URL}/api/chairs/expansion-plan", timeout=20)
    assert r.status_code == 200
    d = r.json()
    tiers = d.get("tiers") or d.get("phases") or []
    assert len(tiers) == 3, f"expected 3 tiers, got {len(tiers)}: {tiers}"
    names = {t.get("name") or t.get("phase") for t in tiers}
    assert {"Genius", "Genesis", "Apex"}.issubset(names), f"tier names: {names}"
    by_name = {(t.get("name") or t.get("phase")): t for t in tiers}
    # Tier sizes may be expressed as (low, high) inclusive ranges or (limit/count).
    def _size(t):
        if t.get("limit"): return t["limit"]
        if t.get("count"): return t["count"]
        low, high = t.get("low", 0), t.get("high", 0)
        return high - low + (0 if low == 0 else 1)
    assert by_name["Genius"].get("price_usd") == 20
    assert _size(by_name["Genius"]) == 50000
    assert by_name["Genesis"].get("price_usd") == 100
    assert _size(by_name["Genesis"]) == 100000
    assert by_name["Apex"].get("price_usd") == 250
    assert _size(by_name["Apex"]) == 50000
    assert d.get("active_circulation") == 200000
    assert d.get("reserve_vault_locked") == 800000
    assert d.get("total_potential_revenue_usd") == 23500000


def test_chairs_checkout_enforces_100_cap(demo_token):
    headers = {"Authorization": f"Bearer {demo_token}", "Origin": BASE_URL}
    r = requests.post(
        f"{BASE_URL}/api/chairs/checkout",
        json={"quantity": 101},
        headers=headers,
        timeout=30,
    )
    # 409 (business cap) OR 422 (Pydantic le=100 validation) both enforce the cap.
    assert r.status_code in (409, 422), f"expected 409/422 for >100, got {r.status_code}: {r.text[:300]}"
    body = r.text
    assert "100" in body, f"response should mention 100-cap: {body[:300]}"


def test_chairs_checkout_qty_1_succeeds(demo_token):
    headers = {
        "Authorization": f"Bearer {demo_token}",
        "Origin": BASE_URL,
        "Referer": f"{BASE_URL}/chair-vault",
    }
    r = requests.post(
        f"{BASE_URL}/api/chairs/checkout",
        json={"quantity": 1},
        headers=headers,
        timeout=30,
    )
    # Accept 200/201/202 as success; 402 acceptable if payment gated.
    assert r.status_code in (200, 201, 202, 402), f"qty=1 checkout failed: {r.status_code} {r.text[:300]}"


# ----- Economy / v12 -----
def test_economy_status_v12_constants_and_vaults():
    r = requests.get(f"{BASE_URL}/api/economy/status", timeout=20)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    consts = d.get("constants", {})
    assert consts.get("ambassador_dividend") == 0.035
    assert consts.get("ambassador_override") == 0.05
    fv = d.get("founder_vault", {})
    assert fv.get("total") == 200_000_000
    assert fv.get("unlock_chairs") == 50000
    assert fv.get("unlocked") is False
    cv = d.get("crew_vault", {})
    assert cv.get("total") == 50_000_000


def test_burn_schedule_wallet_caps():
    r = requests.get(f"{BASE_URL}/api/burn/schedule", timeout=20)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    caps = d.get("wallet_caps", {})
    assert caps.get("standard") == 2_000_000
    assert caps.get("chair_holder") == 5_000_000


def test_bridge_calculate_genius_bonus():
    r = requests.get(
        f"{BASE_URL}/api/bridge/calculate",
        params={"coins": 4000, "genius_bonus": "true"},
        timeout=20,
    )
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d.get("tokens_out") == 1500 or d.get("dsg_out") == 1500


# ----- Auth -----
def test_demo_login_returns_token_and_user_id():
    r = requests.post(f"{BASE_URL}/api/auth/demo-login", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d.get("token"), str) and len(d["token"]) > 10
    assert d.get("user_id")
