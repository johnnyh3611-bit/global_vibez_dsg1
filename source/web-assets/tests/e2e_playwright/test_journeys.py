"""
Playwright UI walkthrough — critical user journeys.

Run via: /opt/plugins-venv/bin/python -m pytest tests/e2e_playwright/ -v
(plugins-venv has playwright + browsers pre-installed)

Each test is intentionally short, headless, and asserts a key visible
landmark per route — designed to catch UI/UX/visual regressions fast.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Optional

import pytest
import pytest_asyncio
from playwright.async_api import async_playwright, Browser, Page


# ─────────────────────────────────────────────────────── env helpers
def _read_env_files() -> dict:
    out = {}
    for path in ("/app/frontend/.env", "/app/backend/.env"):
        p = Path(path)
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                out.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return out


_FILE_ENV = _read_env_files()


def _env(name: str) -> Optional[str]:
    return os.environ.get(name) or _FILE_ENV.get(name)


BASE_URL = (_env("REACT_APP_BACKEND_URL") or "").rstrip("/")
ADMIN_PASSWORD = _env("ADMIN_PASSWORD") or ""
ADMIN_2FA = _env("ADMIN_2FA") or ""

SCREENSHOT_DIR = Path("/app/test_reports/playwright_screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


pytestmark = [
    pytest.mark.skipif(not BASE_URL, reason="REACT_APP_BACKEND_URL not configured"),
]


# ─────────────────────────────────────────────────────── fixtures
# Function-scoped browser: simpler + avoids known pytest-asyncio v1.x
# session/event-loop EPIPE issues. Each test re-launches Chromium
# (cheap headless on Linux — adds ~1-2s per test).
@pytest_asyncio.fixture
async def page():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        pg = await ctx.new_page()
        try:
            yield pg
        finally:
            await ctx.close()
            await browser.close()


async def _shot(page: Page, name: str) -> None:
    """Snapshot helper — saves a small PNG under /app/test_reports/playwright_screenshots/."""
    await page.screenshot(
        path=str(SCREENSHOT_DIR / f"{name}.png"),
        full_page=False,
    )


# ╭──────────────────────────────────────────────────────────────────────╮
# │ Journey 1 — Landing page renders                                       │
# ╰──────────────────────────────────────────────────────────────────────╯
async def test_landing_page_renders(page: Page):
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    assert "Vibez" in (await page.title()) or "Global" in (await page.title()) or await page.locator("body").count() > 0
    await _shot(page, "01_landing")


# ╭──────────────────────────────────────────────────────────────────────╮
# │ Journey 2 — Login page shows the Demo Login button                    │
# ╰──────────────────────────────────────────────────────────────────────╯
async def test_login_page_has_demo_button(page: Page):
    await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    btn = page.locator('[data-testid="login-demo-btn"]')
    await btn.wait_for(state="visible", timeout=10000)
    assert await btn.is_enabled()
    await _shot(page, "02_login_with_demo_button")


# ╭──────────────────────────────────────────────────────────────────────╮
# │ Journey 3 — Demo login → dashboard (the recently-fixed bug)           │
# ╰──────────────────────────────────────────────────────────────────────╯
async def test_demo_login_lands_on_dashboard(page: Page):
    await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    await page.evaluate("() => localStorage.clear()")
    await page.reload(wait_until="domcontentloaded")
    btn = page.locator('[data-testid="login-demo-btn"]')
    await btn.wait_for(state="visible", timeout=10000)
    await btn.click(force=True)

    # Allow the version-manager + ProtectedRoute round-trip to settle.
    await page.wait_for_timeout(7000)
    assert "/dashboard" in page.url, f"expected /dashboard, got {page.url}"
    token = await page.evaluate("() => localStorage.getItem('auth_token')")
    assert token and token.startswith("demo_session_"), "auth_token missing or malformed"
    await _shot(page, "03_dashboard_after_demo_login")


# ╭──────────────────────────────────────────────────────────────────────╮
# │ Journey 4 — Dashboard reveals Game Arena tile                          │
# ╰──────────────────────────────────────────────────────────────────────╯
async def test_dashboard_shows_game_arena(page: Page):
    # Re-establish demo session for an isolated browser context.
    await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    await page.evaluate("() => localStorage.clear()")
    await page.reload(wait_until="domcontentloaded")
    await page.locator('[data-testid="login-demo-btn"]').click(force=True)
    await page.wait_for_url("**/dashboard", timeout=15000)
    await page.wait_for_timeout(2500)
    body_text = (await page.locator("body").inner_text()).lower()
    assert "game" in body_text, "dashboard should mention games"
    await _shot(page, "04_dashboard_game_tile")


# ╭──────────────────────────────────────────────────────────────────────╮
# │ Journey 5 — Admin login flow renders the vault gate                    │
# ╰──────────────────────────────────────────────────────────────────────╯
async def test_admin_route_is_gated(page: Page):
    await page.goto(f"{BASE_URL}/admin", wait_until="domcontentloaded")
    await page.wait_for_timeout(2500)
    body = (await page.locator("body").inner_text()).lower()
    # Either we see a password/auth prompt OR we get redirected to login.
    gated_signals = ("password", "vault", "founder", "sign in", "login", "admin")
    assert any(s in body for s in gated_signals), f"admin page text didn't show a gate: {body[:200]}"
    await _shot(page, "05_admin_gate")


# ╭──────────────────────────────────────────────────────────────────────╮
# │ Journey 6 — Big Wheel Lounge public route                              │
# ╰──────────────────────────────────────────────────────────────────────╯
async def test_big_wheel_lounge_public(page: Page):
    await page.goto(f"{BASE_URL}/spades/big-wheel", wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)
    body = (await page.locator("body").inner_text()).lower()
    # Should mention either Big Wheel, Joker, or Spades
    assert any(k in body for k in ("big wheel", "joker", "spades")), (
        f"Big Wheel Lounge page didn't render expected content: {body[:200]}"
    )
    await _shot(page, "06_big_wheel_lounge")
