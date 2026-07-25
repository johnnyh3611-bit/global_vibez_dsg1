"""Startup secret entropy enforcement."""
from __future__ import annotations

import pytest

from services.security_secrets import (
    audit_secret_strength,
    enforce_secure_secrets,
    warn_insecure_secrets,
)


def test_audit_detects_weak_jwt(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "secret")
    monkeypatch.setenv("ELD_SIGNING_KEY", "dev-eld-signing-key-change-in-production")
    warnings, ok = audit_secret_strength()
    assert ok is False
    assert any("JWT_SECRET" in w for w in warnings)
    assert any("ELD_SIGNING_KEY" in w for w in warnings)


def test_audit_passes_strong_secrets(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "a" * 32)
    monkeypatch.setenv("ELD_SIGNING_KEY", "b" * 32)
    warnings, ok = audit_secret_strength()
    assert ok is True
    assert warnings == []


def test_enforce_blocks_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("ELD_SIGNING_KEY", "b" * 32)
    monkeypatch.delenv("ALLOW_WEAK_SECRETS", raising=False)
    with pytest.raises(SystemExit) as exc:
        enforce_secure_secrets()
    assert exc.value.code == 2


def test_enforce_allows_break_glass(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setenv("ELD_SIGNING_KEY", "b" * 32)
    monkeypatch.setenv("ALLOW_WEAK_SECRETS", "1")
    warnings = enforce_secure_secrets()
    assert warnings  # still warns, but does not exit


def test_warn_does_not_exit_in_dev(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.setenv("JWT_SECRET", "secret")
    monkeypatch.setenv("ELD_SIGNING_KEY", "short")
    warnings = warn_insecure_secrets()
    assert len(warnings) >= 1
