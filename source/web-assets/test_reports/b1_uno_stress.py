"""Round B1: paired UNO bot stress test using python-socketio AsyncClient.

Each pair: Bot A creates room -> Bot B joins -> Bot A fills with bots ->
both attempt a play/draw -> both leave. Records timings and errors.
"""
import asyncio
import os
import statistics
import time
import json
import socketio

BACKEND = os.environ.get("REACT_APP_BACKEND_URL", "https://social-connect-953.preview.emergentagent.com").rstrip("/")
NUM_PAIRS = int(os.environ.get("NUM_PAIRS", "25"))  # 25 pairs = 50 bot connections
PAIR_TIMEOUT = 25  # seconds


async def run_pair(idx: int):
    t0 = time.time()
    result = {
        "idx": idx,
        "success": False,
        "time_to_playing_ms": None,
        "errors": [],
        "stages": {"created": False, "joined": False, "playing": False, "move": False, "left": False},
    }

    sio_a = socketio.AsyncClient(logger=False, engineio_logger=False, reconnection=False)
    sio_b = socketio.AsyncClient(logger=False, engineio_logger=False, reconnection=False)

    room_code = {"code": None}
    playing_event = asyncio.Event()
    joined_event = asyncio.Event()
    created_event = asyncio.Event()
    a_turn_event = asyncio.Event()
    a_state = {"hand": [], "top": None, "current": None, "my_sid": None}

    @sio_a.on("uno_table_created")
    async def on_created(data):
        room_code["code"] = data.get("room_code")
        created_event.set()

    @sio_a.on("uno_state_update")
    async def on_state_a(data):
        t = data.get("table", {}) if isinstance(data, dict) else {}
        gs = t.get("game_state") or t.get("status")
        if gs == "playing":
            playing_event.set()
        # capture hand/top/current for bot A
        you = t.get("you") or {}
        a_state["hand"] = you.get("hand", []) or t.get("hand", [])
        a_state["top"] = t.get("top_card") or t.get("discard_top")
        a_state["current"] = t.get("current_player")
        a_state["my_sid"] = you.get("sid")

    @sio_b.on("uno_state_update")
    async def on_state_b(data):
        t = data.get("table", {}) if isinstance(data, dict) else {}
        if t:
            joined_event.set()

    @sio_a.on("error")
    async def on_err_a(data):
        result["errors"].append(f"A:{data}")

    @sio_b.on("error")
    async def on_err_b(data):
        result["errors"].append(f"B:{data}")

    try:
        await sio_a.connect(BACKEND, socketio_path="/api/socket.io", transports=["websocket"], wait_timeout=10)
        await sio_a.emit("create_uno_room", {"player_name": f"BotA_{idx}"})
        await asyncio.wait_for(created_event.wait(), timeout=8)
        result["stages"]["created"] = True

        await sio_b.connect(BACKEND, socketio_path="/api/socket.io", transports=["websocket"], wait_timeout=10)
        await sio_b.emit("join_uno_room", {"room_code": room_code["code"], "player_name": f"BotB_{idx}"})
        await asyncio.wait_for(joined_event.wait(), timeout=8)
        result["stages"]["joined"] = True

        t_fill = time.time()
        await sio_a.emit("uno_fill_with_bots", {})
        await asyncio.wait_for(playing_event.wait(), timeout=12)
        result["time_to_playing_ms"] = int((time.time() - t_fill) * 1000)
        result["stages"]["playing"] = True

        # Attempt one move each - best-effort; don't fail the pair if backend rejects
        try:
            await sio_a.emit("uno_draw_card", {})
            await asyncio.sleep(0.3)
            await sio_b.emit("uno_draw_card", {})
            await asyncio.sleep(0.3)
            result["stages"]["move"] = True
        except Exception as e:
            result["errors"].append(f"move:{e}")

        try:
            await sio_a.emit("leave_uno_table", {})
            await sio_b.emit("leave_uno_table", {})
            await asyncio.sleep(0.2)
            result["stages"]["left"] = True
        except Exception as e:
            result["errors"].append(f"leave:{e}")

        result["success"] = True
    except asyncio.TimeoutError as e:
        result["errors"].append(f"timeout at stage={result['stages']}")
    except Exception as e:
        result["errors"].append(f"exc:{type(e).__name__}:{e}")
    finally:
        try:
            if sio_a.connected: await sio_a.disconnect()
        except: pass
        try:
            if sio_b.connected: await sio_b.disconnect()
        except: pass

    result["total_ms"] = int((time.time() - t0) * 1000)
    return result


async def main():
    print(f"Starting B1 stress: {NUM_PAIRS} pairs = {NUM_PAIRS*2} bots against {BACKEND}")
    t_start = time.time()
    # Stagger slightly to avoid thundering-herd
    tasks = []
    for i in range(NUM_PAIRS):
        tasks.append(asyncio.create_task(run_pair(i)))
        await asyncio.sleep(0.05)
    results = await asyncio.gather(*tasks, return_exceptions=False)
    elapsed = time.time() - t_start

    succ = [r for r in results if r["success"]]
    fail = [r for r in results if not r["success"]]
    times = [r["time_to_playing_ms"] for r in succ if r["time_to_playing_ms"] is not None]

    p50 = statistics.median(times) if times else None
    p95 = (sorted(times)[int(len(times)*0.95)-1] if len(times) >= 5 else (max(times) if times else None))

    # Collect distinct errors
    errs = {}
    for r in results:
        for e in r["errors"]:
            key = str(e)[:140]
            errs[key] = errs.get(key, 0) + 1

    summary = {
        "backend": BACKEND,
        "num_pairs_attempted": NUM_PAIRS,
        "total_bot_connections": NUM_PAIRS * 2,
        "successful_pairs": len(succ),
        "failed_pairs": len(fail),
        "success_rate_pct": round(len(succ) / NUM_PAIRS * 100, 1) if NUM_PAIRS else 0,
        "p50_time_to_playing_ms": p50,
        "p95_time_to_playing_ms": p95,
        "min_time_to_playing_ms": min(times) if times else None,
        "max_time_to_playing_ms": max(times) if times else None,
        "total_elapsed_sec": round(elapsed, 2),
        "distinct_errors": errs,
        "sample_failures": [{"idx": r["idx"], "stages": r["stages"], "errors": r["errors"][:2]} for r in fail[:5]],
    }

    print(json.dumps(summary, indent=2))
    with open("/app/test_reports/b1_uno_stress_results.json", "w") as f:
        json.dump({"summary": summary, "results": results}, f, indent=2)
    print(f"\nSaved /app/test_reports/b1_uno_stress_results.json")


if __name__ == "__main__":
    asyncio.run(main())
