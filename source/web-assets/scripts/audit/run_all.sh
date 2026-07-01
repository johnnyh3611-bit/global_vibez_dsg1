#!/usr/bin/env bash
# Run all 3 game-design audit agents and print a unified summary.
set -uo pipefail
cd "$(dirname "$0")/../.."

PY=/root/.venv/bin/python
[[ -x "$PY" ]] || PY=python

echo "════════════════════════════════════════════════════"
echo "  Game-Design Audit — Visual · Flow · Rules"
echo "════════════════════════════════════════════════════"

$PY -m scripts.audit.visual_agent
echo
$PY -m scripts.audit.flow_agent
echo
$PY -m scripts.audit.rules_agent
echo
$PY -m scripts.audit.knowledge_lock

echo
echo "Reports written to /app/test_reports/audit/"
ls -la /app/test_reports/audit/
