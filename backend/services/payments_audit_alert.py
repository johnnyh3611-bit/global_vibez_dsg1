"""
Payments-audit drift alert (Feb 2026)
─────────────────────────────────────────────────────────────────
Background worker that runs every 6h, computes the Stripe-paid vs
internally-credited drift over the last 7 days, and emails the
founder via Resend when |drift| > ``DRIFT_THRESHOLD_USD``.

Idempotent: every alert writes a row to ``payments_audit_alerts`` so
we don't re-spam the founder when the same drift persists for days.
A fresh alert only fires when:
  • the drift just crossed the threshold (was clean, now dirty), OR
  • it's been ≥24h since the last alert and the drift is still > threshold

The reconciliation logic mirrors the ``/api/admin/payments-audit/reconcile``
endpoint so the email number matches what the founder sees in the UI.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

log = logging.getLogger("payments-audit-drift-alert")

# Configurable via env. Sensible defaults — $5 catches a single missed
# coin top-up at the Popular ($9) tier but ignores penny rounding noise.
DRIFT_THRESHOLD_USD: float = float(os.environ.get("PAYMENTS_DRIFT_THRESHOLD_USD") or 5.0)
WINDOW_DAYS: int = int(os.environ.get("PAYMENTS_DRIFT_WINDOW_DAYS") or 7)
TICK_SECONDS: int = int(os.environ.get("PAYMENTS_DRIFT_TICK_SECONDS") or 6 * 3600)
COOLDOWN_HOURS: int = int(os.environ.get("PAYMENTS_DRIFT_COOLDOWN_HOURS") or 24)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _compute_drift(db, window_days: int) -> Dict[str, float]:
    """Mirror of routes.admin_payments_audit.reconcile — kept here so
    the worker stays usable even if the route module fails to import."""
    since = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat()
    paid_pipeline = [
        {"$match": {
            "at": {"$gte": since},
            "source": {"$in": ["stripe_checkout", "stripe_webhook"]},
            "status": {"$in": ["paid", "credited"]},
        }},
        {"$group": {"_id": None, "usd": {"$sum": {"$ifNull": ["$amount_usd", 0]}}}},
    ]
    credited_pipeline = [
        {"$match": {"at": {"$gte": since}, "status": "credited"}},
        {"$group": {"_id": None, "usd": {"$sum": {"$ifNull": ["$amount_usd", 0]}}}},
    ]
    paid_doc = await db.payments_audit.aggregate(paid_pipeline).to_list(length=1)
    credited_doc = await db.payments_audit.aggregate(credited_pipeline).to_list(length=1)
    paid_usd = float((paid_doc[0]["usd"] if paid_doc else 0) or 0)
    credited_usd = float((credited_doc[0]["usd"] if credited_doc else 0) or 0)
    return {
        "stripe_paid_usd": round(paid_usd, 2),
        "internally_credited_usd": round(credited_usd, 2),
        "drift_usd": round(paid_usd - credited_usd, 2),
        "since": since,
    }


def _render_alert_html(metrics: Dict[str, float], window_days: int) -> str:
    drift = metrics["drift_usd"]
    return (
        f"""<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;
 background:#0a0a0f;color:#e5e7eb;padding:24px;">
  <h2 style="color:#f87171;margin:0 0 8px;">Payments-audit drift detected</h2>
  <p style="color:#9ca3af;margin:0 0 18px;font-size:14px;">
    Stripe-paid vs internally-credited drift exceeded
    ${DRIFT_THRESHOLD_USD:.2f} over the last {window_days} days.
  </p>
  <table cellpadding="10" style="background:#111827;border-radius:12px;width:100%;
   max-width:480px;font-family:monospace;font-size:14px;">
    <tr><td style="color:#9ca3af;">Stripe paid</td>
        <td style="text-align:right;color:#f3f4f6;">${metrics['stripe_paid_usd']:.2f}</td></tr>
    <tr><td style="color:#9ca3af;">Internally credited</td>
        <td style="text-align:right;color:#f3f4f6;">${metrics['internally_credited_usd']:.2f}</td></tr>
    <tr><td style="color:#9ca3af;border-top:1px solid #1f2937;">Drift</td>
        <td style="text-align:right;color:#f87171;font-weight:bold;
         border-top:1px solid #1f2937;">${drift:.2f}</td></tr>
  </table>
  <p style="color:#6b7280;font-size:12px;margin-top:18px;">
    Open <code>/admin/payments-audit</code> to inspect events and resolve.
  </p>
</body></html>"""
    )


async def _send_alert_email(metrics: Dict[str, float], window_days: int) -> Dict[str, Any]:
    """Best-effort Resend send. Returns ``{sent, error, msg_id}``."""
    api_key = os.environ.get("RESEND_API_KEY")
    rcpt = (
        os.environ.get("PAYMENTS_ALERT_RECIPIENT_EMAIL")
        or os.environ.get("DIGEST_RECIPIENT_EMAIL")
        or os.environ.get("RESEND_SENDER_EMAIL")
        or "support@globalvibezdsg.com"
    )
    if not api_key:
        return {"sent": False, "error": "RESEND_API_KEY missing", "msg_id": None,
                "recipient": rcpt}
    try:
        import resend  # noqa: PLC0415
        resend.api_key = api_key
        sender = os.environ.get("RESEND_SENDER_EMAIL", "support@globalvibezdsg.com")
        params = {
            "from": sender,
            "to": [rcpt],
            "subject": f"[ALERT] Payments drift ${metrics['drift_usd']:.2f} "
                        f"(last {window_days}d)",
            "html": _render_alert_html(metrics, window_days),
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        msg_id = result.get("id") if isinstance(result, dict) else result
        return {"sent": True, "error": None, "msg_id": msg_id, "recipient": rcpt}
    except Exception as exc:  # noqa: BLE001
        log.error("drift alert email send failed: %s", exc)
        return {"sent": False, "error": str(exc), "msg_id": None, "recipient": rcpt}


async def evaluate_and_alert(db) -> Dict[str, Any]:
    """Compute drift, decide whether to email, persist an audit row.

    Returns a structured result so this can be unit-tested without a
    background loop. Exported so the optional ops endpoint (and the
    background loop) share one code path.
    """
    metrics = await _compute_drift(db, WINDOW_DAYS)
    drift = abs(metrics["drift_usd"])
    over_threshold = drift > DRIFT_THRESHOLD_USD

    if not over_threshold:
        return {
            "ok": True,
            "over_threshold": False,
            "metrics": metrics,
            "alert_sent": False,
            "reason": "drift_under_threshold",
        }

    # Cool-down lookup — don't re-spam every 6h while drift is persistent.
    last_alert = await db.payments_audit_alerts.find_one(
        {}, sort=[("at", -1)], projection={"_id": 0, "at": 1},
    )
    if last_alert and last_alert.get("at"):
        try:
            last_dt = datetime.fromisoformat(last_alert["at"])
            if datetime.now(timezone.utc) - last_dt < timedelta(hours=COOLDOWN_HOURS):
                return {
                    "ok": True,
                    "over_threshold": True,
                    "metrics": metrics,
                    "alert_sent": False,
                    "reason": "cooldown_active",
                }
        except Exception:
            pass

    email_result = await _send_alert_email(metrics, WINDOW_DAYS)
    await db.payments_audit_alerts.insert_one({
        "at": _now_iso(),
        "window_days": WINDOW_DAYS,
        "threshold_usd": DRIFT_THRESHOLD_USD,
        "metrics": metrics,
        "email": email_result,
    })
    log.warning(
        "payments-audit drift alert fired: drift=$%.2f threshold=$%.2f window=%dd sent=%s",
        metrics["drift_usd"], DRIFT_THRESHOLD_USD, WINDOW_DAYS, email_result["sent"],
    )
    return {
        "ok": True,
        "over_threshold": True,
        "metrics": metrics,
        "alert_sent": email_result["sent"],
        "email": email_result,
    }


async def drift_alert_loop() -> None:
    """Background loop. Wakes every ``TICK_SECONDS`` (default 6h) and
    calls ``evaluate_and_alert``. Imported by lifespan_workers."""
    from utils.database import get_database  # noqa: PLC0415
    await asyncio.sleep(45)  # warmup so motor + Mongo are ready
    while True:
        try:
            db = get_database()
            await evaluate_and_alert(db)
        except Exception as exc:  # noqa: BLE001
            log.warning("drift alert tick failed: %s", exc)
        await asyncio.sleep(TICK_SECONDS)
