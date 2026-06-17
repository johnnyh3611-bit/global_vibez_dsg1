"""
Mem0 long-term memory client — thin wrapper around `mem0ai`.

We use Mem0 as the SECONDARY persistence layer for the agent's
self-improvement loop. The PRIMARY layer is still our own
``design_lessons`` MongoDB collection + the append-only
``LEARNING_LOG.md``. Mem0 lets us search across hundreds of past
lessons semantically — something neither Mongo full-text search nor
file grep can do.

Wiring:
  - On every successful POST /api/agent/learn, we also push the
    lesson to Mem0 under USER_ID = "global_vibez_founder".
  - GET /api/agent/memory/search uses Mem0's semantic search so
    queries like "what did we decide about scrollbars?" actually work.
  - Both are best-effort: Mem0 outages MUST NOT break the primary
    write path.

Environment:
  MEM0_API_KEY      — required; obtained from https://app.mem0.ai/
  MEM0_USER_ID      — defaults to "global_vibez_founder"
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_DEFAULT_USER_ID = "global_vibez_founder"


class Mem0Client:
    """Singleton-ish wrapper. Returns None if Mem0 is not configured."""

    def __init__(self) -> None:
        self.user_id = os.environ.get("MEM0_USER_ID", _DEFAULT_USER_ID)
        api_key = os.environ.get("MEM0_API_KEY")
        self._client: Optional[Any] = None
        if not api_key:
            logger.info("[mem0] MEM0_API_KEY not set — long-term memory disabled")
            return
        try:
            from mem0 import MemoryClient  # noqa: PLC0415
            self._client = MemoryClient(api_key=api_key)
            logger.info(f"[mem0] connected (user_id={self.user_id})")
        except Exception as exc:
            logger.warning(f"[mem0] failed to init: {exc}")

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def add_lesson(self, *, insight: str, category: str = "Other",
                   metadata: Optional[Dict[str, Any]] = None) -> Optional[Dict]:
        if not self._client:
            return None
        try:
            messages = [
                {"role": "user",
                 "content": f"[{category}] {insight}"},
            ]
            md = {"category": category, "project": "GlobalVibezDSG"}
            if metadata:
                md.update(metadata)
            return self._client.add(messages, user_id=self.user_id, metadata=md)
        except Exception as exc:
            logger.warning(f"[mem0] add failed: {exc}")
            return None

    def add_raw(self, content: str, *,
                metadata: Optional[Dict[str, Any]] = None) -> Optional[Dict]:
        """Push an arbitrary block of memory (used by bulk import)."""
        if not self._client or not content.strip():
            return None
        try:
            messages = [{"role": "user", "content": content}]
            md = {"project": "GlobalVibezDSG"}
            if metadata:
                md.update(metadata)
            return self._client.add(messages, user_id=self.user_id, metadata=md)
        except Exception as exc:
            logger.warning(f"[mem0] add_raw failed: {exc}")
            return None

    def search(self, query: str, *, limit: int = 10) -> List[Dict[str, Any]]:
        if not self._client:
            return []
        try:
            # mem0ai 2.x requires `filters={'user_id': ...}` — not the old
            # top-level user_id kwarg, which now raises ValueError.
            res = self._client.search(
                query,
                filters={"user_id": self.user_id},
                limit=limit,
            )
            if isinstance(res, dict) and "results" in res:
                return res["results"]
            if isinstance(res, list):
                return res
            return []
        except Exception as exc:
            logger.warning(f"[mem0] search failed: {exc}")
            return []


_singleton: Optional[Mem0Client] = None


def get_mem0_client() -> Mem0Client:
    global _singleton
    if _singleton is None:
        _singleton = Mem0Client()
    return _singleton
