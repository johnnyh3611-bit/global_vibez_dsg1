"""
Final Payment Test Protocol — Helio sandbox handshake.

Covers:
  1. Signature header preference (x-helio-signature)
  2. Spoof rejection + signed credit + ledger + audit (via protocol runner)
  3. payment_request_id / transaction_hash extraction from Helio payloads
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from services.helio_client import extract_payment_meta, extract_webhook_signature

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_SCRIPT = BACKEND_ROOT / "scripts" / "run_helio_payment_protocol.py"


def test_extract_signature_prefers_x_helio_signature():
    class H(dict):
        def get(self, k, default=None):
            return super().get(k, default)

    headers = H(
        {
            "x-helio-signature": "abc",
            "X-Signature": "legacy",
        }
    )
    assert extract_webhook_signature(headers) == "abc"
    assert extract_webhook_signature(H({"X-Signature": "legacy"})) == "legacy"
    assert extract_webhook_signature(H()) is None


def test_extract_payment_meta_payment_request_id_and_tx_hash():
    payload = {
        "event": "SUCCESS",
        "paymentRequestId": "paylink_abc",
        "transactionSignature": "5xsig123",
        "customerDetails": {
            "additionalJSON": json.dumps(
                {
                    "payment_id": "coin_pay_1",
                    "pack_id": "popular",
                    "user_id": "u1",
                    "coins": 10_000,
                }
            )
        },
        "transaction": {"status": "SUCCESS", "signature": "5xsig123"},
    }
    meta = extract_payment_meta(payload)
    assert meta["payment_id"] == "coin_pay_1"
    assert meta["payment_request_id"] == "paylink_abc"
    assert meta["transaction_hash"] == "5xsig123"
    assert meta["coins"] == 10_000


def test_extract_payment_meta_nested_tx_object():
    payload = {
        "eventType": "COMPLETED",
        "transaction": {
            "status": "SUCCESS",
            "paymentRequestId": "pr_nested",
            "hash": "tx_nested",
        },
        "customerDetails": {"additionalJSON": '{"payment_id":"p2"}'},
    }
    meta = extract_payment_meta(payload)
    assert meta["payment_id"] == "p2"
    assert meta["payment_request_id"] == "pr_nested"
    assert meta["transaction_hash"] == "tx_nested"


def test_final_payment_protocol_runner():
    """Executable protocol: spoof 401 → signed webhook → ledger → audit → idempotent."""
    if not PROTOCOL_SCRIPT.is_file():
        pytest.skip("protocol runner missing")

    env = os.environ.copy()
    env.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
    env.setdefault("DB_NAME", "global_vibez")
    env["DISABLE_BG_SCHEDULERS"] = "1"
    # Unique port if something else is on 8011
    env["HELIO_PROTOCOL_PORT"] = env.get("HELIO_PROTOCOL_PORT", "8012")

    proc = subprocess.run(
        [sys.executable, str(PROTOCOL_SCRIPT)],
        cwd=str(BACKEND_ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    assert proc.returncode == 0, out
    assert "RESULT: PASS" in out
    assert "spoof_rejected" in out
    assert "signed_webhook" in out
    assert "ledger" in out
    assert "audit" in out
