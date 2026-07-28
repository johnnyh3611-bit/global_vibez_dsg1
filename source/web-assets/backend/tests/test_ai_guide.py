"""Unit tests for AI Guide room-key resolution + hint catalog."""
import pytest

from routes.ai_guide import (
    HINTS,
    Diagnostics,
    RoomContext,
    get_guide_hint,
    resolve_path_hint,
    resolve_room_key,
)


def test_resolve_direct_category():
    assert resolve_room_key("gaming") == "gaming"
    assert resolve_room_key("DATING") == "dating"


def test_resolve_from_path():
    assert resolve_room_key("x", "/games/spades") == "gaming"
    assert resolve_room_key("", "/dating/matches") == "dating"
    assert resolve_room_key("unknown", "/streaming/live") == "streaming"
    assert resolve_room_key("", "/dashboard") == "hub"
    assert resolve_room_key("", "/somewhere-new") == "default"
    assert resolve_room_key("", "/dominoes") == "gaming"
    assert resolve_room_key("", "/cinema-room/abc") == "streaming"


def test_aliases():
    assert resolve_room_key("casino") == "gaming"
    assert resolve_room_key("ridez") == "rides"


def test_path_specific_hints():
    assert resolve_path_hint("/spades") is not None
    assert "landscape" in (resolve_path_hint("/spades") or "").lower() or "Rotate" in (
        resolve_path_hint("/spades") or ""
    )
    assert resolve_path_hint("/dominoes") is not None
    assert resolve_path_hint("/practice/play/bowling") is not None
    assert resolve_path_hint("/somewhere-new") is None


@pytest.mark.asyncio
async def test_guide_hint_endpoint():
    out = await get_guide_hint(RoomContext(room="gaming"))
    assert out["room"] == "gaming"
    assert out["hint"]
    assert out["source"] == "catalog"
    assert isinstance(out["tips"], list)
    assert isinstance(out["known_issues"], list)

    out2 = await get_guide_hint(RoomContext(room="x", path="/vibe-ridez/request"))
    assert out2["room"] == "rides"
    assert out2["hint"] == HINTS["rides"]


@pytest.mark.asyncio
async def test_guide_hint_path_and_diagnostics():
    out = await get_guide_hint(
        RoomContext(
            room="gaming",
            path="/spades",
            diagnostics=Diagnostics(
                viewport_w=390,
                viewport_h=844,
                orientation="portrait",
                force_landscape=False,
                authenticated=True,
            ),
        )
    )
    assert out["source"] == "path"
    assert "Spades" in out["hint"] or "spades" in out["hint"].lower()
    assert any("portrait" in t.lower() or "landscape" in t.lower() for t in out["tips"])
    assert out["known_issues"]
