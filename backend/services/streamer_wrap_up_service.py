"""
Streamer Wrap-Up — weekly per-streamer analytics email.

Founder ask 2026-02 (final pre-beta polish): every Monday morning,
each streamer with a provisioned live input gets an email containing
their previous-7-day Cloudflare Stream analytics:
  - Total minutes viewed
  - Active days (days with any viewer)
  - Top audience country
  - 7-day daily minutes-viewed sparkline
  - Cross-promo to the Featured Streamers tier when ROI looks weak

Pattern mirrors `weekly_digest_service.py` (the Mon 09:00 UTC dispatch
loop + audit pattern) but per-streamer. Single Resend call per streamer
is cheap; the loop walks `cf_live_inputs` and dispatches sequentially
with a 100ms sleep between sends to stay well under Resend's rate limit.

Resend sender domain: until founder's IONOS DNS is verified, sends use
`RESEND_SENDER_EMAIL` (currently the Resend sandbox `onboarding@resend.dev`).
Emails will land but Gmail may flag as "via amazonses.com" — fully
production-ready the moment the founder verifies globalvibezdsg.com
in Resend.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Mondays 09:00 UTC — same cadence as the founder digest.
WRAP_UP_HOUR_UTC = 9


# ── Aggregation ─────────────────────────────────────────────────────────
async def compute_streamer_wrap_up(
    db, streamer_id: str, days: int = 7,
) -> Optional[Dict[str, Any]]:
    """Pull a streamer's last-`days`-day analytics. Returns None if the
    streamer has no provisioned live input (skip them in dispatch)."""
    inp = await db.cf_live_inputs.find_one(
        {"streamer_id": streamer_id, "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not inp:
        return None

    # Lean on the same Cloudflare GraphQL helper the live analytics
    # endpoint uses — single source of truth for the numbers.
    try:
        from routes.cloudflare_stream import stream_analytics  # noqa: PLC0415
        analytics = await stream_analytics(inp["input_id"], days=days)
    except Exception as e:
        logger.warning("Wrap-up: analytics fetch failed for %s: %s", streamer_id, e)
        analytics = {
            "mode": "stub",
            "summary": {"total_minutes_viewed": 0, "unique_viewer_days": 0, "top_country": None},
            "daily": [],
            "countries": [],
        }

    # Streamer profile for personalization. Fall back to streamer_id if
    # we can't find a user (e.g., demo accounts).
    user = await db.users.find_one(
        {"$or": [{"user_id": streamer_id}, {"_id": streamer_id}, {"username": streamer_id}]},
        {"_id": 0, "email": 1, "username": 1, "display_name": 1},
    )

    # Featured status — surface "your feature expires in N days" if any.
    feat = await db.featured_streamers.find_one(
        {"streamer_id": streamer_id}, {"_id": 0},
    )
    featured_until = (feat or {}).get("featured_until")
    feat_days_left = 0
    if featured_until:
        try:
            delta = datetime.fromisoformat(featured_until) - datetime.now(timezone.utc)
            feat_days_left = max(0, delta.days)
        except ValueError:
            feat_days_left = 0

    return {
        "streamer_id": streamer_id,
        "email": (user or {}).get("email"),
        "display_name": (user or {}).get("display_name") or (user or {}).get("username") or streamer_id,
        "stream_name": inp.get("name"),
        "input_id": inp["input_id"],
        "summary": analytics["summary"],
        "daily": analytics["daily"],
        "countries": analytics["countries"],
        "window_days": days,
        "is_featured": feat_days_left > 0,
        "featured_days_left": feat_days_left,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ── HTML render ────────────────────────────────────────────────────────
def render_wrap_up_email_html(payload: Dict[str, Any]) -> str:
    """Single-column, dark-mode-friendly email. Cyan / fuchsia accents
    match the in-app analytics dashboard."""
    s = payload["summary"]
    daily = payload["daily"]
    countries = payload["countries"][:3]
    is_feat = payload["is_featured"]
    days_left = payload["featured_days_left"]

    # Tiny inline sparkline using a bar chart of 7 colored rectangles.
    max_min = max((d["minutes_viewed"] for d in daily), default=1) or 1
    bars_html = ""
    for d in daily[-7:]:
        h = max(4, int((d["minutes_viewed"] / max_min) * 60))
        bars_html += (
            f'<td style="padding:0 4px;vertical-align:bottom;">'
            f'<div style="height:{h}px;width:24px;background:linear-gradient(180deg,#22d3ee,#a855f7);'
            f'border-radius:4px 4px 0 0;"></div>'
            f'<div style="font-size:9px;color:#67e8f9;margin-top:4px;font-family:monospace;">'
            f'{d["date"][-5:]}</div></td>'
        )
    if not bars_html:
        bars_html = (
            '<td style="padding:24px 8px;color:#67e8f9;font-family:monospace;font-size:12px;">'
            'No viewers yet this week — share your stream link to populate this chart!'
            '</td>'
        )

    country_rows = ""
    for c in countries:
        country_rows += (
            f'<tr><td style="padding:6px 0;font-family:monospace;color:#f0abfc;">'
            f'{c["country"]}</td>'
            f'<td style="padding:6px 0;text-align:right;font-family:monospace;color:#fff;">'
            f'{int(c["minutes_viewed"]):,} min</td></tr>'
        )
    if not country_rows:
        country_rows = (
            '<tr><td style="padding:6px 0;color:#67e8f9;font-family:monospace;font-size:11px;">'
            'No geo data yet — viewers will populate this map soon</td></tr>'
        )

    feat_cta = (
        f'<div style="background:linear-gradient(90deg,#f59e0b,#fbbf24);color:#000;'
        f'padding:14px 18px;border-radius:14px;text-align:center;margin:20px 0;'
        f'font-family:monospace;font-weight:900;">'
        f'⭐ You\'re Featured! {days_left} day{"s" if days_left != 1 else ""} left on the Live Now Wall.'
        f'</div>'
        if is_feat else
        f'<div style="background:#1e1b2e;border:1px solid rgba(251,191,36,0.4);'
        f'border-radius:14px;padding:14px 18px;margin:20px 0;text-align:center;">'
        f'<div style="color:#fbbf24;font-family:monospace;font-weight:900;letter-spacing:2px;'
        f'text-transform:uppercase;font-size:11px;margin-bottom:8px;">Want bigger numbers?</div>'
        f'<div style="color:#fde68a;font-family:monospace;font-size:12px;line-height:1.5;">'
        f'Get your stream pinned to the top of the Live Now Wall with a glowing ★ badge. '
        f'<strong>$5 / 30 days.</strong></div>'
        f'<a href="https://globalvibezdsg.com/streamer/studio" '
        f'style="display:inline-block;margin-top:10px;background:#fbbf24;color:#000;'
        f'text-decoration:none;padding:8px 16px;border-radius:999px;font-family:monospace;'
        f'font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:2px;">'
        f'Get Featured</a></div>'
    )

    return f"""<!doctype html>
<html><body style="margin:0;background:#070012;font-family:'Helvetica Neue',sans-serif;color:#e5e7eb;">
<div style="max-width:560px;margin:0 auto;padding:24px;">
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-family:monospace;letter-spacing:4px;color:#67e8f9;font-size:11px;text-transform:uppercase;">
      Global Vibez DSG · Stream Wrap-Up
    </div>
    <h1 style="margin:8px 0 0;color:#fff;font-size:26px;letter-spacing:-0.5px;">
      Hey {payload['display_name']} 👋
    </h1>
    <p style="color:#a5b4fc;font-size:13px;margin-top:6px;">
      Here's how <strong style="color:#fff;">{payload['stream_name']}</strong> performed this past week.
    </p>
  </div>

  <!-- KPI cards -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;">
    <tr>
      <td width="33%" style="padding:6px;">
        <div style="background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.4);
        border-radius:14px;padding:14px;text-align:center;">
          <div style="font-size:10px;color:#67e8f9;letter-spacing:2px;text-transform:uppercase;">Minutes</div>
          <div style="font-size:28px;color:#fff;font-weight:900;font-family:monospace;margin-top:4px;">
            {int(s['total_minutes_viewed']):,}</div>
        </div>
      </td>
      <td width="33%" style="padding:6px;">
        <div style="background:rgba(232,121,249,0.1);border:1px solid rgba(232,121,249,0.4);
        border-radius:14px;padding:14px;text-align:center;">
          <div style="font-size:10px;color:#f0abfc;letter-spacing:2px;text-transform:uppercase;">Active Days</div>
          <div style="font-size:28px;color:#fff;font-weight:900;font-family:monospace;margin-top:4px;">
            {s['unique_viewer_days']} / {payload['window_days']}</div>
        </div>
      </td>
      <td width="34%" style="padding:6px;">
        <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.4);
        border-radius:14px;padding:14px;text-align:center;">
          <div style="font-size:10px;color:#fbbf24;letter-spacing:2px;text-transform:uppercase;">Top Country</div>
          <div style="font-size:20px;color:#fff;font-weight:900;font-family:monospace;margin-top:8px;">
            {s.get('top_country') or '—'}</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- Sparkline -->
  <div style="background:rgba(34,211,238,0.05);border:1px solid rgba(34,211,238,0.2);
  border-radius:14px;padding:16px;margin:16px 0;">
    <div style="font-size:11px;color:#67e8f9;letter-spacing:2px;text-transform:uppercase;
    font-family:monospace;margin-bottom:12px;">Daily minutes viewed</div>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
      <tr>{bars_html}</tr>
    </table>
  </div>

  <!-- Countries -->
  <div style="background:rgba(232,121,249,0.05);border:1px solid rgba(232,121,249,0.2);
  border-radius:14px;padding:16px;margin:16px 0;">
    <div style="font-size:11px;color:#f0abfc;letter-spacing:2px;text-transform:uppercase;
    font-family:monospace;margin-bottom:8px;">Top audience countries</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      {country_rows}
    </table>
  </div>

  {feat_cta}

  <div style="text-align:center;margin:24px 0;">
    <a href="https://globalvibezdsg.com/streamer/analytics" style="background:linear-gradient(90deg,#22d3ee,#a855f7);
    color:#000;text-decoration:none;padding:12px 24px;border-radius:999px;font-family:monospace;
    font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:3px;">
      Open Full Dashboard
    </a>
  </div>

  <p style="font-size:10px;color:#6b7280;text-align:center;margin-top:32px;line-height:1.6;">
    You're receiving this because you have a live input provisioned on Global Vibez DSG.
    <br/><a href="https://globalvibezdsg.com/streamer/studio" style="color:#67e8f9;">Manage your stream</a>
    · Wrap-ups go out every Monday at 09:00 UTC.
  </p>
</div>
</body></html>"""


# ── Dispatch (single streamer) ─────────────────────────────────────────
async def dispatch_one_wrap_up(db, streamer_id: str) -> Dict[str, Any]:
    """Send a wrap-up to a single streamer (used by the per-user
    preview endpoint and looped from the weekly dispatcher)."""
    payload = await compute_streamer_wrap_up(db, streamer_id, days=7)
    if not payload:
        return {"ok": False, "skipped": True, "reason": "no live input"}
    if not payload.get("email"):
        return {"ok": False, "skipped": True, "reason": "no email on file"}

    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("RESEND_SENDER_EMAIL", "support@globalvibezdsg.com")
    if not api_key:
        return {"ok": False, "error": "RESEND_API_KEY missing"}

    try:
        import resend  # noqa: PLC0415
        resend.api_key = api_key
        html = render_wrap_up_email_html(payload)
        s = payload["summary"]
        subject = (
            f"📊 Your Vibez Stream Wrap-Up · "
            f"{int(s['total_minutes_viewed']):,} min viewed this week"
        )
        params = {
            "from": sender,
            "to": [payload["email"]],
            "subject": subject,
            "html": html,
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        msg_id = result.get("id") if isinstance(result, dict) else result
        return {
            "ok": True,
            "email": payload["email"],
            "streamer_id": streamer_id,
            "message_id": msg_id,
            "minutes_viewed": s["total_minutes_viewed"],
        }
    except Exception as e:
        logger.error("Wrap-up send failed for %s: %s", streamer_id, e)
        return {"ok": False, "error": str(e)}


# ── Dispatch (every streamer with a live input) ────────────────────────
async def dispatch_weekly_wrap_ups(db) -> Dict[str, Any]:
    """Loop every streamer with a provisioned live input + email-on-file.
    Returns a structured summary; audits to `streamer_wrap_up_runs`."""
    iso_week = datetime.now(timezone.utc).strftime("%G-W%V")
    # Idempotency: skip if we already dispatched this ISO week.
    prior = await db.streamer_wrap_up_runs.find_one(
        {"iso_week": iso_week, "ok": True}, {"_id": 0},
    )
    if prior:
        return {"ok": True, "skipped": True, "iso_week": iso_week, "reason": "already dispatched this week"}

    streamer_ids: List[str] = []
    async for d in db.cf_live_inputs.find(
        {"is_deleted": {"$ne": True}}, {"_id": 0, "streamer_id": 1},
    ):
        sid = d.get("streamer_id")
        if sid and sid not in streamer_ids:
            streamer_ids.append(sid)

    sent: List[str] = []
    skipped: List[str] = []
    failed: List[str] = []
    for sid in streamer_ids:
        res = await dispatch_one_wrap_up(db, sid)
        if res.get("ok"):
            sent.append(sid)
        elif res.get("skipped"):
            skipped.append(sid)
        else:
            failed.append(sid)
        # Stay under Resend's 10 req/s rate limit.
        await asyncio.sleep(0.12)

    audit = {
        "run_id": f"wrapup_{int(datetime.now(timezone.utc).timestamp())}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "iso_week": iso_week,
        "total_streamers": len(streamer_ids),
        "sent_count": len(sent),
        "skipped_count": len(skipped),
        "failed_count": len(failed),
        "ok": True,
    }
    try:
        await db.streamer_wrap_up_runs.insert_one(dict(audit))
    except Exception as e:
        logger.warning("wrap-up audit insert skipped: %s", e)
    return audit


# ── Auto-dispatch loop ─────────────────────────────────────────────────
async def streamer_wrap_up_loop(get_db) -> None:
    """Fire-and-forget loop. Ticks every 30 min; runs the dispatch when
    it's Monday 09:00-09:30 UTC. Idempotent via the audit collection
    (`dispatch_weekly_wrap_ups` checks for a prior run this ISO week)."""
    logger.info("streamer_wrap_up_loop started")
    while True:
        try:
            now = datetime.now(timezone.utc)
            if now.weekday() == 0 and now.hour == WRAP_UP_HOUR_UTC:
                db = get_db()
                if db is not None:
                    res = await dispatch_weekly_wrap_ups(db)
                    logger.info("Streamer wrap-ups dispatched: %s", res)
        except Exception as e:
            logger.error("streamer_wrap_up_loop tick error: %s", e)
        await asyncio.sleep(30 * 60)
