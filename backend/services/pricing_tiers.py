"""
Pricing Tiers + Infrastructure Wallet — v7.0 Phase 7.

Source: /app/memory/locked_specs/v7_OMNI_BLUEPRINT.md
Spec PDF: Global_Vibez_OMNI_BLUEPRINT_v7.pdf (uploaded 2026-02-15)

This module owns the canonical $USD listing fees AND the closed-loop
"self-sustaining infrastructure" funding mechanism that v7's headline
innovation describes:

  Creator pays a listing fee → fee flows DIRECTLY into the Infrastructure
  Wallet → that wallet pays for cloud storage + bandwidth.

The platform pays for itself.

Public surface:
  PRICING_TIERS         — canonical $ amounts per SKU
  bundle_listing_cost   — handles the "Buy 4 Get 1 Free" series rule
  process_upload        — the Pythonized version of the founder's
                           processUpload JS pseudocode in the v7 PDF
  InfraWallet           — running balance + ledger of every transfer
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional


# ──────────────────────────────────────────────────────────────────────────
# 1. CANONICAL PRICING TIERS (LOCKED — v7.0)
# ──────────────────────────────────────────────────────────────────────────
PRICING_TIERS: Dict[str, float] = {
    "SINGLE_EPISODE": 5.00,
    "SERIES_BUNDLE":  20.00,    # Buy 4 Get 1 Free — see bundle_listing_cost
    "VIBE_CLIP":      0.50,
    "MUSIC_TRACK":    0.50,
}

# Series Bundle rule: 5 episodes for $20 (1 free).
# So per-episode in a bundle = $4.00, NOT $5.00.
SERIES_BUNDLE_EPISODE_COUNT: int = 5
SERIES_BUNDLE_PRICE: float = PRICING_TIERS["SERIES_BUNDLE"]


def bundle_listing_cost(content_type: str, count: int) -> float:
    """Return the total listing-fee cost for `count` items of `content_type`.

    Handles the "Buy 4 Get 1 Free" series rule explicitly:
      - 5 single episodes via SERIES_BUNDLE = $20 (saves $5)
      - 10 single episodes via SERIES_BUNDLE × 2 = $40 (saves $10)
      - leftover items (not enough for a full bundle) bill at SINGLE_EPISODE
    """
    if count <= 0:
        raise ValueError("count must be positive")
    if content_type not in PRICING_TIERS:
        raise ValueError(f"unknown content_type: {content_type!r}")
    if content_type != "SERIES_BUNDLE":
        return round(PRICING_TIERS[content_type] * count, 4)

    # SERIES_BUNDLE accounting — group items into bundles of 5
    bundles = count // SERIES_BUNDLE_EPISODE_COUNT
    leftover = count % SERIES_BUNDLE_EPISODE_COUNT
    return round(
        bundles * SERIES_BUNDLE_PRICE
        + leftover * PRICING_TIERS["SINGLE_EPISODE"],
        4,
    )


# ──────────────────────────────────────────────────────────────────────────
# 2. INFRASTRUCTURE WALLET — closed-loop ledger
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class InfraTransfer:
    """One transfer FROM a creator TO the infra wallet — append-only ledger."""
    transfer_id: str
    creator_id: str
    content_type: str
    count: int
    amount: float
    transferred_at: str
    note: str = ""


@dataclass
class InfraWallet:
    balance: float = 0.0
    ledger: List[InfraTransfer] = field(default_factory=list)

    def deposit(self, transfer: InfraTransfer) -> None:
        if transfer.amount <= 0:
            raise ValueError("transfer amount must be positive")
        self.balance = round(self.balance + transfer.amount, 4)
        self.ledger.append(transfer)

    def total_received(self) -> float:
        return round(sum(t.amount for t in self.ledger), 4)

    def transfers_for_creator(self, creator_id: str) -> List[InfraTransfer]:
        return [t for t in self.ledger if t.creator_id == creator_id]


# ──────────────────────────────────────────────────────────────────────────
# 3. CREATOR WALLET (lightweight in-memory shim — production reads/writes
#    against the real wallets collection)
# ──────────────────────────────────────────────────────────────────────────
@dataclass
class CreatorWallet:
    creator_id: str
    balance: float = 0.0

    def debit(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("debit must be positive")
        if self.balance < amount:
            raise ValueError("INSUFFICIENT_FUNDS")
        self.balance = round(self.balance - amount, 4)


# ──────────────────────────────────────────────────────────────────────────
# 4. processUpload — Pythonized founder pseudocode
# ──────────────────────────────────────────────────────────────────────────
ProcessUploadStatus = Literal["UPLOAD_READY", "INSUFFICIENT_FUNDS"]


@dataclass(frozen=True)
class ProcessUploadResult:
    ok: bool
    status: ProcessUploadStatus
    cost: float
    creator_balance_after: float
    transfer_id: Optional[str] = None
    unlocked_slots: int = 0


def transfer_to_infra(
    creator: CreatorWallet, infra: InfraWallet,
    content_type: str, count: int, cost: float,
) -> InfraTransfer:
    """Atomic-ish transfer: debit creator, append to infra ledger.
    Caller is responsible for catching INSUFFICIENT_FUNDS via creator.debit()."""
    creator.debit(cost)
    transfer = InfraTransfer(
        transfer_id=str(uuid.uuid4()),
        creator_id=creator.creator_id,
        content_type=content_type,
        count=count,
        amount=cost,
        transferred_at=datetime.now(timezone.utc).isoformat(),
        note=f"v7 listing fee · {content_type} ×{count}",
    )
    infra.deposit(transfer)
    return transfer


def process_upload(
    creator: CreatorWallet, infra: InfraWallet,
    content_type: str, count: int = 1,
) -> ProcessUploadResult:
    """Canonical v7 upload-flow:
        cost = PRICING_TIERS[content_type] * count   (or bundle_listing_cost)
        if creator.balance >= cost:
          transfer to infra → unlock slots → UPLOAD_READY
        else: INSUFFICIENT_FUNDS
    """
    cost = bundle_listing_cost(content_type, count)
    if creator.balance < cost:
        return ProcessUploadResult(
            ok=False, status="INSUFFICIENT_FUNDS", cost=cost,
            creator_balance_after=creator.balance,
        )
    transfer = transfer_to_infra(creator, infra, content_type, count, cost)
    return ProcessUploadResult(
        ok=True, status="UPLOAD_READY", cost=cost,
        creator_balance_after=creator.balance,
        transfer_id=transfer.transfer_id,
        unlocked_slots=count,
    )


__all__ = [
    "PRICING_TIERS", "SERIES_BUNDLE_EPISODE_COUNT", "SERIES_BUNDLE_PRICE",
    "bundle_listing_cost",
    "InfraTransfer", "InfraWallet", "CreatorWallet",
    "transfer_to_infra", "process_upload",
    "ProcessUploadResult", "ProcessUploadStatus",
]
