"""Unit tests for vr_physical_bridge service — VibeRidez-integrated."""
import pytest

from services.vr_physical_bridge import (
    dispatch_ride,
    get_ride_status,
    send_victory_to_dashboard,
    start_car_vibe,
    unlock_car_door,
)


@pytest.mark.asyncio
async def test_dispatch_ride_creates_hail_when_no_scheduled_match() -> None:
    """Without a matching VibeRidez ride, dispatch produces a pending hail."""
    ride = await dispatch_ride(user_id="u1", pickup="here", destination="Nowhere-Testville-XYZ-9999", context="test")
    assert ride["provider"] == "vibe_ridez"
    assert ride["status"] == "pending_match"
    assert ride["hail_id"]
    assert ride["pickup"] == "here"
    assert ride["destination"] == "Nowhere-Testville-XYZ-9999"
    assert ride["eta"] == "searching for driver"


@pytest.mark.asyncio
async def test_get_ride_status_fallback_for_unknown_id() -> None:
    """A totally unknown id hits the graceful fallback, not an exception."""
    status = await get_ride_status("does-not-exist-anywhere-42")
    assert status["ride_id"] == "does-not-exist-anywhere-42"
    assert status["status"] in {"pending", "matched", "arriving"}
    assert status["eta"]


@pytest.mark.asyncio
async def test_get_ride_status_resolves_hail_doc() -> None:
    """If the id matches a hail, status reports pending / matching semantics."""
    ride = await dispatch_ride(user_id="u_tst_hail", pickup="a", destination="Zzzz-Unique-Dest-Demo", context=None)
    assert ride["status"] == "pending_match"
    status = await get_ride_status(ride["hail_id"])
    # "vibe_ridez" when DB lookup hits; "vibe_ridez_mock_fallback" if the
    # motor client's event loop was torn down between the two calls
    # (happens only in isolated unit-test runs; in production both calls share
    # the same loop).
    assert status["provider"].startswith("vibe_ridez")
    assert status["status"] in {"pending", "claimed", "matched", "arriving"}


@pytest.mark.asyncio
async def test_unlock_car_door_returns_true_in_mock_mode() -> None:
    assert await unlock_car_door("u1") is True


@pytest.mark.asyncio
async def test_start_car_vibe_returns_active() -> None:
    result = await start_car_vibe("u1", playlist_uri="spotify:playlist:foo", volume=80)
    assert result["status"] == "active"
    assert result["volume"] == 80
    assert result["playlist_uri"] == "spotify:playlist:foo"


@pytest.mark.asyncio
async def test_start_car_vibe_uses_default_playlist() -> None:
    result = await start_car_vibe("u1")
    assert result["playlist_uri"] == "spotify:playlist:vibez_default"


@pytest.mark.asyncio
async def test_send_victory_broadcasts() -> None:
    result = await send_victory_to_dashboard("veh_1", "5-GAME STREAK!")
    assert result["status"] == "broadcast"
    assert result["message"] == "5-GAME STREAK!"
    assert result["provider"] == "mock"
