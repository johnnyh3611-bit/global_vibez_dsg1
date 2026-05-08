"""
Card-game payout helper — applies the 13.5% Sovereign Tax BEFORE crediting
a user's wallet (per `Global_Vibez_Sovereign_Game_Logic_Fix.pdf` directive E).

Flow for every card-game win:
  1. Compute `gross` payout (bet × multiplier, pot / n, etc.)
  2. `settle_taxable_payout(db, user_id, gross, tx_type, game_id, description)`
     → debits sovereign tax, credits `net`, logs audit row, returns the
        breakdown `{gross, tax, net, new_balance_field}`.
  3. Caller returns `net` to the client so the WIN animation always shows
     the POST-TAX amount the player will actually receive.

This is the ONE place that routes payouts through `sovereign_engine.process_transaction`
so ambassador dividends + treasury state stay canonical.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from services.sovereign_engine import process_transaction
from services.sovereign_validator import apply_sovereign_tax
from utils.wallet_fields import pick_wallet_field_for_credit


async def settle_taxable_payout(
    db,
    *,
    user_id: str,
    gross: int,
    tx_type: str,
    game_id: Optional[str] = None,
    description: Optional[str] = None,
    is_ambassador: bool = False,
) -> Dict[str, Any]:
    """Settle a card-game win with Sovereign Tax applied pre-credit.

    Returns `{gross, tax, net, field, tx_type}` — the caller should
    surface `net` in the WS payload so the client's win animation
    shows the real post-tax number.
    """
    gross_i = max(0, int(gross))
    if gross_i <= 0:
        return {"gross": 0, "tax": 0, "net": 0, "field": None, "tx_type": tx_type}

    # PDF validator's canonical 13.5% split — identical numbers to
    # sovereign_engine's SOVEREIGN_TAX, but exposed here so the
    # WIN animation sees them BEFORE the DB write fires.
    preview = apply_sovereign_tax(gross_i)

    # Route through the sovereign engine so the Treasury ledger +
    # ambassador dividends stay consistent with tips + rides.
    tx = await process_transaction(
        db,
        user_id=user_id,
        amount=gross_i,
        tx_type=tx_type,
        is_ambassador=is_ambassador,
        metadata={
            "game_id": game_id,
            "description": description,
            "source": "card_game_payout",
        },
    )
    net = int(tx["payout"])

    # Sanity: the engine's numbers should equal the validator's preview.
    # If they ever diverge we prefer the engine (source of truth for on-
    # chain economic state).
    if net != preview["net"]:
        preview["net"] = net
        preview["tax"] = gross_i - net

    # Credit the winner's preferred wallet field.
    u = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "token_balance": 1, "credits_balance": 1},
    ) or {}
    field = pick_wallet_field_for_credit(u)
    if net > 0:
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {field: net}},
        )

    # Audit row (matches existing credit_transactions shape).
    await db.credit_transactions.insert_one({
        "user_id": user_id,
        "amount": net,
        "gross": gross_i,
        "tax": preview["tax"],
        "type": tx_type,
        "game_id": game_id,
        "description": description or f"Game win — {tx_type} · gross {gross_i} ₵ · tax {preview['tax']} ₵ · net {net} ₵",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "gross": gross_i,
        "tax": preview["tax"],
        "net": net,
        "field": field,
        "tx_type": tx_type,
    }


__all__ = ["settle_taxable_payout"]
