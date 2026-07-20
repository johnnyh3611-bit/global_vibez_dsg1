#!/usr/bin/env python3
"""
Final Payment Test Protocol — Helio sandbox (executable runner).

Spawns a short-lived uvicorn with HELIO_WEBHOOK_TOKEN set, then:
  1. Spoofs unsigned / bad-signature POSTs → expect 401
  2. Seeds a pending pack payment + fires a signed SUCCESS webhook
  3. Reconciles credits_balance against pack tokenomics
  4. Confirms payments_audit has payment_request_id + transaction_hash

Usage (from backend/):
  . .venv/bin/activate
  python scripts/run_helio_payment_protocol.py
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import signal
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("HELIO_PROTOCOL_PORT", "8011"))
BASE = f"http://127.0.0.1:{PORT}"
TOKEN = os.environ.get("HELIO_PROTOCOL_TOKEN", "helio_protocol_test_token_2026")
PAYLINK = "paylink_protocol_test"
PACK_COINS = 10_000
PACK_USD = 9.00


def _sign(body: bytes) -> str:
    return hmac.new(TOKEN.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _db():
    return MongoClient(os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017"))[
        os.environ.get("DB_NAME", "global_vibez")
    ]


def _spawn_server() -> subprocess.Popen:
    env = os.environ.copy()
    env["HELIO_WEBHOOK_TOKEN"] = TOKEN
    env["HELIO_PAYLINK_ID"] = PAYLINK
    env["PAYMENTS_REQUIRE_WEBHOOK_AUTH"] = "1"
    env["ENVIRONMENT"] = "production"
    env["DISABLE_BG_SCHEDULERS"] = "1"
    # Keep existing MONGO_URL / DB_NAME / JWT_SECRET from parent env / .env
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "server:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(PORT),
            "--log-level",
            "warning",
        ],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    deadline = time.time() + 45
    last_err = b""
    while time.time() < deadline:
        if proc.poll() is not None:
            last_err = proc.stderr.read() if proc.stderr else b""
            raise RuntimeError(
                f"protocol server exited early: {last_err.decode()[:800]}"
            )
        try:
            r = httpx.get(f"{BASE}/health", timeout=1.0)
            if r.status_code == 200:
                return proc
        except Exception:
            time.sleep(0.3)
    proc.send_signal(signal.SIGTERM)
    raise RuntimeError("protocol server failed to become healthy")


def main() -> int:
    print("=== Helio Final Payment Test Protocol ===")
    results = []
    proc = None
    try:
        print(f"[boot] spawning protocol server on :{PORT}")
        proc = _spawn_server()
        db = _db()
        client = httpx.Client(base_url=BASE, timeout=20.0)

        # ── 1) Security handshake ─────────────────────────────────────
        print("[1/4] Security handshake — spoofed POSTs must 401")
        body = b'{"event":"SUCCESS","payment_id":"spoof"}'
        r_bad = client.post(
            "/api/coins/webhook/helio",
            content=body,
            headers={
                "Content-Type": "application/json",
                "x-helio-signature": "00" * 32,
            },
        )
        r_none = client.post(
            "/api/webhooks/helio",
            content=body,
            headers={"Content-Type": "application/json"},
        )
        ok1 = r_bad.status_code == 401 and r_none.status_code == 401
        results.append(
            ("spoof_rejected", ok1, f"bad={r_bad.status_code} none={r_none.status_code}")
        )
        print(f"  → {'PASS' if ok1 else 'FAIL'} bad={r_bad.status_code} none={r_none.status_code}")

        # ── 2) Signed sandbox webhook ─────────────────────────────────
        print("[2/4] Sandbox signed webhook (payment_request_id + tx hash)")
        user_id = f"protocol_user_{uuid.uuid4().hex[:10]}"
        payment_id = f"coin_pay_{uuid.uuid4().hex[:12]}"
        charge_id = f"helio_charge_{uuid.uuid4().hex[:10]}"
        tx_hash = f"5xtest{uuid.uuid4().hex}"

        db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "user_id": user_id,
                    "email": f"{user_id}@protocol.test",
                    "credits_balance": 500,
                }
            },
            upsert=True,
        )
        db.coin_topup_payments.insert_one(
            {
                "id": payment_id,
                "user_id": user_id,
                "pack_id": "popular",
                "coins": PACK_COINS,
                "amount_usd": PACK_USD,
                "provider": "helio",
                "helio_charge_id": charge_id,
                "payment_request_id": PAYLINK,
                "status": "pending",
                "credited": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

        payload = {
            "event": "SUCCESS",
            "id": charge_id,
            "paymentRequestId": PAYLINK,
            "transactionSignature": tx_hash,
            "customerDetails": {
                "additionalJSON": json.dumps(
                    {
                        "kind": "coin_topup",
                        "payment_id": payment_id,
                        "pack_id": "popular",
                        "user_id": user_id,
                        "coins": PACK_COINS,
                        "usd": PACK_USD,
                    }
                )
            },
            "transaction": {"status": "SUCCESS", "signature": tx_hash},
        }
        raw = json.dumps(payload).encode()
        r_ok = client.post(
            "/api/coins/webhook/helio",
            content=raw,
            headers={
                "Content-Type": "application/json",
                "x-helio-signature": _sign(raw),
            },
        )
        data = (
            r_ok.json()
            if "application/json" in r_ok.headers.get("content-type", "")
            else {}
        )
        ok2 = (
            r_ok.status_code == 200
            and data.get("credited") is True
            and data.get("payment_request_id") == PAYLINK
            and data.get("transaction_hash") == tx_hash
        )
        results.append(("signed_webhook", ok2, f"status={r_ok.status_code} body={data}"))
        print(f"  → {'PASS' if ok2 else 'FAIL'} {data}")

        # ── 3) Ledger ─────────────────────────────────────────────────
        print("[3/4] Ledger reconciliation — wallet +₵10,000 for $9 popular pack")
        user = db.users.find_one({"user_id": user_id}, {"_id": 0})
        pay = db.coin_topup_payments.find_one({"id": payment_id}, {"_id": 0})
        ok3 = (
            user is not None
            and user.get("credits_balance") == 500 + PACK_COINS
            and pay is not None
            and pay.get("credited") is True
            and pay.get("status") == "paid"
            and pay.get("transaction_hash") == tx_hash
        )
        results.append(
            (
                "ledger",
                ok3,
                f"balance={user.get('credits_balance') if user else None}",
            )
        )
        print(
            f"  → {'PASS' if ok3 else 'FAIL'} "
            f"balance={user.get('credits_balance') if user else None} "
            f"(expected {500 + PACK_COINS})"
        )

        # ── 4) Audit ──────────────────────────────────────────────────
        print("[4/4] Audit log — payment_request_id + transaction_hash + credited")
        time.sleep(0.4)
        audit = db.payments_audit.find_one(
            {
                "kind": "coin_topup",
                "status": "credited",
                "user_id": user_id,
                "metadata.payment_id": payment_id,
            },
            sort=[("at", -1)],
        )
        ok4 = (
            audit is not None
            and audit.get("coins") == PACK_COINS
            and audit.get("amount_usd") == PACK_USD
            and audit.get("metadata", {}).get("transaction_hash") == tx_hash
            and audit.get("metadata", {}).get("payment_request_id") == PAYLINK
        )
        results.append(("audit", ok4, str(audit.get("event_id") if audit else None)))
        print(
            f"  → {'PASS' if ok4 else 'FAIL'} "
            f"audit_id={audit.get('event_id') if audit else None}"
        )

        r_replay = client.post(
            "/api/coins/webhook/helio",
            content=raw,
            headers={
                "Content-Type": "application/json",
                "x-helio-signature": _sign(raw),
            },
        )
        user_after = db.users.find_one({"user_id": user_id}, {"_id": 0})
        ok5 = (
            r_replay.status_code == 200
            and r_replay.json().get("already") is True
            and user_after.get("credits_balance") == 500 + PACK_COINS
        )
        results.append(("idempotent", ok5, r_replay.json()))
        print(
            f"  → {'PASS' if ok5 else 'FAIL'} "
            f"replay already={r_replay.json().get('already')}"
        )

        print(
            "[UX] Cancel path (manual in wallet Top-Up): Helio onCancel → "
            "'Payment cancelled — no charge was made…' "
            "(data-testid=topup-helio-status)"
        )

        print("\n=== Summary ===")
        all_ok = True
        for name, ok, detail in results:
            print(f"  {'✓' if ok else '✗'} {name}: {detail if not ok else 'ok'}")
            all_ok = all_ok and ok
        print("RESULT:", "PASS" if all_ok else "FAIL")
        return 0 if all_ok else 1
    finally:
        if proc and proc.poll() is None:
            proc.send_signal(signal.SIGTERM)
            try:
                proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
