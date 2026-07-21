"""
Unit tests for FMCSA HOS calculation engine (no database).
"""
from datetime import datetime, timedelta, timezone

from services.eld_hos import (
    MAX_DRIVE_MINUTES,
    MAX_DUTY_WINDOW_MINUTES,
    calculate_hos_from_logs,
    find_duty_window_start,
    resolve_motion_status,
)


def _log(status: str, hours_ago: float, now: datetime) -> dict:
    t = now - timedelta(hours=hours_ago)
    return {
        "status": status,
        "created_at": t.isoformat(),
        "event_type": "status_change",
    }


def test_empty_logs_full_remaining():
    hos = calculate_hos_from_logs([], driver_id="d1")
    assert hos["driving_minutes_remaining"] == MAX_DRIVE_MINUTES
    assert hos["duty_window_minutes_remaining"] == MAX_DUTY_WINDOW_MINUTES
    assert hos["requires_break"] is False


def test_14_hour_window_not_paused_by_off_duty():
    """Off-duty inside the window must NOT pause the 14-hour clock."""
    now = datetime(2026, 7, 21, 18, 0, tzinfo=timezone.utc)
    # 10h rest ended 12 hours ago → window open 12h → ~120 min left
    logs = [
        _log("OFF_DUTY", 22, now),       # start long rest
        _log("DRIVING", 12, now),       # on duty / window opens
        _log("OFF_DUTY", 10, now),      # 2h off duty — must NOT pause 14h
        _log("DRIVING", 8, now),
    ]
    hos = calculate_hos_from_logs(logs, now=now, driver_id="d1")
    # Window elapsed ≈ 12 hours → remaining ≈ 2 hours (120 min)
    assert 100 <= hos["duty_window_minutes_remaining"] <= 140
    assert hos["on_duty_window_minutes"] >= 11 * 60


def test_11_hour_driving_limit():
    now = datetime(2026, 7, 21, 20, 0, tzinfo=timezone.utc)
    logs = [
        _log("OFF_DUTY", 24, now),
        _log("DRIVING", 10, now),  # driving continuously for 10 hours
    ]
    hos = calculate_hos_from_logs(logs, now=now, driver_id="d1")
    assert hos["driving_time_today_minutes"] >= 9.5 * 60
    assert hos["remaining_drive_minutes"] <= 1.5 * 60
    assert hos["driving_minutes_remaining"] <= hos["remaining_drive_minutes"]


def test_30_min_break_required_after_8h():
    now = datetime(2026, 7, 21, 16, 0, tzinfo=timezone.utc)
    logs = [
        _log("OFF_DUTY", 20, now),
        _log("DRIVING", 9, now),  # 9 hours driving, no break
    ]
    hos = calculate_hos_from_logs(logs, now=now, driver_id="d1")
    assert hos["requires_break"] is True
    assert hos["driving_minutes_remaining"] == 0
    assert any("30-minute" in v for v in hos["violations"])


def test_30_min_break_resets_clock():
    now = datetime(2026, 7, 21, 16, 0, tzinfo=timezone.utc)
    logs = [
        _log("OFF_DUTY", 20, now),
        _log("DRIVING", 12, now),     # drive 4h
        _log("OFF_DUTY", 8, now),      # 45 min break
        _log("DRIVING", 7.25, now),   # drive again ~7.25h
    ]
    # After break, only post-break accum counts — 7.25h < 8h → no break required
    hos = calculate_hos_from_logs(logs, now=now, driver_id="d1")
    assert hos["requires_break"] is False
    assert hos["time_since_last_break_minutes"] < 8 * 60


def test_70_hour_cycle():
    now = datetime(2026, 7, 21, 12, 0, tzinfo=timezone.utc)
    # Simulate ~65 hours on duty across the window with a prior 10h rest
    logs = [
        _log("OFF_DUTY", 8 * 24, now),
        _log("ON_DUTY_NOT_DRIVING", 8 * 24 - 11, now),
    ]
    # One long on-duty stretch of nearly 8 days is extreme; instead build
    # discrete days of on-duty.
    logs = [{"status": "OFF_DUTY", "created_at": (now - timedelta(days=9)).isoformat()}]
    # 7 days × 10h on duty = 70h exactly at limit edge
    for day in range(7, 0, -1):
        logs.append(
            {
                "status": "ON_DUTY_NOT_DRIVING",
                "created_at": (now - timedelta(days=day, hours=10)).isoformat(),
            }
        )
        logs.append(
            {
                "status": "OFF_DUTY",
                "created_at": (now - timedelta(days=day)).isoformat(),
            }
        )
    hos = calculate_hos_from_logs(logs, now=now, driver_id="d1", cycle="70_8")
    assert hos["rolling_8_day_duty_minutes"] >= 60 * 60  # at least 60h
    assert hos["cycle_70hr_minutes_remaining"] <= 10 * 60


def test_find_window_after_10h_rest():
    now = datetime(2026, 7, 21, 12, 0, tzinfo=timezone.utc)
    logs = [
        _log("DRIVING", 20, now),
        _log("OFF_DUTY", 15, now),  # 10h rest
        _log("DRIVING", 5, now),
    ]
    start = find_duty_window_start(logs, now, now - timedelta(days=8))
    # Window should open when rest ended (~5h ago)
    assert abs((now - start).total_seconds() / 3600 - 5) < 0.2


def test_motion_auto_driving():
    assert resolve_motion_status(current_status="ON_DUTY_NOT_DRIVING", speed_mph=8) == "DRIVING"
    assert resolve_motion_status(current_status="DRIVING", speed_mph=10) is None


def test_motion_auto_stopped():
    assert (
        resolve_motion_status(
            current_status="DRIVING", speed_mph=2, seconds_since_moving=400
        )
        == "ON_DUTY_NOT_DRIVING"
    )
    assert (
        resolve_motion_status(
            current_status="DRIVING", speed_mph=2, seconds_since_moving=60
        )
        is None
    )
    # Unknown stop duration — do not auto-switch yet
    assert (
        resolve_motion_status(
            current_status="DRIVING", speed_mph=2, seconds_since_moving=None
        )
        is None
    )
