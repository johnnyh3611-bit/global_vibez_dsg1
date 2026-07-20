"""SQLite engine for AI Judge SQLModel tables (closed-loop escrow metadata).

VibeCredits themselves live on Mongo ``users.credits_balance``; this DB
only stores dispute / vote rows and escrow accounting.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

from sqlmodel import Session, SQLModel, create_engine

_DATA_DIR = Path(
    os.environ.get(
        "AI_JUDGE_DB_DIR",
        str(Path(__file__).resolve().parents[3] / "data"),
    )
)
_DATA_DIR.mkdir(parents=True, exist_ok=True)
_DB_PATH = _DATA_DIR / "ai_judge.db"
_ENGINE = create_engine(
    f"sqlite:///{_DB_PATH}",
    connect_args={"check_same_thread": False},
)
_initialized = False


def get_engine():
    return _ENGINE


def init_db() -> None:
    global _initialized
    # Import models so metadata is registered.
    from app.modules.ai_judge import models as _models  # noqa: F401, PLC0415

    SQLModel.metadata.create_all(_ENGINE)
    _initialized = True


def get_session() -> Iterator[Session]:
    if not _initialized:
        init_db()
    with Session(_ENGINE) as session:
        yield session
