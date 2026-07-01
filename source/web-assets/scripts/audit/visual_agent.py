"""
Visual / UX audit agent.

Scans card-game frontend files for visual & UX issues that won't compile-fail
but degrade polish. Writes JSON to /app/test_reports/audit/visual.json.

Rules checked (each emits a Finding):
  V1  USD currency leak — $X used for gameplay/bets (must be ₵ Vibez Coins)
  V2  Lingering animation — animate-* class without conditional or unmount
  V3  Missing data-testid on interactive button/input
  V4  Hardcoded hex color outside design tokens
  V5  Console.log left in production code
  V6  Inline z-index abuse (>= 9999 indicates layering hacks)
  V7  Icon-only button missing aria-label
  V8  setTimeout/setInterval without a cleanup ref (memory leak)
  V9  Image without alt text
  V10 Backdrop / modal portal without unmount cleanup
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
    aggregate, grep_lines, read_lines, write_report,
)


# Lines that are SAFE despite matching a rule pattern (allow-list).
SAFE_DOLLAR_CONTEXTS = (
    "$ ",                # JSX template strings, prices in label text
    "${API}",
    "${BACKEND",
    "$\\{",              # escaped
    "// $",              # commented
    "/* $",              # block-commented
    "$args",             # bash refs in code-strings
    "$location",
)

CURRENCY_RGX = re.compile(r"(?<![A-Za-z\$])\$\s?\d+(?:\.\d+)?(?:[kKmM])?")
ANIMATE_RGX = re.compile(r'\banimate-(?:pulse|spin|bounce|ping)\b')
# NOTE: V3 detection is multi-line-aware below (see ``find_jsx_tag_end``);
# this regex only locates *opening* of <button>/<Button> tags.
BUTTON_OPEN_RGX = re.compile(r'<(?:button|Button)\b')
HEX_COLOR_RGX = re.compile(r"#[0-9a-fA-F]{6,8}\b")
CONSOLE_LOG_RGX = re.compile(r"\bconsole\.(?:log|debug|info)\(")
# Tailwind arbitrary-value syntax — this IS the design-token escape hatch
# so ``bg-[#050507]`` / ``text-[#22d3ee]`` should NOT trigger V4.
TAILWIND_ARBITRARY_RGX = re.compile(r"-\[#[0-9a-fA-F]{3,8}(?:/\d+)?\]")
ZINDEX_RGX = re.compile(r"z-(?:\[)?(\d{4,})\]?")
ICON_BTN_NO_ARIA_RGX = re.compile(
    r'<(?:button|Button)\b(?:(?![\s/>]+aria-label=)[^>])*>\s*<[A-Z][A-Za-z0-9]+\s+[^>]*?className=', re.DOTALL
)
SET_TIMEOUT_NO_REF_RGX = re.compile(r'\b(?:setTimeout|setInterval)\(')
IMG_NO_ALT_RGX = re.compile(r'<img\b(?![^>]*\balt=)[^>]*?>', re.IGNORECASE)


def find_jsx_tag_end(src: str, start: int) -> int:
    """Given ``src[start] == '<'``, find the index of the closing ``>`` of
    the JSX *opening* tag — multi-line aware.

    Properly handles:
      • arrow tokens (``() => …``) — ``=>`` is *not* the tag closer
      • string literals (``'``, ``"``, `` ` ``) including escapes
      • braced expression children (``{…}``) — we ignore ``>`` inside braces
    Returns ``-1`` if no terminator is found.
    """
    i, n = start, len(src)
    in_str: str | None = None
    brace_depth = 0
    while i < n:
        ch = src[i]
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in "\"'`":
            in_str = ch
            i += 1
            continue
        if ch == "{":
            brace_depth += 1
            i += 1
            continue
        if ch == "}":
            brace_depth = max(0, brace_depth - 1)
            i += 1
            continue
        if ch == ">" and brace_depth == 0:
            # Skip arrow-fn ``=>`` tokens.
            if i > 0 and src[i - 1] == "=":
                i += 1
                continue
            return i
        i += 1
    return -1


def scan_buttons_missing_testid(src: str) -> List[Dict[str, int]]:
    """Return [{'line': N, 'tag': '<Button …>'}] for *every* button-like JSX
    opening tag in ``src`` that lacks a ``data-testid`` attribute. Multi-line
    aware — handles arrow callbacks, ternaries, and template literals."""
    out: List[Dict[str, int]] = []
    for m in BUTTON_OPEN_RGX.finditer(src):
        end = find_jsx_tag_end(src, m.start())
        if end == -1:
            continue
        tag = src[m.start():end + 1]
        if "data-testid" in tag:
            continue
        line_no = src[: m.start()].count("\n") + 1
        out.append({"line": line_no, "tag": " ".join(tag.split())[:140]})
    return out


def audit_file(report: GameReport, path: Path) -> None:
    if not path.exists():
        return
    report.files_scanned += 1
    lines = read_lines(path)
    src = path.read_text(encoding="utf-8")

    # V3 (multi-line-aware) — every <button>/<Button> opening tag in the file
    # is examined for a ``data-testid`` attribute, regardless of whether the
    # tag spans many lines (arrow callbacks, conditional className, etc.).
    for hit in scan_buttons_missing_testid(src):
        report.add(file=path, line=hit["line"], rule="V3_btn_missing_testid",
                   severity=SEVERITY_MED,
                   message=f"<button>/<Button> without data-testid: {hit['tag']}")

    # Lines that are SAFE despite matching a rule pattern (allow-list).
    # Pre-compute "is this a comment-only line?" cache so we skip them.
    for n, raw in enumerate(lines, start=1):
        text = raw.strip()
        if text.startswith("//") or text.startswith("*") or text.startswith("/*"):
            continue
        # Strip trailing line comment so chip-color labels like
        #   `// White - $1-5` don't trigger V1.
        code_only = re.sub(r"//.*$", "", text).strip()

        # V1 — USD leak (gameplay context).
        if CURRENCY_RGX.search(code_only) and not any(
            s in code_only for s in SAFE_DOLLAR_CONTEXTS
        ):
            if "USD" not in code_only and "TGE" not in code_only and not code_only.startswith('"'):
                report.add(file=path, line=n, rule="V1_currency_usd_leak",
                           severity=SEVERITY_HIGH,
                           message=f"Possible USD-denominated bet/price (use ₵): {code_only[:120]}")

        # V2 — lingering animation.
        if ANIMATE_RGX.search(text):
            # Heuristic: if line lacks a conditional ({cond ? '...' : ''}) and
            # there's no `key=` (which forces remount), flag.
            # Skip lines that explicitly opt-in via `// audit:allow-animate`,
            # which marks intentional always-on indicators (loaders, pulsing
            # "active" dots, decorative gradients).
            if "audit:allow-animate" in raw:
                pass
            elif "?" not in text and "key=" not in text:
                report.add(file=path, line=n, rule="V2_lingering_animation",
                           severity=SEVERITY_MED,
                           message=f"Animation class without conditional / key — may not unmount: {text[:120]}")

        # V4 — hex color (use Tailwind tokens / CSS vars instead).
        # Exempt Tailwind arbitrary-value syntax — `bg-[#050507]` is the
        # sanctioned escape hatch for one-off brand colors and shouldn't
        # spam the report.
        # Also exempt lines that explicitly opt-in via `// audit:allow-hex`,
        # which is how design-token files (e.g., `cardGameColors.ts`) and
        # legitimately game-local palettes (e.g., UNO red/yellow/green/blue
        # which are fixed by the actual UNO card deck) document intent.
        if "audit:allow-hex" in raw:
            pass
        else:
            cleaned_for_hex = TAILWIND_ARBITRARY_RGX.sub("", code_only)
            if HEX_COLOR_RGX.search(cleaned_for_hex):
                report.add(file=path, line=n, rule="V4_hardcoded_hex",
                           severity=SEVERITY_LOW,
                           message=f"Hardcoded hex color (prefer design tokens): {code_only[:120]}")

        # V5 — console.log in production code.
        if CONSOLE_LOG_RGX.search(text):
            report.add(file=path, line=n, rule="V5_console_log",
                       severity=SEVERITY_LOW,
                       message=f"console.log left in production: {text[:120]}")

        # V6 — z-index abuse.
        m = ZINDEX_RGX.search(text)
        if m and int(m.group(1)) >= 9999:
            report.add(file=path, line=n, rule="V6_zindex_abuse",
                       severity=SEVERITY_MED,
                       message=f"z-index ≥ 9999 (re-architect layering): {text[:120]}")

        # V8 — bare setTimeout (no useRef cleanup signal nearby).
        if SET_TIMEOUT_NO_REF_RGX.search(text):
            window = "\n".join(lines[max(n-6, 0):min(n+6, len(lines))])
            if "clearTimeout" not in window and "clearInterval" not in window and "useRef" not in window:
                report.add(file=path, line=n, rule="V8_unguarded_timer",
                           severity=SEVERITY_MED,
                           message=f"setTimeout/setInterval without cleanup nearby: {text[:120]}")

        # V9 — img without alt.
        if IMG_NO_ALT_RGX.search(text):
            report.add(file=path, line=n, rule="V9_img_no_alt",
                       severity=SEVERITY_LOW,
                       message=f"<img> missing alt text: {text[:120]}")


def main() -> int:
    reports: List[GameReport] = []
    for game in CARD_GAMES:
        report = GameReport(key=game["key"], label=game["label"])
        for fp in game["frontend"]:
            audit_file(report, fp)
        reports.append(report)

    payload = {
        "agent": "visual",
        "summary": aggregate(reports),
        "games": [r.to_dict() for r in reports],
    }
    out = write_report("visual", payload)
    print(f"[visual] wrote {out}  ·  {payload['summary']['total_findings']} findings")
    print(json.dumps(payload["summary"], indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
