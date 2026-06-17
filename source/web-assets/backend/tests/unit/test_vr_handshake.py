"""Unit tests for the VR handshake token service."""
import time

from services.vr_handshake import create_handshake_token, verify_vr_handshake


def test_create_and_verify_roundtrip() -> None:
    token = create_handshake_token("u1", "session_x")
    assert verify_vr_handshake("u1", "session_x", token) is True


def test_rejects_mismatched_user() -> None:
    token = create_handshake_token("u1", "session_x")
    assert verify_vr_handshake("u2", "session_x", token) is False


def test_rejects_mismatched_session() -> None:
    token = create_handshake_token("u1", "session_x")
    assert verify_vr_handshake("u1", "session_y", token) is False


def test_rejects_garbage() -> None:
    assert verify_vr_handshake("u1", "s", "garbage") is False
    assert verify_vr_handshake("u1", "s", None) is False
    assert verify_vr_handshake("u1", "s", "") is False
    assert verify_vr_handshake("u1", "s", "1776715205.tampered") is False


def test_rejects_expired_token() -> None:
    # Negative TTL ⇒ already expired
    token = create_handshake_token("u1", "s", ttl_seconds=-1)
    assert verify_vr_handshake("u1", "s", token) is False


def test_ttl_respected() -> None:
    token = create_handshake_token("u1", "s", ttl_seconds=10)
    exp_str = token.split(".")[0]
    assert int(exp_str) - int(time.time()) <= 10


def test_unique_tokens_per_call() -> None:
    # Different expiries produce different tokens
    t1 = create_handshake_token("u1", "s", ttl_seconds=60)
    time.sleep(1.1)
    t2 = create_handshake_token("u1", "s", ttl_seconds=60)
    assert t1 != t2
