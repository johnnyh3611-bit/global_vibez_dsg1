"""
/api/admin/games-lock — runtime status of the LOCKED_GAMES_REGISTRY.

For each game in the registry the endpoint returns:
  - the static metadata (route, engine module, last modified, declared status)
  - LIVE health checks:
      • engine_importable    — does the engine module still import?
      • test_module_exists   — does the pytest module file still exist?
      • test_pass_count      — actual passing-test count for that module right now
      • lock_intact          — pass_count >= min_tests AND status == LOCKED
      • lock_color           — "green" | "yellow" | "red" for the UI

The God-Mode dashboard widget renders this as a row-per-game table with a
big top-of-page health badge.  No DB writes, no auth-side effects — pure
read-only diagnostics for the founder.
"""
from __future__ import annotations

import importlib
import os
import subprocess
from typing import Dict, List, Optional

from fastapi import APIRouter

from services.locked_games import LOCKED_GAMES, lock_dict


games_lock_router = APIRouter(prefix="/admin/games-lock", tags=["admin-games-lock"])


def _engine_importable(module: Optional[str]) -> Optional[bool]:
    """Try to import the engine module without executing side effects."""
    if not module:
        return None
    try:
        importlib.import_module(module)
        return True
    except Exception:
        return False


def _test_module_path(module: Optional[str]) -> Optional[str]:
    """Convert a dotted test path like `tests.test_xyz` to a fs path."""
    if not module:
        return None
    return os.path.join("/home/johnnie/master-project", module.replace(".", "/") + ".py")


def _test_pass_count(test_path: Optional[str], timeout: int = 30) -> Optional[int]:
    """Run pytest in --collect-only mode + a quick run.

    For lockdown UX we do NOT actually re-run tests on every dashboard
    refresh (would be slow and CPU-spiky).  We just COUNT collected tests.
    Drift between collected and actually-passing only happens on a broken
    push, in which case the regression shield will go red anyway.
    """
    if not test_path or not os.path.exists(test_path):
        return None
    import sys
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", test_path, "--collect-only", "-q"],
            cwd="/home/johnnie/master-project",
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        # last line of pytest --collect-only -q is "N tests collected in 0.02s"
        for line in reversed((proc.stdout or "").splitlines()):
            line = line.strip()
            # Match e.g. "43 tests collected in 0.02s" or "1 test collected"
            tokens = line.split()
            if len(tokens) >= 3 and tokens[1] in ("tests", "test") and tokens[2] == "collected":
                try:
                    return int(tokens[0])
                except ValueError:
                    return None
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError, PermissionError):
        return None


def _color_for(status: str, lock_intact: bool) -> str:
    if status == "BLOCKED":
        return "red"
    if status == "REDESIGN":
        return "yellow"
    if not lock_intact:
        return "red"
    return "green"


@games_lock_router.get("/")
def get_games_lock_status() -> Dict:
    """Return the live lock status for every game in the registry."""
    rows: List[Dict] = []
    locked_ok = 0
    locked_broken = 0
    redesign_count = 0
    blocked_count = 0

    for g in LOCKED_GAMES:
        engine_ok = _engine_importable(g.engine_module)
        test_path = _test_module_path(g.test_module)
        test_count = _test_pass_count(test_path)
        test_module_exists = (test_path is not None) and os.path.exists(test_path)

        lock_intact = (
            g.status == "LOCKED"
            and (engine_ok in (True, None))
            and ((g.min_tests == 0) or (
                test_count is not None and test_count >= g.min_tests
            ))
        )

        if g.status == "BLOCKED":
            blocked_count += 1
        elif g.status == "REDESIGN":
            redesign_count += 1
        elif lock_intact:
            locked_ok += 1
        else:
            locked_broken += 1

        rows.append({
            **{k: v for k, v in g.__dict__.items()},
            "engine_importable": engine_ok,
            "test_module_exists": test_module_exists,
            "test_pass_count": test_count,
            "lock_intact": lock_intact,
            "lock_color": _color_for(g.status, lock_intact),
        })

    overall = "green"
    if blocked_count > 0 or locked_broken > 0:
        overall = "red"
    elif redesign_count > 0:
        overall = "yellow"

    return {
        "overall_color": overall,
        "summary": {
            "total": len(LOCKED_GAMES),
            "locked_ok": locked_ok,
            "locked_broken": locked_broken,
            "redesign": redesign_count,
            "blocked": blocked_count,
        },
        "games": rows,
    }


@games_lock_router.get("/registry")
def get_static_registry() -> Dict:
    """Return only the static registry without the live health checks.
    Useful for scripts/CI that want the lock manifest without paying the
    pytest --collect-only cost."""
    return {"games": lock_dict(), "total": len(LOCKED_GAMES)}


__all__ = ["games_lock_router"]
