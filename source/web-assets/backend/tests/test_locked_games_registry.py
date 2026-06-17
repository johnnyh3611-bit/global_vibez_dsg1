"""Regression tests for the LOCKED_GAMES_REGISTRY.

These tests are the "lock seal" — if any test here goes red, the lock is
considered breached and the room must be checked manually. Every assertion
here is intentionally cheap to keep the dashboard refresh snappy.
"""
from __future__ import annotations

import importlib
import os

from services.locked_games import LOCKED_GAMES, find


def test_registry_has_at_least_30_locked_games() -> None:
    """Sanity floor: we shipped ~35 games. If this drops below 30 something
    has gone catastrophically wrong with the registry."""
    assert len(LOCKED_GAMES) >= 30


def test_no_duplicate_game_ids() -> None:
    ids = [g.id for g in LOCKED_GAMES]
    assert len(ids) == len(set(ids)), f"Duplicate game IDs in lock registry: {ids}"


def test_no_duplicate_routes() -> None:
    routes = [g.route for g in LOCKED_GAMES]
    assert len(routes) == len(set(routes)), f"Duplicate routes: {routes}"


def test_every_engine_module_imports_cleanly() -> None:
    """If a locked game's engine module can't import, the lock is breached."""
    for g in LOCKED_GAMES:
        if not g.engine_module:
            continue
        try:
            importlib.import_module(g.engine_module)
        except Exception as exc:
            raise AssertionError(
                f"Locked game {g.id!r} declares engine "
                f"{g.engine_module!r}, but it failed to import: {exc}"
            ) from exc


def test_every_declared_test_module_exists_on_disk() -> None:
    """Tests can't disappear out from under a locked game."""
    for g in LOCKED_GAMES:
        if not g.test_module:
            continue
        path = os.path.join("/home/johnnie/master-project", g.test_module.replace(".", "/") + ".py")
        assert os.path.exists(path), (
            f"Locked game {g.id!r} declares test module {g.test_module!r}, "
            f"but {path} does not exist."
        )


def test_status_is_valid() -> None:
    for g in LOCKED_GAMES:
        assert g.status in ("LOCKED", "REDESIGN", "BLOCKED"), (
            f"Game {g.id!r} has invalid status {g.status!r}"
        )


def test_min_tests_is_non_negative() -> None:
    for g in LOCKED_GAMES:
        assert g.min_tests >= 0, f"Game {g.id!r} min_tests must be ≥ 0"


def test_lookup_works() -> None:
    g = find("yahtzee")
    assert g is not None and g.name == "Yahtzee"
    assert find("__nonexistent__") is None


def test_every_route_starts_with_slash() -> None:
    for g in LOCKED_GAMES:
        assert g.route.startswith("/"), f"{g.id!r} route must start with /"
