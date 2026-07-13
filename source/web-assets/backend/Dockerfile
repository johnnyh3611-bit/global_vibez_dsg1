FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Railway / small dyno defaults — ~25 background schedulers will OOM a
# trial instance and surface as edge 502 "Application failed to respond".
# Override to 0 in Variables only when you intentionally want them.
ENV DISABLE_BG_SCHEDULERS=1
ENV DB_NAME=global_vibez

# Expose port (Railway injects $PORT at runtime)
EXPOSE 8000

# Health check must use Railway's $PORT — hardcoding 8000 makes the
# container look dead when Railway assigns e.g. 8080, causing 502s.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD sh -c 'curl -fsS "http://127.0.0.1:${PORT:-8000}/health" || exit 1'

# Start the application - use PORT env var (Railway injects it), fallback to 8000
CMD sh -c "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000} --timeout-keep-alive 30"
