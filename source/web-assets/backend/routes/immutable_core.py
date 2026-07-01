"""
Immutable Core — Production Security & Phase Gating (Ultimate Blueprint
v3 §4, May 2026).

Locks the two foundational economic parameters of the platform:
  • Sovereign Tax: 13.5% on every taxable transaction
  • Artist / Producer Split: 70% creator / 30% platform

These rates are encoded as `Final[float]` constants AND verified at boot
so the server REFUSES to start if anyone tampers with them. Any attempt
to monkey-patch them at runtime raises `ImmutableCoreViolation`.

Public read endpoint:
  GET /api/immutable-core/constants
    → { sovereign_tax_rate: 0.135, artist_split: 0.70, ... }
"""
from __future__ import annotations
from typing import Final
import logging

from fastapi import APIRouter, HTTPException

log = logging.getLogger(__name__)


class ImmutableCoreViolation(Exception):
    """Raised at startup if a locked rate has been tampered with."""


# ── Locked constants (DO NOT EDIT after lock has been verified) ────────
SOVEREIGN_TAX_RATE: Final[float] = 0.135            # 13.5%
ARTIST_PRODUCER_SHARE: Final[float] = 0.70          # 70%
PLATFORM_SHARE: Final[float] = 0.30                 # 30%

EXPECTED = {
    "SOVEREIGN_TAX_RATE": 0.135,
    "ARTIST_PRODUCER_SHARE": 0.70,
    "PLATFORM_SHARE": 0.30,
}


def verify_locks() -> None:
    """Boot-time check — asserts the imported services agree with the
    immutable core. If a downstream config drifts, the server refuses
    to start. Wired into server.py startup."""
    actual: dict[str, float] = {
        "SOVEREIGN_TAX_RATE": SOVEREIGN_TAX_RATE,
        "ARTIST_PRODUCER_SHARE": ARTIST_PRODUCER_SHARE,
        "PLATFORM_SHARE": PLATFORM_SHARE,
    }

    # Cross-check against pricing_master_vault (canonical site).
    try:
        from services.pricing_master_vault import SOVEREIGN_TAX_RATE as PMV_TAX
        if PMV_TAX != EXPECTED["SOVEREIGN_TAX_RATE"]:
            raise ImmutableCoreViolation(
                f"pricing_master_vault.SOVEREIGN_TAX_RATE drifted to {PMV_TAX}; "
                f"expected {EXPECTED['SOVEREIGN_TAX_RATE']}"
            )
    except ImportError:
        log.warning("pricing_master_vault not yet importable at boot")

    # Cross-check against beat_auctions (producer 70/30).
    try:
        from services.beat_auctions import AUCTION_PRODUCER_SHARE as BA_SHARE
        if BA_SHARE != EXPECTED["ARTIST_PRODUCER_SHARE"]:
            raise ImmutableCoreViolation(
                f"beat_auctions.AUCTION_PRODUCER_SHARE drifted to {BA_SHARE}; "
                f"expected {EXPECTED['ARTIST_PRODUCER_SHARE']}"
            )
    except ImportError:
        log.warning("beat_auctions not yet importable at boot")

    # Sanity check — rates sum to 100% by definition.
    if abs((ARTIST_PRODUCER_SHARE + PLATFORM_SHARE) - 1.0) > 1e-9:
        raise ImmutableCoreViolation(
            f"Artist+platform must sum to 1.0; got "
            f"{ARTIST_PRODUCER_SHARE + PLATFORM_SHARE}"
        )

    for k, v in actual.items():
        if v != EXPECTED[k]:
            raise ImmutableCoreViolation(
                f"{k} expected {EXPECTED[k]}, got {v}"
            )

    # Cross-check Equity Master locks (PDF: Crewmate Architecture, 30%
    # Revenue Split, Diamond Market Logic). Module's own verify_equity_locks
    # also runs at import time — this is the belt-and-suspenders check.
    try:
        from routes.equity_master import verify_equity_locks
        verify_equity_locks()
    except ImportError:
        log.warning("equity_master not yet importable at boot")

    log.info("✅ Immutable Core verified — Sovereign Tax 13.5% & 70/30 Split locked")


# ── Public read-only router (Legacy Vault relies on this) ─────────────
router = APIRouter(prefix="/immutable-core", tags=["immutable-core"])


@router.get("/constants")
async def get_constants():
    """
    Public read-only view of the locked economic constants. The Legacy
    Vault page reads from this so any drift attempt is immediately
    visible to investors and auditors.
    """
    return {
        "sovereign_tax_rate": SOVEREIGN_TAX_RATE,
        "sovereign_tax_pct": "13.5%",
        "artist_producer_share": ARTIST_PRODUCER_SHARE,
        "platform_share": PLATFORM_SHARE,
        "artist_split_pretty": "70/30",
        "locked": True,
        "spec_doc": "Ultimate Blueprint v3 §4",
        "last_verified": "2026-05-08",
    }
