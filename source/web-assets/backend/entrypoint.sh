#!/bin/sh
# Railway / container entrypoint — always expand PORT via a real shell.
# A bare `uvicorn ... --port $PORT` startCommand can fail to expand when the
# platform does not run the command through a shell, which leaves uvicorn
# unbound and surfaces as Railway "Healthcheck failure" / edge 502.
set -eu

PORT="${PORT:-8000}"
DB_NAME="${DB_NAME:-global_vibez}"
export PORT DB_NAME
export DISABLE_BG_SCHEDULERS="${DISABLE_BG_SCHEDULERS:-1}"

echo "[entrypoint] binding 0.0.0.0:${PORT}"
echo "[entrypoint] DB_NAME=${DB_NAME}"
echo "[entrypoint] DISABLE_BG_SCHEDULERS=${DISABLE_BG_SCHEDULERS}"
if [ -n "${MONGO_URL:-}" ]; then
  echo "[entrypoint] MONGO_URL is set"
else
  echo "[entrypoint] WARNING: MONGO_URL is unset — /health will still pass," \
       "but API routes that need Mongo will 500. Add a MongoDB plugin or Atlas URI."
fi

exec uvicorn server:app \
  --host 0.0.0.0 \
  --port "${PORT}" \
  --timeout-keep-alive 30 \
  --log-level info
