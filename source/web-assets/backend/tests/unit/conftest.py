"""
pytest configuration for backend/tests/unit.
Ensures `/home/johnnie/master-project` is on sys.path so `from utils.foo import ...`
and `from routes.foo import ...` resolve cleanly without installation.
"""
import os
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[2]  # /home/johnnie/master-project
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Disable the Card Royale scheduler during tests so module-scoped
# TestClient lifespans don't race test fixtures.
os.environ.setdefault("DISABLE_CARD_ROYALE_SCHEDULER", "1")


@pytest.fixture(scope="session")
def shared_client():
    """
    Session-scoped TestClient shared across every test module that needs one.
    Using a single TestClient for the whole session avoids the "Event loop
    closed" issue that occurs when multiple module-scoped TestClient context
    managers each spin up + tear down their own anyio portal.
    """
    from fastapi.testclient import TestClient
    from server import app
    with TestClient(app) as c:
        yield c
