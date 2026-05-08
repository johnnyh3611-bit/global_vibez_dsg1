#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
#  Quality Gates — runs API contracts (fast) + Playwright UI walkthrough
#  + Game-Design audit agents (Visual / Flow / Rules)
# ════════════════════════════════════════════════════════════════════
#  Usage:
#    bash scripts/run_quality_gates.sh            # all three layers
#    bash scripts/run_quality_gates.sh api        # API contracts only
#    bash scripts/run_quality_gates.sh ui         # Playwright only
#    bash scripts/run_quality_gates.sh audit      # Game-design audits only
#
#  Exit codes:  0 = all pass · non-zero = any failure
# ════════════════════════════════════════════════════════════════════
set -uo pipefail

cd "$(dirname "$0")/.."

# Pick env files up so REACT_APP_BACKEND_URL / ADMIN_* are visible.
for env_file in /app/frontend/.env /app/backend/.env; do
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
done

LAYER="${1:-all}"
REPORT_DIR="/app/test_reports/quality_gates"
mkdir -p "$REPORT_DIR"

GREEN="\033[32m"; RED="\033[31m"; YEL="\033[33m"; BOLD="\033[1m"; RESET="\033[0m"
ok() { echo -e "${GREEN}✔${RESET} $*"; }
warn() { echo -e "${YEL}!${RESET} $*"; }
fail() { echo -e "${RED}✘${RESET} $*"; }
hdr() { echo -e "\n${BOLD}── $* ──${RESET}"; }

API_RC=0
UI_RC=0
AUDIT_RC=0
RAN_API=0
RAN_UI=0
RAN_AUDIT=0

# ─────────────────────────────────────────────────── API layer
if [[ "$LAYER" == "all" || "$LAYER" == "api" ]]; then
  hdr "API CONTRACT LAYER"
  RAN_API=1
  /root/.venv/bin/python -m pytest tests/api_contracts/ \
    -v --tb=short \
    --junitxml="$REPORT_DIR/api_contracts.xml" \
    2>&1 | tee "$REPORT_DIR/api_contracts.log"
  API_RC=${PIPESTATUS[0]}
  if [[ $API_RC -eq 0 ]]; then ok "API contracts: PASS"; else fail "API contracts: FAIL ($API_RC)"; fi
fi

# ─────────────────────────────────────────────────── UI layer
if [[ "$LAYER" == "all" || "$LAYER" == "ui" ]]; then
  hdr "PLAYWRIGHT UI WALKTHROUGH"
  RAN_UI=1
  if [[ ! -x /opt/plugins-venv/bin/python ]]; then
    warn "plugins-venv missing — skipping Playwright layer"
  else
    /opt/plugins-venv/bin/python -m pytest tests/e2e_playwright/ \
      -v --tb=short \
      --junitxml="$REPORT_DIR/e2e_playwright.xml" \
      2>&1 | tee "$REPORT_DIR/e2e_playwright.log"
    UI_RC=${PIPESTATUS[0]}
    if [[ $UI_RC -eq 0 ]]; then ok "UI walkthrough: PASS"; else fail "UI walkthrough: FAIL ($UI_RC)"; fi
  fi
fi

# ─────────────────────────────────────────────────── Game-design audit
if [[ "$LAYER" == "all" || "$LAYER" == "audit" ]]; then
  hdr "GAME-DESIGN AUDIT (Visual · Flow · Rules)"
  RAN_AUDIT=1
  bash /app/scripts/audit/run_all.sh 2>&1 | tee "$REPORT_DIR/audit.log" | tail -80
  AUDIT_RC=${PIPESTATUS[0]}
  # Check for HIGH-severity findings — those fail the gate.
  HIGH=$(/root/.venv/bin/python -c "
import json, glob, sys
total = 0
for p in sorted(glob.glob('/app/test_reports/audit/*.json')):
    d = json.load(open(p))
    total += d.get('summary', {}).get('by_severity', {}).get('high', 0)
print(total)
")
  if [[ "$HIGH" -gt 0 ]]; then
    fail "Audit gate: $HIGH HIGH-severity findings — see /app/test_reports/audit/"
    AUDIT_RC=1
  else
    ok "Audit gate: 0 HIGH-severity findings"
  fi
fi

# ─────────────────────────────────────────────────── summary
hdr "QUALITY GATE SUMMARY"
[[ $RAN_API -eq 1 ]] && { [[ $API_RC -eq 0 ]] && ok "API contracts" || fail "API contracts"; }
[[ $RAN_UI -eq 1 ]]  && { [[ $UI_RC -eq 0 ]]  && ok "UI walkthrough" || fail "UI walkthrough"; }
[[ $RAN_AUDIT -eq 1 ]] && { [[ $AUDIT_RC -eq 0 ]] && ok "Game-design audit" || fail "Game-design audit"; }
echo ""
echo "Reports:  $REPORT_DIR/"
echo "Audits:   /app/test_reports/audit/"
echo "Screenshots: /app/test_reports/playwright_screenshots/"

EXIT=$(( API_RC + UI_RC + AUDIT_RC ))
[[ $EXIT -eq 0 ]] && echo -e "\n${GREEN}${BOLD}ALL GATES PASSED${RESET}\n" || \
                     echo -e "\n${RED}${BOLD}GATE(S) FAILED${RESET}\n"
exit "$EXIT"
