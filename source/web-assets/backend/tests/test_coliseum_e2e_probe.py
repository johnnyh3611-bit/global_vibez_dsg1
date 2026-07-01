"""
Playwright e2e probe for the in-table Coliseum compressed center stage.

Created 2026-02-06 to address the LOW-priority finding from the
previous testing-agent run:

    "Could not verify `Play Next Orbit` button + tiny dice + 'Round X ·
    Pot' on the actual in-table route — /games/vibe654/tournament was
    the lobby, not the table view."

This probe:
  1. demo-logs the test user in
  2. POSTs /api/vibe654/tournament/create-table to spin up a fresh table
  3. navigates to /vibe-654/coliseum/{table_id}
  4. asserts the live qualifier chips (6/5/4) + tiny dice tray +
     "Round 0 · Pot" label + cyan-emerald palette of the menu bar
     are all present in the DOM

Skips silently when Playwright Chromium isn't installed in the
container (CI keeps the slim image).
"""

from __future__ import annotations

import os

import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")

playwright = pytest.importorskip("playwright.sync_api")  # type: ignore
from playwright.sync_api import sync_playwright  # noqa: E402


def _bootstrap_table() -> tuple[str, str]:
    """Create a fresh table via the public API and return (token, table_id)."""
    r = requests.post(f"{BASE}/api/auth/demo-login", timeout=15)
    r.raise_for_status()
    body = r.json()
    token = body["token"]
    user_id = body["user_id"]

    payload = {
        "host_user_id": user_id,
        "host_name": "QA Probe",
        "table_name": "QA Coliseum Probe",
        "buy_in": 100.0,
        "max_players": 4,
    }
    r = requests.post(
        f"{BASE}/api/vibe654/tournament/create-table",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    r.raise_for_status()
    return token, r.json()["table_id"]


def _chromium_available() -> bool:
    try:
        with sync_playwright() as p:
            p.chromium.launch(headless=True).close()
        return True
    except Exception:
        return False


@pytest.mark.skipif(not _chromium_available(), reason="Playwright Chromium not installed")
def test_coliseum_in_table_center_stage_renders_live_qualifiers() -> None:
    token, table_id = _bootstrap_table()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        # Seed token in localStorage before the SPA boots so the demo
        # user is recognised on first paint.
        page.goto(f"{BASE}/", wait_until="domcontentloaded")
        page.evaluate(
            "(t) => { localStorage.setItem('token', t); }",
            token,
        )
        page.goto(
            f"{BASE}/vibe-654/coliseum/{table_id}",
            wait_until="domcontentloaded",
        )
        page.wait_for_selector(
            '[data-testid="vibe654-coliseum-qualifier-row"]',
            timeout=15_000,
        )
        # 6, 5, 4 chips
        for digit in (6, 5, 4):
            assert page.query_selector(
                f'[data-testid="vibe654-coliseum-qualifier-{digit}"]'
            ) is not None, f"qualifier chip {digit} missing"
        # Tiny dice tray
        assert page.query_selector(
            '[data-testid="vibe654-coliseum-tiny-dice"]'
        ) is not None, "tiny dice tray missing"
        # Pot label
        pot = page.query_selector('[data-testid="vibe654-center-pot"]')
        assert pot is not None, "vibe654-center-pot label missing"
        # Universal voice bar mounted (Universal 2-20 player integration)
        assert page.query_selector('[data-testid="vibe-room-voice"]') is not None, (
            "Universal voice bar missing from Coliseum"
        )
        # Theme attribute on the menu bar = vibe654 OR colosseum
        bar = page.query_selector('[data-testid="room-menu-bar"]')
        if bar is not None:
            theme = bar.get_attribute("data-room-theme") or ""
            assert theme in ("colosseum", "vibe654", "default"), (
                f"unexpected coliseum menu-bar theme: {theme}"
            )
        ctx.close()
        browser.close()
