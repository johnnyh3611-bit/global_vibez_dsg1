"""
Backend conftest — guarantees pytest can resolve `from server import app`
no matter where it's invoked from. Without this, running
`pytest /home/johnnie/master-project/tests/regression_shield.py` from /app fails with
ModuleNotFoundError because the backend dir isn't on sys.path.

Founder-fix Feb 2026 (post P1 sweep): every CI/CD script and human-driven
beta-redeploy run can now call the regression shield from any cwd.
"""
import sys
from pathlib import Path

# Insert /home/johnnie/master-project at the front of sys.path so `from server import app`,
# `from services.* import …`, and `from routes.* import …` always work.
_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
