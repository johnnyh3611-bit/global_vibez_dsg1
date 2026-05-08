"""User verification (P1):
  • Solvency WebSocket — clients joining the `treasury` room receive a live
    `solvency_update` payload within the 60-second push window.
  • Fernet field-level encryption — `chair_purchases.user_id` round-trips
    cleanly: write encrypted, read decrypted, legacy plain rows still queryable.

Run:
    /root/.venv/bin/python -m pytest backend/tests/test_p1_user_verification.py -v
"""
from __future__ import annotations

import asyncio
import os
import socketio
from urllib.parse import urlparse

import pytest

API = os.environ.get("REACT_APP_BACKEND_URL") or os.environ.get("API_URL")
assert API, "REACT_APP_BACKEND_URL must be set in env"


# ──────────────────────────────────────────────── 1. Fernet encryption


def test_fernet_roundtrip_basic():
    """`enc(x)` must round-trip when the key is configured."""
    from services.field_encryption import enc, dec, enabled
    if not enabled():
        pytest.skip("FIELD_ENCRYPTION_KEY not configured — encryption disabled (no-op mode)")
    cipher = enc("user-abc-123")
    assert cipher and cipher.startswith("fern::")
    assert cipher != "user-abc-123"
    assert dec(cipher) == "user-abc-123"


def test_fernet_passthrough_for_plaintext():
    """Legacy un-prefixed values must pass through `dec()` unchanged so old
    rows stay queryable during the migration window."""
    from services.field_encryption import dec
    assert dec("legacy-plain-user-id") == "legacy-plain-user-id"
    assert dec(None) is None


def test_fernet_idempotent_encrypt():
    """Re-encrypting an already-encrypted value must not double-wrap."""
    from services.field_encryption import enc, enabled
    if not enabled():
        pytest.skip("encryption disabled")
    once = enc("u-1")
    twice = enc(once)
    assert once == twice


# ──────────────────────────────────────────────── 2. Solvency WebSocket


@pytest.mark.asyncio
async def test_solvency_websocket_emits_within_window():
    """Subscribe to `treasury` Socket.IO room, wait up to 75s, expect at
    least one `solvency_update` event with the schema we contract on.

    This is the user-verification gate for the 60-second broadcaster.
    """
    parsed = urlparse(API)
    base = f"{parsed.scheme}://{parsed.netloc}"
    sio = socketio.AsyncClient(reconnection=False, logger=False, engineio_logger=False)
    received: list[dict] = []
    done = asyncio.Event()

    @sio.on("solvency_update")
    async def _on_solvency(data):
        received.append(data)
        done.set()

    await sio.connect(base, socketio_path="/api/socket.io",
                      transports=["websocket"], wait_timeout=10)
    try:
        # Fire-and-forget join (server handler doesn't ack via callback path).
        await sio.emit("join_treasury_room", {})
        # Tiny grace period so the room enter completes before the next tick.
        await asyncio.sleep(1.0)

        try:
            await asyncio.wait_for(done.wait(), timeout=75)
        except asyncio.TimeoutError:
            pytest.fail("No `solvency_update` received within 75s — broadcaster not running?")

        payload = received[0]
        # Schema contract from routes/manifesto_features._compute_solvency
        assert "vault_usd" in payload
        assert "liability_usd" in payload
        assert "coverage_pct" in payload
        assert "active_chairs" in payload
        assert "circuit_breaker" in payload
        assert isinstance(payload["circuit_breaker"], dict)
        assert "engaged" in payload["circuit_breaker"]
    finally:
        await sio.disconnect()
