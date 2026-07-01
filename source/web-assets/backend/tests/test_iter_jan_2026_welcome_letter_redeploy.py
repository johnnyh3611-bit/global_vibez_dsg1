"""
Regression suite: WelcomeLetter / collapsed ChairExpansionPlan / new chair pricing.

Validates:
  * /health and /api/health remain 200 (deploy probe fix)
  * /api/chairs/phase reflects new Genesis $10 / 50K cap / 3× weight
  * /api/chairs/expansion-plan still returns 10 tiers ($10..$55)
"""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


# ---------- deploy probes ----------
def test_root_health_ok():
    """In preview env, ingress routes /health to frontend; check internal 8001 too."""
    r = requests.get(f"{BASE_URL}/health", timeout=15)
    assert r.status_code == 200, r.text
    # Internal backend definitely returns JSON {status:ok}
    r2 = requests.get("http://localhost:8001/health", timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("status") == "ok"


def test_api_health_ok():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("status") == "ok"


# ---------- legacy phase endpoint (now Genesis-aligned) ----------
def test_chairs_phase_genesis_aligned():
    r = requests.get(f"{BASE_URL}/api/chairs/phase", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    # When Genesis is still active, expect the new ladder values
    assert body.get("phase") == "Genesis", f"phase={body.get('phase')}"
    assert body.get("price_usd") == 10.0, f"price_usd={body.get('price_usd')}"
    assert body.get("weight") == 3.0, f"weight={body.get('weight')}"
    assert body.get("in_phase_capacity") == 50000, (
        f"in_phase_capacity={body.get('in_phase_capacity')}"
    )
    tagline = (body.get("tagline") or "").lower()
    assert "3" in tagline and ("earn" in tagline or "rate" in tagline), tagline
    # total_sold must be a real number
    assert isinstance(body.get("total_sold"), (int, float))


# ---------- expansion plan still returns 10 tiers ----------
def test_chairs_expansion_plan_full_ladder():
    r = requests.get(f"{BASE_URL}/api/chairs/expansion-plan", timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    tiers = body.get("tiers") or []
    assert len(tiers) == 10, f"got {len(tiers)} tiers"
    prices = [t.get("price_usd") for t in tiers]
    assert prices[0] == 10 and prices[-1] == 55, prices
    # +$5 every tier
    for a, b in zip(prices, prices[1:]):
        assert b - a == 5, prices
    # Apex tier present in API even though hidden in UI
    assert any(t.get("order") == 10 for t in tiers)
