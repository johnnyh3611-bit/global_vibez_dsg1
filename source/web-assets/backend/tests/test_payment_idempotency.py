"""Payment tx-key idempotency helper."""
from __future__ import annotations

import pytest

from services.payment_idempotency import claim_tx_key, tx_already_processed


class _FakeDup(Exception):
    code = 11000


class _FakeColl:
    def __init__(self):
        self.keys = set()

    async def insert_one(self, doc):
        key = doc["tx_key"]
        if key in self.keys:
            raise _FakeDup("E11000 duplicate key")
        self.keys.add(key)

    async def find_one(self, q, *_a, **_k):
        key = q.get("tx_key")
        if key in self.keys:
            return {"tx_key": key}
        return None


class _FakeDB:
    def __init__(self):
        self.processed_payment_tx = _FakeColl()


@pytest.mark.asyncio
async def test_claim_tx_key_once():
    db = _FakeDB()
    assert await claim_tx_key(db, rail="helio", tx_id="abc123", payment_id="p1") is True
    assert await claim_tx_key(db, rail="helio", tx_id="abc123", payment_id="p1") is False
    assert await tx_already_processed(db, rail="helio", tx_id="abc123") is True


@pytest.mark.asyncio
async def test_empty_tx_allows_caller_cas():
    db = _FakeDB()
    assert await claim_tx_key(db, rail="solana", tx_id="") is True
