"""Trivia path normalize — canonical /games/trivia + legacy /trivia aliases."""
from fastapi import FastAPI, APIRouter
from fastapi.testclient import TestClient

from routes.trivia import router, legacy_router


def _client() -> TestClient:
    app = FastAPI()
    api = APIRouter(prefix="/api")
    api.include_router(router)
    api.include_router(legacy_router)
    app.include_router(api)
    return TestClient(app)


def test_canonical_and_legacy_categories():
    c = _client()
    a = c.get("/api/games/trivia/categories")
    b = c.get("/api/trivia/categories")
    assert a.status_code == 200
    assert b.status_code == 200
    assert a.json()["categories"] == b.json()["categories"]
    assert len(a.json()["categories"]) >= 1


def test_quiz_questions_alias_requires_auth():
    from routes.quiz import router as quiz_router

    app = FastAPI()
    app.include_router(quiz_router, prefix="/api")
    c = TestClient(app)
    # Without auth cookie/header → 401 (normalized path exists)
    r = c.get("/api/quiz/questions?quiz_type=friends")
    assert r.status_code == 401
