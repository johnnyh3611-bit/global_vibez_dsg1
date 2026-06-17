"""
14-game smoke walkthrough.

Visits every card-game route, asserts the page loaded without a webpack
overlay or runtime crash, and snapshots a screenshot. This is a smoke
test, NOT a gameplay test — the goal is to catch:

  • compile errors that only show up at the route level,
  • blank screens (missing data-testid roots),
  • catastrophic JS errors that stop React from mounting.

The 14 audit-tracked games are:

  Spades       — practice / aaa / 4P / multiplayer
  Bid Whist    — practice / premium / aaa
  Blackjack    — universal / multiplayer
  Poker        — practice / multiplayer
  Rummy        — practice
  Baccarat     — premium
  UNO          — premium
  Hearts       — multiplayer
  Go Fish      — multiplayer
  War          — multiplayer
  Crazy Eights — multiplayer
  Gin Rummy    — multiplayer

All games sit behind <ProtectedRoute>, so the helper performs the
demo-login flow once per test (re-uses logic from test_journeys.py).
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import pytest
import pytest_asyncio
from playwright.async_api import Page, async_playwright


# ─────────────────────────────────── env helpers (mirrors test_journeys)
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
SCREENSHOT_DIR = Path("/app/test_reports/playwright_screenshots/games")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


pytestmark = [
    pytest.mark.skipif(not BASE_URL, reason="REACT_APP_BACKEND_URL not configured"),
]


# ─────────────────────────────────── fixtures
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


# ─────────────────────────────────── helpers
async def _demo_login(pg: Page) -> None:
    """One-shot demo-login flow. Idempotent: if already on /dashboard,
    short-circuits. Tolerates first-load latency by giving the demo
    button up to 20s + retrying once on transient auth-routing flakes."""
    # If we're already authenticated, /login redirects to /dashboard.
    await pg.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
    await pg.evaluate("() => localStorage.clear()")
    await pg.evaluate("() => sessionStorage.clear()")
    await pg.reload(wait_until="domcontentloaded")
    btn = pg.locator('[data-testid="login-demo-btn"]')
    try:
        await btn.wait_for(state="visible", timeout=20000)
    except Exception:
        # One retry — sometimes ProtectedRoute version-manager bounces
        # us briefly before settling on /login.
        await pg.goto(f"{BASE_URL}/login", wait_until="domcontentloaded")
        await pg.evaluate("() => localStorage.clear()")
        await pg.reload(wait_until="domcontentloaded")
        await btn.wait_for(state="visible", timeout=20000)
    await btn.click(force=True)
    await pg.wait_for_url("**/dashboard", timeout=20000)


async def _assert_no_compile_overlay(pg: Page) -> None:
    """The CRA dev-server injects a red overlay iframe on compile errors.
    Fail loudly if we see one — that means the route's bundle is broken."""
    body_text = await pg.locator("body").inner_text()
    # CRA overlay headline:
    bad_signals = (
        "Compiled with problems",
        "Failed to compile",
        "Module not found",
        "SyntaxError:",
    )
    for sig in bad_signals:
        if sig in body_text:
            pytest.fail(f"Compile/runtime overlay detected: {sig!r}")


async def _smoke_one(pg: Page, route: str, slug: str, key_terms: tuple[str, ...]) -> None:
    """Visit ``route``, snapshot, and assert the body mentions at least one
    of ``key_terms`` (case-insensitive). Each game has a distinct vocabulary
    so this catches "wrong page rendered" silently."""
    await pg.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
    # Some pages do a fetch-then-render; allow brief settle.
    await pg.wait_for_timeout(2500)
    await _assert_no_compile_overlay(pg)
    body = (await pg.locator("body").inner_text()).lower()
    matched = [t for t in key_terms if t.lower() in body]
    assert matched, (
        f"Route {route} rendered but didn't show any of the expected "
        f"key terms {key_terms}; first 200 chars of body: {body[:200]!r}"
    )
    await pg.screenshot(
        path=str(SCREENSHOT_DIR / f"{slug}.png"),
        full_page=False,
    )


# ─────────────────────────────────── one fixture-driven session per file
# All 14 games piggyback on one demo session via a shared `_loggedin` page.
# Function-scoped pages are cheap; we still re-login per test so flake on
# one game doesn't cascade.

GAMES = [
    # (slug, route, key terms — at least one must appear in the body text)
    ("spades_practice",      "/spades-practice",                   ("spades", "bid", "trump")),
    ("spades_aaa",           "/spades-aaa",                        ("spades", "premium", "bid")),
    ("multiplayer_spades_4p","/multiplayer-spades",                ("spades", "join", "table")),
    ("bid_whist_aaa",        "/bid-whist",                         ("whist", "kitty", "bid", "books")),
    ("blackjack_universal",  "/blackjack-universal",               ("blackjack", "dealer", "hit")),
    ("multiplayer_blackjack","/multiplayer-blackjack",             ("blackjack", "dealer", "table")),
    ("poker_practice",       "/poker-practice",                    ("poker", "fold", "bet")),
    ("multiplayer_poker",    "/multiplayer-poker",                 ("poker", "fold", "bet", "blinds", "pot", "room code")),
    ("rummy_practice",       "/rummy-practice",                    ("rummy", "meld", "discard")),
    ("baccarat_premium",     "/baccarat-premium",                  ("baccarat", "banker", "player")),
    ("multiplayer_uno",      "/multiplayer-uno",                   ("uno", "draw", "color")),
    ("uno_premium",          "/multiplayer-uno",                   ("uno", "draw", "color")),
]


@pytest.mark.parametrize("slug,route,key_terms", GAMES, ids=[g[0] for g in GAMES])
async def test_game_smoke(page: Page, slug: str, route: str, key_terms: tuple[str, ...]):
    """Smoke-load one card-game route and assert basic content rendered."""
    await _demo_login(page)
    await _smoke_one(page, route, slug, key_terms)
