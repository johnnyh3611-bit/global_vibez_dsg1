"""Lock test — guarantees the founder's locked specs are intact and on-disk.

If any future agent deletes, truncates, or massively rewrites the locked
specs in /app/memory/locked_specs/, this test goes red BEFORE shipping
and the lock is considered breached.
"""
from __future__ import annotations

import os


LOCKED_SPECS_DIR = "/app/memory/locked_specs"

# Files that MUST exist + minimum byte size sanity floor for each.
# If a file shrinks below the floor, something was accidentally truncated.
LOCKED_FILES = {
    "v7_OMNI_BLUEPRINT.md": 2000,
}

# Critical phrases that MUST appear verbatim in v7_OMNI_BLUEPRINT.md.
# These are the canonical numbers + instructions the founder ratified.
V7_REQUIRED_SUBSTRINGS = (
    "Global Vibez DSG Omni-Blueprint v7.0",
    "Self-Sustaining Infrastructure",
    "SINGLE_EPISODE",
    "SERIES_BUNDLE",
    "VIBE_CLIP",
    "MUSIC_TRACK",
    "Memory Bank Movie",
    "Celestial Glasshouse",
    "Beat Auctions",
    "Power Couple",
    "Buy 4 Get 1 Free",
    "70%",
    "30% Platform Fee",
    "DSG Guard",
    "DSG TV",
    "Music Group",
)


def test_locked_specs_dir_exists() -> None:
    assert os.path.isdir(LOCKED_SPECS_DIR), (
        f"{LOCKED_SPECS_DIR} is missing. The founder explicitly asked us to "
        f"lock specs there on 2026-02-15. Restore from git history."
    )


def test_each_locked_file_present_and_sized() -> None:
    for name, min_bytes in LOCKED_FILES.items():
        path = os.path.join(LOCKED_SPECS_DIR, name)
        assert os.path.isfile(path), f"locked spec {name} was deleted"
        size = os.path.getsize(path)
        assert size >= min_bytes, (
            f"locked spec {name} is suspiciously small ({size} < {min_bytes} "
            f"bytes) — looks like a regression / truncation."
        )


def test_v7_blueprint_contains_canonical_numbers() -> None:
    path = os.path.join(LOCKED_SPECS_DIR, "v7_OMNI_BLUEPRINT.md")
    content = open(path).read()
    missing = [s for s in V7_REQUIRED_SUBSTRINGS if s not in content]
    assert not missing, (
        f"v7 blueprint lock is missing canonical strings: {missing}. "
        f"Restore the spec from git or re-derive from the source PDF."
    )
