"""
End-to-end smoke + integration tests for the Cyber Casino room.

Covers (against the running backend via ``REACT_APP_BACKEND_URL``):

  • GET  /api/cyber-casino/paytable                — public, no auth
  • GET  /api/cyber-casino/slots/commit            — public, no auth
  • POST /api/cyber-casino/slots/spin              — auth, balance round-trip
  • POST /api/cyber-casino/slots/verify            — math replay
  • POST /api/cyber-casino/blackjack/deal          — auth, deducts bet
  • POST /api/cyber-casino/blackjack/action        — full hand → settlement

Each test demo-logs a fresh user so the balance assertions are
deterministic regardless of who else has been hammering the API.
"""
from __future__ import annotations

import os
import time

import pytest
import requests


def _api(base: str) -> str:
    return base.rstrip("/") + "/api"


@pytest.fixture()
def session_token(api_base: str) -> str:
    """Spin up a fresh demo user; return its bearer token."""
    r = requests.post(f"{api_base}/auth/demo-login", json={}, timeout=15)
    r.raise_for_status()
    data = r.json()
    token = data.get("session_token") or data.get("token")
    assert token, f"demo-login did not return a token: {data}"
    return token


@pytest.fixture()
def auth(session_token: str) -> dict:
    return {"Authorization": f"Bearer {session_token}"}


# ─────────────────────────────────────────────────────────────── PUBLIC

def test_paytable_returns_house_rules(api_base: str) -> None:
    r = requests.get(f"{api_base}/cyber-casino/paytable", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body["slots"]["min_bet"] == 10
    assert body["slots"]["max_bet"] == 5000
    assert body["slots"]["payouts_3x"]["wild"] == 50
    assert body["blackjack"]["blackjack_pays"] == "3:2"
    assert body["blackjack"]["dealer_rule"] == "S17"


def test_slots_commit_returns_hash_and_nonce(api_base: str) -> None:
    r = requests.get(f"{api_base}/cyber-casino/slots/commit", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert len(body["server_seed_hash"]) == 64  # sha256 hex
    assert isinstance(body["nonce"], int)


# ───────────────────────────────────────────────────────────────── SLOTS

def test_slots_spin_round_trip(api_base: str, auth: dict) -> None:
    """A spin should: deduct bet, return reels of len 3, return a proof
    block with all four pieces, and the balance returned should equal
    starting_balance - bet + payout."""
    bal_before = requests.get(
        f"{api_base}/coins/balance", headers=auth, timeout=10
    ).json()["coins"]

    r = requests.post(
        f"{api_base}/cyber-casino/slots/spin",
        headers={**auth, "Content-Type": "application/json"},
        json={"bet": 50, "client_seed": "pytest-seed"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    body = r.json()

    # Reel + payout sanity.
    assert isinstance(body["reels"], list) and len(body["reels"]) == 3
    for sym in body["reels"]:
        assert sym in {"bolt", "eye", "skull", "diamond", "neon", "wild"}
    assert body["bet"] == 50
    assert body["won"] >= 0

    # Proof completeness.
    proof = body["proof"]
    for k in ("server_seed", "client_seed", "nonce", "hmac_sha512"):
        assert k in proof
    assert proof["server_seed"] and proof["client_seed"] and proof["hmac_sha512"]
    assert isinstance(proof["nonce"], int) and proof["nonce"] >= 0
    assert len(proof["server_seed"]) == 64
    assert len(proof["hmac_sha512"]) == 128

    # Balance arithmetic.
    expected_balance = bal_before - 50 + body["won"]
    assert body["balance"] == expected_balance


def test_slots_verify_replays_correctly(api_base: str, auth: dict) -> None:
    """Take a real spin, then ask /verify if the math matches. Should
    always be valid for the actual server-returned reels."""
    spin = requests.post(
        f"{api_base}/cyber-casino/slots/spin",
        headers={**auth, "Content-Type": "application/json"},
        json={"bet": 10, "client_seed": "verify-seed"},
        timeout=15,
    ).json()

    v = requests.post(
        f"{api_base}/cyber-casino/slots/verify",
        json={
            "server_seed": spin["proof"]["server_seed"],
            "client_seed": spin["proof"]["client_seed"],
            "nonce": spin["proof"]["nonce"],
            "claimed_reels": spin["reels"],
        },
        timeout=10,
    ).json()
    assert v["valid"] is True
    assert v["computed_reels"] == spin["reels"]


def test_slots_rejects_underbet(api_base: str, auth: dict) -> None:
    r = requests.post(
        f"{api_base}/cyber-casino/slots/spin",
        headers={**auth, "Content-Type": "application/json"},
        json={"bet": 1, "client_seed": "a"},
        timeout=10,
    )
    assert r.status_code == 422  # pydantic Field(ge=10) rejects


def test_slots_rejects_unauthenticated(api_base: str) -> None:
    r = requests.post(
        f"{api_base}/cyber-casino/slots/spin",
        json={"bet": 50, "client_seed": "x"},
        timeout=10,
    )
    assert r.status_code == 401


# ───────────────────────────────────────────────────────────── BLACKJACK

def test_blackjack_deal_deducts_bet(api_base: str, auth: dict) -> None:
    bal = requests.get(
        f"{api_base}/coins/balance", headers=auth, timeout=10
    ).json()["coins"]

    r = requests.post(
        f"{api_base}/cyber-casino/blackjack/deal",
        headers={**auth, "Content-Type": "application/json"},
        json={"bet": 100},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "session" in body
    assert len(body["session"]["player"]) == 2
    assert len(body["session"]["dealer"]) == 2
    # Dealer hole card is hidden while in-progress.
    if body["session"]["state"] == "in_progress":
        assert body["session"]["dealer"][1] == "hidden"
    # Bet was deducted (or 0-net if natural blackjack push).
    assert body["balance"] <= bal


def test_blackjack_full_hand_settles(api_base: str, auth: dict) -> None:
    """Deal → keep hitting until ≥ 21 or stand → expect a complete
    settlement object with one of the known outcome strings."""
    deal = requests.post(
        f"{api_base}/cyber-casino/blackjack/deal",
        headers={**auth, "Content-Type": "application/json"},
        json={"bet": 50},
        timeout=10,
    ).json()
    sid = deal["session"]["session_id"]

    if deal["session"]["state"] == "complete":
        outcome = deal["session"]["settlement"]["outcome"]
    else:
        # Just stand — easiest, deterministic path.
        act = requests.post(
            f"{api_base}/cyber-casino/blackjack/action",
            headers={**auth, "Content-Type": "application/json"},
            json={"session_id": sid, "action": "stand"},
            timeout=10,
        ).json()
        assert act["session"]["state"] == "complete"
        outcome = act["settlement"]["outcome"]

    assert outcome in {
        "blackjack",
        "win",
        "lose",
        "bust",
        "push",
        "push-blackjack",
    }


def test_blackjack_session_404_on_bad_id(api_base: str, auth: dict) -> None:
    r = requests.post(
        f"{api_base}/cyber-casino/blackjack/action",
        headers={**auth, "Content-Type": "application/json"},
        json={"session_id": "does-not-exist", "action": "stand"},
        timeout=10,
    )
    assert r.status_code == 404


def test_blackjack_double_only_on_first_action(api_base: str, auth: dict) -> None:
    deal = requests.post(
        f"{api_base}/cyber-casino/blackjack/deal",
        headers={**auth, "Content-Type": "application/json"},
        json={"bet": 50},
        timeout=10,
    ).json()
    if deal["session"]["state"] == "complete":
        pytest.skip("dealt natural blackjack — can't test double here")
    sid = deal["session"]["session_id"]

    # Hit once first.
    hit = requests.post(
        f"{api_base}/cyber-casino/blackjack/action",
        headers={**auth, "Content-Type": "application/json"},
        json={"session_id": sid, "action": "hit"},
        timeout=10,
    ).json()
    if hit["session"]["state"] == "complete":
        pytest.skip("player went to ≥21 on hit — can't test double here")

    # Now double should be rejected.
    r = requests.post(
        f"{api_base}/cyber-casino/blackjack/action",
        headers={**auth, "Content-Type": "application/json"},
        json={"session_id": sid, "action": "double"},
        timeout=10,
    )
    assert r.status_code == 400


# ───────────────────────────────────────────────────────────────── AUDITS

def test_audits_requires_auth(api_base: str) -> None:
    r = requests.get(f"{api_base}/cyber-casino/audits", timeout=10)
    assert r.status_code == 401


def test_audits_returns_recent_rounds(api_base: str, auth: dict) -> None:
    # Generate at least one round.
    requests.post(
        f"{api_base}/cyber-casino/slots/spin",
        headers={**auth, "Content-Type": "application/json"},
        json={"bet": 10, "client_seed": "audit-seed"},
        timeout=15,
    )
    r = requests.get(
        f"{api_base}/cyber-casino/audits", headers=auth, timeout=10
    )
    assert r.status_code == 200
    body = r.json()
    assert "audits" in body
    assert len(body["audits"]) >= 1
    audit = body["audits"][0]
    assert audit["game"] in {"cyber_slots", "cyber_blackjack"}
