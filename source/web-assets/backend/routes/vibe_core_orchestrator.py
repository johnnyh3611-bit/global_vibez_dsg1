"""
Vibe Core Master Orchestrator — `/api/vibe-core/process-event` (Master
Blueprint PDF, page 2 — Master Integration Code).

This is the single funnel for ANY cross-module event in the platform.
It (a) routes the event to the right specialist module, (b) optionally
runs an AI mediation pass when a dispute is involved, (c) executes the
Solana / off-chain escrow settlement, (d) broadcasts the outcome to the
AI Media Network's "Vibe Court" segment, and (e) emails the founder a
system alert when the resolution is non-trivial.

Compare to the PDF code block:

    @app.post("/vibe-core/process-event")
    async def process_event(event_id, type):
        decision = await ai_agent.mediate(event_id, type, data_sources=[...])
        payout   = await execute_solana_escrow(decision)
        await tv_network.broadcast_update(segment="Vibe Court", content=...)
        await send_system_email(subject=..., body=..., to="founder@globalvibez.dsg")
        return {"status": "Complete", "tx_id": payout["tx"]}
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


KNOWN_EVENT_TYPES = {
    "VIBE_SPOT_DISPUTE",       # guest vs host disagreement
    "VIBEZ_654_PAYOUT_AUDIT",  # large-payout review
    "GAME_RESULT_CONTEST",     # contested game outcome
    "MERCHANT_BOUNTY_VERIFY",  # auto-validate Hungry VIBEZ proof
    "DSG6_DRAW_AUDIT",         # post-draw audit trail
    "GENERIC",                 # anything that just needs orchestration
}


class ProcessEventPayload(BaseModel):
    event_id: str = Field(min_length=4, max_length=64)
    type: str = Field(min_length=4, max_length=64)
    context: Optional[Dict[str, Any]] = None
    notify_founder: bool = False


async def _ai_mediate(event_id: str, event_type: str, context: Dict[str, Any]) -> Dict[str, Any]:
    """Best-effort mediation *hint* via the AI gateway.

    Vibe-Core remains the cross-feature mediator for disputes, escrow,
    and policy outcomes. The LLM only drafts a short verdict label —
    it never executes payouts or conversational prompts for dating/games.
    """
    from services.ai_context import normalize_context  # noqa: PLC0415
    from services import ai_gateway as gw  # noqa: PLC0415

    if not gw.ai_configured():
        return {
            "verdict": "NO_LLM_KEY",
            "summary": "AI mediation skipped — GEMINI_API_KEY missing.",
            "confidence": 0.0,
        }

    ctx = normalize_context(
        {
            "user_id": str(context.get("user_id") or "system"),
            "balance": float(context.get("balance") or 0),
            "mode": "earn",
            "room_id": str(context.get("room_id") or event_id),
            "beta_flags": {"vibe_core": True, "event_type": event_type},
        }
    )
    result = await gw.complete(
        system=(
            "You are NOVA, the senior AI judge for Global Vibez DSG. "
            "You read a single event payload and return a short, formal "
            "verdict in 2-4 sentences. Be neutral. End with a single-line "
            "label of one of: REFUND_GUEST, REFUND_PARTIAL, FAVOR_HOST, NEEDS_HUMAN."
        ),
        user_text=f"Event {event_id} ({event_type}) context:\n{context}",
        context=ctx,
        session_id=f"vibe-court-{event_id}",
        max_tokens=512,
        timeout_s=15.0,
        fallback="Unable to mediate automatically.\nNEEDS_HUMAN",
        model_hint="flash",
    )
    verdict_text = result.get("text") or "NEEDS_HUMAN"
    lines = [ln.strip() for ln in verdict_text.strip().splitlines() if ln.strip()]
    label = lines[-1] if lines else "NEEDS_HUMAN"
    if result.get("fallback"):
        return {
            "verdict": "NEEDS_HUMAN",
            "summary": verdict_text.strip()[:400],
            "confidence": 0.0,
        }
    return {
        "verdict": label,
        "summary": verdict_text.strip(),
        "confidence": 0.85,
    }


async def _execute_settlement(decision: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """STUB — when Solana mainnet flag flips, dispatch to the real
    Solana program. For now, returns a mock tx so downstream logic can
    proceed without a chain hit."""
    unlocked = os.environ.get("SOLANA_MAINNET_UNLOCKED", "0") == "1"
    tx = f"sol_tx_{uuid.uuid4().hex[:24]}" if unlocked else f"offchain_{uuid.uuid4().hex[:16]}"
    return {"tx": tx, "executed_on_chain": unlocked}


async def _broadcast_vibe_court(db, event_id: str, decision: Dict[str, Any]) -> None:
    """Persist a broadcast row that the DSG TV Vibe Court segment can poll."""
    await db.vibe_court_broadcasts.insert_one({
        "broadcast_id": f"vc_{uuid.uuid4().hex[:12]}",
        "event_id": event_id,
        "verdict": decision.get("verdict"),
        "summary": decision.get("summary"),
        "confidence": decision.get("confidence"),
        "segment": "Vibe Court",
        "broadcast_at": datetime.now(timezone.utc).isoformat(),
    })


async def _email_founder(event_id: str, event_type: str, decision: Dict[str, Any]) -> bool:
    """Best-effort founder email via the existing Resend integration.
    Recipient comes from FOUNDER_EMAIL env so it can be any address the
    founder controls (the hardcoded globalvibez.dsg mailbox didn't yet
    exist as of May 2026 — flagged by the founder)."""
    sender = os.environ.get("RESEND_SENDER_EMAIL")
    api_key = os.environ.get("RESEND_API_KEY")
    recipient = os.environ.get("FOUNDER_EMAIL")
    if not (sender and api_key and recipient):
        return False
    try:
        import httpx  # noqa: PLC0415
        async with httpx.AsyncClient(timeout=10) as cli:
            await cli.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "from": sender,
                    "to": [recipient],
                    "subject": f"System Alert: {event_type} Resolved",
                    "html": (
                        f"<p><b>Event:</b> {event_id}</p>"
                        f"<p><b>Verdict:</b> {decision.get('verdict')}</p>"
                        f"<p>{decision.get('summary')}</p>"
                    ),
                },
            )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Founder email failed: %s", exc)
        return False


@router.post("/vibe-core/process-event")
async def process_event(payload: ProcessEventPayload, http_request: Request):
    """Master orchestrator — see module docstring for the exact pipeline."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if payload.type not in KNOWN_EVENT_TYPES:
        raise HTTPException(400, f"Unknown event type. Allowed: {sorted(KNOWN_EVENT_TYPES)}")

    db = get_database()
    context: Dict[str, Any] = payload.context or {}

    # 1. AI mediation.
    decision = await _ai_mediate(payload.event_id, payload.type, context)

    # 2. Settlement / payout (Solana stub until mainnet unlock).
    payout = await _execute_settlement(decision, context)

    # 3. Broadcast to Vibe Court segment.
    await _broadcast_vibe_court(db, payload.event_id, decision)

    # 4. Optional founder email.
    emailed = False
    if payload.notify_founder:
        emailed = await _email_founder(payload.event_id, payload.type, decision)

    # 5. Persist the event itself for audit.
    record = {
        "event_id": payload.event_id,
        "type": payload.type,
        "context": context,
        "decision": decision,
        "payout": payout,
        "emailed_founder": emailed,
        "submitted_by": user.user_id,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "status": "Complete",
    }
    await db.vibe_core_events.update_one(
        {"event_id": payload.event_id},
        {"$set": record},
        upsert=True,
    )
    record.pop("_id", None)
    return {
        "status": "Complete",
        "event_id": payload.event_id,
        "verdict": decision.get("verdict"),
        "summary": decision.get("summary"),
        "tx_id": payout["tx"],
        "executed_on_chain": payout["executed_on_chain"],
        "emailed_founder": emailed,
    }


@router.get("/vibe-core/events")
async def list_events(http_request: Request, limit: int = 25):
    """Recent orchestrated events — Vibe Court producer reads from this."""
    user = await get_current_user(http_request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    db = get_database()
    cursor = db.vibe_core_events.find({}, {"_id": 0}).sort("submitted_at", -1).limit(max(1, min(int(limit), 100)))
    rows: List[Dict[str, Any]] = await cursor.to_list(length=100)
    return {"count": len(rows), "rows": rows}


@router.get("/vibe-court/feed")
async def vibe_court_feed(limit: int = 10):
    """Public read-only feed of recent Vibe Court broadcasts for the TV ticker."""
    db = get_database()
    cursor = db.vibe_court_broadcasts.find({}, {"_id": 0}).sort("broadcast_at", -1).limit(max(1, min(int(limit), 50)))
    rows: List[Dict[str, Any]] = await cursor.to_list(length=50)
    return {"count": len(rows), "rows": rows}
