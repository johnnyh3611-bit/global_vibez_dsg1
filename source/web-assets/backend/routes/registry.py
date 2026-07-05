from fastapi import APIRouter

# Safely import notification routes
try:
    from routes.notifications import router as notifications_router
except ImportError:
    notifications_router = APIRouter()

# Safely import moderation routes
try:
    from routes.moderation import router as moderation_router
except ImportError:
    moderation_router = APIRouter()

# Register all other routes...
def register_all_routes(api_router, app, logger):
    api_router.include_router(notifications_router)
    api_router.include_router(moderation_router)
    from routes.email_auth import router as auth_router
    # `api_router` is already mounted at `/api`, so auth must mount at `/auth`
    # (not `/api/auth`) to avoid generating `/api/api/auth/*` endpoints.
    api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
