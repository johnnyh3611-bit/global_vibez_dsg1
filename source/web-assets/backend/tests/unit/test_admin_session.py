"""
Unit tests for admin session token helpers in routes/admin_dashboard.py.
Covers pure in-memory logic — no FastAPI app, no DB.
"""
from datetime import datetime, timedelta, timezone

import pytest

from routes import admin_dashboard as admin


@pytest.fixture(autouse=True)
def _clear_sessions():
    """Start each test with an empty session store."""
    admin.ADMIN_SESSIONS.clear()
    yield
    admin.ADMIN_SESSIONS.clear()


class TestCreateAdminSession:
    def test_returns_a_nonempty_token(self):
        token = admin.create_admin_session()
        assert isinstance(token, str)
        assert len(token) > 20  # URL-safe base64, 32 bytes → >20 chars

    def test_two_calls_return_distinct_tokens(self):
        a = admin.create_admin_session()
        b = admin.create_admin_session()
        assert a != b

    def test_session_store_gets_an_entry_with_expiry(self):
        before = datetime.now(timezone.utc)
        admin.create_admin_session()
        assert len(admin.ADMIN_SESSIONS) == 1
        entry = next(iter(admin.ADMIN_SESSIONS.values()))
        assert entry['expires_at'] > before
        # Expires ~4h from now; allow broad tolerance
        assert entry['expires_at'] - before <= timedelta(hours=4, minutes=1)


class TestVerifyAdminSession:
    def test_valid_fresh_token_is_verified(self):
        token = admin.create_admin_session()
        assert admin.verify_admin_session(token) is True

    def test_none_token_is_rejected(self):
        assert admin.verify_admin_session(None) is False

    def test_empty_token_is_rejected(self):
        assert admin.verify_admin_session('') is False

    def test_unknown_token_is_rejected(self):
        assert admin.verify_admin_session('not-a-real-token') is False

    def test_expired_token_is_rejected_and_cleaned_up(self):
        token = admin.create_admin_session()
        # Forge expiry into the past
        import hashlib
        session_id = hashlib.sha256(token.encode()).hexdigest()
        admin.ADMIN_SESSIONS[session_id]['expires_at'] = (
            datetime.now(timezone.utc) - timedelta(seconds=1)
        )
        assert admin.verify_admin_session(token) is False
        # Expired session should have been pruned
        assert session_id not in admin.ADMIN_SESSIONS


class TestClearAdminSession:
    def test_clears_valid_session(self):
        token = admin.create_admin_session()
        assert admin.verify_admin_session(token) is True
        admin.clear_admin_session(token)
        assert admin.verify_admin_session(token) is False

    def test_clearing_unknown_token_is_a_no_op(self):
        admin.clear_admin_session('nonexistent')
        # No exception, store still usable
        token = admin.create_admin_session()
        assert admin.verify_admin_session(token) is True

    def test_clearing_empty_token_is_a_no_op(self):
        admin.clear_admin_session('')
        # Still works after
        assert admin.create_admin_session()


def test_create_verify_clear_end_to_end():
    """Sanity: full lifecycle of an admin session token."""
    token = admin.create_admin_session()
    assert admin.verify_admin_session(token)
    admin.clear_admin_session(token)
    assert not admin.verify_admin_session(token)
    # Replay rejected
    assert not admin.verify_admin_session(token)
