#!/usr/bin/env bash
# Production launch script — Global Vibez 100K Production Blueprint §1.
#
# Replaces single-process Uvicorn with a multi-worker Gunicorn cluster
# capable of handling 20,000 simultaneous connections per node
# (4 workers × 5,000 worker-connections). Multiply across nodes to reach
# the 100K CCU target.
#
# Usage (production environment ONLY — NOT the supervised preview env):
#   /app/backend/scripts/run_production.sh
#
# IMPORTANT: do NOT run this on the Emergent preview pod — supervisor
# already manages a single uvicorn process there. This script is for
# the production cluster spin-up described in the Blueprint PDF.

set -euo pipefail

cd "$(dirname "$0")/.."

WORKERS="${GUNICORN_WORKERS:-4}"
WORKER_CONNECTIONS="${GUNICORN_WORKER_CONNECTIONS:-5000}"
TIMEOUT="${GUNICORN_TIMEOUT:-120}"
BIND="${GUNICORN_BIND:-0.0.0.0:8001}"

echo "Launching Gunicorn cluster — workers=$WORKERS, conn/worker=$WORKER_CONNECTIONS, bind=$BIND"

exec gunicorn \
    -w "$WORKERS" \
    -k uvicorn.workers.UvicornWorker \
    --bind "$BIND" \
    --worker-connections "$WORKER_CONNECTIONS" \
    --timeout "$TIMEOUT" \
    --access-logfile - \
    --error-logfile - \
    server:app
