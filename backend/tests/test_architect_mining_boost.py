"""
Architect Pack ($20) Ambassador mining-override consumer test.

Per Pricing Master Vault v1.0: purchasing The Architect activates a 5%
network mining override. The wallet route sets `mining_override_pct = 0.05`
on the user document. The mining engine MUST honour that field by
multiplying personal_mult by (1 + mining_override_pct).

This test guards the full chain wallet → user.mining_override_pct →
mining_engine.compute payout. If anyone removes that read, tests break.
"""
import pytest

from utils import mining_engine


def test_architect_boost_applied_in_get_balance(monkeypatch):
    """get_balance() must surface architect_boost = 1.05 when the user has 0.05 override."""

    fake_user = {
        "user_id": "u1",
        "subscription_tier": "premium",
        "mining_override_pct": 0.05,
    }

    async def _fake_user(_uid):
        return fake_user

    async def _fake_global_boost():
        return 1.0

    async def _fake_find_one(_q, _proj=None):
        return None

    class _FakeColl:
        async def find_one(self, *a, **k):
            return None

    class _FakeDB:
        vibez_mining_balance = _FakeColl()

    monkeypatch.setattr(mining_engine, "_get_user", _fake_user)
    monkeypatch.setattr(mining_engine, "_get_global_boost", _fake_global_boost)
    monkeypatch.setattr(mining_engine, "get_database", lambda: _FakeDB())

    import asyncio
    out = asyncio.run(mining_engine.get_balance("u1"))

    assert out["architect_boost"] == pytest.approx(1.05)
    # personal_multiplier should be base 1.0 * 1.05 = 1.05
    assert out["personal_multiplier"] == pytest.approx(1.05)


def test_architect_boost_default_is_one_for_non_ambassador(monkeypatch):
    fake_user = {
        "user_id": "u2",
        "subscription_tier": "premium",
        # no mining_override_pct field
    }

    async def _fake_user(_uid):
        return fake_user

    async def _fake_global_boost():
        return 1.0

    class _FakeColl:
        async def find_one(self, *a, **k):
            return None

    class _FakeDB:
        vibez_mining_balance = _FakeColl()

    monkeypatch.setattr(mining_engine, "_get_user", _fake_user)
    monkeypatch.setattr(mining_engine, "_get_global_boost", _fake_global_boost)
    monkeypatch.setattr(mining_engine, "get_database", lambda: _FakeDB())

    import asyncio
    out = asyncio.run(mining_engine.get_balance("u2"))

    # No architect override → boost = 1.0, personal_mult = 1.0
    assert out["architect_boost"] == 1.0
    assert out["personal_multiplier"] == 1.0
