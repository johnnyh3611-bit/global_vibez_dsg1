#!/usr/bin/env bash
# Production smoke test for www.globalvibezdsg.com (and mirrors).
set -euo pipefail

BASE_URL="${1:-https://www.globalvibezdsg.com}"
API_URL="${2:-}"   # optional absolute FastAPI base, e.g. https://xxx.up.railway.app
FAIL=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAIL=1; }

echo "Global Vibez DSG smoke test → ${BASE_URL}"
[[ -n "$API_URL" ]] && echo "API check → ${API_URL}"

html="$(mktemp)"
hdr="$(mktemp)"
curl -sS -L -A 'Mozilla/5.0' -D "$hdr" -o "$html" --max-time 30 "${BASE_URL}/" || {
  fail "GET / (network)"
  exit 1
}

code="$(awk 'BEGIN{c=0} /^HTTP/{c=$2} END{print c}' "$hdr")"
[[ "$code" == "200" ]] && pass "GET / → 200" || fail "GET / → $code"

grep -q 'id="root"' "$html" && pass "SPA #root present" || fail "SPA #root missing"
grep -q 'static/js/main\.' "$html" && pass "main.js referenced" || fail "main.js not referenced"

js_path="$(grep -oE 'static/js/main\.[a-f0-9]+\.js' "$html" | head -1 || true)"
if [[ -z "$js_path" ]]; then
  fail "Could not parse main.js path"
else
  js="$(mktemp)"
  curl -sS -L -o "$js" --max-time 60 "${BASE_URL}/${js_path}" || fail "Download ${js_path}"
  if head -c 64 "$js" | grep -qiE '<!doctype|<html'; then
    fail "main.js returned HTML (deploy in progress or bad rewrite)"
  fi
  size="$(wc -c < "$js" | tr -d ' ')"
  if [[ "${size:-0}" -gt 100000 ]]; then
    pass "main.js size ${size}"
  else
    fail "main.js too small (${size})"
  fi
  if grep -q 'SpeedDatingVideo_API_URL.replace' "$js"; then
    fail "Unsafe SpeedDatingVideo_API_URL.replace still present (blank-screen risk)"
  else
    pass "No unsafe SpeedDatingVideo undefined.replace pattern"
  fi
  if grep -q 'REACT_APP_BACKEND_URL' "$js"; then
    pass "REACT_APP_BACKEND_URL referenced in bundle"
  fi
  # Ship-core FTU: landing must expose Demo Login (CRA embeds the string in main.js).
  if grep -q 'Demo Login' "$js"; then
    pass "Bundle contains Demo Login"
  else
    fail "Bundle missing Demo Login (landing FTU)"
  fi
  # Prefer four-job / lifestyle-extras copy over legacy "Six Utility Rooms".
  if grep -q 'Six Utility Rooms' "$js"; then
    echo "WARN: Bundle still mentions Six Utility Rooms (redeploy after UtilityRoomsDock trim)"
  fi
  if grep -qE 'Four jobs|Lifestyle extras|Explore · beta' "$js"; then
    pass "Bundle has four-job / lifestyle-extras landing copy"
  fi
  rm -f "$js"
fi

for path in /login /games /earn /dashboard; do
  c="$(curl -sS -L -o /dev/null -w '%{http_code}' --max-time 20 "${BASE_URL}${path}")"
  [[ "$c" == "200" ]] && pass "GET ${path} → 200" || fail "GET ${path} → $c"
done

# Same-origin /api on Vercel without a rewrite returns HTML — warn loudly.
same_api="$(mktemp)"
curl -sS -L -o "$same_api" --max-time 20 "${BASE_URL}/api/health" || true
if head -c 32 "$same_api" | grep -qi '<!doctype\|<html'; then
  echo "WARN: ${BASE_URL}/api/health returned HTML (no backend proxy on Vercel)."
  echo "      Set REACT_APP_BACKEND_URL to a live FastAPI host and redeploy."
  if [[ "${SMOKE_REQUIRE_API:-}" == "1" && -z "$API_URL" ]]; then
    fail "SMOKE_REQUIRE_API=1 but no API_URL and www /api is not FastAPI"
  fi
else
  pass "www /api/health is not HTML"
fi
rm -f "$same_api"

if [[ -n "$API_URL" ]]; then
  API_URL="${API_URL%/}"
  body="$(mktemp)"
  hc="$(curl -sS -o "$body" -w '%{http_code}' --max-time 20 "${API_URL}/health" || echo ERR)"
  if [[ "$hc" == "200" ]] && head -c 1 "$body" | grep -q '{'; then
    pass "API /health → 200 JSON"
  else
    fail "API /health → ${hc} (expected JSON 200)"
  fi
  dc="$(curl -sS -o "$body" -w '%{http_code}' -X POST --max-time 20 \
    "${API_URL}/api/auth/demo-login" || echo ERR)"
  if [[ "$dc" == "200" ]]; then
    pass "API demo-login → 200"
    token="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("token", ""))' "$body" 2>/dev/null || true)"
    if [[ -z "$token" ]]; then
      fail "API demo-login response missing token"
    else
      me="$(mktemp)"
      auth_header="Authorization"
      auth_scheme="$(printf '%s' 'Bearer')"
      mc="$(curl -sS -o "$me" -w '%{http_code}' --max-time 20 \
        -H "${auth_header}: ${auth_scheme} ${token}" "${API_URL}/api/auth/me" || echo ERR)"
      if [[ "$mc" == "200" ]] && python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$me" >/dev/null 2>&1; then
        pass "API authenticated /api/auth/me → 200 JSON"
      else
        fail "API authenticated /api/auth/me → ${mc}"
      fi
      rm -f "$me"
    fi
  else
    fail "API demo-login → ${dc}"
  fi
  ih="$(mktemp)"
  ic="$(curl -sS -o "$ih" -w '%{http_code}' --max-time 20 \
    "${API_URL}/api/integrations/health" || echo ERR)"
  if [[ "$ic" == "200" ]] && python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$ih" >/dev/null 2>&1; then
    pass "API /api/integrations/health → 200 JSON"
  else
    fail "API /api/integrations/health → ${ic}"
  fi
  rm -f "$ih"
  rm -f "$body"
fi

rm -f "$html" "$hdr"

if [[ "$FAIL" -ne 0 ]]; then
  echo "SMOKE TEST FAILED"
  echo "See PRODUCTION_OPS.md for Railway + Vercel wiring."
  exit 1
fi
echo "SMOKE TEST PASSED"
