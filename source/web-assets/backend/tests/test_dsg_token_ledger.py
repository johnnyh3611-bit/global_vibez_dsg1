"""DSG / in-app coin closed-loop ledger — recirculation balance rules.

Scope note: the on-chain **DSG SPL token** (see
``services/pricing_master_vault.py``) and the off-chain **in-app coin
(₵/VIBEZ) recirculation engine** (``services/recirculation.py``) are
deliberately separate economies — DSG keeps a burn schedule, in-app
coins never leave the system. This suite locks the closed-loop
invariant for the in-app ledger: every coin that enters
``recirculate()`` is accounted for across the 40/30/30 split (nothing
is created or destroyed), mirroring the fixed-supply guarantee the
DSG token relies on (``TOTAL_DSG_SUPPLY`` in pricing_master_vault).

Uses lightweight fake Motor-style collections (no live Mongo needed)
so this suite runs the same everywhere the pure DSG pricing tests do.
"""
from __future__ import annotations

import pytest

from services.recirculation import (
    AIRLOCK_PCT,
    TOURNAMENT_POOL_PCT,
    TREASURY_PCT,
    _split,
    get_pool_summary,
    recirculate,
    release_due_airlocks,
)


# ─────────────────────────────  Fake Mongo plumbing  ─────────────────────────
class _FakeCursor:
    def __init__(self, docs):
        self._iter = iter(list(docs))

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


def _matches(doc, filt) -> bool:
    for key, expected in filt.items():
        actual = doc.get(key)
        if isinstance(expected, dict):
            if "$lte" in expected and not (actual is not None and actual <= expected["$lte"]):
                return False
            if "$lt" in expected and not (actual is not None and actual < expected["$lt"]):
                return False
            if "$gte" in expected and not (actual is not None and actual >= expected["$gte"]):
                return False
            if "$gt" in expected and not (actual is not None and actual > expected["$gt"]):
                return False
        elif actual != expected:
            return False
    return True


class _FakeAggregateCursor:
    def __init__(self, result):
        self._result = result

    async def to_list(self, length=None):
        return self._result


class _FakeUpdateResult:
    def __init__(self, modified_count: int):
        self.modified_count = modified_count


class _FakeCollection:
    def __init__(self):
        self.docs: list = []

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def update_one(self, filt, update, upsert=False):
        target = next(
            (d for d in self.docs if _matches(d, filt)),
            None,
        )
        if target is None:
            if not upsert:
                return _FakeUpdateResult(0)
            target = dict(filt)
            self.docs.append(target)
        modified = False
        for k, v in update.get("$setOnInsert", {}).items():
            target.setdefault(k, v)
        for k, v in update.get("$inc", {}).items():
            target[k] = target.get(k, 0) + v
            modified = True
        for k, v in update.get("$set", {}).items():
            if target.get(k) != v:
                modified = True
            target[k] = v
        return _FakeUpdateResult(1 if modified else 0)

    def find(self, filt=None, _proj=None):
        filt = filt or {}
        matched = [d for d in self.docs if _matches(d, filt)]
        return _FakeCursor(matched)

    def aggregate(self, pipeline):
        docs = self.docs
        total = 0
        for stage in pipeline:
            if "$match" in stage:
                filt = stage["$match"]
                docs = [d for d in docs if all(d.get(k) == v for k, v in filt.items())]
            elif "$group" in stage:
                for key, expr in stage["$group"].items():
                    if key != "_id" and isinstance(expr, dict) and "$sum" in expr:
                        field = expr["$sum"].lstrip("$")
                        total = sum(d.get(field, 0) for d in docs)
        return _FakeAggregateCursor([{"_id": None, "total": total}] if docs else [])


class _FakeDB:
    def __init__(self):
        self.recirculation_ledger = _FakeCollection()
        self.recirculation_pools = _FakeCollection()
        self.recirculation_airlocks = _FakeCollection()


# ─────────────────────────────  Pure split invariants  ───────────────────────
def test_split_percentages_lock_to_40_30_30():
    assert TOURNAMENT_POOL_PCT == 0.40
    assert TREASURY_PCT == 0.30
    assert AIRLOCK_PCT == 0.30


@pytest.mark.parametrize("amount", [1, 3, 7, 100, 999, 1_000_000])
def test_split_conserves_total_supply(amount):
    """Closed loop: tournament + treasury + airlock must always sum back
    to the original amount — coins are never created or destroyed."""
    split = _split(amount)
    assert split["tournament"] + split["treasury"] + split["airlock"] == amount
    assert all(v >= 0 for v in split.values())


def test_split_rejects_non_positive_amount():
    assert _split(0) == {"tournament": 0, "treasury": 0, "airlock": 0}
    assert _split(-50) == {"tournament": 0, "treasury": 0, "airlock": 0}


# ─────────────────────────────  recirculate() ledger rows  ───────────────────
@pytest.mark.asyncio
async def test_recirculate_rejects_non_positive_amount():
    db = _FakeDB()
    out = await recirculate(db, amount_coins=0, source="test")
    assert out["ok"] is False
    assert out["reason"] == "non_positive_amount"
    assert db.recirculation_ledger.docs == []


@pytest.mark.asyncio
async def test_recirculate_writes_ledger_row_and_conserves_amount():
    db = _FakeDB()
    out = await recirculate(db, amount_coins=1_000, source="wheel_joker", user_id="u1")
    assert out["ok"] is True
    assert len(db.recirculation_ledger.docs) == 1
    ledger_row = db.recirculation_ledger.docs[0]
    split = ledger_row["split"]
    assert split["tournament"] + split["treasury"] + split["airlock"] == 1_000
    assert split["tournament"] == 400
    assert split["treasury"] == 300
    assert split["airlock"] == 300


@pytest.mark.asyncio
async def test_recirculate_updates_pool_balances_cumulatively():
    db = _FakeDB()
    await recirculate(db, amount_coins=1_000, source="a")
    await recirculate(db, amount_coins=500, source="b")

    summary = await get_pool_summary(db)
    # 1000 -> 400/300/300 ; 500 -> 200/150/150
    assert summary["tournament_pool"] == 600
    assert summary["treasury"] == 450
    assert summary["airlock_locked"] == 450
    # Closed loop: pools + still-held airlock account for every coin spent.
    assert (
        summary["tournament_pool"] + summary["treasury"] + summary["airlock_locked"]
        == 1_500
    )


@pytest.mark.asyncio
async def test_release_due_airlocks_only_matures_expired_rows():
    db = _FakeDB()
    await recirculate(db, amount_coins=1_000, source="a")
    # Force the airlock row to already be due.
    db.recirculation_airlocks.docs[0]["clears_at"] = "2000-01-01T00:00:00+00:00"

    result = await release_due_airlocks(db)
    assert result["matured"] == 1
    assert result["released"] == 1
    assert result["coins_released"] == 300

    summary = await get_pool_summary(db)
    assert summary["airlock_locked"] == 0

    # Idempotent: re-running releases nothing new.
    again = await release_due_airlocks(db)
    assert again["matured"] == 0
    assert again["released"] == 0
