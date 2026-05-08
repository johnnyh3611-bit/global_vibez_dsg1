"""
Middleware configuration for FastAPI app
"""
from starlette.middleware.cors import CORSMiddleware
import os


def setup_middleware(app) -> None:
    """Configure all middleware for the FastAPI app"""
    
    # Read CORS origins from environment variable
    cors_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000')  # Default to localhost for dev
    
    print("🔧 CORS Configuration Debug:")
    print(f"  Raw CORS_ORIGINS: {cors_origins}")
    
    if cors_origins == '*':
        allow_origins = ['*']
        allow_credentials = False  # Credentials not allowed with wildcard
        print("  Using wildcard CORS (credentials: False)")
    else:
        allow_origins = [origin.strip() for origin in cors_origins.split(',')]
        allow_credentials = True  # ✅ Enable credentials for HttpOnly cookies
        print(f"  Using specific origins: {allow_origins}")
        print(f"  Credentials allowed: {allow_credentials}")
    
    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"]
    )

    # Optional rate-limiting middleware — OFF by default to avoid throttling
    # the preview environment (admin polling, dashboards, multi-tab sessions).
    # Flip RATE_LIMIT_ENABLED=1 in production .env to engage the 60req/min /
    # 1000req/hour ceiling defined in middleware.security.RateLimitConfig.
    if os.environ.get("RATE_LIMIT_ENABLED") == "1":
        from middleware.security import rate_limit_middleware
        app.middleware("http")(rate_limit_middleware)
        print("  Rate limiting: ENABLED (60/min, 1000/hr per IP)")

    # Per-route latency telemetry — feeds /api/admin/perf-snapshot.
    # In-process, bounded ring-buffers (1024 samples per route), no DB.
    from services.perf_telemetry import install_perf_middleware
    install_perf_middleware(app)
    print("  Perf telemetry: enabled (1024 samples/route)")

    return app
