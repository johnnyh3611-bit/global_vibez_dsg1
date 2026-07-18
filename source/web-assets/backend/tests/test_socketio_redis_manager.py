"""Production readiness: Socket.IO Redis client_manager wiring."""

from __future__ import annotations

from pathlib import Path

import socketio

_BACKEND = Path(__file__).resolve().parents[1]


def test_build_manager_none_without_redis_url(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    from utils.socketio_manager import build_socketio_client_manager

    assert build_socketio_client_manager() is None


def test_build_manager_returns_async_redis_manager(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    from utils.socketio_manager import build_socketio_client_manager

    mgr = build_socketio_client_manager()
    assert mgr is not None
    assert isinstance(mgr, socketio.AsyncRedisManager)


def test_safe_host_never_includes_password():
    from utils.socketio_manager import _safe_redis_host

    host = _safe_redis_host("redis://user:supersecret@redis.example:6379/0")
    assert "supersecret" not in host
    assert "redis.example" in host


def test_multiplayer_module_wires_client_manager_kwarg():
    """Lock the audit fix: AsyncServer must receive client_manager=."""
    src = (_BACKEND / "services" / "multiplayer.py").read_text()
    assert "build_socketio_client_manager" in src
    assert "client_manager=_client_manager" in src
    assert "AsyncRedisManager" in (
        _BACKEND / "utils" / "socketio_manager.py"
    ).read_text()


def test_multiplayer_does_not_print_user_ids():
    src = (_BACKEND / "services" / "multiplayer.py").read_text()
    assert "user_id: {user_id}" not in src
    assert "(user_id:" not in src
