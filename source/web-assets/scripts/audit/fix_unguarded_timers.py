"""
V8 auto-fix — replace unguarded setTimeout calls with `useSafeTimeout`.

Strategy (per file flagged by visual_agent):
  1. Add `import { useSafeTimeout } from "@/hooks/useSafeTimeout";` once.
  2. Insert `const safeTimeout = useSafeTimeout();` at the top of the
     default-exported component function.
  3. Find the EXACT line numbers V8 flagged and rewrite
     `setTimeout(` → `safeTimeout(` on those lines only.

This is intentionally conservative — we ONLY touch lines the audit
flagged. Lines that were already safe (e.g. inside useEffect with a
cleanup) keep `setTimeout` unchanged.

Run:  /root/.venv/bin/python scripts/audit/fix_unguarded_timers.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

VISUAL = Path("/app/test_reports/audit/visual.json")


def fix_file(abs_path: Path, bad_lines: set[int]) -> int:
    src = abs_path.read_text()
    lines = src.splitlines(keepends=False)
    patched = 0

    for idx in [ln - 1 for ln in sorted(bad_lines)]:
        if 0 <= idx < len(lines) and "setTimeout(" in lines[idx]:
            lines[idx] = lines[idx].replace("setTimeout(", "safeTimeout(", 1)
            patched += 1

    if patched == 0:
        return 0

    joined = "\n".join(lines)

    # 1. Ensure the import exists.
    if "useSafeTimeout" not in joined:
        # Find insertion point AFTER the full import block, respecting
        # multi-line `import { ... } from ...;` declarations. We look for
        # the first non-import line (excluding blanks) and insert BEFORE it.
        source_lines = joined.splitlines()
        insert_after = 0
        in_multiline = False
        for i, raw in enumerate(source_lines):
            stripped = raw.strip()
            if in_multiline:
                if re.search(r"\}\s*(?:from\s+['\"][^'\"]+['\"]\s*)?;?\s*$", stripped):
                    in_multiline = False
                    insert_after = i
                continue
            if stripped.startswith("import "):
                insert_after = i
                if "{" in stripped and "}" not in stripped:
                    in_multiline = True
                continue
            if stripped == "" or stripped.startswith("//"):
                continue
            # First real code line — stop scanning.
            break
        new_line = 'import { useSafeTimeout } from "@/hooks/useSafeTimeout";'
        source_lines.insert(insert_after + 1, new_line)
        joined = "\n".join(source_lines)

    # 2. Ensure every component that uses safeTimeout has declared it.
    #    Find every default/export function + add the const if missing.
    #    Heuristic: pick the FIRST component function body and inject.
    if "const safeTimeout = useSafeTimeout()" not in joined:
        # Match `export default function Name(...) {` or
        #       `function Name(...) {` followed by a hook call.
        pattern = re.compile(
            r"(export\s+default\s+function\s+\w+\([^)]*\)\s*\{|"
            r"function\s+\w+\([^)]*\)\s*\{)",
            re.MULTILINE,
        )
        m = pattern.search(joined)
        if m:
            inject = "\n  const safeTimeout = useSafeTimeout();"
            joined = joined[: m.end()] + inject + joined[m.end():]

    abs_path.write_text(joined if joined.endswith("\n") else joined + "\n")
    return patched


def main() -> int:
    data = json.load(VISUAL.open())
    targets: dict[str, set[int]] = {}
    for g in data["games"]:
        for f in g["findings"]:
            if f["rule"] != "V8_unguarded_timer":
                continue
            targets.setdefault(f["file"], set()).add(int(f["line"]))

    if not targets:
        print("No V8 findings.")
        return 0

    total = 0
    for rel, lines in targets.items():
        abs_path = Path("/app") / rel
        if not abs_path.exists():
            continue
        count = fix_file(abs_path, lines)
        if count:
            print(f"[fix] {rel} — {count} setTimeout → safeTimeout")
        total += count

    print(f"\n{total} unguarded timers patched.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
