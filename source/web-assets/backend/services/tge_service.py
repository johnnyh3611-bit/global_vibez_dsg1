"""
TGE (Token Generation Event) scaffold for $DSG — Solana SPL minting.

STATUS: SCAFFOLD / MOCKED behind env flag `VIBEZ_TGE_MODE`
    - `mock` (default)  → no chain calls, everything is a simulation.
    - `devnet`          → raises NotImplementedError. Wired for future
                          solana-py integration when keys arrive.
    - `mainnet-beta`    → raises NotImplementedError.

Until the real Solana SPL token is minted and the treasury keypair is in
the environment, every call here logs the intent and records what *would*
have happened, so the admin can preview and audit future mint batches.

Environment variables consumed (none are required in mock mode):
    VIBEZ_TGE_MODE            "mock" | "devnet" | "mainnet-beta"
    VIBEZ_TOKEN_MINT_ADDRESS  (future) SPL mint pubkey
    VIBEZ_TREASURY_SECRET     (future) base58 secret for treasury signer
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

TGE_MODE = os.environ.get("VIBEZ_TGE_MODE", "mock").lower()
DEFAULT_MIN_ELIGIBLE_VIBEZ = float(os.environ.get("VIBEZ_TGE_MIN_BALANCE", "10"))


class TGEConfig:
    """Live config snapshot."""

    @classmethod
    def snapshot(cls) -> Dict[str, Any]:
        return {
            "mode": TGE_MODE,
            "token_mint_address": os.environ.get("VIBEZ_TOKEN_MINT_ADDRESS", ""),
            "treasury_configured": bool(os.environ.get("VIBEZ_TREASURY_SECRET")),
            "min_eligible_vibez": DEFAULT_MIN_ELIGIBLE_VIBEZ,
            "supported_networks": ["mock", "devnet", "mainnet-beta"],
        }


async def build_eligible_cohort(
    db,
    min_vibez: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    Returns every user whose sum(pending + available) ≥ min_vibez.

    Single-pass MongoDB aggregation on `vibez_mining_balance` that joins the
    corresponding `users` doc via `$lookup`. Eliminates the N+1 `find_one`
    pattern — one round trip instead of 1 + N, scales cleanly past 10k wallets.
    """
    threshold = float(min_vibez if min_vibez is not None else DEFAULT_MIN_ELIGIBLE_VIBEZ)

    pipeline: List[Dict[str, Any]] = [
        # Only look at balances that could possibly cross the threshold.
        {"$match": {"$or": [
            {"pending_balance": {"$gt": 0}},
            {"balance": {"$gt": 0}},
        ]}},
        # Compute total + coerce nullable amounts to 0.
        {"$addFields": {
            "pending_amt": {"$ifNull": ["$pending_balance", 0]},
            "avail_amt": {"$ifNull": ["$balance", 0]},
        }},
        {"$addFields": {
            "total_amt": {"$add": ["$pending_amt", "$avail_amt"]},
        }},
        {"$match": {"total_amt": {"$gte": threshold}}},
        # Join the user doc in-place.
        {"$lookup": {
            "from": "users",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "user",
        }},
        {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": False}},
        # Project the exact wire shape.
        {"$project": {
            "_id": 0,
            "user_id": "$user.user_id",
            "username": {"$ifNull": ["$user.username", "$user.user_id"]},
            "wallet": {"$ifNull": ["$user.solana_wallet_address", ""]},
            "opted_in": {"$toBool": {"$ifNull": ["$user.tge_opt_in", False]}},
            "total_vibez": {"$round": ["$total_amt", 2]},
            "pending_vibez": {"$round": ["$pending_amt", 2]},
            "available_vibez": {"$round": ["$avail_amt", 2]},
            "eligible_to_mint": {"$and": [
                {"$ne": [{"$ifNull": ["$user.solana_wallet_address", ""]}, ""]},
                {"$toBool": {"$ifNull": ["$user.tge_opt_in", False]}},
            ]},
        }},
        {"$sort": {"total_vibez": -1}},
    ]

    cursor = db.vibez_mining_balance.aggregate(pipeline)
    return await cursor.to_list(length=None)


async def dry_run_mint_batch(
    db,
    min_vibez: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Compute what a mint batch would look like. No writes.
    """
    cohort = await build_eligible_cohort(db, min_vibez)
    eligible = [r for r in cohort if r["eligible_to_mint"]]
    total_to_mint = round(sum(r["total_vibez"] for r in eligible), 2)
    return {
        "mode": TGE_MODE,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "cohort_size": len(cohort),
        "eligible_count": len(eligible),
        "pending_opt_in_count": len([r for r in cohort if not r["opted_in"]]),
        "pending_wallet_count": len([r for r in cohort if not r["wallet"]]),
        "total_vibez_to_mint": total_to_mint,
        "min_vibez_threshold": float(min_vibez if min_vibez is not None else DEFAULT_MIN_ELIGIBLE_VIBEZ),
        "sample_rows": eligible[:50],
        "config": TGEConfig.snapshot(),
    }


async def execute_mint_batch(
    db,
    min_vibez: Optional[float] = None,
    initiated_by: str = "founder",
) -> Dict[str, Any]:
    """
    Execute a mint batch.

    - `mock` mode → records SIMULATED batch; no chain calls.
    - `devnet` / `mainnet-beta` → calls services.solana_minter.live_mint_batch
      which mints via SPL Token Program, captures per-wallet signatures, and
      records a COMPLETED batch (or COMPLETED_WITH_ERRORS on partial failure).
    """
    preview = await dry_run_mint_batch(db, min_vibez)
    batch_id = f"tge_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    if TGE_MODE == "mock":
        doc = {
            "batch_id": batch_id,
            "status": "SIMULATED",
            "mode": TGE_MODE,
            "initiated_by": initiated_by,
            "initiated_at": now_iso,
            "eligible_count": preview["eligible_count"],
            "total_vibez_minted": preview["total_vibez_to_mint"],
            "min_vibez_threshold": preview["min_vibez_threshold"],
            "rows": preview["sample_rows"],
            "note": "MOCK mode — no on-chain transactions. Rehearsal only.",
        }
        await db.vibez_tge_batches.insert_one(doc)
        return {"ok": True, "batch": {k: v for k, v in doc.items() if k != "_id"}}

    # LIVE path — devnet or mainnet-beta
    mint_address = os.environ.get("VIBEZ_TOKEN_MINT_ADDRESS", "").strip()
    treasury_secret = os.environ.get("VIBEZ_TREASURY_SECRET", "").strip()
    if not mint_address or not treasury_secret:
        raise NotImplementedError(
            f"VIBEZ_TGE_MODE={TGE_MODE} requires VIBEZ_TOKEN_MINT_ADDRESS + "
            "VIBEZ_TREASURY_SECRET to be set."
        )

    from services.solana_minter import live_mint_batch

    eligible_rows = [r for r in preview["sample_rows"] if r.get("eligible_to_mint")]
    decimals = int(os.environ.get("VIBEZ_TOKEN_DECIMALS", "9"))
    results = await live_mint_batch(
        eligible_rows,
        network=TGE_MODE,
        token_mint_address=mint_address,
        treasury_secret_b58=treasury_secret,
        decimals=decimals,
    )

    success_rows = [r for r in results if r.get("ok")]
    failed_rows = [r for r in results if not r.get("ok")]
    total_minted = round(sum(float(r["amount"]) for r in success_rows), 2)
    status = "COMPLETED" if not failed_rows else "COMPLETED_WITH_ERRORS"

    doc = {
        "batch_id": batch_id,
        "status": status,
        "mode": TGE_MODE,
        "token_mint_address": mint_address,
        "network": TGE_MODE,
        "decimals": decimals,
        "initiated_by": initiated_by,
        "initiated_at": now_iso,
        "eligible_count": len(eligible_rows),
        "successful_count": len(success_rows),
        "failed_count": len(failed_rows),
        "total_vibez_minted": total_minted,
        "min_vibez_threshold": preview["min_vibez_threshold"],
        "rows": results,
        "note": f"{TGE_MODE.upper()} mode — on-chain SPL mint batch.",
    }
    await db.vibez_tge_batches.insert_one(doc)

    # Debit each successful user's mining balance so they can't double-mint.
    for r in success_rows:
        recipient_ids = [u["user_id"] for u in eligible_rows if u["wallet"] == r["recipient"]]
        for uid in recipient_ids:
            await db.vibez_mining_balance.update_one(
                {"user_id": uid},
                {
                    "$inc": {
                        "balance": -float(r["amount"]),
                        "lifetime_redeemed": float(r["amount"]),
                    }
                },
            )

    return {"ok": True, "batch": {k: v for k, v in doc.items() if k != "_id"}}


async def list_batches(db, limit: int = 50) -> List[Dict[str, Any]]:
    cursor = db.vibez_tge_batches.find({}, {"_id": 0, "rows": 0}).sort("initiated_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


async def get_batch(db, batch_id: str) -> Optional[Dict[str, Any]]:
    return await db.vibez_tge_batches.find_one({"batch_id": batch_id}, {"_id": 0})


async def set_user_tge_opt_in(db, user_id: str, wallet: str, opt_in: bool) -> Dict[str, Any]:
    """User opts in (or out) and optionally registers their Solana wallet."""
    # Very light validation. A real Solana wallet is a 32-44 char base58 pubkey.
    wallet = (wallet or "").strip()
    if opt_in and (len(wallet) < 32 or len(wallet) > 44):
        raise ValueError("Invalid Solana wallet address (expected 32-44 base58 chars)")
    update: Dict[str, Any] = {"tge_opt_in": bool(opt_in)}
    if wallet:
        update["solana_wallet_address"] = wallet
    await db.users.update_one({"user_id": user_id}, {"$set": update}, upsert=False)
    user = await db.users.find_one(
        {"user_id": user_id},
        {"user_id": 1, "solana_wallet_address": 1, "tge_opt_in": 1, "_id": 0},
    )
    return {"ok": True, "user": user}
