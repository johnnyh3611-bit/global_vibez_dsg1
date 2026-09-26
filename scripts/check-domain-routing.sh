#!/usr/bin/env bash
set -euo pipefail

APEX_URL="${1:-https://globalvibezdsg.com}"
WWW_URL="${2:-https://www.globalvibezdsg.com}"
EXPECTED_WWW_HOST="$(printf '%s' "$WWW_URL" | sed -E 's#^https?://([^/:]+).*$#\1#')"
APEX_PATH_AND_QUERY="$(
  python3 - "$APEX_URL" <<'PY'
import sys
from urllib.parse import urlsplit

url = sys.argv[1]
parts = urlsplit(url)
suffix = parts.path or "/"
if parts.query:
    suffix = f"{suffix}?{parts.query}"
print(suffix)
PY
)"
EXPECTED_APEX_REDIRECT="https://${EXPECTED_WWW_HOST}${APEX_PATH_AND_QUERY}"
FAIL=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAIL=1; }

header_location() {
  awk '
    BEGIN{IGNORECASE=1}
    {
      line=$0
      sub(/\r$/, "", line)
      sub(/^[[:space:]]+/, "", line)
      if (line ~ /^location:[[:space:]]*/) {
        sub(/^location:[[:space:]]*/, "", line)
        print line
        exit
      }
    }
  ' "$1"
}

http_code() {
  awk 'BEGIN{c=""} /^HTTP\//{c=$2} END{print c}' "$1"
}

http_code_first() {
  awk '/^HTTP\//{print $2; exit}' "$1"
}

status_is_ok() {
  local code="$1"
  [[ "$code" =~ ^[23][0-9][0-9]$ ]]
}

run_head() {
  local url="$1"
  local out="$2"
  local follow_redirects="${3:-0}"
  local follow_flag=()
  if [[ "$follow_redirects" == "1" ]]; then
    follow_flag=(-L)
  fi
  if curl -sS "${follow_flag[@]}" -I --max-time 20 "$url" > "$out"; then
    if [[ "$follow_redirects" != "1" ]]; then
      return 0
    fi
    local code
    code="$(http_code "$out")"
    status_is_ok "$code" && return 0
  fi
  curl -sS "${follow_flag[@]}" -o /dev/null -D "$out" --max-time 20 --request GET "$url" || return 1
  if [[ "$follow_redirects" != "1" ]]; then
    return 0
  fi
  local code
  code="$(http_code "$out")"
  status_is_ok "$code" || return 1
  return 0
}

echo "Domain routing check"
echo "  apex: ${APEX_URL}"
echo "  www : ${WWW_URL}"

apex_hdr="$(mktemp)"
www_hdr="$(mktemp)"
robots_hdr="$(mktemp)"
sitemap_hdr="$(mktemp)"
robots_body="$(mktemp)"
sitemap_body="$(mktemp)"
trap 'rm -f "$apex_hdr" "$www_hdr" "$robots_hdr" "$sitemap_hdr" "$robots_body" "$sitemap_body"' EXIT

run_head "$APEX_URL" "$apex_hdr" 0 || { fail "Apex request failed"; exit 1; }
run_head "$WWW_URL" "$www_hdr" 0 || { fail "WWW request failed"; exit 1; }
robots_ok=0
sitemap_ok=0
if run_head "${WWW_URL%/}/robots.txt" "$robots_hdr" 1; then
  robots_ok=1
else
  fail "robots.txt request failed"
fi
if run_head "${WWW_URL%/}/sitemap.xml" "$sitemap_hdr" 1; then
  sitemap_ok=1
else
  fail "sitemap.xml request failed"
fi

apex_code="$(http_code_first "$apex_hdr")"
apex_loc="$(header_location "$apex_hdr")"
apex_redirect_ok=0
if [[ "$APEX_PATH_AND_QUERY" == "/" ]]; then
  if [[ "$apex_loc" == "https://${EXPECTED_WWW_HOST}" || "$apex_loc" == "https://${EXPECTED_WWW_HOST}/" ]]; then
    apex_redirect_ok=1
  fi
elif [[ "$apex_loc" == "$EXPECTED_APEX_REDIRECT" ]]; then
  apex_redirect_ok=1
fi
if [[ "$apex_code" =~ ^3[0-9][0-9]$ ]] && [[ "$apex_redirect_ok" -eq 1 ]]; then
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

if [[ "$robots_ok" -eq 1 ]]; then
  if grep -qiE '^content-type:[[:space:]]*text/plain([[:space:]]*;[[:space:]]*.*)?$' "$robots_hdr"; then
    robots_code="$(http_code "$robots_hdr")"
    if [[ "$robots_code" == "200" ]]; then
      if curl -sS -L --max-time 20 "${WWW_URL%/}/robots.txt" > "$robots_body"; then
        if head -c 64 "$robots_body" | grep -qiE '<!doctype|<html'; then
          fail "robots.txt body looks like HTML (possible SPA fallback)"
        elif grep -qiE '^(User-agent:|Sitemap:)' "$robots_body"; then
          pass "robots.txt is served as text/plain with HTTP 200 and expected directives"
        else
          fail "robots.txt body missing expected directives"
        fi
      else
        fail "robots.txt body request failed"
      fi
    else
      fail "robots.txt is text/plain but status is ${robots_code:-none} (expected 200)"
    fi
  else
    fail "robots.txt content-type is not text/plain (possible SPA fallback)"
  fi
fi

if [[ "$sitemap_ok" -eq 1 ]]; then
  if grep -qiE '^content-type:[[:space:]]*(application|text)/xml' "$sitemap_hdr"; then
    sitemap_code="$(http_code "$sitemap_hdr")"
    if [[ "$sitemap_code" == "200" ]]; then
      if curl -sS -L --max-time 20 "${WWW_URL%/}/sitemap.xml" > "$sitemap_body"; then
        if head -c 64 "$sitemap_body" | grep -qiE '<!doctype|<html'; then
          fail "sitemap.xml body looks like HTML (possible SPA fallback)"
        elif grep -qiE '<\?xml|<urlset|<sitemapindex' "$sitemap_body"; then
          pass "sitemap.xml is served as XML with HTTP 200 and valid XML markers"
        else
          fail "sitemap.xml body missing expected XML markers"
        fi
      else
        fail "sitemap.xml body request failed"
      fi
    else
      fail "sitemap.xml is XML but status is ${sitemap_code:-none} (expected 200)"
    fi
  else
    fail "sitemap.xml content-type is not XML (possible SPA fallback)"
  fi
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
