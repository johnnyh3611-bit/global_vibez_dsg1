"""
Tests for the live Solana minting code path.

No real RPC calls — we patch services.solana_minter.live_mint_batch so the
code path is exercised without Solana keys.
"""
import pytest
from unittest.mock import patch, AsyncMock


# Tests live modes with mocked Solana calls.


@pytest.mark.asyncio
async def test_live_mode_requires_keys(monkeypatch):
    """Live mode refuses to run when required env vars are missing."""
    import services.tge_service as tge

    monkeypatch.setattr(tge, "TGE_MODE", "devnet")
    monkeypatch.delenv("VIBEZ_TOKEN_MINT_ADDRESS", raising=False)
    monkeypatch.delenv("VIBEZ_TREASURY_SECRET", raising=False)

    async def fake_dry_run(_db, _min=None):
        return {
            "mode": "devnet", "computed_at": "t", "cohort_size": 0,
            "eligible_count": 0, "pending_opt_in_count": 0, "pending_wallet_count": 0,
            "total_vibez_to_mint": 0, "min_vibez_threshold": 0.0,
            "sample_rows": [], "config": {},
        }
    monkeypatch.setattr(tge, "dry_run_mint_batch", fake_dry_run)

    with pytest.raises(NotImplementedError) as exc:
        await tge.execute_mint_batch(object(), min_vibez=0)
    assert "VIBEZ_TOKEN_MINT_ADDRESS" in str(exc.value)


@pytest.mark.asyncio
async def test_live_mode_calls_live_mint_batch(monkeypatch):
    """When env is set, execute_mint_batch delegates to solana_minter.live_mint_batch."""
    import services.tge_service as tge

    monkeypatch.setattr(tge, "TGE_MODE", "devnet")
    monkeypatch.setenv("VIBEZ_TOKEN_MINT_ADDRESS", "FakeMintAddrDoNotUse111111111111111111111111")
    monkeypatch.setenv("VIBEZ_TREASURY_SECRET", "fakebase58secretdoNOTuse")
    monkeypatch.setenv("VIBEZ_TOKEN_DECIMALS", "9")

    # Fake db — dry_run_mint_batch reads users + vibez_mining_balance.
    fake_row = {
        "user_id": "u1",
        "username": "Alice",
        "wallet": "7xLk17EQQ5KLDLDe44wCmupJKJjTGd8hs3eSVVhCx4Mx",
        "opted_in": True,
        "total_vibez": 12.5,
        "pending_vibez": 0.0,
        "available_vibez": 12.5,
        "eligible_to_mint": True,
    }

    async def fake_dry_run(_db, _min=None):
        return {
            "mode": "devnet",
            "computed_at": "t",
            "cohort_size": 1,
            "eligible_count": 1,
            "pending_opt_in_count": 0,
            "pending_wallet_count": 0,
            "total_vibez_to_mint": 12.5,
            "min_vibez_threshold": 10.0,
            "sample_rows": [fake_row],
            "config": {"mode": "devnet"},
        }
    monkeypatch.setattr(tge, "dry_run_mint_batch", fake_dry_run)

    mock_live = AsyncMock(return_value=[{
        "ok": True,
        "recipient": fake_row["wallet"],
        "amount": 12.5,
        "base_units": 12_500_000_000,
        "ata": "FakeATA",
        "signature": "FakeSig1",
    }])

    inserted = {}
    updated_balances = []

    class _Col:
        async def insert_one(self, doc):
            inserted["doc"] = doc
        async def update_one(self, q, u):
            updated_balances.append((q, u))

    class _DB:
        vibez_tge_batches = _Col()
        vibez_mining_balance = _Col()

    with patch("services.solana_minter.live_mint_batch", mock_live):
        result = await tge.execute_mint_batch(_DB(), min_vibez=10, initiated_by="pytest")

    assert result["ok"] is True
    batch = result["batch"]
    assert batch["status"] == "COMPLETED"
    assert batch["successful_count"] == 1
    assert batch["failed_count"] == 0
    assert batch["mode"] == "devnet"
    assert batch["total_vibez_minted"] == 12.5
    assert batch["rows"][0]["signature"] == "FakeSig1"
    # live_mint_batch was called with the expected rows
    mock_live.assert_called_once()
    kwargs = mock_live.call_args.kwargs
    assert kwargs["network"] == "devnet"
    assert kwargs["decimals"] == 9
    # Debited balance for the winner
    assert len(updated_balances) == 1
    assert updated_balances[0][0] == {"user_id": "u1"}


@pytest.mark.asyncio
async def test_live_mode_partial_failure_marks_with_errors(monkeypatch):
    """If any mint fails, status flips to COMPLETED_WITH_ERRORS."""
    import services.tge_service as tge

    monkeypatch.setattr(tge, "TGE_MODE", "devnet")
    monkeypatch.setenv("VIBEZ_TOKEN_MINT_ADDRESS", "MintAddr")
    monkeypatch.setenv("VIBEZ_TREASURY_SECRET", "secret")

    rows = [
        {"user_id": "u1", "username": "A", "wallet": "wA", "opted_in": True,
         "total_vibez": 10, "pending_vibez": 0, "available_vibez": 10, "eligible_to_mint": True},
        {"user_id": "u2", "username": "B", "wallet": "wB", "opted_in": True,
         "total_vibez": 5, "pending_vibez": 0, "available_vibez": 5, "eligible_to_mint": True},
    ]

    async def fake_dry_run(_db, _min=None):
        return {
            "mode": "devnet", "computed_at": "t", "cohort_size": 2, "eligible_count": 2,
            "pending_opt_in_count": 0, "pending_wallet_count": 0,
            "total_vibez_to_mint": 15.0, "min_vibez_threshold": 0.0,
            "sample_rows": rows, "config": {},
        }
    monkeypatch.setattr(tge, "dry_run_mint_batch", fake_dry_run)

    mock_live = AsyncMock(return_value=[
        {"ok": True, "recipient": "wA", "amount": 10, "signature": "s1"},
        {"ok": False, "recipient": "wB", "amount": 5, "error": "blockhash expired"},
    ])

    class _Col:
        async def insert_one(self, doc): pass
        async def update_one(self, q, u): pass

    class _DB:
        vibez_tge_batches = _Col()
        vibez_mining_balance = _Col()

    with patch("services.solana_minter.live_mint_batch", mock_live):
        result = await tge.execute_mint_batch(_DB(), min_vibez=0)

    batch = result["batch"]
    assert batch["status"] == "COMPLETED_WITH_ERRORS"
    assert batch["successful_count"] == 1
    assert batch["failed_count"] == 1
    assert batch["total_vibez_minted"] == 10.0


def test_rpc_endpoint_map(monkeypatch):
    monkeypatch.delenv("VIBEZ_SOLANA_RPC", raising=False)
    from services.solana_minter import _get_rpc_url, RPC_ENDPOINTS
    assert _get_rpc_url("devnet") == RPC_ENDPOINTS["devnet"]
    assert _get_rpc_url("mainnet-beta") == RPC_ENDPOINTS["mainnet-beta"]


def test_rpc_endpoint_override(monkeypatch):
    monkeypatch.setenv("VIBEZ_SOLANA_RPC", "https://my.rpc")
    from services.solana_minter import _get_rpc_url
    assert _get_rpc_url("devnet") == "https://my.rpc"
    assert _get_rpc_url("mainnet-beta") == "https://my.rpc"


@pytest.mark.asyncio
async def test_mint_one_rejects_zero_amount(monkeypatch):
    from services.solana_minter import mint_one
    result = await mint_one(
        recipient_wallet="anywallet",
        amount_vibez=0.0000000001,  # < 1 base unit at decimals=9
        network="devnet",
        token_mint_address="any",
        treasury_secret_b58="any",
        decimals=9,
    )
    # 0.0000000001 * 1e9 = 0 base units
    assert result["ok"] is False
    assert "base units" in result["error"]
