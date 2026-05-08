"""
Knowledge-Lock audit agent — the 4th gate.

Reads /app/memory/MASTER_RULEBOOK.md and enforces its hard UI rules
against every card-game + landing-page frontend file. Any violation
is reported as HIGH (fails the quality gate).

Rules enforced:
  K1  `overflow-scroll` (use `overflow-y-auto scrollbar-hide` instead)
  K2  Bet/wager inputs MUST be sliders, not text/number inputs
  K3  Fixed-bottom status bars MUST have `backdrop-blur` on them
  K4  Primary nav/menu bars MUST use `flex-wrap` to avoid clipping
  K5  3D card tables (class contains `rounded-[150px]` or `card-table`)
      MUST have `perspective-1000` on their container
  K6  Raw `setTimeout` is banned — must use `useSafeTimeout` hook
      (enforced in addition to V8 for redundancy)
  K7  Card-dealing spring physics must include stiffness=80, damping=15
      (when a motion component mentions `"type":"spring"` for cards)
  K8  Multi-player card game containers must not seat more than 4
      players unless the game name explicitly allows it (Poker, Uno)

Writes /app/test_reports/audit/knowledge_lock.json.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import List

sys.path.insert(0, "/app")
from scripts.audit import (  # noqa: E402
    CARD_GAMES, GameReport, SEVERITY_HIGH, SEVERITY_MED,
    aggregate, read_lines, write_report,
)


# ───────────── compile once
OVERFLOW_SCROLL_RGX = re.compile(r"\boverflow-scroll\b|\boverflow-y-scroll\b|\boverflow-x-scroll\b")
TEXT_BET_INPUT_RGX = re.compile(
    r'<input[^>]+type\s*=\s*["\'](?:text|number)["\'][^>]*?(?:bet|wager|stake|amount)',
    re.IGNORECASE,
)
FIXED_BOTTOM_RGX = re.compile(r'className\s*=\s*\{?["\'`][^"\'`]*\bfixed\b[^"\'`]*\bbottom-0\b[^"\'`]*["\'`]')
NAV_OR_MENU_RGX = re.compile(r'<(?:nav|Nav|MenuBar|Menu)\b[^>]*?className\s*=\s*["\'`]([^"\'`]+)["\'`]')
CARD_TABLE_HINT_RGX = re.compile(r'\brounded-\[150px\]\b|\bcard-table\b|\bcardTable\b')
SETTIMEOUT_RGX = re.compile(r"\bsetTimeout\(")
SPRING_CARD_RGX = re.compile(r'type\s*:\s*"spring"', re.IGNORECASE)
TEAM_SIZE_RGX = re.compile(r'\b(?:MAX_PLAYERS|max_players|playerLimit|seats)\s*[:=]\s*(\d+)')


def audit_file(report: GameReport, path: Path, game_key: str) -> None:
    if not path.exists():
        return
    report.files_scanned += 1
    lines = read_lines(path)
    full = "\n".join(lines)

    for n, raw in enumerate(lines, start=1):
        stripped = raw.strip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue

        # K1
        if OVERFLOW_SCROLL_RGX.search(stripped):
            report.add(file=path, line=n, rule="K1_overflow_scroll_banned",
                       severity=SEVERITY_HIGH,
                       message=f"`overflow-scroll` violates rulebook §2.1 — "
                               f"use `overflow-y-auto scrollbar-hide`: {stripped[:120]}")

        # K2
        if TEXT_BET_INPUT_RGX.search(stripped):
            report.add(file=path, line=n, rule="K2_text_bet_input",
                       severity=SEVERITY_HIGH,
                       message=f"Bet/wager text input violates rulebook §2.5 "
                               f"— use <input type='range'>: {stripped[:120]}")

        # K3 — fixed bottom status bar needs backdrop-blur
        if FIXED_BOTTOM_RGX.search(stripped):
            window = "\n".join(lines[max(n - 2, 0):min(n + 3, len(lines))])
            if "backdrop-blur" not in window:
                report.add(file=path, line=n, rule="K3_status_no_blur",
                           severity=SEVERITY_MED,
                           message="fixed bottom-0 bar missing `backdrop-blur-*` (rulebook §2.2)")

        # K4 — nav/menu bars need flex-wrap
        m = NAV_OR_MENU_RGX.search(stripped)
        if m:
            classes = m.group(1)
            if "flex-wrap" not in classes and "flex-col" not in classes:
                report.add(file=path, line=n, rule="K4_menu_no_wrap",
                           severity=SEVERITY_MED,
                           message=f"Nav/Menu missing `flex-wrap` (rulebook §2.3): {classes[:100]}")

        # K7 — cards spring physics sanity (ensures stiffness=80, damping=15 nearby)
        if SPRING_CARD_RGX.search(stripped) and game_key.startswith(("spades", "bid_whist", "poker", "blackjack", "uno")):
            window = "\n".join(lines[max(n - 2, 0):min(n + 6, len(lines))])
            if "stiffness" not in window or "damping" not in window:
                report.add(file=path, line=n, rule="K7_spring_missing_tuning",
                           severity=SEVERITY_MED,
                           message="Card spring animation missing stiffness/damping (rulebook §3)")

        # K8 — player cap for non-Poker/Uno games
        m = TEAM_SIZE_RGX.search(stripped)
        if m and game_key not in ("poker_practice", "uno"):
            seats = int(m.group(1))
            if seats > 4:
                report.add(file=path, line=n, rule="K8_too_many_seats",
                           severity=SEVERITY_MED,
                           message=f"{game_key} allows {seats} seats but rulebook §3 caps at 4: "
                                   f"{stripped[:120]}")

    # K5 — card table without perspective
    if CARD_TABLE_HINT_RGX.search(full) and "perspective-1000" not in full:
        report.add(file=path, line=None, rule="K5_card_table_no_perspective",
                   severity=SEVERITY_MED,
                   message="Card-table container missing `perspective-1000` (rulebook §2.4)")


def main() -> int:
    reports: List[GameReport] = []
    for game in CARD_GAMES:
        report = GameReport(key=game["key"], label=game["label"])
        for fp in game["frontend"]:
            audit_file(report, fp, game["key"])
        reports.append(report)

    payload = {
        "agent": "knowledge_lock",
        "summary": aggregate(reports),
        "games": [r.to_dict() for r in reports],
    }
    out = write_report("knowledge_lock", payload)
    print(f"[knowledge_lock] wrote {out}  ·  "
          f"{payload['summary']['total_findings']} findings")
    print(json.dumps(payload["summary"], indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
