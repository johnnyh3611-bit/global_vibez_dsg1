"""
Test the new Vibe Integrity & Ban Protocol routes + Sovereign Tiers
pricing curve. These add to /home/johnnie/master-project/tests/regression_shield.py via
the locks at the bottom — failing here would prevent shipping.
"""
from __future__ import annotations

import os
import pytest

os.environ.setdefault("DB_NAME", "test_regression_shield")


def test_integrity_routes_registered():
    """The integrity router is wired up at /api/integrity/* and exposes
    /report, /resolve, /my-status, /config. Sovereign Master Code §2."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for endpoint in [
        "/api/integrity/report",
        "/api/integrity/resolve",
        "/api/integrity/my-status",
        "/api/integrity/config",
    ]:
        assert endpoint in paths, f"Missing endpoint: {endpoint}"


def test_integrity_config_values_lock():
    """Vibe Check thresholds are spec-locked from the Integrity Protocol
    PDF: 10 reporters, 75% consensus, 2× chair-holder weight, 5 ₵ reward."""
    from routes.integrity_protocol import VIBE_CHECK
    assert VIBE_CHECK["Min_Reporters"] == 10
    assert VIBE_CHECK["Consensus_Threshold"] == 0.75
    assert VIBE_CHECK["Genius_Chair_Weight"] == 2.0
    assert VIBE_CHECK["Reward_Per_Correct_Report_Vibe"] == 5
    # Three-strike policy:
    assert VIBE_CHECK["Strike_1"]["tax_pct"] == 0.10
    assert VIBE_CHECK["Strike_1"]["suspension_hours"] == 24
    assert VIBE_CHECK["Strike_2"]["tax_pct"] == 0.50
    assert VIBE_CHECK["Strike_2"]["suspension_hours"] == 24 * 7
    assert VIBE_CHECK["Strike_3"]["permanent_ban"] is True


def test_sovereign_tiers_pricing_math_locked():
    """Founder-confirmed pricing curve. 2× price step ⇒ Tastemaker is the
    obvious anchor at $19 with the popular_anchor flag set."""
    from routes.sovereign_tiers import TIERS, ANNUAL_DISCOUNT_PCT

    by_id = {t["id"]: t for t in TIERS}
    # Curve check.
    assert by_id["guest"]["price_usd"] == 0
    assert by_id["insider"]["price_usd"] == 9
    assert by_id["tastemaker"]["price_usd"] == 19
    assert by_id["royal"]["price_usd"] == 39
    assert by_id["sovereign"]["price_usd"] == 89
    assert by_id["genius_chair"]["price_usd"] == 20
    # Anchor flag = Tastemaker (and only Tastemaker).
    anchors = [t for t in TIERS if t.get("popular_anchor")]
    assert len(anchors) == 1, "Exactly one tier may be popular_anchor"
    assert anchors[0]["id"] == "tastemaker"
    # Insider must carry the $1 first-month trial.
    assert by_id["insider"].get("trial_intro_usd") == 1
    # Annual discount = 2 months free ≈ 16.67%.
    assert round(ANNUAL_DISCOUNT_PCT, 2) == 16.67
    # Yearly price = 12 × monthly × (1 - 0.1667) for every paid monthly tier.
    for tier in [by_id["insider"], by_id["tastemaker"], by_id["royal"], by_id["sovereign"]]:
        expected = int(round(tier["price_usd"] * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100)))
        assert tier["price_usd_year"] == expected, f"Annual price math wrong for {tier['id']}"


def test_sovereign_tier_routes_wired():
    """The /api/tiers/* router is mounted. Catalog + me + subscribe at
    minimum (we exercise the catalog via FastAPI route check, not HTTP)."""
    from server import app
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    for endpoint in ["/api/tiers/catalog", "/api/tiers/me", "/api/tiers/subscribe"]:
        assert endpoint in paths, f"Missing tiers endpoint: {endpoint}"


def test_vibe_check_report_component_exists():
    """Frontend Vibe Check widget must exist and use the report endpoint."""
    path = "/app/frontend/src/components/sports/VibeCheckReport.tsx"
    assert os.path.exists(path)
    src = open(path).read()
    assert "/api/integrity/report" in src
    assert "vibe-check-trigger-" in src
    assert "vibe-check-modal" in src


def test_sovereign_tiers_frontend_page_exists():
    """Sovereign Tiers page renders the catalog and ships the testids
    the testing agent will probe."""
    path = "/app/frontend/src/pages/SovereignTiers.tsx"
    assert os.path.exists(path)
    src = open(path).read()
    assert "/api/tiers/catalog" in src
    assert "/api/tiers/subscribe" in src
    assert "sovereign-tiers-page" in src
    assert "tiers-grid" in src
    # Tastemaker must carry the popular badge testid.
    assert "tier-popular-" in src
    # Annual / monthly toggle testids.
    assert "tiers-interval-month" in src
    assert "tiers-interval-year" in src


def test_sports_lounge_wires_vibe_check():
    """The Sports Lounge embeds VibeCheckReport on every game card."""
    src = open("/app/frontend/src/pages/SportsLounge.tsx").read()
    assert "VibeCheckReport" in src
    assert "components/sports/VibeCheckReport" in src
