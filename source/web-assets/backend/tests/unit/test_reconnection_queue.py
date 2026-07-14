"""Unit tests for Spades ReconnectionQueue."""
from services.reconnection_queue import ReconnectionQueue


def test_offline_enqueue_and_drain():
    q = ReconnectionQueue()
    q.mark_offline("ROOM", "p1")
    q.enqueue("ROOM", "p1", "card_played", {"card": "AS"})
    q.enqueue("ROOM", "p1", "trick_complete", {"winner": "north"})
    q.mark_online("ROOM", "p1", "sid-1")
    events = q.drain_since("ROOM", "p1", 0)
    assert [e.event for e in events] == ["card_played", "trick_complete"]
    assert events[0].seq == 1
    assert events[1].payload["seq"] == 2


def test_drain_since_filters():
    q = ReconnectionQueue()
    q.enqueue("R", "p", "a", {})
    q.enqueue("R", "p", "b", {})
    q.enqueue("R", "p", "c", {})
    assert [e.event for e in q.drain_since("R", "p", 1)] == ["b", "c"]


def test_clear_room():
    q = ReconnectionQueue()
    q.enqueue("R1", "p", "a", {})
    q.enqueue("R2", "p", "a", {})
    q.clear_room("R1")
    assert q.drain_since("R1", "p", 0) == []
    assert len(q.drain_since("R2", "p", 0)) == 1
