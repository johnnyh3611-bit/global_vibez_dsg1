# Global Vibez DSG - Deployment Configuration

# Backend service will run on port 8001
web: cd backend && uvicorn server:app --host 0.0.0.0 --port ${PORT:-8001}

# Alternative: Use gunicorn for production
# web: cd backend && gunicorn server:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8001}
