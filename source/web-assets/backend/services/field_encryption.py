"""
Application-layer Field-Level Encryption — practical replacement for
Mongo CSFLE in environments without a KMS (manifesto §3 "even if your
database is breached, the $DSG balances are unreadable without the
master key").

We use Fernet (AES-128-CBC + HMAC-SHA256) from the cryptography lib —
already a transitive dep of bcrypt/PyJWT in our requirements. The key
is read from ``FIELD_ENCRYPTION_KEY`` env var; if absent, encrypt/decrypt
are NO-OPs so existing rows keep working.

Usage:
    from services.field_encryption import enc, dec
    encrypted = enc("user_id_value")          # → "fern::gAAAA..."
    plain     = dec(encrypted)                # → "user_id_value"

Encrypted values are stored with a ``fern::`` sentinel prefix so we can
detect mixed encrypted/plain rows during the migration window without
breaking either.
"""
from __future__ import annotations

import base64
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

PREFIX = "fern::"
_KEY_ENV = "FIELD_ENCRYPTION_KEY"
_fernet = None


def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet
    raw = os.environ.get(_KEY_ENV)
    if not raw:
        return None
    try:
        from cryptography.fernet import Fernet  # noqa: PLC0415
        # Accept either a Fernet base64 key OR a 32-byte secret.
        try:
            Fernet(raw.encode())
            key_bytes = raw.encode()
        except Exception:
            digest = base64.urlsafe_b64encode(raw.encode().ljust(32, b"\0")[:32])
            key_bytes = digest
        _fernet = Fernet(key_bytes)
        logger.info("[field-encryption] enabled (key length: %d)", len(raw))
        return _fernet
    except Exception as exc:
        logger.warning("[field-encryption] disabled: %s", exc)
        return None


def enc(value: Optional[str]) -> Optional[str]:
    """Encrypt a string. Returns the input unchanged if encryption disabled."""
    if value is None:
        return None
    f = _get_fernet()
    if not f or not isinstance(value, str):
        return value
    if value.startswith(PREFIX):
        return value  # already encrypted, idempotent
    token = f.encrypt(value.encode("utf-8")).decode("ascii")
    return f"{PREFIX}{token}"


def dec(value: Optional[str]) -> Optional[str]:
    """Decrypt a Fernet-prefixed string. Pass-through if unencrypted."""
    if value is None or not isinstance(value, str) or not value.startswith(PREFIX):
        return value
    f = _get_fernet()
    if not f:
        return value  # we can't decrypt without the key — leave the cipher
    try:
        return f.decrypt(value[len(PREFIX):].encode("ascii")).decode("utf-8")
    except Exception as exc:
        logger.warning("[field-encryption] decrypt failed: %s", exc)
        return value


def enabled() -> bool:
    return _get_fernet() is not None
