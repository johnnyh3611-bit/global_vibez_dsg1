#!/usr/bin/env bash
set -euo pipefail

APEX_URL="${1:-https://globalvibezdsg.com}"
WWW_URL="${2:-https://www.globalvibezdsg.com}"
EXPECTED_WWW_HOST="$(printf '%s' "$WWW_URL" | sed -E 's#^https?://([^/:]+).*$#\1#')"
FAIL=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAIL=1; }

header_location() {
  awk 'BEGIN{IGNORECASE=1} /^location:/{sub(/\r$/, "", $0); print substr($0, 11); exit}' "$1" | sed 's/^ *//'
}

http_code() {
  awk 'BEGIN{c=""} /^HTTP\//{c=$2} END{print c}' "$1"
}

run_head() {
  local url="$1"
  local out="$2"
  curl -sS -o /dev/null -D "$out" --max-time 20 "$url"
}

echo "Domain routing check"
echo "  apex: ${APEX_URL}"
echo "  www : ${WWW_URL}"

apex_hdr="$(mktemp)"
www_hdr="$(mktemp)"
robots_hdr="$(mktemp)"
sitemap_hdr="$(mktemp)"
trap 'rm -f "$apex_hdr" "$www_hdr" "$robots_hdr" "$sitemap_hdr"' EXIT

run_head "$APEX_URL" "$apex_hdr" || { fail "Apex request failed"; exit 1; }
run_head "$WWW_URL" "$www_hdr" || { fail "WWW request failed"; exit 1; }
run_head "${WWW_URL%/}/robots.txt" "$robots_hdr" || fail "robots.txt request failed"
run_head "${WWW_URL%/}/sitemap.xml" "$sitemap_hdr" || fail "sitemap.xml request failed"

apex_code="$(http_code "$apex_hdr")"
apex_loc="$(header_location "$apex_hdr")"
if [[ "$apex_code" =~ ^30[18]$ ]] && [[ "$apex_loc" == "https://${EXPECTED_WWW_HOST}/"* || "$apex_loc" == "https://${EXPECTED_WWW_HOST}" ]]; then
  pass "Apex redirects to www (${apex_code} → ${apex_loc})"
else
  fail "Apex does not redirect to www as expected (code=${apex_code:-none}, location=${apex_loc:-none})"
fi

www_code="$(http_code "$www_hdr")"
if [[ "$www_code" == "200" ]]; then
  pass "WWW host returns HTTP 200"
else
  fail "WWW host did not return HTTP 200 (code=${www_code:-none})"
fi

if grep -qi '^content-type: text/plain' "$robots_hdr"; then
  pass "robots.txt is served as text/plain"
else
  fail "robots.txt content-type is not text/plain (possible SPA fallback)"
fi

if grep -qi '^content-type: application/xml' "$sitemap_hdr" || grep -qi '^content-type: text/xml' "$sitemap_hdr"; then
  pass "sitemap.xml is served as XML"
else
  fail "sitemap.xml content-type is not XML (possible SPA fallback)"
fi

echo
echo "Manual follow-up checklist:"
echo "  1) Vercel project includes both apex and www domains."
echo "  2) Vercel DNS records point only to Vercel (not GitHub Pages)."
echo "  3) Search Console: submit ${WWW_URL%/}/sitemap.xml and request indexing for ${WWW_URL%/}/."
echo "  4) Optional hard fix to hide repo from Google: set repository visibility to private."

if [[ "$FAIL" -ne 0 ]]; then
  echo "Domain routing check failed."
  exit 1
fi

echo "Domain routing check passed."
