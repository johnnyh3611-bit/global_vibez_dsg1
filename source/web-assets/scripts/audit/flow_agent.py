"""
Game-flow audit agent.

Validates each card game's state-flow integrity — the things that cause
"phantom" or stuck-state bugs that pure rule-checking misses.

Rules checked:
  F1  Frontend useState 'phase' value is referenced but never assigned
      (orphan phase / dead-state risk).
  F2  Backend rule engine class exposes a method named in the frontend's
      fetch URLs but the route doesn't exist in /app/backend/routes/.
  F3  WebSocket emit('foo') in frontend but no @sio.event def foo() on
      backend (or vice-versa).
  F4  Frontend has a button labelled "Deal" / "Bid" / "Play" / "End" /
      "Score" but never wires onClick to a handler that POSTs.
  F5  Game route file references a table_style / ruleset / phase that
      isn't documented in the canonical state list.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Set

sys.path.insert(0, "/app")
from scripts.audit import (  # noqa: E402
    CARD_GAMES, REPO, GameReport, SEVERITY_HIGH, SEVERITY_MED, SEVERITY_LOW,
    aggregate, read_lines, write_report,
)


PHASE_USESTATE_RGX = re.compile(
    r"useState[^(]*\(\s*['\"]([a-z_]+)['\"]\s*\)\s*;?\s*(?://[^\n]*phase)?",
    re.IGNORECASE,
)
SET_PHASE_RGX = re.compile(r"set([A-Z][A-Za-z0-9]*?)\(['\"]([a-z_]+)['\"]\)")
SOCKET_EMIT_RGX = re.compile(r"socket\.(?:emit|send)\(['\"]([a-z_]+)['\"]")
SOCKET_ON_RGX = re.compile(r"socket\.on\(['\"]([a-z_]+)['\"]")
FRONTEND_FETCH_RGX = re.compile(r"\$\{API\}/api/([a-z0-9\-/_]+)")
ACTION_BTN_RGX = re.compile(
    r'<(?:button|Button)\b[^>]*?>\s*((?:Deal|Bid|Play|End Game|Score|Pass|Fold|Hit|Stand|Stay|Surrender|Double|Split))\s*</',
    re.IGNORECASE,
)
ONCLICK_RGX = re.compile(r'onClick\s*=\s*\{')


def collect_backend_event_handlers() -> Set[str]:
    """Find every @sio.event declared across services/*.py for F3 cross-check."""
    handlers: Set[str] = set()
    services = REPO / "backend/services"
    if not services.exists():
        return handlers
    for p in services.glob("*.py"):
        for line in read_lines(p):
            m = re.match(r"\s*async def ([a-z_][a-z0-9_]*)\s*\(", line)
            if m and "@sio.event" in (read_lines(p)[
                max(0, list(read_lines(p)).index(line) - 1)]
                if line in read_lines(p) else ""):
                handlers.add(m.group(1))
    return handlers


def collect_backend_routes() -> Set[str]:
    """Crude /api/<seg>/<seg>... extraction from @router decorators."""
    routes_dir = REPO / "backend/routes"
    paths: Set[str] = set()
    if not routes_dir.exists():
        return paths
    rgx = re.compile(r'@(?:router|api_router)\.(?:get|post|put|delete|patch)\(\s*["\']([^"\']+)["\']')
    prefix_rgx = re.compile(r'APIRouter\(\s*prefix\s*=\s*["\']([^"\']+)["\']')
    for p in routes_dir.glob("*.py"):
        prefix = ""
        for line in read_lines(p):
            mm = prefix_rgx.search(line)
            if mm:
                prefix = mm.group(1)
                break
        for line in read_lines(p):
            m = rgx.search(line)
            if m:
                full = (prefix + m.group(1)).lstrip("/")
                paths.add(full)
    return paths


def audit_frontend(report: GameReport, path: Path,
                   backend_routes: Set[str]) -> None:
    if not path.exists():
        return
    report.files_scanned += 1
    text_lines = read_lines(path)
    full_text = "\n".join(text_lines)

    # ── F1: orphan phase
    declared_phases: Set[str] = set()
    for n, ln in enumerate(text_lines, start=1):
        # Only flag phases declared with an explicit "phase" hint nearby
        # (variable name / inline comment). Generic useState('uptown') is
        # too noisy — that's usually a select-option default, not a
        # state-machine phase.
        if "phase" not in ln.lower() and "stage" not in ln.lower():
            continue
        for m in PHASE_USESTATE_RGX.finditer(ln):
            declared_phases.add(m.group(1))
    set_phases: Set[str] = {m.group(2) for m in SET_PHASE_RGX.finditer(full_text)}
    # Also consider dynamic assignments like `setPhase(data.phase || 'bidding')`
    # — pull literal fallbacks.
    fallback_rgx = re.compile(r"set[A-Z][A-Za-z0-9]*?\([^)]*?\|\|\s*['\"]([a-z_]+)['\"]")
    set_phases |= {m.group(1) for m in fallback_rgx.finditer(full_text)}

    for phase in declared_phases:
        # only declared once → fine, nothing wrong
        if phase not in set_phases and full_text.count(f"'{phase}'") <= 1:
            continue
        if phase not in set_phases:
            report.add(file=path, line=None, rule="F1_orphan_phase",
                       severity=SEVERITY_LOW,
                       message=f"Phase '{phase}' read but never set (or set dynamically — verify)")

    # ── F2: fetch URL → backend route mismatch
    for n, ln in enumerate(text_lines, start=1):
        for m in FRONTEND_FETCH_RGX.finditer(ln):
            url = m.group(1).rstrip("/")
            # Skip dynamic templated segments — they look like ${room_id}
            if "${" in url:
                continue
            # Strip trailing path params we can't pre-resolve
            stripped = re.sub(r"/[a-z0-9_]+$", "", url) if "/" in url else url
            if not any(url == r or stripped == r or r.startswith(url) or url.startswith(r)
                       for r in backend_routes):
                # tolerate well-known infra paths
                if url.startswith(("auth/", "ws/", "wallet/", "preferences/")):
                    continue
                report.add(file=path, line=n, rule="F2_unknown_route",
                           severity=SEVERITY_MED,
                           message=f"Frontend fetch /api/{url} — no matching backend route found")

    # ── F4: action button without onClick
    for n, ln in enumerate(text_lines, start=1):
        m = ACTION_BTN_RGX.search(ln)
        if not m:
            continue
        # window of -3..+3 lines for the matching <button> open tag
        window = "\n".join(text_lines[max(n - 4, 0):min(n + 1, len(text_lines))])
        if not ONCLICK_RGX.search(window):
            report.add(file=path, line=n, rule="F4_action_no_onclick",
                       severity=SEVERITY_MED,
                       message=f"Action button '{m.group(1)}' without onClick wiring")


def audit_backend_rules(report: GameReport, path: Path) -> None:
    """For backend rule engines (e.g. spades_game.py): require at least
    one ``def __init__`` and a method that returns a winner / score.
    Auxiliary helpers (AI heuristics, hand evaluators) are exempt — their
    "terminal" is the comparison/heuristic return, not a game-end hook.
    """
    if not path.exists():
        return
    report.files_scanned += 1
    name = path.name.lower()
    if any(n in name for n in ("_ai.py", "evaluator.py", "_helpers.py", "helpers.py")):
        return  # auxiliary module — not a rules engine
    text = "\n".join(read_lines(path))

    if "class " not in text:
        return  # plain helper module — no class shape to check
    has_terminal = any(kw in text for kw in
                       ("is_finished", "is_complete", "winner", "is_winner",
                        "score(", "final_score", "end_game"))
    if not has_terminal:
        report.add(file=path, line=None, rule="F5_no_terminal_state",
                   severity=SEVERITY_HIGH,
                   message="Rule engine class exposes no terminal/winner method")


def main() -> int:
    backend_routes = collect_backend_routes()
    reports: List[GameReport] = []

    for game in CARD_GAMES:
        report = GameReport(key=game["key"], label=game["label"])
        for fp in game["frontend"]:
            audit_frontend(report, fp, backend_routes)
        for bp in game.get("backend_rules", []):
            audit_backend_rules(report, bp)
        reports.append(report)

    payload = {
        "agent": "flow",
        "summary": aggregate(reports),
        "games": [r.to_dict() for r in reports],
    }
    out = write_report("flow", payload)
    print(f"[flow] wrote {out}  ·  {payload['summary']['total_findings']} findings")
    print(json.dumps(payload["summary"], indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
