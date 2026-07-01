"""Quick test of room_registry — in-memory backend behaviour."""
import asyncio
import sys

sys.path.insert(0, "/home/johnnie/master-project")

from utils.room_registry import get_registry, is_redis_enabled


async def _basic_set_get_delete():
    reg = get_registry()
    await reg.set("test_room_1", {"players": 2, "phase": "playing"})
    got = await reg.get("test_room_1")
    assert got == {"players": 2, "phase": "playing"}
    await reg.delete("test_room_1")
    assert await reg.get("test_room_1") is None


async def _list_prefix():
    reg = get_registry()
    await reg.set("smartstack:offer:1", {"id": 1})
    await reg.set("smartstack:offer:2", {"id": 2})
    await reg.set("dominoes:room:1", {"id": "x"})
    rows = await reg.list("smartstack:offer:")
    assert len(rows) == 2, f"expected 2 prefix matches, got {len(rows)}"


async def _pubsub_basic():
    """In-memory pub/sub: subscribe then publish and confirm receipt."""
    reg = get_registry()
    received = []

    async def consumer():
        async for msg in reg.subscribe("test-channel"):
            received.append(msg)
            if len(received) >= 2:
                break

    task = asyncio.create_task(consumer())
    await asyncio.sleep(0.1)
    await reg.publish("test-channel", {"hello": 1})
    await reg.publish("test-channel", {"hello": 2})
    await asyncio.wait_for(task, timeout=2)
    assert received == [{"hello": 1}, {"hello": 2}]


# Sync wrappers so the suite runs under plain `pytest` (no
# pytest-asyncio plugin needed). The async helpers above also work
# when this file is invoked directly via __main__ below.

def test_basic_set_get_delete() -> None:
    asyncio.run(_basic_set_get_delete())


def test_list_prefix() -> None:
    asyncio.run(_list_prefix())


def test_pubsub_basic() -> None:
    asyncio.run(_pubsub_basic())


def test_backend_selection() -> None:
    reg = get_registry()
    backend = "RedisRegistry" if is_redis_enabled() else "InMemoryRegistry"
    print(f"Backend: {backend}")


if __name__ == "__main__":
    test_basic_set_get_delete()
    test_list_prefix()
    test_pubsub_basic()
    test_backend_selection()
    print("\n✅ All room_registry tests passed.")
