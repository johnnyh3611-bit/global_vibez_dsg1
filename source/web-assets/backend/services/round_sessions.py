"""
Short-lived server-side round sessions for the stateless casino engines.

Several casino endpoints used to trust client-supplied state between the
"deal" and "resolve" steps (dealer hands, dealt cards, dice). That let a
player forge a royal flush or a winning roll by POSTing crafted JSON.
This store keeps that state server-side between the two requests instead.

Single-process, in-memory by design: the backend runs as one uvicorn
worker and rounds only live for a few minutes. Rounds are popped on
resolve (one-shot) and expired entries are pruned opportunistically.
"""
from __future__ import annotations

import secrets
import time
from typing import Any, Dict, Optional, Tuple

ROUND_TTL_SECONDS = 15 * 60
_MAX_ROUNDS = 10_000

_rounds: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def _prune() -> None:
    now = time.monotonic()
    for key in [k for k, (ts, _) in _rounds.items() if now - ts > ROUND_TTL_SECONDS]:
        _rounds.pop(key, None)
    if len(_rounds) > _MAX_ROUNDS:
        oldest_first = sorted(_rounds, key=lambda k: _rounds[k][0])
        for key in oldest_first[: len(_rounds) - _MAX_ROUNDS]:
            _rounds.pop(key, None)


def create_round(payload: Dict[str, Any]) -> str:
    """Store round state and return an unguessable round id."""
    _prune()
    round_id = secrets.token_urlsafe(16)
    _rounds[round_id] = (time.monotonic(), payload)
    return round_id


def pop_round(round_id: str) -> Optional[Dict[str, Any]]:
    """Consume a round (one-shot). Returns None if unknown or expired."""
    _prune()
    entry = _rounds.pop(round_id, None)
    return entry[1] if entry else None


__all__ = ["create_round", "pop_round", "ROUND_TTL_SECONDS"]
