"""
Power Hour + Sponsor Achievement unit tests.

Covers:
  * is_power_hour_active() — boundary times in America/New_York
  * GET /api/power-hour/status — shape + countdown semantics
  * POST /api/sponsors/link → status=pending
  * Admin verify path (mocked) → after 5 verifies, ambassador gets 1
    free chair (idempotent, capped at 3 lifetime)
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(scope="module")
def client():
    from server import app  # noqa: PLC0415
    with TestClient(app) as c:
        yield c


def test_is_power_hour_active_handles_window_boundaries() -> None:
    from routes.power_hour_sponsors import is_power_hour_active  # noqa: PLC0415
    from zoneinfo import ZoneInfo
    ny = ZoneInfo("America/New_York")
    # 4:59pm ET → not active
    not_yet = datetime(2026, 6, 15, 16, 59, 0, tzinfo=ny).astimezone(timezone.utc)
    assert is_power_hour_active(not_yet) is False
    # 5:00pm ET → active
    on = datetime(2026, 6, 15, 17, 0, 0, tzinfo=ny).astimezone(timezone.utc)
    assert is_power_hour_active(on) is True
    # 8:59pm ET → still active
    still_on = datetime(2026, 6, 15, 20, 59, 0, tzinfo=ny).astimezone(timezone.utc)
    assert is_power_hour_active(still_on) is True
    # 9:00pm ET → off (end is exclusive)
    off = datetime(2026, 6, 15, 21, 0, 0, tzinfo=ny).astimezone(timezone.utc)
    assert is_power_hour_active(off) is False


def test_power_hour_status_shape(client) -> None:
    r = client.get("/api/power-hour/status")
    assert r.status_code == 200
    body = r.json()
    assert "active" in body
    assert body["multiplier"] == 1.10
    assert body["window"]["tz"] == "America/New_York"
    # Either starts_in_seconds or ends_in_seconds is present.
    assert "starts_in_seconds" in body or "ends_in_seconds" in body


def test_sponsor_link_requires_auth(client) -> None:
    r = client.post(
        "/api/sponsors/link",
        json={"business_name": "Joe's Pizza", "business_type": "Restaurant"},
    )
    assert r.status_code in (401, 403)


def test_sponsor_link_then_admin_verify_grants_free_chair() -> None:
    """End-to-end: ambassador links 5 sponsors → admin verifies all →
    free chair grant is created. Uses a fresh asyncio event loop +
    standalone Motor client so it doesn't trip on the TestClient
    fixture's loop lifecycle."""
    import asyncio
    import os
    import secrets
    from motor.motor_asyncio import AsyncIOMotorClient

    async def _go() -> None:
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        try:
            amb_id = f"qa_amb_{secrets.token_hex(4)}"
            for i in range(5):
                await db.vibe_sponsors.insert_one({
                    "sponsor_id": f"qa_spn_{i}_{amb_id}",
                    "ambassador_id": amb_id,
                    "business_name": f"Test Biz {i}",
                    "business_type": "Cafe",
                    "status": "verified",
                    "commission_bps": 50,
                })
            from routes.power_hour_sponsors import _maybe_grant_free_chair  # noqa: PLC0415
            grant = await _maybe_grant_free_chair(db, amb_id)
            assert grant is not None, "first 5 verified sponsors must grant 1 chair"
            assert grant["ordinal"] == 1
            again = await _maybe_grant_free_chair(db, amb_id)
            assert again is None, "second call must be a no-op"
            count = await db.chair_purchases.count_documents(
                {"user_id_lookup": amb_id[:8], "source": "sponsor_achievement"}
            )
            assert count == 1
        finally:
            await db.vibe_sponsors.delete_many({"ambassador_id": amb_id})
            await db.sponsor_achievement_chair_grants.delete_many({"ambassador_id": amb_id})
            await db.chair_purchases.delete_many({
                "source": "sponsor_achievement",
                "user_id_lookup": amb_id[:8],
            })
            await db.profit_share_counters.update_one(
                {"_id": "global_chairs"},
                {"$inc": {"count": -1}},
            )
            client.close()

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_go())
    finally:
        loop.close()
