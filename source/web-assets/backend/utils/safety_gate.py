"""
SafetyGate — behavioral anti-bot shield.

Detects bots by variance in action timings (humans have jitter, bots don't).
Flags user via `is_shadow_banned=True` on the users collection.

When a user is shadow-banned:
    - Mining ledger updates become no-ops (see routes/mining.py).
    - They still see animations and "mined X VIBEZ" messages to discourage evasion.
    - All game results still persist (so false positives don't destroy gameplay).
"""
from collections import deque
import math
import time
from typing import Deque, Dict

from utils.database import get_database


# In-memory per-user action buffers (resets on process restart).
_USER_BUFFERS: Dict[str, Deque[float]] = {}
_BUFFER_SIZE = 20
_VARIANCE_FLOOR = 0.01   # stddev(intervals) below this triggers suspicion
_MIN_SAMPLES_TO_FLAG = 10


def _buffer(user_id: str) -> Deque[float]:
    buf = _USER_BUFFERS.get(user_id)
    if buf is None:
        buf = deque(maxlen=_BUFFER_SIZE)
        _USER_BUFFERS[user_id] = buf
    return buf


def log_action(user_id: str) -> None:
    """Record a timestamp for this user's action (trick won, bid placed, etc.)."""
    _buffer(user_id).append(time.time())


def compute_variance(intervals: list) -> float:
    if len(intervals) < 2:
        return 1.0
    mean = sum(intervals) / len(intervals)
    var = sum((x - mean) ** 2 for x in intervals) / len(intervals)
    return math.sqrt(var)


async def check_and_flag(user_id: str) -> bool:
    """
    Inspect timing variance. Returns True if user should be treated as a bot
    (shadow-banned). Also persists the flag on first detection.
    """
    buf = _buffer(user_id)
    if len(buf) < _MIN_SAMPLES_TO_FLAG:
        return False

    timestamps = list(buf)
    intervals = [timestamps[i + 1] - timestamps[i] for i in range(len(timestamps) - 1)]
    if not intervals:
        return False

    stddev = compute_variance(intervals)
    if stddev >= _VARIANCE_FLOOR:
        return False

    # Flagged. Persist it.
    db = get_database()
    res = await db.users.update_one(
        {"user_id": user_id, "is_shadow_banned": {"$ne": True}},
        {"$set": {
            "is_shadow_banned": True,
            "shadow_ban_reason": "bot_timing_variance",
            "shadow_ban_stddev": round(stddev, 6),
            "shadow_ban_at": time.time(),
        }},
    )
    if res.modified_count:
        print(f"[SafetyGate] shadow-banned {user_id} (stddev={stddev:.6f})")
    return True


async def is_shadow_banned(user_id: str) -> bool:
    """Cheap check for whether a user is currently shadow-banned."""
    db = get_database()
    doc = await db.users.find_one({"user_id": user_id}, {"is_shadow_banned": 1, "_id": 0})
    return bool(doc and doc.get("is_shadow_banned"))


async def clear_shadow_ban(user_id: str) -> None:
    """Admin-only: lift a shadow-ban (e.g., on manual review)."""
    db = get_database()
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_shadow_banned": False}, "$unset": {"shadow_ban_reason": "", "shadow_ban_stddev": "", "shadow_ban_at": ""}},
    )
    _USER_BUFFERS.pop(user_id, None)
