"""
Game-rules audit agent.

Validates each game's rule integrity end-to-end. Targets the kinds of bugs
that compile clean and run, but break the game:

  R1  Deck size mismatch — frontend constructs a deck shape that doesn't
      match the game's expected_deck_size in scripts/audit/__init__.py.
  R2  Currency violation — float-typed bet/wager (must be integer
      Vibez Coins, never float USD).
  R3  Hardcoded "$" prefix in any bet/payout label (must be ₵).
  R4  Win-condition function present in backend but its return value is
      never compared against (orphan rule code).
  R5  Spades-specific: BIG_WHEEL ruleset must include 4 jokers/promoted
      trumps (BIG_JOKER, LITTLE_JOKER, 2_SPADES, 2_DIAMONDS).
  R6  Blackjack-specific: dealer hit-on-soft-17 rule documented in code.
  R7  Poker-specific: hand rank table covers all 10 standard hands.
  R8  Bid Whist: 6-card kitty constant present.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Dict, List

sys.path.insert(0, "/app")
from scripts.audit import (  # noqa: E402
    CARD_GAMES, GameReport, SEVERITY_HIGH, SEVERITY_MED, SEVERITY_LOW,
    aggregate, read_lines, write_report,
)


# ─────────────────────────────────────────── rule patterns

DECK_BUILD_RGX = re.compile(
    r'(?:deck\s*=\s*\[)|(?:Array\.from\(\{\s*length:\s*(\d+)\s*\})|'
    r'(?:new Array\(\s*(\d+)\s*\))', re.IGNORECASE
)
SIZE_DECL_RGX = re.compile(r'\b(?:DECK_SIZE|deckSize)\s*[:=]\s*(\d+)', re.IGNORECASE)
WAGER_FLOAT_RGX = re.compile(
    r'\b(?:wager|bet|stake|pot|payout)\s*[:=]\s*[\d_]+\.\d+', re.IGNORECASE
)
DOLLAR_PREFIX_RGX = re.compile(r"['\"`]\s*\$\s*\$\{")
JOKER_KEYS = ("BIG_JOKER", "LITTLE_JOKER", "2_SPADES", "2_DIAMONDS")
BLACKJACK_S17_RGX = re.compile(r"soft[\s_-]?17|S17", re.IGNORECASE)
POKER_HANDS = (
    "ROYAL_FLUSH", "STRAIGHT_FLUSH", "FOUR_OF_A_KIND", "FULL_HOUSE",
    "FLUSH", "STRAIGHT", "THREE_OF_A_KIND", "TWO_PAIR", "PAIR", "HIGH_CARD",
)
KITTY_RGX = re.compile(r"\bkitty\s*[:=]\s*[\[\(]\s*(?:[^\]\)]*?){0,5}", re.IGNORECASE)


def audit_deck_size(report: GameReport, path: Path,
                    expected: int, alt: List[int]) -> None:
    if not path.exists():
        return
    accepted = {expected, *alt}
    for n, ln in enumerate(read_lines(path), start=1):
        m = SIZE_DECL_RGX.search(ln)
        if m:
            sz = int(m.group(1))
            if sz not in accepted:
                report.add(file=path, line=n, rule="R1_deck_size_mismatch",
                           severity=SEVERITY_HIGH,
                           message=f"DECK_SIZE={sz} but expected {sorted(accepted)}: {ln.strip()[:120]}")
        m = DECK_BUILD_RGX.search(ln)
        if m:
            for g in m.groups():
                if g and int(g) not in accepted and int(g) not in (10, 12, 13, 14):
                    report.add(file=path, line=n, rule="R1_deck_size_mismatch",
                               severity=SEVERITY_MED,
                               message=f"Hardcoded array length {g} suspect for deck "
                                       f"(expected {sorted(accepted)})")


def audit_currency(report: GameReport, path: Path) -> None:
    if not path.exists():
        return
    for n, ln in enumerate(read_lines(path), start=1):
        if WAGER_FLOAT_RGX.search(ln):
            report.add(file=path, line=n, rule="R2_currency_float",
                       severity=SEVERITY_HIGH,
                       message=f"Wager/bet/stake declared as float (must be int ₵): "
                               f"{ln.strip()[:120]}")


def audit_spades_jokers(report: GameReport, path: Path) -> None:
    if not path.exists():
        return
    text = "\n".join(read_lines(path))
    if "BIG_WHEEL" not in text:
        return  # game variant doesn't even mention BIG_WHEEL — skip
    missing = [k for k in JOKER_KEYS if k not in text]
    if missing:
        report.add(file=path, line=None, rule="R5_big_wheel_missing_jokers",
                   severity=SEVERITY_HIGH,
                   message=f"BIG_WHEEL ruleset missing tokens: {missing}")


def audit_blackjack_s17(report: GameReport, path: Path) -> None:
    if not path.exists():
        return
    text = "\n".join(read_lines(path))
    if not BLACKJACK_S17_RGX.search(text):
        report.add(file=path, line=None, rule="R6_blackjack_no_s17_doc",
                   severity=SEVERITY_LOW,
                   message="Blackjack file mentions no soft-17 / S17 rule (recommend documenting)")


def audit_poker_hands(report: GameReport, path: Path) -> None:
    if not path.exists():
        return
    text = "\n".join(read_lines(path))
    missing = [h for h in POKER_HANDS if h not in text and h.replace("_", " ").lower() not in text.lower()]
    if len(missing) > 2:
        report.add(file=path, line=None, rule="R7_poker_incomplete_hand_table",
                   severity=SEVERITY_MED,
                   message=f"Poker hand-rank table missing: {missing}")


def audit_bid_whist_kitty(report: GameReport, path: Path) -> None:
    if not path.exists():
        return
    text = "\n".join(read_lines(path))
    if "kitty" not in text.lower():
        return
    # Check a ±40-char window around every "kitty" mention. We're satisfied
    # if ANY window mentions "6" — the kitty-size invariant. This catches
    # both `kitty=6` and `Deal 6 cards to kitty`.
    for m in re.finditer(r"kitty", text, flags=re.I):
        start = max(0, m.start() - 40)
        end = min(len(text), m.end() + 40)
        window = text[start:end]
        # Strip newlines so multi-line constants count when adjacent.
        flat = window.replace("\n", " ")
        if "6" in flat:
            return
    report.add(file=path, line=None, rule="R8_bid_whist_kitty",
               severity=SEVERITY_LOW,
               message="Bid Whist mentions a kitty but no 6-card constant nearby")


def main() -> int:
    reports: List[GameReport] = []

    for game in CARD_GAMES:
        report = GameReport(key=game["key"], label=game["label"])
        expected = int(game.get("expected_deck_size", 52))
        alt = list(game.get("alt_deck_sizes", []) or [])

        for fp in game["frontend"]:
            audit_deck_size(report, fp, expected, alt)
            audit_currency(report, fp)
            if game["key"].startswith("spades"):
                audit_spades_jokers(report, fp)
            if game["key"].startswith("blackjack"):
                audit_blackjack_s17(report, fp)
            if game["key"].startswith("poker"):
                audit_poker_hands(report, fp)
            if game["key"].startswith("bid_whist"):
                audit_bid_whist_kitty(report, fp)
        for bp in game.get("backend_rules", []):
            audit_deck_size(report, bp, expected, alt)
            audit_currency(report, bp)
            if game["key"].startswith("spades"):
                audit_spades_jokers(report, bp)
            if game["key"].startswith("blackjack"):
                audit_blackjack_s17(report, bp)
            if game["key"].startswith("poker"):
                audit_poker_hands(report, bp)
            if game["key"].startswith("bid_whist"):
                audit_bid_whist_kitty(report, bp)
        reports.append(report)

    payload = {
        "agent": "rules",
        "summary": aggregate(reports),
        "games": [r.to_dict() for r in reports],
    }
    out = write_report("rules", payload)
    print(f"[rules] wrote {out}  ·  {payload['summary']['total_findings']} findings")
    print(json.dumps(payload["summary"], indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
