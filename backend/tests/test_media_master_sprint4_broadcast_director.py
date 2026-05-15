"""Sprint 4 Media Master Broadcast Director + Break-In Banner backend test."""
import os
import requests
import time
import json as _json

BASE = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.strip().split("=", 1)[1]
                break
BASE = BASE.rstrip("/")

results = {"passed": [], "failed": []}

def check(name, cond, detail=""):
    if cond:
        results["passed"].append(name)
        print(f"PASS  {name}  {detail}")
    else:
        results["failed"].append({"name": name, "detail": detail})
        print(f"FAIL  {name}  {detail}")

# 1) Auth - login as betatester1
r = requests.post(f"{BASE}/api/auth/login", json={"email":"betatester1@globalvibez.com","password":"BetaTester2026!"}, timeout=30)
token = None
uid = None
if r.status_code == 200:
    j = r.json()
    token = j.get("token") or j.get("access_token")
    uid = (j.get("user") or {}).get("user_id") or (j.get("user") or {}).get("id") or j.get("user_id")
print(f"Login -> {r.status_code}, token={'yes' if token else 'no'}, uid={uid}")

# 2) GET /api/media-master/tv/channels (sanity - 5 channels)
r = requests.get(f"{BASE}/api/media-master/tv/channels", timeout=15)
chans = r.json().get("channels", []) if r.ok else []
check("GET tv/channels returns 5", r.status_code == 200 and len(chans) == 5, f"status={r.status_code} count={len(chans)}")
channel_ids = [c["channel_id"] for c in chans]
print("channels:", channel_ids)

# 3) POST /api/streaming/cloudflare/live-inputs creates a live input
test_uid = uid or "8f707bb9-dc0f-43cd-acf4-065f7d86cd54"
r = requests.post(f"{BASE}/api/streaming/cloudflare/live-inputs", json={"streamer_id": test_uid, "name":"Sprint4 Test Input"}, timeout=20)
print("live-inputs ->", r.status_code, r.text[:300])
ok = r.status_code in (200, 201)
data = r.json() if ok else {}
input_id = data.get("input_id")
mode = data.get("mode")
check("POST live-inputs ok + input_id + mode", ok and input_id and mode in ("live","stub"), f"status={r.status_code} mode={mode} input_id={input_id}")

# 4) POST /api/media-master/tv/program
channel_id = channel_ids[0] if channel_ids else "arena"
r = requests.post(f"{BASE}/api/media-master/tv/program",
    json={"channel_id": channel_id, "input_id": input_id, "streamer_id": test_uid, "duration_hours": 4}, timeout=15)
print("tv/program ->", r.status_code, r.text[:300])
prog_ok = r.status_code == 200
prog_data = r.json() if prog_ok else {}
prog_until = (prog_data.get("program") or {}).get("programmed_until") or prog_data.get("programmed_until")
check("POST tv/program returns 200 + programmed_until", prog_ok and bool(prog_until), f"status={r.status_code} programmed_until={prog_until}")

# 5) GET tv/now-playing/{channel_id} -> live:false because is_live=false
r = requests.get(f"{BASE}/api/media-master/tv/now-playing/{channel_id}", timeout=15)
print("now-playing ->", r.status_code, r.text[:400])
np_ok = r.status_code == 200
np = r.json() if np_ok else {}
check("now-playing privacy guard: live=false (is_live=false)", np_ok and np.get("live") is False, f"live={np.get('live')}")

# 6) POST /api/media-master/scout/ingest (hype >= 10000) creates break-in
r = requests.post(f"{BASE}/api/media-master/scout/ingest",
    json={"room_id":"sprint4_break_test","gift_volume_coins": 15000, "chat_messages_per_minute": 300}, timeout=15)
print("scout/ingest ->", r.status_code, r.text[:300])
ing_ok = r.status_code in (200, 201)
ing_data = r.json() if ing_ok else {}
check("POST scout/ingest accepted", ing_ok, f"status={r.status_code}")

# 7) GET /scout/break-ins/active should now contain alert
time.sleep(0.4)
r = requests.get(f"{BASE}/api/media-master/scout/break-ins/active", timeout=15)
print("break-ins/active ->", r.status_code, r.text[:400])
ba_ok = r.status_code == 200
alerts = r.json().get("alerts", []) if ba_ok else []
matching = [a for a in alerts if a.get("room_id") == "sprint4_break_test"]
check("scout/break-ins/active returns our alert", ba_ok and len(matching) >= 1, f"alerts_count={len(alerts)} matching={len(matching)}")

print("\n===SUMMARY===")
print(f"Passed: {len(results['passed'])}")
print(f"Failed: {len(results['failed'])}")
for f in results["failed"]:
    print(" -", f)
