"""
Wallet-field selection helpers — UNIFIED on ``credits_balance`` (May 2026).

History: early demo accounts were seeded with ``credits_balance`` and never
had a ``token_balance`` field. Newer DSG accounts originally used
``token_balance``. This file used to dispatch between the two based on
balance, which led to drift bugs (a user's coins could end up split
across two fields, JFTN read one but not the other, etc.).

**As of the 2026-05-07 unified-market migration, every user has
exactly ONE wallet field: ``credits_balance``.** All reads + writes
across every utility room and every legacy game route are unified.

This module is preserved as a thin compatibility shim so any remaining
caller that imports these helpers continues to work — but it now always
returns ``credits_balance``. Do not reintroduce dual-field dispatch.
"""
from __future__ import annotations

from typing import Any, Dict, Tuple


# Single source of truth — DO NOT change without a database migration
# of every user's wallet field.
WALLET_FIELDS = ("credits_balance",)
WALLET_FIELD = "credits_balance"


def pick_wallet_field_for_debit(user_doc: Dict[str, Any], amount: int) -> Tuple[str, int]:
    """Return ``(field, balance)`` for a debit. Always reads
    ``credits_balance``. Raises ``ValueError("insufficient:<balance>")``
    if the wallet doesn't cover the amount."""
    bal = int((user_doc or {}).get(WALLET_FIELD) or 0)
    if bal < amount:
        raise ValueError(f"insufficient:{bal}")
    return WALLET_FIELD, bal


def pick_wallet_field_for_credit(user_doc: Dict[str, Any]) -> str:
    """Always returns the canonical wallet field for credits."""
    return WALLET_FIELD


__all__ = [
    "WALLET_FIELD",
    "WALLET_FIELDS",
    "pick_wallet_field_for_debit",
    "pick_wallet_field_for_credit",
]
