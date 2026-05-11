"""
Age Verification — FastAPI routes.

Implements the 21+ gate per `Legal_Age_Verification_Protocol.pdf`:

  GET  /api/age-verification/status            — current user status
  POST /api/age-verification/submit            — submit DOB + ID + selfie
  POST /api/age-verification/appeal            — contest a rejection
  GET  /api/age-verification/eligibility/{cat} — public check ("alcohol"|"tobacco")
  GET  /api/age-verification/constants         — gated categories + min age + decline-reason table
  GET  /api/age-verification/driver-can-deliver — back-channel for dispatch service

  ADMIN-ONLY:
  GET  /api/age-verification/admin/queue       — pending submissions awaiting review
  GET  /api/age-verification/admin/events      — full audit log
  POST /api/age-verification/admin/decide      — manual approve / reject / appeal
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from services import age_verification as avp
from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/age-verification", tags=["age-verification"])


def _require_admin(user) -> None:
    if not user:
        raise HTTPException(status_code=401, detail="Auth required")
    if not (getattr(user, "is_admin", False) or getattr(user, "role", "") == "admin"):
        raise HTTPException(status_code=403, detail="Admin only")


def _user_id(user) -> str:
    if not user:
        raise HTTPException(status_code=401, detail="Auth required")
    uid = getattr(user, "user_id", None) or getattr(user, "id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth")
    return str(uid)


# ───────────────────────────────────────── Public reads ──

@router.get("/constants")
async def constants() -> Dict[str, Any]:
    """Public — minimum age + restricted categories + decline reason copy."""
    return {
        "minimum_age": avp.RESTRICTED_GOODS_MIN_AGE,
        "restricted_categories": avp.RESTRICTED_CATEGORIES,
        "statuses": avp.ALL_STATUSES,
        "decline_reasons": avp.DECLINE_REASONS,
        "delivery_refusal_reasons": avp.DELIVERY_REFUSAL_REASONS,
        "vendor_decisions": [
            avp.DECISION_VERIFIED_21,
            avp.DECISION_VERIFIED_UNDER_21,
            avp.DECISION_PENDING,
            avp.DECISION_REQUIRES_INPUT,
            avp.DECISION_REJECTED,
        ],
        "recommended_kyc_provider": avp.KYC_PROVIDER_STRIPE_IDENTITY,
        "supported_kyc_providers": avp.SUPPORTED_KYC_PROVIDERS,
        "protocol_version": "Corrected KYC Compliance Protocol · 2026",
    }


@router.get("/status")
async def status(user=Depends(get_current_user)) -> Dict[str, Any]:
    db = get_database()
    return await avp.get_status(db, _user_id(user))


@router.get("/eligibility/{category}")
async def eligibility(
    category: str,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Is the current user eligible to purchase items in `category`?

    Returns `{eligible: bool, reason?: str}`. Used by the HungryVibes
    menu shadow-gate + the checkout button.
    """
    category = category.lower().strip()
    if category not in avp.RESTRICTED_CATEGORIES:
        # Non-restricted categories are always eligible.
        return {"eligible": True, "category": category}
    db = get_database()
    rec = await avp.get_status(db, _user_id(user))
    eligible = bool(rec.get("eligible_for_restricted"))
    reason = None
    if not eligible:
        if rec.get("age") is not None and rec.get("age", 0) < avp.RESTRICTED_GOODS_MIN_AGE:
            reason = "underage"
        elif rec.get("status") == avp.STATUS_REJECTED:
            reason = rec.get("rejected_reason") or "policy"
        elif rec.get("status") == avp.STATUS_PENDING:
            reason = "pending_review"
        else:
            reason = "not_submitted"
    return {
        "eligible": eligible,
        "category": category,
        "status": rec.get("status"),
        "reason": reason,
    }


@router.get("/driver-can-deliver")
async def driver_can_deliver(
    driver_user_id: str,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Internal — checked by the HungryVibes dispatch service before
    assigning a restricted-goods order to a driver."""
    _require_admin(user)  # internal endpoint; admins + dispatch service only
    db = get_database()
    ok = await avp.driver_can_deliver_restricted(db, driver_user_id)
    return {"driver_user_id": driver_user_id, "can_deliver_restricted": ok}


# ───────────────────────────────────────── User submit / appeal ──

class SubmitPayload(BaseModel):
    dob: str = Field(..., description="YYYY-MM-DD")
    id_document_url: Optional[str] = Field(default=None, description="Uploaded asset URL")
    selfie_url: Optional[str] = Field(default=None, description="Uploaded asset URL")


@router.post("/submit")
async def submit(
    payload: SubmitPayload,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Submit DOB + ID document + selfie for verification."""
    # Cheap DOB format check; service does the auth math.
    try:
        from datetime import date
        date.fromisoformat(payload.dob)
    except ValueError:
        raise HTTPException(status_code=400, detail="dob must be YYYY-MM-DD")

    db = get_database()
    try:
        rec = await avp.submit(
            db,
            user_id=_user_id(user),
            dob_iso=payload.dob,
            id_document_url=payload.id_document_url,
            selfie_url=payload.selfie_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return rec


class AppealPayload(BaseModel):
    message: str = Field(..., min_length=10, max_length=1000)


@router.post("/appeal")
async def appeal(
    payload: AppealPayload,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    db = get_database()
    try:
        rec = await avp.appeal(db, _user_id(user), payload.message)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return rec


# ───────────────────────────────────────── Admin tools ──

@router.get("/admin/queue")
async def admin_queue(
    status_filter: str = Query(default="pending"),
    limit: int = Query(default=50, ge=1, le=500),
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Pending submissions waiting for manual review."""
    _require_admin(user)
    db = get_database()
    docs = await db.age_verification.find(
        {"status": status_filter}, {"_id": 0}
    ).sort("submitted_at", -1).limit(limit).to_list(limit)
    return {"status": status_filter, "items": docs, "count": len(docs)}


@router.get("/admin/events")
async def admin_events(
    user_id: Optional[str] = None,
    kind: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(user)
    db = get_database()
    events = await avp.list_events(db, user_id=user_id, kind=kind, limit=limit)
    return {"events": events, "count": len(events)}


class AdminDecidePayload(BaseModel):
    user_id: str
    decision: str  # verified | rejected | appeal
    rejected_reason: Optional[str] = None
    note: Optional[str] = None


@router.post("/admin/decide")
async def admin_decide(
    payload: AdminDecidePayload,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(user)
    db = get_database()
    try:
        rec = await avp.admin_decide(
            db,
            user_id=payload.user_id,
            decision=payload.decision,
            admin_user_id=_user_id(user),
            rejected_reason=payload.rejected_reason,
            note=payload.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return rec


# ───────────────────────────────────────── Corrected Protocol: KYC vendor webhook ──

class VendorDecisionPayload(BaseModel):
    user_id: str
    decision: str  # VERIFIED_21 | VERIFIED_UNDER_21 | PENDING | REQUIRES_INPUT | REJECTED
    doc_status: Optional[str] = None
    requirements_due: Optional[List[str]] = None
    provider: str = Field(default=avp.KYC_PROVIDER_STRIPE_IDENTITY)
    provider_session_id: Optional[str] = None


@router.post("/webhook/vendor")
async def webhook_vendor(
    request: Request,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """KYC vendor → DSG webhook surface.

    Two modes (auto-detected at runtime):

    1. **Stripe Identity production mode** — active when
       `STRIPE_IDENTITY_WEBHOOK_SECRET` is set. The endpoint becomes
       PUBLIC (no JWT) and instead verifies the `Stripe-Signature`
       header via `stripe.Webhook.construct_event(...)`. Maps Stripe
       Identity event types → our 5-state decision matrix:
         identity.verification_session.verified         → VERIFIED_21 (or VERIFIED_UNDER_21 if DOB < 21)
         identity.verification_session.requires_input   → REQUIRES_INPUT
         identity.verification_session.canceled         → REJECTED
         identity.verification_session.processing       → PENDING

    2. **Stub mode** (admin-JWT-gated) — lets admins hand-fire vendor
       decisions while Stripe Identity provisioning is pending. Same
       code path, just a different authn front door.

    Body is parsed MANUALLY (no Pydantic body param) so the Stripe
    Identity payload shape — which has no `user_id`/`decision` at the
    top level — doesn't trigger 422 before signature verification runs.
    """
    db = get_database()
    secret = os.environ.get("STRIPE_IDENTITY_WEBHOOK_SECRET", "").strip()

    # ──────── Mode 1: Stripe Identity signature-verified webhook ────────
    if secret:
        try:
            import stripe  # noqa: PLC0415
        except ImportError:
            raise HTTPException(status_code=500, detail="stripe SDK not installed")

        sig_header = request.headers.get("stripe-signature", "")
        body = await request.body()
        try:
            event = stripe.Webhook.construct_event(body, sig_header, secret)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe.error.SignatureVerificationError:  # type: ignore[attr-defined]
            raise HTTPException(status_code=401, detail="Invalid signature")

        # Map Stripe Identity event types → our decision matrix.
        event_type = event.get("type", "")
        session = event.get("data", {}).get("object", {})
        metadata = session.get("metadata") or {}
        user_id = metadata.get("user_id") or session.get("client_reference_id")
        if not user_id:
            logger.warning("Stripe Identity event missing user_id in metadata; dropping")
            return {"received": True, "skipped": "no_user_id"}

        provider_session_id = session.get("id")
        doc_status = (session.get("verified_outputs") or {}).get("id_number_status") or session.get("status")

        if event_type == "identity.verification_session.verified":
            # Spec corrected: gate the 21-year-old check on the DOB Stripe returned.
            verified_outputs = session.get("verified_outputs") or {}
            dob = verified_outputs.get("dob") or {}
            from datetime import date  # noqa: PLC0415
            try:
                ref_age = date.today().year - int(dob.get("year", 0))
                # rough — refined by full DOB check on submit; Stripe gives full
                if dob.get("month") and dob.get("day"):
                    d_obj = date(int(dob["year"]), int(dob["month"]), int(dob["day"]))
                    ref_age = avp.calculate_age(d_obj.isoformat())
            except (ValueError, TypeError, KeyError):
                ref_age = 0
            decision = (
                avp.DECISION_VERIFIED_21
                if ref_age >= avp.RESTRICTED_GOODS_MIN_AGE
                else avp.DECISION_VERIFIED_UNDER_21
            )
            requirements_due = []
        elif event_type == "identity.verification_session.requires_input":
            decision = avp.DECISION_REQUIRES_INPUT
            requirements_due = [
                e.get("code", "unknown")
                for e in (session.get("last_error") and [session["last_error"]] or [])
            ]
        elif event_type == "identity.verification_session.processing":
            decision = avp.DECISION_PENDING
            requirements_due = []
        elif event_type == "identity.verification_session.canceled":
            decision = avp.DECISION_REJECTED
            requirements_due = []
        else:
            # Ignore unhandled events; Stripe will retry on 5xx so we 200 + skip.
            return {"received": True, "ignored_event": event_type}

        rec = await avp.apply_vendor_decision(
            db,
            user_id=user_id,
            decision=decision,
            doc_status=doc_status,
            requirements_due=requirements_due,
            provider=avp.KYC_PROVIDER_STRIPE_IDENTITY,
            provider_session_id=provider_session_id,
        )
        return {"received": True, "decision": decision, "user_id": user_id, "record": rec}

    # ──────── Mode 2: Admin-gated stub (no Stripe secret yet) ────────
    _require_admin(user)
    # Stub mode: payload is now parsed manually here (Pydantic body
    # param was removed from the function signature so Stripe Identity
    # webhooks in mode 1 don't 422-fail on schema mismatch).
    try:
        raw = await request.json()
        payload = VendorDecisionPayload(**raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid stub payload")
    if payload.provider not in avp.SUPPORTED_KYC_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {payload.provider}")
    try:
        rec = await avp.apply_vendor_decision(
            db,
            user_id=payload.user_id,
            decision=payload.decision,
            doc_status=payload.doc_status,
            requirements_due=payload.requirements_due,
            provider=payload.provider,
            provider_session_id=payload.provider_session_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return rec


# ───────────────────────────────────────── Corrected Protocol: Driver delivery ──

class DeliveryConfirmPayload(BaseModel):
    order_id: str
    pdf417_scanned: bool = Field(..., description="Recipient ID PDF417 barcode scanned successfully")
    biometric_match: bool = Field(..., description="Driver visually confirmed recipient matches ID photo")
    recipient_age: int = Field(..., ge=0, le=120)
    sobriety_ok: bool = Field(..., description="Recipient not visibly intoxicated")


@router.post("/delivery/confirm")
async def delivery_confirm(
    payload: DeliveryConfirmPayload,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Driver completes point-of-delivery checks for a restricted-goods
    order. All 4 checks must pass (PDF417 + biometric + age + sobriety)
    for the handoff to register as complete."""
    db = get_database()
    rec = await avp.driver_confirm_delivery(
        db,
        order_id=payload.order_id,
        driver_user_id=_user_id(user),
        pdf417_scanned=payload.pdf417_scanned,
        biometric_match=payload.biometric_match,
        recipient_age=payload.recipient_age,
        sobriety_ok=payload.sobriety_ok,
    )
    return rec


class DeliveryRefusePayload(BaseModel):
    order_id: str
    reason: str
    note: Optional[str] = None


@router.post("/delivery/refuse")
async def delivery_refuse(
    payload: DeliveryRefusePayload,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Driver right-to-refuse. Codified per Corrected Protocol — driver
    may refuse handoff regardless of digital checks (e.g., visibly
    intoxicated recipient even though ID validated)."""
    db = get_database()
    try:
        rec = await avp.driver_refuse_delivery(
            db,
            order_id=payload.order_id,
            driver_user_id=_user_id(user),
            reason=payload.reason,
            note=payload.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return rec


@router.get("/delivery/refusal-reasons")
async def delivery_refusal_reasons() -> Dict[str, Any]:
    """Public — the standardized refusal-reason taxonomy for drivers."""
    return {"reasons": avp.DELIVERY_REFUSAL_REASONS}
