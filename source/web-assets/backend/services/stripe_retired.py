"""Stripe fiat checkout is retired — Helio card + Solana deposit only."""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import HTTPException


DEFAULT_USE = "/api/coins/topup/helio"

STRIPE_RETIRED_MESSAGE = (
    "Stripe checkout is retired. Pay with Helio (card) via "
    "POST /api/coins/topup/helio, or deposit Solana from the wallet."
)


def stripe_retired_detail(use: Optional[str] = None) -> Dict[str, Any]:
    return {
        "error": "stripe_retired",
        "message": STRIPE_RETIRED_MESSAGE,
        "use": use or DEFAULT_USE,
        "rails": ["helio", "solana"],
    }


def raise_stripe_retired(use: Optional[str] = None) -> None:
    """Raise HTTP 410 Gone for any Stripe Checkout / status / webhook path."""
    raise HTTPException(status_code=410, detail=stripe_retired_detail(use))
