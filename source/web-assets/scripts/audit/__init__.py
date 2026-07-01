"""
Shared inventory + helpers for the game-design audit agents.

Agents share this so they all audit the SAME set of files. To audit a new
game, append to ``CARD_GAMES`` below.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional


REPO = Path("/app")
PAGES = REPO / "frontend/src/pages/games"
BACKEND_UTILS = REPO / "backend/utils"

# Each entry pairs a game's frontend file(s) with its backend rule engine
# (when one exists). ``key`` is the canonical slug used in reports.
CARD_GAMES: List[Dict[str, object]] = [
    {
        "key": "spades_aaa",
        "label": "Spades — Premium AAA",
        "frontend": [PAGES / "SpadesPremiumAAA.tsx"],
        "backend_rules": [BACKEND_UTILS / "spades_game.py"],
        "expected_deck_size": 52,                  # CLASSIC default
        "alt_deck_sizes": [54],                    # BIG_WHEEL
    },
    {
        "key": "spades_practice",
        "label": "Spades — Practice (vs AI)",
        "frontend": [PAGES / "SpadesPractice.tsx"],
        "backend_rules": [BACKEND_UTILS / "spades_game.py"],
        "expected_deck_size": 52,
    },
    {
        "key": "spades_4p",
        "label": "Spades — 4P Live",
        "frontend": [PAGES / "HttpMultiplayerSpades4P.tsx",
                     PAGES / "HttpMultiplayerSpades.tsx"],
        "backend_rules": [BACKEND_UTILS / "spades_game.py"],
        "expected_deck_size": 52,
    },
    {
        "key": "bid_whist_aaa",
        "label": "Bid Whist — AAA (canonical)",
        "frontend": [PAGES / "BidWhistAAA.tsx"],
        "backend_rules": [BACKEND_UTILS / "bid_whist_game.py",
                          BACKEND_UTILS / "bid_whist_ai.py"],
        "expected_deck_size": 54,                  # 52 + 2 jokers
    },
    {
        "key": "blackjack_universal",
        "label": "Blackjack — Universal",
        "frontend": [PAGES / "BlackjackUniversal.tsx",
                     PAGES / "HttpMultiplayerBlackjack.tsx"],
        "backend_rules": [],
        "expected_deck_size": 52,
    },
    {
        "key": "poker_practice",
        "label": "Poker — Practice + Multiplayer",
        "frontend": [PAGES / "PokerPractice.tsx",
                     PAGES / "HttpMultiplayerPoker.tsx"],
        "backend_rules": [BACKEND_UTILS / "poker_evaluator.py"],
        "expected_deck_size": 52,
    },
    {
        "key": "rummy",
        "label": "Rummy — Practice + Multiplayer + Gin",
        "frontend": [PAGES / "RummyPractice.tsx",
                     PAGES / "HttpMultiplayerRummy.tsx",
                     PAGES / "HttpMultiplayerGinRummy.tsx"],
        "backend_rules": [],
        "expected_deck_size": 52,
    },
    {
        "key": "baccarat",
        "label": "Baccarat — Premium",
        "frontend": [PAGES / "BaccaratPremium.tsx"],
        "backend_rules": [],
        "expected_deck_size": 52,                  # 6-8 decks shoe but per-deck = 52
    },
    {
        "key": "uno",
        "label": "Uno — Premium",
        "frontend": [PAGES / "UnoPremium.tsx"],
        "backend_rules": [],
        "expected_deck_size": 108,
    },
    {
        "key": "hearts",
        "label": "Hearts",
        "frontend": [PAGES / "HttpMultiplayerHearts.tsx"],
        "backend_rules": [],
        "expected_deck_size": 52,
    },
    {
        "key": "go_fish",
        "label": "Go Fish",
        "frontend": [PAGES / "HttpMultiplayerGoFish.tsx"],
        "backend_rules": [],
        "expected_deck_size": 52,
    },
    {
        "key": "war",
        "label": "War",
        "frontend": [PAGES / "HttpMultiplayerWar.tsx"],
        "backend_rules": [],
        "expected_deck_size": 52,
    },
    {
        "key": "crazy_eights",
        "label": "Crazy Eights",
        "frontend": [PAGES / "HttpMultiplayerCrazyEights.tsx"],
        "backend_rules": [],
        "expected_deck_size": 52,
    },
]


# ─────────────────────────────────────────── shared report types

SEVERITY_HIGH = "high"
SEVERITY_MED = "medium"
SEVERITY_LOW = "low"


@dataclass
class Finding:
    file: str
    line: Optional[int]
    rule: str
    severity: str
    message: str

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class GameReport:
    key: str
    label: str
    files_scanned: int = 0
    findings: List[Finding] = field(default_factory=list)

    def add(self, *, file: Path, line: Optional[int], rule: str,
            severity: str, message: str) -> None:
        self.findings.append(Finding(
            file=str(file.relative_to(REPO)) if file.is_absolute() else str(file),
            line=line, rule=rule, severity=severity, message=message,
        ))

    def to_dict(self) -> Dict:
        by_sev = {SEVERITY_HIGH: 0, SEVERITY_MED: 0, SEVERITY_LOW: 0}
        for f in self.findings:
            by_sev[f.severity] = by_sev.get(f.severity, 0) + 1
        return {
            "key": self.key,
            "label": self.label,
            "files_scanned": self.files_scanned,
            "totals": by_sev,
            "findings": [f.to_dict() for f in self.findings],
        }


def read_lines(path: Path) -> List[str]:
    try:
        return path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return []
    except Exception:
        return []


def grep_lines(path: Path, pattern: str, *, flags: int = 0) -> List[Dict]:
    """Return [{'line': N, 'text': ...}] for every match of ``pattern``."""
    rgx = re.compile(pattern, flags)
    out = []
    for n, txt in enumerate(read_lines(path), start=1):
        if rgx.search(txt):
            out.append({"line": n, "text": txt})
    return out


def write_report(name: str, payload: Dict) -> Path:
    """Persist a JSON report under /app/test_reports/audit/."""
    out_dir = Path("/app/test_reports/audit")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{name}.json"
    out_path.write_text(json.dumps(payload, indent=2, default=str))
    return out_path


def aggregate(reports: List[GameReport]) -> Dict:
    """Sum severity counts across all per-game reports."""
    grand = {SEVERITY_HIGH: 0, SEVERITY_MED: 0, SEVERITY_LOW: 0}
    by_rule: Dict[str, int] = {}
    for r in reports:
        for f in r.findings:
            grand[f.severity] = grand.get(f.severity, 0) + 1
            by_rule[f.rule] = by_rule.get(f.rule, 0) + 1
    return {
        "total_games": len(reports),
        "total_findings": sum(grand.values()),
        "by_severity": grand,
        "by_rule": dict(sorted(by_rule.items(), key=lambda kv: -kv[1])),
    }
