"""Mount shim — AI Judge lives in ``app.modules.ai_judge``."""
from app.modules.ai_judge.db import init_db
from app.modules.ai_judge.router import router

init_db()

__all__ = ["router"]
