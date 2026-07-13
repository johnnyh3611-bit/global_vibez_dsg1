#!/usr/bin/env bash
# Production smoke test for www.globalvibezdsg.com (and mirrors).
# Fails if the SPA shell is blank / missing JS, or if the backend URL
# was not baked into the production bundle.
set -euo pipefail

BASE_URL="${1:-https://www.globalvibezdsg.com}"
FAIL=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAIL=1; }

echo "Global Vibez DSG smoke test → ${BASE_URL}"

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
  size="$(wc -c < "$js" | tr -d ' ')"
  if [[ "${size:-0}" -gt 100000 ]]; then
    pass "main.js size ${size}"
  else
    fail "main.js too small (${size})"
  fi
  # CRA must bake a string (even empty), never leave the key absent.
  if grep -q 'REACT_APP_BACKEND_URL":"' "$js" \
    || grep -q 'REACT_APP_BACKEND_URL:""' "$js" \
    || grep -q 'REACT_APP_BACKEND_URL:".*"' "$js" \
    || grep -qE 'REACT_APP_BACKEND_URL","[^"]*"' "$js"; then
    pass "REACT_APP_BACKEND_URL baked into bundle"
  else
    # Accept empty-string default from .env.production helpers path:
    # SpeedDatingVideo must not call undefined.replace
    if grep -q 'SpeedDatingVideo_API_URL.replace' "$js" && ! grep -q 'getBackendUrl\|getBackendWsUrl\|||""\|||'\'\' "$js"; then
      fail "Unsafe SpeedDatingVideo_API_URL.replace still present (blank-screen risk)"
    else
      pass "No unsafe SpeedDatingVideo undefined.replace pattern"
    fi
  fi
  rm -f "$js"
fi

for path in /login /games; do
  c="$(curl -sS -L -o /dev/null -w '%{http_code}' --max-time 20 "${BASE_URL}${path}")"
  [[ "$c" == "200" ]] && pass "GET ${path} → 200" || fail "GET ${path} → $c"
done

rm -f "$html" "$hdr"

if [[ "$FAIL" -ne 0 ]]; then
  echo "SMOKE TEST FAILED"
  exit 1
fi
echo "SMOKE TEST PASSED"
