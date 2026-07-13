#!/usr/bin/env bash
# Open / start the Global Vibez DSG workspace (source/web-assets).
# Usage: bash scripts/dev-up.sh [--docker]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/source/web-assets"
FE="$WEB/frontend"
BE="$WEB/backend"

mode="${1:-local}"

echo "Global Vibez DSG — workspace open"
echo "Repo root: $ROOT"

ensure_frontend_env() {
  if [[ ! -f "$FE/.env" ]]; then
    cat > "$FE/.env" <<'EOF'
REACT_APP_BACKEND_URL=http://localhost:8001
EOF
    echo "Created $FE/.env"
  fi
}

ensure_backend_env() {
  if [[ ! -f "$BE/.env" ]]; then
    cat > "$BE/.env" <<'EOF'
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=global_vibez
JWT_SECRET=dev-jwt-secret-change-me
DISABLE_BG_SCHEDULERS=1
EOF
    echo "Created $BE/.env"
  fi
}

if [[ "$mode" == "--docker" || "$mode" == "docker" ]]; then
  echo "Starting docker-compose (mongo + backend + frontend)..."
  (cd "$WEB" && docker compose up --build)
  exit 0
fi

ensure_frontend_env
ensure_backend_env

# MongoDB (best-effort)
if ! curl -sS --max-time 1 "http://127.0.0.1:27017" >/dev/null 2>&1; then
  if command -v mongod >/dev/null 2>&1; then
    mkdir -p /data/db 2>/dev/null || sudo mkdir -p /data/db
    echo "Starting mongod on :27017..."
    mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017 >/tmp/gv-mongod.log 2>&1 &
    sleep 2
  else
    echo "WARN: mongod not found — backend will 500 until Mongo is reachable."
  fi
else
  echo "Mongo already reachable on :27017"
fi

# Backend venv + uvicorn
if [[ ! -d "$BE/.venv" ]]; then
  echo "Creating backend venv..."
  python3 -m venv "$BE/.venv"
  # shellcheck disable=SC1091
  source "$BE/.venv/bin/activate"
  pip install -r "$BE/requirements.txt"
else
  # shellcheck disable=SC1091
  source "$BE/.venv/bin/activate"
fi

echo "Starting backend on :8001..."
(cd "$BE" && DISABLE_BG_SCHEDULERS=1 uvicorn server:app --host 0.0.0.0 --port 8001) >/tmp/gv-backend.log 2>&1 &
BE_PID=$!
sleep 2

# Frontend
echo "Starting frontend on :3000..."
cd "$FE"
if [[ -f yarn.lock ]]; then
  yarn install --frozen-lockfile >/tmp/gv-frontend-install.log 2>&1 || yarn install >/tmp/gv-frontend-install.log 2>&1
  ESLINT_NO_DEV_ERRORS=true BROWSER=none yarn start
else
  npm install >/tmp/gv-frontend-install.log 2>&1
  ESLINT_NO_DEV_ERRORS=true BROWSER=none npm start
fi

kill "$BE_PID" 2>/dev/null || true
