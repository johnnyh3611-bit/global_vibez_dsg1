"""
Multi-human QA harness — simulates 2-3 simultaneous browsers joining the
same Vibe Room voice channel and verifies the Universal 2-20 Player
signaling layer behaves correctly under concurrent load.

This is the automated stand-in for live beta-tester multi-human QA.
Real human testing is still required for camera/mic flows, but this
harness covers:
  * 3 concurrent peers joining a single room
  * each peer sees the other 2 in `peer_list` / `peer_joined`
  * voice_activity from one peer broadcasts to the other 2
  * peer_left fires for everyone when one disconnects

Skips silently when Playwright Chromium isn't installed. Uses the live
preview backend over wss://, not the in-process TestClient — so we
exercise the real Kubernetes ingress + WebSocket upgrade path.
"""

from __future__ import annotations

import asyncio
import os
import time

import pytest

playwright = pytest.importorskip("playwright.async_api")  # type: ignore
from playwright.async_api import async_playwright  # noqa: E402

BASE = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://social-connect-953.preview.emergentagent.com",
).rstrip("/")
WS_BASE = BASE.replace("https://", "wss://").replace("http://", "ws://")


async def _chromium_available() -> bool:
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(headless=True)
            await b.close()
        return True
    except Exception:
        return False


async def _open_ws_peer(p, room_id: str, user_id: str):
    """Open a barebones browser context that connects to the WS endpoint
    via plain JS. We don't need a full SPA — just a page where we can
    `new WebSocket(...)` and capture inbound frames into a JS array.
    """
    browser = await p.chromium.launch(headless=True)
    ctx = await browser.new_context()
    page = await ctx.new_page()
    # about:blank is fine — we just need a JS runtime for the WS.
    await page.goto("about:blank")
    url = f"{WS_BASE}/api/vibe-room/ws/{room_id}/{user_id}"
    await page.evaluate(
        """(url) => {
            window.__frames = [];
            return new Promise((resolve, reject) => {
                const ws = new WebSocket(url);
                window.__ws = ws;
                ws.onopen = () => resolve(true);
                ws.onerror = (e) => reject(e);
                ws.onmessage = (e) => { window.__frames.push(JSON.parse(e.data)); };
            });
        }""",
        url,
    )
    return browser, ctx, page


async def _read_frames(page, expected_min: int = 1, timeout_s: float = 5.0):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        frames = await page.evaluate("() => window.__frames")
        if len(frames) >= expected_min:
            return frames
        await asyncio.sleep(0.1)
    return await page.evaluate("() => window.__frames")


@pytest.mark.skipif(
    not asyncio.get_event_loop_policy().new_event_loop().run_until_complete(_chromium_available()),
    reason="Playwright Chromium not installed",
)
@pytest.mark.asyncio
async def test_three_concurrent_peers_share_room() -> None:
    room = f"qa_multi_{int(time.time())}"

    async with async_playwright() as p:
        b1, _, page1 = await _open_ws_peer(p, room, "alice")
        b2, _, page2 = await _open_ws_peer(p, room, "bob")
        b3, _, page3 = await _open_ws_peer(p, room, "carol")

        # Each peer should have at least 1 frame: their own peer_list.
        f1 = await _read_frames(page1, expected_min=3)  # peer_list + 2 peer_joined
        f2 = await _read_frames(page2, expected_min=2)  # peer_list + 1 peer_joined
        f3 = await _read_frames(page3, expected_min=1)  # peer_list

        # Alice's first frame is peer_list ([]).
        assert f1[0]["type"] == "peer_list"
        assert f1[0]["peers"] == []
        # Then peer_joined bob, peer_joined carol.
        assert any(f.get("type") == "peer_joined" and f.get("user_id") == "bob" for f in f1)
        assert any(f.get("type") == "peer_joined" and f.get("user_id") == "carol" for f in f1)

        # Bob's peer_list contains alice.
        assert f2[0]["type"] == "peer_list"
        assert {x["user_id"] for x in f2[0]["peers"]} == {"alice"}

        # Carol's peer_list contains alice + bob.
        assert f3[0]["type"] == "peer_list"
        assert {x["user_id"] for x in f3[0]["peers"]} == {"alice", "bob"}

        # Bob speaks → alice + carol receive speaker_update.
        await page2.evaluate(
            "() => window.__ws.send(JSON.stringify({type:'voice_activity', active:true}))"
        )
        await asyncio.sleep(1.0)
        f1b = await _read_frames(page1, expected_min=4)
        f3b = await _read_frames(page3, expected_min=2)
        assert any(
            f.get("type") == "speaker_update" and f.get("user") == "bob" and f.get("active")
            for f in f1b
        )
        assert any(
            f.get("type") == "speaker_update" and f.get("user") == "bob" and f.get("active")
            for f in f3b
        )

        # Carol leaves → alice + bob receive peer_left.
        await b3.close()
        await asyncio.sleep(1.0)
        f1c = await _read_frames(page1, expected_min=5)
        f2c = await _read_frames(page2, expected_min=3)
        assert any(
            f.get("type") == "peer_left" and f.get("user_id") == "carol" for f in f1c
        )
        assert any(
            f.get("type") == "peer_left" and f.get("user_id") == "carol" for f in f2c
        )

        await b1.close()
        await b2.close()
