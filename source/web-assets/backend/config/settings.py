"""
Application settings and environment variables
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# Database
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'global_vibez')

# API Keys
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
# AI — Google Gemini (preferred). GOOGLE_API_KEY also accepted.
GEMINI_API_KEY = (
    os.environ.get('GEMINI_API_KEY')
    or os.environ.get('GOOGLE_API_KEY')
    or os.environ.get('EMERGENT_LLM_KEY')  # legacy alias only
)
# Call sites still import EMERGENT_LLM_KEY — point it at Gemini.
EMERGENT_LLM_KEY = GEMINI_API_KEY
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')  # unused for chat; kept for other tools
MAPBOX_API_KEY = os.environ.get('MAPBOX_API_KEY')

# URLs
FRONTEND_URL = os.environ.get('FRONTEND_URL')
BACKEND_URL = os.environ.get('BACKEND_URL')

# App Settings
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
PORT = int(os.environ.get('PORT', 8001))
HOST = os.environ.get('HOST', '0.0.0.0')
