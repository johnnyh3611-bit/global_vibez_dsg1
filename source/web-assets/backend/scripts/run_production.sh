#!/usr/bin/env bash
# Production launch script — Global Vibez Master Blueprint §5 (May 2026).
#
# Replaces single-process Uvicorn with a multi-worker Gunicorn cluster.
# Master Blueprint spec: 8 workers × 10,000 worker-connections = 80,000
# simultaneous connections per node. Multiply across nodes for 100K CCU.
#
# (The earlier 4×5,000 number from the original Production Blueprint PDF
# is preserved as a fallback via env vars for nodes with less RAM/CPU.)
#
# Usage (production environment ONLY — NOT the supervised preview env):
#   /home/johnnie/master-project/scripts/run_production.sh
#
# IMPORTANT: do NOT run this on the Emergent preview pod — supervisor
# already manages a single uvicorn process there.

set -euo pipefail

cd "$(dirname "$0")/.."

WORKERS="${GUNICORN_WORKERS:-8}"
WORKER_CONNECTIONS="${GUNICORN_WORKER_CONNECTIONS:-10000}"
TIMEOUT="${GUNICORN_TIMEOUT:-120}"
BIND="${GUNICORN_BIND:-0.0.0.0:8001}"

echo "Launching Gunicorn cluster — workers=$WORKERS, conn/worker=$WORKER_CONNECTIONS, bind=$BIND"
echo "(Master Blueprint §5: 8×10K = 80K simultaneous connections per node)"

exec gunicorn \
    -w "$WORKERS" \
    -k uvicorn.workers.UvicornWorker \
    --bind "$BIND" \
    --worker-connections "$WORKER_CONNECTIONS" \
    --timeout "$TIMEOUT" \
    --access-logfile - \
    --error-logfile - \
    server:app
