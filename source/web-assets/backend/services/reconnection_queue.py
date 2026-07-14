"""
ReconnectionQueue — buffer Socket.IO game events while a player is offline,
then flush them (with sequence numbers) on resume.

Used by Underground Spades to kill reconnect jitter: missed card_played /
trick_complete / hand_dealt events are replayed in order instead of the
client guessing state from a partial re-join.
"""
from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional, Tuple
import threading


@dataclass
class QueuedEvent:
    seq: int
    event: str
    payload: Dict[str, Any]
    ts: str


@dataclass
class PlayerBuffer:
    offline: bool = False
    next_seq: int = 1
    events: Deque[QueuedEvent] = field(default_factory=lambda: deque(maxlen=200))
    last_sid: Optional[str] = None


class ReconnectionQueue:
    """Per-(room, player) event ring buffer with offline/resume semantics."""

    def __init__(self, max_events: int = 200) -> None:
        self._max = max_events
        self._lock = threading.Lock()
        # (room_code, player_id) -> PlayerBuffer
        self._buffers: Dict[Tuple[str, str], PlayerBuffer] = defaultdict(
            lambda: PlayerBuffer(events=deque(maxlen=self._max))
        )

    def _key(self, room_code: str, player_id: str) -> Tuple[str, str]:
        return (room_code, player_id)

    def mark_offline(self, room_code: str, player_id: str) -> None:
        with self._lock:
            buf = self._buffers[self._key(room_code, player_id)]
            buf.offline = True

    def mark_online(self, room_code: str, player_id: str, sid: str) -> None:
        with self._lock:
            buf = self._buffers[self._key(room_code, player_id)]
            buf.offline = False
            buf.last_sid = sid

    def is_offline(self, room_code: str, player_id: str) -> bool:
        with self._lock:
            return self._buffers[self._key(room_code, player_id)].offline

    def enqueue(
        self,
        room_code: str,
        player_id: str,
        event: str,
        payload: Dict[str, Any],
    ) -> QueuedEvent:
        with self._lock:
            buf = self._buffers[self._key(room_code, player_id)]
            qe = QueuedEvent(
                seq=buf.next_seq,
                event=event,
                payload={**payload, "seq": buf.next_seq},
                ts=datetime.now(timezone.utc).isoformat(),
            )
            buf.next_seq += 1
            buf.events.append(qe)
            return qe

    def drain_since(
        self, room_code: str, player_id: str, from_seq: int = 0
    ) -> List[QueuedEvent]:
        with self._lock:
            buf = self._buffers[self._key(room_code, player_id)]
            return [e for e in list(buf.events) if e.seq > from_seq]

    def clear_room(self, room_code: str) -> None:
        with self._lock:
            doomed = [k for k in self._buffers if k[0] == room_code]
            for k in doomed:
                del self._buffers[k]


# Shared singleton used by Spades socket handlers
spades_reconnect_queue = ReconnectionQueue()
