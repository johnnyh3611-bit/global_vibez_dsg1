"""
Application settings and environment variables
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# Database
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')

# API Keys
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
MAPBOX_API_KEY = os.environ.get('MAPBOX_API_KEY')

# URLs
FRONTEND_URL = os.environ.get('FRONTEND_URL')
BACKEND_URL = os.environ.get('BACKEND_URL')

# Firebase
FIREBASE_CREDENTIALS_PATH = os.environ.get('FIREBASE_CREDENTIALS_PATH')

# Emergent Auth
EMERGENT_AUTH_BASE_URL = os.environ.get('EMERGENT_AUTH_BASE_URL', 'https://demobackend.emergentagent.com')
EMERGENT_GOOGLE_CLIENT_ID = os.environ.get('EMERGENT_GOOGLE_CLIENT_ID')
EMERGENT_GOOGLE_CLIENT_SECRET = os.environ.get('EMERGENT_GOOGLE_CLIENT_SECRET')

# App Settings
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
PORT = int(os.environ.get('PORT', 8001))
HOST = os.environ.get('HOST', '0.0.0.0')
