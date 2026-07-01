"""
Configuration package initialization
"""
from .database import db, get_database, get_client, ping_database
from .middleware import setup_middleware
from .settings import (
    MONGO_URL,
    DB_NAME,
    STRIPE_API_KEY,
    EMERGENT_LLM_KEY,
    FRONTEND_URL,
    BACKEND_URL,
    MAPBOX_API_KEY,
    FIREBASE_CREDENTIALS_PATH,
    EMERGENT_AUTH_BASE_URL,
    EMERGENT_GOOGLE_CLIENT_ID,
    EMERGENT_GOOGLE_CLIENT_SECRET
)

__all__ = [
    'db',
    'get_database',
    'get_client',
    'ping_database',
    'setup_middleware',
    'MONGO_URL',
    'DB_NAME',
    'STRIPE_API_KEY',
    'EMERGENT_LLM_KEY',
    'FRONTEND_URL',
    'BACKEND_URL',
    'MAPBOX_API_KEY',
    'FIREBASE_CREDENTIALS_PATH',
    'EMERGENT_AUTH_BASE_URL',
    'EMERGENT_GOOGLE_CLIENT_ID',
    'EMERGENT_GOOGLE_CLIENT_SECRET'
]
