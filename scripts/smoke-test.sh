#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${1:-https://globalvibezdsg.com}"

echo "Running Genius Phase Smoke Test against ${BASE_URL}"

test_url() {
  local url="$1"
  local code
  code=$(curl -sSL -o /dev/null -w "%{http_code}" "$url")

  if [[ "$code" == "200" ]]; then
    echo "PASS: $url"
  else
    echo "FAIL: $url (Status: $code)"
  fi
}

test_url "${BASE_URL}/"
test_url "${BASE_URL}/games"
test_url "${BASE_URL}/chair-registry"
