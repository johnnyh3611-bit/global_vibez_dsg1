"""Unit tests for AI Guide room-key resolution + hint catalog."""
import pytest

from routes.ai_guide import HINTS, RoomContext, get_guide_hint, resolve_room_key


def test_resolve_direct_category():
    assert resolve_room_key("gaming") == "gaming"
    assert resolve_room_key("DATING") == "dating"


def test_resolve_from_path():
    assert resolve_room_key("x", "/games/spades") == "gaming"
    assert resolve_room_key("", "/dating/matches") == "dating"
    assert resolve_room_key("unknown", "/streaming/live") == "streaming"
    assert resolve_room_key("", "/dashboard") == "hub"
    assert resolve_room_key("", "/somewhere-new") == "default"


def test_aliases():
    assert resolve_room_key("casino") == "gaming"
    assert resolve_room_key("ridez") == "rides"


@pytest.mark.asyncio
async def test_guide_hint_endpoint():
    out = await get_guide_hint(RoomContext(room="gaming"))
    assert out["room"] == "gaming"
    assert out["hint"]
    assert out["source"] == "catalog"

    out2 = await get_guide_hint(RoomContext(room="x", path="/vibe-ridez/request"))
    assert out2["room"] == "rides"
    assert out2["hint"] == HINTS["rides"]
