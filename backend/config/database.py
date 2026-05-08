"""
Database configuration and connection management
"""
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB configuration
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')

# MongoDB client with optimized settings for Atlas
client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=30000,  # 30 seconds for Atlas replica sets
    connectTimeoutMS=20000,           # 20 seconds connection timeout
    socketTimeoutMS=20000,            # 20 seconds socket timeout
    maxPoolSize=50,                   # Connection pool size
    minPoolSize=10
)

# Database instance
db = client[DB_NAME]


def get_database() -> dict:
    """Get database instance"""
    return db


def get_client() -> dict:
    """Get MongoDB client"""
    return client


async def ping_database():
    """Health check for database connection"""
    try:
        await client.admin.command('ping')
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False
