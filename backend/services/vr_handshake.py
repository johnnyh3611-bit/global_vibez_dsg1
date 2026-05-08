"""
VR Handshake Service — Cryptographic session tokens for VR→physical handoffs.

When a VR client requests a physical-world action (ride, door unlock, audio
transition), we require a short-lived HMAC handshake token that proves the
request came from a legitimate live VR session. The token is:

    HMAC-SHA256(secret, f"{user_id}|{vr_session_id}|{exp_unix}")

…encoded as `{exp_unix}.{hex_hmac}`. Tokens expire after 10 minutes.

This is intentionally stateless (no DB round-trip for verify) so VR latency
stays low. The secret lives in the backend env; VR clients receive a fresh
token via `create_handshake_token()` whenever a privileged action becomes
available (e.g., the user walks up to the "Meet in Person" console).
"""
from __future__ import annotations

import hashlib
import hmac
import os
import time
from typing import Optional

# Single secret used for handshake signing. Falls back to a dev default so the
# module still imports in tests; production must set VR_HANDSHAKE_SECRET.
_SECRET = os.environ.get("VR_HANDSHAKE_SECRET", "dev-vr-handshake-secret-change-me").encode("utf-8")
_DEFAULT_TTL_SECONDS = 600  # 10 minutes


def _sign(payload: str) -> str:
    return hmac.new(_SECRET, payload.encode("utf-8"), hashlib.sha256).hexdigest()


def create_handshake_token(user_id: str, vr_session_id: str, ttl_seconds: int = _DEFAULT_TTL_SECONDS) -> str:
    """Create a short-lived signed handshake token for a VR session."""
    exp = int(time.time()) + ttl_seconds
    payload = f"{user_id}|{vr_session_id}|{exp}"
    return f"{exp}.{_sign(payload)}"


def verify_vr_handshake(user_id: str, vr_session_id: str, token: Optional[str]) -> bool:
    """Return True iff the token is valid, not expired, and matches the session."""
    if not token or "." not in token:
        return False
    try:
        exp_str, signature = token.split(".", 1)
        exp = int(exp_str)
    except (ValueError, TypeError):
        return False
    if time.time() > exp:
        return False
    expected = _sign(f"{user_id}|{vr_session_id}|{exp}")
    return hmac.compare_digest(expected, signature)
