"""
FMCSA Hours-of-Service calculation engine for Vibe Fleet ELD.

Pure functions — no I/O. Callers pass ordered duty logs and a `now`.

Rules enforced (property-carrying CMV, default 70/8 cycle):
  • 11-hour driving limit after ≥10 consecutive hours off-duty/sleeper
  • 14-hour duty window from coming on duty (off-duty does NOT pause)
  • 30-minute break after 8 cumulative hours of driving/on-duty without
    a ≥30-minute off-duty or sleeper interruption
  • 70-hour / 8-day (or optional 60-hour / 7-day) rolling duty limit
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional, Sequence

CycleType = Literal["70_8", "60_7"]

MAX_DRIVE_MINUTES = 11 * 60
MAX_DUTY_WINDOW_MINUTES = 14 * 60
MAX_CYCLE_70_8_MINUTES = 70 * 60
MAX_CYCLE_60_7_MINUTES = 60 * 60
BREAK_AFTER_MINUTES = 8 * 60
MIN_BREAK_MINUTES = 30
MIN_RESTART_REST_MINUTES = 10 * 60

# Automatic motion thresholds (FMCSA ELD guidance ≈ 5 mph)
SPEED_DRIVING_MPH = 5.0
STOPPED_SECONDS_FOR_ON_DUTY = 5 * 60

DUTY_STATUSES = (
    "OFF_DUTY",
    "SLEEPER_BERTH",
    "DRIVING",
    "ON_DUTY_NOT_DRIVING",
    "PERSONAL_USE",
    "YARD_MOVE",
)
ON_DUTY_STATUSES = frozenset({"DRIVING", "ON_DUTY_NOT_DRIVING", "YARD_MOVE"})
REST_STATUSES = frozenset({"OFF_DUTY", "SLEEPER_BERTH"})
# Time that accumulates toward the 8-hour break clock (per product rule).
BREAK_ACCUM_STATUSES = frozenset({"DRIVING", "ON_DUTY_NOT_DRIVING", "YARD_MOVE"})


def to_dt(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def interval_minutes(start: datetime, end: datetime) -> float:
    return max(0.0, (end - start).total_seconds() / 60.0)


def cycle_limits(cycle: CycleType = "70_8") -> tuple[int, int]:
    """Return (max_minutes, window_days) for the selected cycle."""
    if cycle == "60_7":
        return MAX_CYCLE_60_7_MINUTES, 7
    return MAX_CYCLE_70_8_MINUTES, 8


def find_duty_window_start(
    logs: Sequence[Dict[str, Any]],
    now: datetime,
    lookback: datetime,
) -> datetime:
    """
    Find when the current 14-hour window opened: the end of the most recent
    ≥10 consecutive hours in REST_STATUSES. Falls back to `lookback`.
    """
    if not logs:
        return lookback

    # Walk chronologically, track contiguous rest stretches.
    window_start = lookback
    rest_run_start: Optional[datetime] = None
    rest_run_end: Optional[datetime] = None

    for i, log in enumerate(logs):
        t = to_dt(log["created_at"])
        next_t = to_dt(logs[i + 1]["created_at"]) if i + 1 < len(logs) else now
        status = log.get("status") or "OFF_DUTY"

        if status in REST_STATUSES:
            if rest_run_start is None:
                rest_run_start = t
            rest_run_end = next_t
        else:
            if (
                rest_run_start is not None
                and rest_run_end is not None
                and interval_minutes(rest_run_start, rest_run_end)
                >= MIN_RESTART_REST_MINUTES
            ):
                # Coming on duty after a qualifying 10h rest opens a new window.
                window_start = rest_run_end
            rest_run_start = None
            rest_run_end = None

    # Still in a qualifying rest at `now` — window has not opened yet;
    # treat window_start as now so remaining clocks are full.
    if (
        rest_run_start is not None
        and rest_run_end is not None
        and interval_minutes(rest_run_start, rest_run_end)
        >= MIN_RESTART_REST_MINUTES
    ):
        window_start = rest_run_end

    return window_start


def calculate_hos_from_logs(
    logs: Sequence[Dict[str, Any]],
    now: Optional[datetime] = None,
    *,
    cycle: CycleType = "70_8",
    driver_id: str = "",
) -> Dict[str, Any]:
    """
    Compute live HOS clocks from ordered status logs (oldest → newest).

    Each log's `status` applies from `created_at` until the next log (or `now`).
    """
    now = now or datetime.now(timezone.utc)
    cycle_max, cycle_days = cycle_limits(cycle)
    lookback = now - timedelta(days=cycle_days)

    # Only status_change / trip events define duty segments; include all
    # rows that carry a status so location pings that stamp status count.
    usable = [
        log
        for log in logs
        if log.get("status") and log.get("created_at")
    ]
    usable = sorted(usable, key=lambda L: L["created_at"])

    if not usable:
        return _empty_hos(driver_id, cycle_max, cycle=cycle)

    window_start = find_duty_window_start(usable, now, lookback)

    driving_in_window = 0.0
    # 14-hour window is WALL CLOCK from coming on duty — off-duty does not pause.
    duty_window_elapsed = interval_minutes(window_start, now)

    # Break clock: cumulative driving/on-duty since last ≥30m rest.
    since_break_accum = 0.0
    break_required = False

    cycle_on_duty = 0.0

    for i, log in enumerate(usable):
        t = to_dt(log["created_at"])
        next_t = to_dt(usable[i + 1]["created_at"]) if i + 1 < len(usable) else now
        status = log["status"]

        # 70/8 (or 60/7) rolling on-duty
        if t >= lookback and status in ON_DUTY_STATUSES:
            # Clip to lookback if segment straddles
            start_clipped = max(t, lookback)
            cycle_on_duty += interval_minutes(start_clipped, next_t)

        if next_t <= window_start:
            continue

        # Clip segment to current duty window
        seg_start = max(t, window_start)
        seg_dur = interval_minutes(seg_start, next_t)
        if seg_dur <= 0:
            continue

        if status == "DRIVING":
            driving_in_window += seg_dur

        if status in REST_STATUSES:
            if seg_dur >= MIN_BREAK_MINUTES:
                since_break_accum = 0.0
            # short rest does not reset
        elif status in BREAK_ACCUM_STATUSES:
            since_break_accum += seg_dur
            if since_break_accum >= BREAK_AFTER_MINUTES:
                break_required = True

    remaining_drive = max(0.0, MAX_DRIVE_MINUTES - driving_in_window)
    remaining_window = max(0.0, MAX_DUTY_WINDOW_MINUTES - duty_window_elapsed)
    remaining_cycle = max(0.0, cycle_max - cycle_on_duty)

    # Actual drive allowed is the tightest remaining clock (and zero if break due).
    actual_driving_allowed = min(remaining_drive, remaining_window, remaining_cycle)
    if break_required:
        actual_driving_allowed = 0.0

    violations: List[str] = []
    if driving_in_window > MAX_DRIVE_MINUTES:
        violations.append("11-hour driving limit exceeded")
    if duty_window_elapsed > MAX_DUTY_WINDOW_MINUTES:
        violations.append("14-hour duty window exceeded")
    if cycle_on_duty > cycle_max:
        label = "60-hour / 7-day" if cycle == "60_7" else "70-hour / 8-day"
        violations.append(f"{label} limit exceeded")
    if break_required:
        violations.append(
            "30-minute break required after 8 hours of driving/on-duty"
        )

    current_status = usable[-1]["status"]
    status_start = usable[-1]["created_at"]

    return {
        "driver_id": driver_id,
        "status": current_status,
        "status_start_time": status_start,
        "cycle": cycle,
        # Counters (minutes) — match product schema
        "driving_time_today_minutes": round(driving_in_window, 1),
        "on_duty_window_minutes": round(duty_window_elapsed, 1),
        "time_since_last_break_minutes": round(since_break_accum, 1),
        "rolling_8_day_duty_minutes": round(cycle_on_duty, 1),
        # Remaining clocks
        "current_driving_minutes": round(driving_in_window, 1),
        "current_on_duty_minutes": round(duty_window_elapsed, 1),
        "remaining_drive_minutes": round(remaining_drive, 1),
        "remaining_duty_window_minutes": round(remaining_window, 1),
        "remaining_8_day_on_duty_minutes": round(remaining_cycle, 1),
        # Aliases matching the HOSStatusResponse contract
        "driving_minutes_remaining": round(actual_driving_allowed, 1),
        "duty_window_minutes_remaining": round(remaining_window, 1),
        "cycle_70hr_minutes_remaining": round(remaining_cycle, 1),
        "requires_break": break_required,
        "break_required": break_required,
        "in_violation": bool(violations),
        "violations": violations,
        "window_start": window_start.isoformat(),
    }


def _empty_hos(
    driver_id: str, cycle_max: int, *, cycle: CycleType = "70_8"
) -> Dict[str, Any]:
    return {
        "driver_id": driver_id,
        "status": "OFF_DUTY",
        "status_start_time": None,
        "cycle": cycle,
        "driving_time_today_minutes": 0,
        "on_duty_window_minutes": 0,
        "time_since_last_break_minutes": 0,
        "rolling_8_day_duty_minutes": 0,
        "current_driving_minutes": 0,
        "current_on_duty_minutes": 0,
        "remaining_drive_minutes": MAX_DRIVE_MINUTES,
        "remaining_duty_window_minutes": MAX_DUTY_WINDOW_MINUTES,
        "remaining_8_day_on_duty_minutes": cycle_max,
        "driving_minutes_remaining": MAX_DRIVE_MINUTES,
        "duty_window_minutes_remaining": MAX_DUTY_WINDOW_MINUTES,
        "cycle_70hr_minutes_remaining": cycle_max,
        "requires_break": False,
        "break_required": False,
        "in_violation": False,
        "violations": [],
        "window_start": None,
    }


def resolve_motion_status(
    *,
    current_status: str,
    speed_mph: Optional[float],
    seconds_since_moving: Optional[float] = None,
) -> Optional[str]:
    """
    Return a new duty status when vehicle motion requires an automatic change.
    None = no change.
    """
    if speed_mph is None:
        return None
    if speed_mph >= SPEED_DRIVING_MPH:
        if current_status != "DRIVING":
            return "DRIVING"
        return None
    # Below threshold — if currently driving and stopped long enough → on-duty ND
    if current_status == "DRIVING":
        if (
            seconds_since_moving is not None
            and seconds_since_moving >= STOPPED_SECONDS_FOR_ON_DUTY
        ):
            return "ON_DUTY_NOT_DRIVING"
    return None
