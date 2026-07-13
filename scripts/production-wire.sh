#!/usr/bin/env bash
# Wire production: Railway backend health + Vercel REACT_APP_BACKEND_URL.
# Requires env: RAILWAY_TOKEN, VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
set -euo pipefail

export PATH="${HOME}/.local/bin:${PATH}"

BACKEND_ROOT="$(cd "$(dirname "$0")/../source/web-assets/backend" && pwd)"
RAILWAY_URL="${RAILWAY_PUBLIC_URL:-https://global-vibez-dsg-production.up.railway.app}"
RAILWAY_SERVICE="${RAILWAY_SERVICE_NAME:-global-vibez-dsg}"

need() {
  local k="$1"
  if [[ -z "${!k:-}" ]]; then
    echo "MISSING secret: $k" >&2
    exit 2
  fi
}

need RAILWAY_TOKEN
need VERCEL_TOKEN

# Defaults from known production team (override via env if needed).
export VERCEL_ORG_ID="${VERCEL_ORG_ID:-team_HzlvtSpbRCS0iJgTRZxWzrby}"
export VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-}"

echo "==> Railway whoami"
railway whoami

if [[ -z "${VERCEL_PROJECT_ID}" ]]; then
  echo "==> Resolve Vercel project id for global-vibez-dsg"
  VERCEL_PROJECT_ID="$(vercel project ls --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID" 2>/dev/null \
    | awk '/global-vibez-dsg([^1]|$)/ {print $1; exit}')"
  # Fallback: query API
  if [[ -z "${VERCEL_PROJECT_ID}" ]]; then
    VERCEL_PROJECT_ID="$(curl -sS -H "Authorization: Bearer ${VERCEL_TOKEN}" \
      "https://api.vercel.com/v9/projects?teamId=${VERCEL_ORG_ID}&search=global-vibez-dsg" \
      | python3 -c 'import sys,json; d=json.load(sys.stdin); ps=d.get("projects") or [];
print(next((p["id"] for p in ps if p.get("name")=="global-vibez-dsg"), ""))')"
  fi
  export VERCEL_PROJECT_ID
  [[ -n "${VERCEL_PROJECT_ID}" ]] || { echo "Could not resolve VERCEL_PROJECT_ID" >&2; exit 2; }
  echo "VERCEL_PROJECT_ID=${VERCEL_PROJECT_ID}"
fi

echo "==> Ensure backend vars on ${RAILWAY_SERVICE}"
cd "$BACKEND_ROOT"
# Link if needed (uses .railway/config.json when present)
if [[ ! -f .railway/config.json ]]; then
  echo "No .railway/config.json — run from a linked backend checkout" >&2
  exit 1
fi

# Set critical vars (idempotent). MONGO_URL must already reference the Mongo plugin
# or an Atlas URI; we only ensure DISABLE_BG_SCHEDULERS + DB_NAME + CORS.
railway variables set \
  DISABLE_BG_SCHEDULERS=1 \
  DB_NAME=global_vibez \
  FRONTEND_URL=https://www.globalvibezdsg.com \
  CORS_ORIGINS=https://www.globalvibezdsg.com,https://globalvibezdsg.com \
  ENVIRONMENT=production \
  --service "$RAILWAY_SERVICE" || true

# Ensure JWT_SECRET exists (do not overwrite if already set)
if ! railway variables --service "$RAILWAY_SERVICE" 2>/dev/null | grep -q '^JWT_SECRET='; then
  JWT_SECRET="$(openssl rand -hex 32)"
  railway variables set "JWT_SECRET=${JWT_SECRET}" --service "$RAILWAY_SERVICE"
fi

echo "==> Redeploy Railway service ${RAILWAY_SERVICE}"
railway up --detach --service "$RAILWAY_SERVICE" || railway redeploy --service "$RAILWAY_SERVICE" --yes || true

echo "==> Wait for /health"
ok=0
for i in $(seq 1 60); do
  body="$(curl -sS -m 15 "${RAILWAY_URL}/health" || true)"
  if echo "$body" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
    echo "HEALTH_OK: $body"
    ok=1
    break
  fi
  echo "  attempt $i: $body"
  sleep 10
done
[[ "$ok" -eq 1 ]] || { echo "Railway /health never became ok" >&2; exit 1; }

echo "==> Set Vercel Production REACT_APP_BACKEND_URL=${RAILWAY_URL}"
vercel env rm REACT_APP_BACKEND_URL production --yes --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID" 2>/dev/null || true
printf '%s' "$RAILWAY_URL" | vercel env add REACT_APP_BACKEND_URL production --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID"

echo "==> Redeploy Vercel production"
vercel --prod --yes --token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID" \
  --cwd "$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Smoke"
REACT_APP_BACKEND_URL="$RAILWAY_URL" \
  bash "$(dirname "$0")/smoke-test.sh" https://www.globalvibezdsg.com "$RAILWAY_URL"

echo "PRODUCTION WIRE COMPLETE"
