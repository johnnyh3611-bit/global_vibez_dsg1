"""
Beta Tester Seed — auto-provisions 3 ready-to-use beta accounts on
backend startup so the founder can always share fresh credentials with
testers, even right after a redeploy to a fresh Atlas database.

Founder ask 2026-02-17 Late × 5: "Make sure people that can test the
system can log in… and set it up for deployment."

This module is idempotent — if the accounts already exist, it does
nothing. If they exist but are missing DOB / age, it heals them.

Account spec
------------
- email:         betatester{1,2,3}@globalvibez.com
- password:      BetaTester2026!
- DOB:           1995-06-15 (so they're auto-30 and bypass the age gate)
- name:          "Beta Tester {N}"
- profile:       complete (so they don't bounce to /profile/setup)

Wire-up
-------
The seeder is registered in `lifespan.register_startup_tasks` so it
fires once per backend boot.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

BETA_DOB = "1995-06-15"  # auto-30, well over the age gate
# The default password is intentionally shared and documented in
# `/app/memory/test_credentials.md` so the founder can hand fresh
# credentials to friends right after a redeploy. Override via the
# `BETA_TESTER_PASSWORD` env var if you want a per-environment secret
# (e.g. for staging vs production). Static analyzers may flag this as
# a hardcoded credential — that's the trade-off for a self-healing
# tester onboarding flow.
BETA_PASSWORD = os.environ.get("BETA_TESTER_PASSWORD", "BetaTester2026!")
BETA_ACCOUNTS = [
    {"email": "betatester1@globalvibez.com", "name": "Beta Tester 1"},
    {"email": "betatester2@globalvibez.com", "name": "Beta Tester 2"},
    {"email": "betatester3@globalvibez.com", "name": "Beta Tester 3"},
]


def _hash_password(password: str) -> str:
    """Use the same passlib context as the live email_auth router so
    the seeded password verifies via /api/auth/login without hand-rolling."""
    from passlib.context import CryptContext
    ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return ctx.hash(password)


def _calc_age(dob_iso: str) -> int:
    dob = datetime.strptime(dob_iso, "%Y-%m-%d")
    today = datetime.now(timezone.utc)
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


async def seed_beta_tester_accounts(db) -> dict:
    """Idempotently provision the 3 beta tester accounts.
    Returns {created, healed, untouched, total} tally."""
    created = 0
    healed = 0
    untouched = 0
    age = _calc_age(BETA_DOB)
    pwd_hash = None  # lazy: only compute if we actually need to write

    for spec in BETA_ACCOUNTS:
        email = spec["email"].lower()
        existing = await db.users.find_one({"email": email})
        if existing:
            patch: dict = {}
            # Heal missing DOB / age (otherwise login forces an age gate).
            if not existing.get("date_of_birth"):
                patch["date_of_birth"] = BETA_DOB
            if not existing.get("age"):
                patch["age"] = age
            if not existing.get("profile_completed"):
                patch["profile_completed"] = True
            if not existing.get("password_hash"):
                # If the row has no password (e.g. seeded via Google),
                # set the canonical beta password so we can document
                # the credential.
                if pwd_hash is None:
                    pwd_hash = _hash_password(BETA_PASSWORD)
                patch["password_hash"] = pwd_hash
                patch["auth_provider"] = "email"
            # Top up to the demo-buy-in floor so testers can always
            # afford the demo content — every market test (JFTN, HV, VR,
            # YP). Only adds — never subtracts — so any earned balance stays
            # intact. Floor matches new-account starter (₵40,000 ≈ $20).
            existing_credits = int(existing.get("credits_balance", 0) or 0)
            if existing_credits < 40_000:
                patch["credits_balance"] = 40_000
            if patch:
                await db.users.update_one({"email": email}, {"$set": patch})
                healed += 1
            else:
                untouched += 1
            continue

        # Brand-new account.
        if pwd_hash is None:
            pwd_hash = _hash_password(BETA_PASSWORD)
        doc = {
            "user_id": f"beta_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": spec["name"],
            "password_hash": pwd_hash,
            "auth_provider": "email",
            "date_of_birth": BETA_DOB,
            "age": age,
            "profile_completed": True,
            "is_beta_tester": True,
            # Seed wallet with ₵40,000 (≈ $20 at 2,000 ₵/$1) so testers can
            # immediately try out every utility room: JFTN room ~₵100,
            # ride seat ~₵36,000, food order ~₵30,000, YP Verified upgrade
            # ₵58,000 (top-up modal will trigger as designed).
            "credits_balance": 40_000,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(doc)
        created += 1

    summary = {
        "created": created,
        "healed": healed,
        "untouched": untouched,
        "total": len(BETA_ACCOUNTS),
    }
    logger.info(
        f"beta tester seeder: created={created} healed={healed} "
        f"untouched={untouched} total={summary['total']}",
    )
    return summary


async def run_seeder() -> None:
    """Lifespan entrypoint — pulls the live DB and runs the seed once.
    Best-effort: failures are logged but never crash the boot."""
    try:
        from utils.database import get_database
        db = get_database()
        await seed_beta_tester_accounts(db)
    except Exception as e:
        logger.warning(f"beta tester seeder skipped: {e}")


__all__ = [
    "seed_beta_tester_accounts",
    "run_seeder",
    "BETA_ACCOUNTS",
    "BETA_PASSWORD",
    "BETA_DOB",
]
