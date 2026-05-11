"""
Legal Age Verification Protocol — 21+ gate for restricted goods.

Encodes `Legal_Age_Verification_Protocol.pdf` (Restricted Goods Delivery
Standard, 2026):

  * 21+ minimum age for purchasing alcohol or tobacco items, AND for
    drivers handling those orders.
  * Two-layer verification:
      1. ONBOARDING — DOB + government ID scan + biometric selfie.
      2. POINT-OF-DELIVERY — driver scans recipient's ID (PDF417
         barcode), visually matches the photo, and confirms recipient
         is not visibly intoxicated.
  * Shadow-gating — restricted menu items are HIDDEN from underage or
    unverified users (not just blocked at checkout) so the friction +
    temptation are minimized.
  * Liability shield — every verification attempt + decision + driver
    delivery confirmation is appended to an immutable audit log.

Provider-agnostic: the actual ID + selfie capture writes documents to a
local stub store today. The same data shape is what Persona / Stripe
Identity / Veriff / Onfido / Jumio webhooks return, so plugging in a
real KYC vendor later is a service-class swap, not a contract change.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, date
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ───────────────────────────────────────── Spec constants ──
RESTRICTED_GOODS_MIN_AGE: int = 21
RESTRICTED_CATEGORIES: List[str] = ["alcohol", "tobacco"]

# Verification statuses (mirrors the lifecycle in every major KYC API).
STATUS_NOT_SUBMITTED = "not_submitted"
STATUS_PENDING = "pending"          # documents received, awaiting review
STATUS_VERIFIED = "verified"        # passed — fully eligible
STATUS_REJECTED = "rejected"        # failed — must re-submit
STATUS_APPEAL = "appeal"            # user contested a rejection

ALL_STATUSES = [
    STATUS_NOT_SUBMITTED, STATUS_PENDING, STATUS_VERIFIED,
    STATUS_REJECTED, STATUS_APPEAL,
]

# Decline reason taxonomy (admin picks one; user sees the copy below).
DECLINE_REASONS: Dict[str, str] = {
    "underage":        "Our records show you don't meet the 21+ requirement for restricted goods.",
    "id_unreadable":   "Your government ID couldn't be read clearly. Please re-submit a sharper photo.",
    "id_expired":      "The government ID you submitted appears to be expired.",
    "selfie_mismatch": "We couldn't confirm the selfie matches the ID photo. Please try again in good lighting.",
    "dob_mismatch":    "The date of birth on your ID doesn't match what you entered.",
    "duplicate":       "This ID has already been used to verify another account.",
    "policy":          "Verification declined per platform policy.",
}


# ───────────────────────────────────────── Pure helpers ──

def calculate_age(dob_iso: str, reference_date: Optional[date] = None) -> int:
    """Years-old calc. `dob_iso` must be YYYY-MM-DD."""
    ref = reference_date or date.today()
    dob = date.fromisoformat(dob_iso)
    years = ref.year - dob.year - ((ref.month, ref.day) < (dob.month, dob.day))
    return max(0, years)


def is_eligible_for_restricted(age: Optional[int], status: str) -> bool:
    """Restricted-goods purchase eligibility check."""
    if age is None or age < RESTRICTED_GOODS_MIN_AGE:
        return False
    return status == STATUS_VERIFIED


def shadow_filter_menu(
    menu_items: List[Dict[str, Any]],
    is_eligible: bool,
) -> List[Dict[str, Any]]:
    """Spec function — hide alcohol/tobacco items from ineligible users.

    Matches the spec's pseudo-code:

        if item.category in RESTRICTED:
            if not user.verified_21_plus:
                hide_or_lock(item)

    Returns a NEW list — items the user shouldn't see are stripped
    entirely (not just disabled) per the "shadow-gating" rule.
    """
    if is_eligible:
        return list(menu_items)
    return [
        item for item in menu_items
        if str(item.get("category", "")).lower() not in RESTRICTED_CATEGORIES
    ]


# ───────────────────────────────────────── Stateful engine (Mongo) ──

async def _log_event(db, user_id: str, kind: str, details: Dict[str, Any]) -> None:
    """Append-only audit row — every verification action lives here."""
    await db.age_verification_events.insert_one({
        "event_id": f"avp_{uuid.uuid4().hex[:14]}",
        "user_id": user_id,
        "kind": kind,
        "ts": datetime.now(timezone.utc).isoformat(),
        "details": details,
    })


async def get_status(db, user_id: str) -> Dict[str, Any]:
    """Return the current verification record for a user. Lazy-creates
    a default 'not_submitted' shell so callers can always read."""
    rec = await db.age_verification.find_one({"user_id": user_id})
    if rec is None:
        return {
            "user_id": user_id,
            "status": STATUS_NOT_SUBMITTED,
            "age": None,
            "dob": None,
            "submitted_at": None,
            "verified_at": None,
            "rejected_reason": None,
            "eligible_for_restricted": False,
        }
    out = {k: v for k, v in rec.items() if k != "_id"}
    out["eligible_for_restricted"] = is_eligible_for_restricted(
        out.get("age"), out.get("status", STATUS_NOT_SUBMITTED)
    )
    return out


async def submit(
    db,
    user_id: str,
    dob_iso: str,
    id_document_url: Optional[str] = None,
    selfie_url: Optional[str] = None,
    auto_decision: bool = True,
) -> Dict[str, Any]:
    """User submits DOB + ID scan + selfie. Status → pending. If
    `auto_decision=True` we make an immediate algorithmic decision based
    on DOB alone (no KYC vendor wired yet); manual admin review remains
    available for any case."""
    age = calculate_age(dob_iso)
    now = datetime.now(timezone.utc).isoformat()

    initial_status = STATUS_PENDING
    rejected_reason: Optional[str] = None

    # Auto-decision path used until a KYC vendor is plugged in. Once
    # Persona / Stripe Identity etc. land, this branch is replaced by
    # the webhook-driven decision.
    if auto_decision:
        if age < RESTRICTED_GOODS_MIN_AGE:
            initial_status = STATUS_REJECTED
            rejected_reason = "underage"
        elif id_document_url and selfie_url:
            initial_status = STATUS_VERIFIED
        # else: stays pending until docs uploaded

    doc = {
        "user_id": user_id,
        "status": initial_status,
        "age": age,
        "dob": dob_iso,
        "id_document_url": id_document_url,
        "selfie_url": selfie_url,
        "submitted_at": now,
        "verified_at": now if initial_status == STATUS_VERIFIED else None,
        "rejected_reason": rejected_reason,
        "updated_at": now,
    }
    await db.age_verification.update_one(
        {"user_id": user_id},
        {"$set": doc},
        upsert=True,
    )

    await _log_event(db, user_id, "submit", {
        "age": age,
        "decision": initial_status,
        "rejected_reason": rejected_reason,
        "has_id": bool(id_document_url),
        "has_selfie": bool(selfie_url),
    })

    out = dict(doc)
    out["eligible_for_restricted"] = is_eligible_for_restricted(age, initial_status)
    return out


async def admin_decide(
    db,
    user_id: str,
    decision: str,
    admin_user_id: str,
    rejected_reason: Optional[str] = None,
    note: Optional[str] = None,
) -> Dict[str, Any]:
    """Manual admin override — approve, reject, or queue for appeal."""
    if decision not in (STATUS_VERIFIED, STATUS_REJECTED, STATUS_APPEAL):
        raise ValueError(f"Invalid decision: {decision}")
    if decision == STATUS_REJECTED and not rejected_reason:
        raise ValueError("rejected_reason is required when rejecting")
    if rejected_reason and rejected_reason not in DECLINE_REASONS:
        raise ValueError(f"Unknown rejected_reason: {rejected_reason}")

    now = datetime.now(timezone.utc).isoformat()
    update: Dict[str, Any] = {
        "status": decision,
        "updated_at": now,
        "admin_decided_by": admin_user_id,
        "admin_note": note,
    }
    if decision == STATUS_VERIFIED:
        update["verified_at"] = now
        update["rejected_reason"] = None
    else:
        update["rejected_reason"] = rejected_reason

    result = await db.age_verification.find_one_and_update(
        {"user_id": user_id},
        {"$set": update},
        return_document=True,
    )
    if result is None:
        raise ValueError("No verification record found for user")

    await _log_event(db, user_id, "admin_decide", {
        "decision": decision,
        "rejected_reason": rejected_reason,
        "admin_user_id": admin_user_id,
        "note": note,
    })

    record = {k: v for k, v in result.items() if k != "_id"}
    record["eligible_for_restricted"] = is_eligible_for_restricted(
        record.get("age"), record.get("status", STATUS_NOT_SUBMITTED)
    )
    return record


async def appeal(db, user_id: str, message: str) -> Dict[str, Any]:
    """User contests a rejection → status moves to `appeal` for review."""
    now = datetime.now(timezone.utc).isoformat()
    result = await db.age_verification.find_one_and_update(
        {"user_id": user_id, "status": STATUS_REJECTED},
        {"$set": {"status": STATUS_APPEAL, "appeal_message": message, "updated_at": now}},
        return_document=True,
    )
    if result is None:
        raise ValueError("Only rejected verifications can be appealed")
    await _log_event(db, user_id, "appeal", {"message": message})
    return {k: v for k, v in result.items() if k != "_id"}


async def driver_can_deliver_restricted(db, driver_user_id: str) -> bool:
    """Spec rule — only drivers verified as 21+ are dispatched for
    restricted-goods orders. Returns True iff the driver is `verified`
    and 21 or older."""
    rec = await db.age_verification.find_one(
        {"user_id": driver_user_id},
        {"_id": 0, "status": 1, "age": 1},
    )
    if not rec:
        return False
    return is_eligible_for_restricted(rec.get("age"), rec.get("status", STATUS_NOT_SUBMITTED))


async def list_events(
    db,
    user_id: Optional[str] = None,
    kind: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Audit log fetch — admin tool."""
    q: Dict[str, Any] = {}
    if user_id:
        q["user_id"] = user_id
    if kind:
        q["kind"] = kind
    return await db.age_verification_events.find(q, {"_id": 0}).sort("ts", -1).limit(limit).to_list(limit)
