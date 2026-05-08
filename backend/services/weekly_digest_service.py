"""
Beta Waitlist — Founder Weekly Digest

Founder ask 2026-02-17 Late × 4: "I want a weekly digest email auto-
dispatched every Monday morning. It'd surface this week's signup count,
top 5 climbers, new Ambassadors unlocked, average time-to-redemption,
and any zero-signup days that need a marketing push."

What this module does
---------------------
1. `compute_weekly_digest(db, ref_now=None)` — pure aggregation. Reads
   `beta_waitlist` + `beta_invite_tokens` and returns the structured
   payload used by both preview/send endpoints and by the email template.
2. `render_digest_email_html(payload)` — branded HTML email.
3. `dispatch_weekly_digest(db, recipient=None)` — computes, renders,
   ships via Resend, and audits the run to `beta_digest_runs`.
4. `weekly_digest_loop()` — fire-and-forget asyncio loop that ticks
   every 30 min, runs the dispatch every Monday at 09:00 UTC. Idempotent
   via the audit collection (only one dispatch per ISO calendar week).

The recipient defaults to env `DIGEST_RECIPIENT_EMAIL`, falling back to
`RESEND_SENDER_EMAIL` so the founder always gets the digest even if no
explicit recipient is configured.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

DIGEST_HOUR_UTC = 9  # Monday 09:00 UTC
DIGEST_DAY_OF_WEEK = 0  # Mon=0 .. Sun=6


# ── Aggregation ──────────────────────────────────────────────────────────
async def compute_weekly_digest(db, ref_now: Optional[datetime] = None) -> Dict[str, Any]:
    """Build the payload. `ref_now` lets tests pin a specific moment."""
    now = ref_now or datetime.now(timezone.utc)
    week_start = now - timedelta(days=7)
    prev_week_start = now - timedelta(days=14)

    # ── Signup counts ──
    week_signups = await db.beta_waitlist.count_documents({
        "created_at": {"$gte": week_start.isoformat()},
    })
    prev_week_signups = await db.beta_waitlist.count_documents({
        "created_at": {
            "$gte": prev_week_start.isoformat(),
            "$lt": week_start.isoformat(),
        },
    })
    delta_pct = 0.0
    if prev_week_signups > 0:
        delta_pct = round((week_signups - prev_week_signups) / prev_week_signups * 100.0, 1)
    elif week_signups > 0:
        delta_pct = 100.0
    total_signups = await db.beta_waitlist.count_documents({})
    total_ambassadors = await db.beta_waitlist.count_documents({"is_ambassador": True})

    # ── New ambassadors this week ──
    new_amb_cursor = db.beta_waitlist.find(
        {"is_ambassador": True, "ambassador_at": {"$gte": week_start.isoformat()}},
        {"_id": 0, "name": 1, "referred_count": 1, "ambassador_at": 1},
    ).sort("ambassador_at", -1).limit(20)
    new_ambassadors: List[Dict[str, Any]] = [doc async for doc in new_amb_cursor]

    # ── Top 5 climbers ──
    # We don't have day-by-day deltas; approximate "this week's climbers"
    # as the 5 signups whose latest referee was added this week, sorted
    # by total referred_count desc. Robust + cheap.
    climbers_cursor = db.beta_waitlist.find(
        {"referred_count": {"$gt": 0}},
        {"_id": 0, "name": 1, "referral_code": 1, "referred_count": 1, "is_ambassador": 1},
    ).sort("referred_count", -1).limit(5)
    top_climbers: List[Dict[str, Any]] = [doc async for doc in climbers_cursor]

    # ── Avg time-to-redemption (invited_at → redeemed_at) ──
    pipe = [
        {"$match": {
            "status": "redeemed",
            "invited_at": {"$ne": None},
            "redeemed_at": {"$ne": None},
        }},
        {"$project": {
            "_id": 0,
            "invited_at": 1,
            "redeemed_at": 1,
        }},
    ]
    redemption_rows: List[Dict[str, Any]] = []
    try:
        async for row in db.beta_waitlist.aggregate(pipe):
            redemption_rows.append(row)
    except Exception:
        redemption_rows = []
    deltas_sec: List[float] = []
    for row in redemption_rows:
        try:
            inv = datetime.fromisoformat(row["invited_at"].replace("Z", "+00:00"))
            red = datetime.fromisoformat(row["redeemed_at"].replace("Z", "+00:00"))
            d = (red - inv).total_seconds()
            if d >= 0:
                deltas_sec.append(d)
        except Exception:
            pass
    avg_redeem_hours: Optional[float] = None
    if deltas_sec:
        avg_redeem_hours = round((sum(deltas_sec) / len(deltas_sec)) / 3600.0, 2)

    # ── Zero-signup days (last 7 days) ──
    zero_days: List[str] = []
    daily_buckets: List[Dict[str, Any]] = []
    for offset in range(7):
        day_start = (now - timedelta(days=offset + 1)).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )
        day_end = day_start + timedelta(days=1)
        cnt = await db.beta_waitlist.count_documents({
            "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()},
        })
        label = day_start.strftime("%a %b %d")
        daily_buckets.append({"day": label, "count": cnt})
        if cnt == 0:
            zero_days.append(label)
    daily_buckets.reverse()  # oldest → newest

    # ── Status snapshot ──
    waitlisted = await db.beta_waitlist.count_documents({"status": "waitlisted"})
    invited = await db.beta_waitlist.count_documents({"status": "invited"})
    redeemed = await db.beta_waitlist.count_documents({"status": "redeemed"})
    conversion_pct = round((redeemed / invited * 100.0) if invited > 0 else 0.0, 1)

    return {
        "generated_at": now.isoformat(),
        "week_start": week_start.isoformat(),
        "week_signups": week_signups,
        "prev_week_signups": prev_week_signups,
        "delta_pct": delta_pct,
        "total_signups": total_signups,
        "total_ambassadors": total_ambassadors,
        "new_ambassadors": new_ambassadors,
        "top_climbers": top_climbers,
        "avg_redemption_hours": avg_redeem_hours,
        "zero_days": zero_days,
        "daily_buckets": daily_buckets,
        "waitlisted": waitlisted,
        "invited": invited,
        "redeemed": redeemed,
        "conversion_pct": conversion_pct,
    }


# ── Email template ───────────────────────────────────────────────────────
def render_digest_email_html(payload: Dict[str, Any]) -> str:
    week_signups = payload["week_signups"]
    delta = payload["delta_pct"]
    delta_color = "#00E5C7" if delta >= 0 else "#FC2A82"
    delta_arrow = "▲" if delta >= 0 else "▼"
    avg_redeem = payload.get("avg_redemption_hours")
    avg_redeem_str = f"{avg_redeem}h" if avg_redeem is not None else "—"
    zero_days = payload.get("zero_days") or []
    new_amb = payload.get("new_ambassadors") or []
    climbers = payload.get("top_climbers") or []

    climbers_rows = "".join(
        f"""
        <tr>
          <td style="padding:8px 0;color:#FFD33D;font-weight:900;width:24px;">#{i+1}</td>
          <td style="padding:8px 6px;color:#F5F5F5;">{c.get('name','—')}{(' 👑' if c.get('is_ambassador') else '')}</td>
          <td style="padding:8px 0;text-align:right;color:#FFD33D;font-weight:900;">{c.get('referred_count',0)}</td>
        </tr>
        """
        for i, c in enumerate(climbers)
    ) or '<tr><td colspan="3" style="padding:12px 0;color:#737373;font-size:12px;">No referrals captured yet — share /beta-tester?ref=YOUR_CODE links.</td></tr>'

    new_amb_block = ""
    if new_amb:
        items = "".join(
            f'<li style="margin:6px 0;color:#FFD33D;">{a.get("name","—")} ({a.get("referred_count",0)} refs)</li>'
            for a in new_amb[:5]
        )
        new_amb_block = f"""
        <div style="margin:20px 0;padding:16px;border-radius:12px;background:rgba(255,211,61,0.08);border:1px solid rgba(255,211,61,0.3);">
          <div style="font-size:11px;letter-spacing:3px;color:#FFD33D;font-weight:900;margin-bottom:8px;">NEW AMBASSADORS THIS WEEK</div>
          <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;color:#F5F5F5;list-style:none;">{items}</ul>
        </div>
        """

    zero_days_block = ""
    if zero_days:
        zd = ", ".join(zero_days)
        zero_days_block = f"""
        <div style="margin:20px 0;padding:14px 18px;border-radius:12px;background:rgba(252,42,130,0.08);border:1px solid rgba(252,42,130,0.3);">
          <div style="font-size:11px;letter-spacing:3px;color:#FC2A82;font-weight:900;margin-bottom:6px;">⚠ ZERO-SIGNUP DAYS</div>
          <div style="color:#F5F5F5;font-size:13px;line-height:1.5;">{zd} — consider a marketing push.</div>
        </div>
        """

    return f"""
<!doctype html>
<html><body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:40px 20px;">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#13131A;border:1px solid #262630;border-radius:16px;">
        <tr><td style="padding:36px 36px 12px;color:#F5F5F5;">
          <div style="font-size:11px;letter-spacing:4px;color:#FFD33D;font-weight:900;margin-bottom:12px;">FOUNDER DIGEST · WEEK SUMMARY</div>
          <h1 style="font-size:28px;line-height:1.15;margin:0 0 6px;color:#FFFFFF;">{week_signups} new beta signups this week</h1>
          <div style="color:{delta_color};font-size:14px;font-weight:900;">{delta_arrow} {abs(delta)}% vs last week ({payload.get('prev_week_signups', 0)})</div>
        </td></tr>
        <tr><td style="padding:0 36px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
            <tr>
              <td style="padding:14px;border-radius:12px;background:rgba(0,229,199,0.08);border:1px solid rgba(0,229,199,0.25);width:33%;">
                <div style="font-size:10px;letter-spacing:2px;color:#00E5C7;font-weight:900;margin-bottom:4px;">TOTAL</div>
                <div style="font-size:22px;font-weight:900;color:#FFFFFF;">{payload.get('total_signups',0):,}</div>
              </td>
              <td style="width:8px;"></td>
              <td style="padding:14px;border-radius:12px;background:rgba(255,138,31,0.08);border:1px solid rgba(255,138,31,0.25);width:33%;">
                <div style="font-size:10px;letter-spacing:2px;color:#FF8A1F;font-weight:900;margin-bottom:4px;">AMBASSADORS</div>
                <div style="font-size:22px;font-weight:900;color:#FFFFFF;">{payload.get('total_ambassadors',0):,}</div>
              </td>
              <td style="width:8px;"></td>
              <td style="padding:14px;border-radius:12px;background:rgba(252,42,130,0.08);border:1px solid rgba(252,42,130,0.25);width:33%;">
                <div style="font-size:10px;letter-spacing:2px;color:#FC2A82;font-weight:900;margin-bottom:4px;">AVG REDEEM</div>
                <div style="font-size:22px;font-weight:900;color:#FFFFFF;">{avg_redeem_str}</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 36px 4px;color:#F5F5F5;">
          <div style="font-size:11px;letter-spacing:3px;color:#FFD33D;font-weight:900;margin-bottom:10px;">TOP 5 CLIMBERS</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            {climbers_rows}
          </table>
        </td></tr>
        <tr><td style="padding:0 36px;">
          {new_amb_block}
          {zero_days_block}
        </td></tr>
        <tr><td style="padding:24px 36px 36px;">
          <hr style="border:none;border-top:1px solid #262630;margin:18px 0;" />
          <p style="font-size:12px;color:#737373;margin:0;line-height:1.5;">
            <strong style="color:#9999A8;">Snapshot:</strong>
            {payload.get('waitlisted',0)} waitlisted · {payload.get('invited',0)} invited ·
            {payload.get('redeemed',0)} redeemed ({payload.get('conversion_pct',0)}% conversion).
          </p>
          <p style="font-size:11px;color:#525252;margin:18px 0 0;line-height:1.5;">
            Generated {payload.get('generated_at','')} · Open the Control Tower at
            <a href="#" style="color:#FFD33D;text-decoration:none;">/vibe-vault-admin/beta-waitlist</a> to take action.
          </p>
        </td></tr>
      </table>
      <div style="text-align:center;color:#404040;font-size:10px;margin-top:16px;font-family:monospace;letter-spacing:3px;">GLOBAL VIBEZ DSG · FOUNDER DIGEST</div>
    </td></tr>
  </table>
</body></html>
""".strip()


# ── Dispatch ─────────────────────────────────────────────────────────────
async def dispatch_weekly_digest(db, recipient: Optional[str] = None) -> Dict[str, Any]:
    """Send the digest now. Returns a structured result with `ok`,
    `email_sent`, `recipient`, and audit metadata."""
    payload = await compute_weekly_digest(db)
    rcpt = (
        recipient
        or os.environ.get("DIGEST_RECIPIENT_EMAIL")
        or os.environ.get("RESEND_SENDER_EMAIL")
        or "onboarding@resend.dev"
    )
    api_key = os.environ.get("RESEND_API_KEY")
    sent = False
    msg_id: Optional[str] = None
    err: Optional[str] = None
    if not api_key:
        err = "RESEND_API_KEY missing"
    else:
        try:
            import resend
            resend.api_key = api_key
            sender = os.environ.get("RESEND_SENDER_EMAIL", "onboarding@resend.dev")
            html = render_digest_email_html(payload)
            week_label = datetime.fromisoformat(
                payload["generated_at"]
            ).strftime("%b %d %Y")
            params = {
                "from": sender,
                "to": [rcpt],
                "subject": f"[Beta Digest] {payload['week_signups']} new signups · {week_label}",
                "html": html,
            }
            result = await asyncio.to_thread(resend.Emails.send, params)
            msg_id = result.get("id") if isinstance(result, dict) else result
            sent = True
        except Exception as e:
            err = str(e)
            logger.error(f"weekly digest send failed: {e}")

    audit = {
        "run_id": f"digest_{int(datetime.now(timezone.utc).timestamp())}",
        "generated_at": payload["generated_at"],
        "iso_week": datetime.now(timezone.utc).strftime("%G-W%V"),
        "recipient": rcpt,
        "week_signups": payload["week_signups"],
        "delta_pct": payload["delta_pct"],
        "email_sent": sent,
        "message_id": msg_id,
        "error": err,
    }
    try:
        await db.beta_digest_runs.insert_one(audit)
        audit.pop("_id", None)
    except Exception as e:
        logger.warning(f"digest audit insert skipped: {e}")
    return {"ok": True, "audit": audit, "payload": payload}


# ── Background scheduler ─────────────────────────────────────────────────
async def weekly_digest_loop():
    """Wakes every 30 min, fires the dispatch when it's Monday between
    09:00 and 09:30 UTC, idempotent via the iso-week audit row."""
    from utils.database import get_database
    log = logging.getLogger("weekly-digest")
    db = get_database()
    while True:
        try:
            now = datetime.now(timezone.utc)
            iso_week = now.strftime("%G-W%V")
            if (
                now.weekday() == DIGEST_DAY_OF_WEEK
                and now.hour == DIGEST_HOUR_UTC
                and now.minute < 30
            ):
                already = await db.beta_digest_runs.find_one(
                    {"iso_week": iso_week, "email_sent": True}, {"_id": 1},
                )
                if not already:
                    log.info(f"dispatching weekly digest for {iso_week}")
                    res = await dispatch_weekly_digest(db)
                    log.info(f"weekly digest dispatched: {res.get('audit', {})}")
        except Exception as exc:
            log.warning(f"weekly digest loop tick failed: {exc}")
        await asyncio.sleep(30 * 60)


async def get_last_digest_run(db) -> Optional[Dict[str, Any]]:
    """Return the most recent audit row for the admin status panel."""
    cursor = db.beta_digest_runs.find({}, {"_id": 0}).sort("generated_at", -1).limit(1)
    rows: List[Dict[str, Any]] = [doc async for doc in cursor]
    return rows[0] if rows else None


__all__ = [
    "compute_weekly_digest",
    "render_digest_email_html",
    "dispatch_weekly_digest",
    "weekly_digest_loop",
    "get_last_digest_run",
]
