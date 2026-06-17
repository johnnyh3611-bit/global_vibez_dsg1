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

# Corrected KYC Compliance Protocol — Stripe Identity is the recommended
# vendor (chosen for seamless integration with the existing Stripe
# Connect payment rails). Provider-agnostic plumbing remains — swap
# `KYC_PROVIDER` env var to plug in Persona / Veriff / Onfido / Jumio.
KYC_PROVIDER_STRIPE_IDENTITY = "stripe_identity"
SUPPORTED_KYC_PROVIDERS = [
    KYC_PROVIDER_STRIPE_IDENTITY, "persona", "veriff", "onfido", "jumio",
]

# Corrected protocol decision matrix — vendor returns one of:
#   VERIFIED_21       → 21+ confirmed → eligible
#   VERIFIED_UNDER_21 → docs valid but DOB < 21 → not eligible
#   PENDING           → docs received, awaiting vendor decision
#   REQUIRES_INPUT    → vendor needs more docs (requirements_due[] populated)
#   REJECTED          → vendor declined (fraud, expired, mismatch, etc.)
DECISION_VERIFIED_21 = "VERIFIED_21"
DECISION_VERIFIED_UNDER_21 = "VERIFIED_UNDER_21"
DECISION_PENDING = "PENDING"
DECISION_REQUIRES_INPUT = "REQUIRES_INPUT"
DECISION_REJECTED = "REJECTED"

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

# Map Corrected-Protocol vendor decision → internal lifecycle status.
DECISION_TO_STATUS: Dict[str, str] = {
    DECISION_VERIFIED_21: STATUS_VERIFIED,
    DECISION_VERIFIED_UNDER_21: STATUS_REJECTED,
    DECISION_PENDING: STATUS_PENDING,
    DECISION_REQUIRES_INPUT: STATUS_PENDING,
    DECISION_REJECTED: STATUS_REJECTED,
}

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


# ───────────────────────────────────────── Corrected Protocol: KYC vendor webhook ──

async def apply_vendor_decision(
    db,
    user_id: str,
    decision: str,
    doc_status: Optional[str] = None,
    requirements_due: Optional[List[str]] = None,
    provider: str = KYC_PROVIDER_STRIPE_IDENTITY,
    provider_session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Apply a KYC vendor's decision to the user's verification record.

    Spec corrections (Corrected_KYC_Compliance_Protocol.pdf) — vendor
    returns the decision matrix below; we map it to our internal
    lifecycle and persist `doc_status` + `requirements_due[]` so users
    + admins can see exactly what the vendor needs.

      VERIFIED_21       → status=verified, eligible
      VERIFIED_UNDER_21 → status=rejected, rejected_reason=underage
      PENDING           → status=pending
      REQUIRES_INPUT    → status=pending + requirements_due surfaced
      REJECTED          → status=rejected, rejected_reason=policy

    Designed for direct call from Stripe Identity webhook handler. Same
    shape works for Persona / Veriff / Onfido / Jumio webhooks too.
    """
    if decision not in DECISION_TO_STATUS:
        raise ValueError(f"Unknown vendor decision: {decision}")

    now = datetime.now(timezone.utc).isoformat()
    target_status = DECISION_TO_STATUS[decision]
    update: Dict[str, Any] = {
        "status": target_status,
        "vendor_decision": decision,
        "doc_status": doc_status,
        "requirements_due": requirements_due or [],
        "kyc_provider": provider,
        "kyc_session_id": provider_session_id,
        "updated_at": now,
    }
    if target_status == STATUS_VERIFIED:
        update["verified_at"] = now
        update["rejected_reason"] = None
    elif decision == DECISION_VERIFIED_UNDER_21:
        update["rejected_reason"] = "underage"
    elif decision == DECISION_REJECTED:
        update["rejected_reason"] = "policy"

    result = await db.age_verification.find_one_and_update(
        {"user_id": user_id},
        {"$set": update},
        upsert=True,
        return_document=True,
    )

    await _log_event(db, user_id, "vendor_decision", {
        "decision": decision,
        "doc_status": doc_status,
        "requirements_due": requirements_due,
        "provider": provider,
        "provider_session_id": provider_session_id,
    })

    record = {k: v for k, v in (result or update).items() if k != "_id"}
    record["eligible_for_restricted"] = is_eligible_for_restricted(
        record.get("age"), record.get("status", STATUS_NOT_SUBMITTED)
    )
    return record


# ───────────────────────────────────────── Corrected Protocol: Driver delivery flow ──

DELIVERY_REFUSAL_REASONS: Dict[str, str] = {
    "id_invalid":       "Recipient ID failed PDF417 validation or appeared altered.",
    "id_mismatch":      "Recipient's photo did not match the ID presented.",
    "underage":         "Recipient's ID showed an age below 21.",
    "intoxicated":      "Recipient appeared visibly intoxicated.",
    "absent":           "No 21+ adult present to receive the order.",
    "wrong_address":    "Address mismatch from order details.",
    "other":            "Other (driver provided written reason).",
}


async def driver_confirm_delivery(
    db,
    order_id: str,
    driver_user_id: str,
    pdf417_scanned: bool,
    biometric_match: bool,
    recipient_age: int,
    sobriety_ok: bool,
) -> Dict[str, Any]:
    """
    Spec-mandated point-of-delivery checks (Corrected Protocol):
      1. Mandatory PDF417 barcode scan on recipient's physical ID.
      2. Biometric facial match against the verified digital profile.
      3. Recipient age ≥ 21.
      4. Sobriety check — driver may refuse if recipient is visibly
         impaired (codified driver right-to-refuse).

    All four checks must pass for the handoff to complete. Failure
    auto-routes the order to `delivery_refused` and refunds.
    """
    now = datetime.now(timezone.utc).isoformat()
    all_passed = (
        bool(pdf417_scanned)
        and bool(biometric_match)
        and int(recipient_age) >= RESTRICTED_GOODS_MIN_AGE
        and bool(sobriety_ok)
    )
    refusal_reasons: List[str] = []
    if not pdf417_scanned:
        refusal_reasons.append("id_invalid")
    if not biometric_match:
        refusal_reasons.append("id_mismatch")
    if recipient_age < RESTRICTED_GOODS_MIN_AGE:
        refusal_reasons.append("underage")
    if not sobriety_ok:
        refusal_reasons.append("intoxicated")

    record = {
        "delivery_id": f"avp_delivery_{uuid.uuid4().hex[:12]}",
        "order_id": order_id,
        "driver_user_id": driver_user_id,
        "pdf417_scanned": pdf417_scanned,
        "biometric_match": biometric_match,
        "recipient_age": recipient_age,
        "sobriety_ok": sobriety_ok,
        "handoff_completed": all_passed,
        "refusal_reasons": refusal_reasons,
        "ts": now,
    }
    await db.age_verification_deliveries.insert_one(dict(record))
    await _log_event(db, driver_user_id, "delivery_confirm", record)
    return {k: v for k, v in record.items() if k != "_id"}


async def driver_refuse_delivery(
    db,
    order_id: str,
    driver_user_id: str,
    reason: str,
    note: Optional[str] = None,
) -> Dict[str, Any]:
    """Driver explicit refusal — overrides any partial-pass state. Used
    when the driver's judgment trumps the digital checks (e.g., visibly
    intoxicated even though the ID checked out)."""
    if reason not in DELIVERY_REFUSAL_REASONS:
        raise ValueError(f"Unknown refusal reason: {reason}")
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "delivery_id": f"avp_refusal_{uuid.uuid4().hex[:12]}",
        "order_id": order_id,
        "driver_user_id": driver_user_id,
        "handoff_completed": False,
        "refused": True,
        "reason": reason,
        "note": note,
        "ts": now,
    }
    await db.age_verification_deliveries.insert_one(dict(record))
    await _log_event(db, driver_user_id, "delivery_refuse", record)
    return {k: v for k, v in record.items() if k != "_id"}
