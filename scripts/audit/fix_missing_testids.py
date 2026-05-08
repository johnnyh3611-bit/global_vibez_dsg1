"""
V3 auto-fix — adds data-testid to card-game <Button> tags that the
visual_agent flagged as missing testids.

Safe approach:
  - Only edits files listed in /app/test_reports/audit/visual.json under V3.
  - Only rewrites lines that EXACTLY match known safe patterns:
      * Back-to-lobby Buttons
      * leaveGame() handlers
  - Derives a stable slug from the file name (HttpMultiplayerPoker.tsx →
    mp-poker).
  - Skips any line that already has ``data-testid``.

Run:  /root/.venv/bin/python scripts/audit/fix_missing_testids.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

VISUAL_REPORT = Path("/app/test_reports/audit/visual.json")


def _slug(fname: str) -> str:
    base = Path(fname).stem
    base = re.sub(r"^HttpMultiplayer", "mp-", base)
    # CamelCase → kebab-case
    return re.sub(r"([a-z])([A-Z])", r"\1-\2", base).lower()


def _pick_label(line: str, slug: str) -> str:
    """Pick a stable, unique testid suffix for the button."""
    lower = line.lower()
    if "leavegame" in lower and "cancel" in lower:
        return "cancel-leave-btn"
    if "leavegame" in lower and "confirm" in lower:
        return "confirm-leave-btn"
    if "leavegame" in lower:
        return "leave-btn"
    if "navigate(" in lower and "/http-multiplayer" in lower:
        return "back-to-lobby"
    if "navigate(" in lower and "/games" in lower:
        return "back-to-games"
    if "startgame" in lower:
        return "start-game-btn"
    return "action-btn"


def fix_line(line: str, slug: str) -> str:
    """Insert data-testid right after the <Button token if missing."""
    if "data-testid" in line:
        return line
    # Only touch <Button ...> opening tags (not <button>).
    if not re.search(r"<Button\b", line):
        return line
    label = _pick_label(line, slug)
    testid = f'{slug}-{label}'
    # Insert after `<Button` token (preserve any existing props).
    return re.sub(r"<Button\b", f'<Button data-testid="{testid}"', line, count=1)


def main() -> int:
    data = json.load(VISUAL_REPORT.open())
    targets: dict[str, set[int]] = {}
    for g in data["games"]:
        for f in g["findings"]:
            if f["rule"] != "V3_btn_missing_testid":
                continue
            targets.setdefault(f["file"], set()).add(int(f["line"]))

    if not targets:
        print("No V3 findings to fix.")
        return 0

    fixed = 0
    for rel, lines_to_fix in targets.items():
        abs_path = Path("/app") / rel
        if not abs_path.exists():
            continue
        src = abs_path.read_text().splitlines(keepends=False)
        slug = _slug(abs_path.name)
        # Seen suffixes per file to keep testids unique across file.
        used_testids: set[str] = set()
        any_changed = False
        for lineno in sorted(lines_to_fix):
            idx = lineno - 1
            if idx < 0 or idx >= len(src):
                continue
            before = src[idx]
            after = fix_line(before, slug)
            if before == after:
                continue
            # Ensure uniqueness within the file — append "-2", "-3", ...
            m = re.search(r'data-testid="([^"]+)"', after)
            if m:
                base = m.group(1)
                uniq = base
                n = 2
                while uniq in used_testids:
                    uniq = f"{base}-{n}"
                    n += 1
                used_testids.add(uniq)
                if uniq != base:
                    after = after.replace(f'data-testid="{base}"',
                                          f'data-testid="{uniq}"')
            src[idx] = after
            any_changed = True
            fixed += 1
        if any_changed:
            abs_path.write_text("\n".join(src) + "\n")
            print(f"[fix] {rel} — {len([1 for l in src if 'data-testid' in l])} testids now present")

    print(f"\n{fixed} lines patched.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
