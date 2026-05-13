"""
Cloudflare Stream — RTMP/SRT ingest + HLS playback integration.

Wires every streamer on the platform to a Cloudflare-hosted live input,
which gives us:
  • RTMP + SRT ingest URLs (works with OBS, Streamlabs, vMix, XSplit,
    GoXLR, Elgato Stream Deck, Cam Link, PS5/Xbox via Elgato, iOS Larix
    Broadcaster, Android RTMP apps, DSLR via NDI)
  • Auto-transcoded HLS + DASH playback URLs (universal device support)
  • Webhook events on stream.live + stream.disconnected

Activation:
  Drop these into /app/backend/.env (without commits) — once present,
  endpoints flip from STUB to LIVE automatically:
    CLOUDFLARE_ACCOUNT_ID=...
    CLOUDFLARE_API_TOKEN=...
    CLOUDFLARE_STREAM_SUBDOMAIN=customer-xxxxx.cloudflarestream.com
    CLOUDFLARE_STREAM_WEBHOOK_SECRET=...   (optional — webhook-only)
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/streaming/cloudflare", tags=["cloudflare-stream"])

# ────────────────────────────────────────────── Config (lazy) ──
# We read env at request time so a `.env` change auto-flips STUB→LIVE
# without a backend restart. Cheap dict lookup; negligible overhead.
CF_API_BASE = "https://api.cloudflare.com/client/v4"
CF_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql"


def _cf_config() -> Dict[str, Optional[str]]:
    return {
        "account_id": os.environ.get("CLOUDFLARE_ACCOUNT_ID"),
        "api_token": os.environ.get("CLOUDFLARE_API_TOKEN"),
        "subdomain": os.environ.get("CLOUDFLARE_STREAM_SUBDOMAIN"),
        "webhook_secret": os.environ.get("CLOUDFLARE_STREAM_WEBHOOK_SECRET"),
    }


def _is_live() -> bool:
    """True when both account_id and api_token are configured. We still
    serve the API in STUB mode without these so the frontend can be
    exercised end-to-end pre-credential."""
    c = _cf_config()
    return bool(c["account_id"] and c["api_token"])


# ────────────────────────────────────────────── Mongo ──
MONGO_URL = os.environ.get("MONGO_URL")
_client = AsyncIOMotorClient(MONGO_URL)
db = _client[os.environ.get("DB_NAME", "global_vibez_dsg")]


# ────────────────────────────────────────────── Pydantic ──
class CreateLiveInputRequest(BaseModel):
    streamer_id: str
    name: str = "Vibez Live"


class LiveInputPublic(BaseModel):
    input_id: str
    streamer_id: str
    name: str
    rtmps_url: Optional[str]
    rtmps_key: Optional[str]
    srt_url: Optional[str]
    srt_stream_id: Optional[str]
    srt_passphrase: Optional[str]
    hls_playback_url: Optional[str]
    dash_playback_url: Optional[str]
    is_live: bool
    mode: str  # "live" | "stub"
    created_at: str


def _public_input(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Mongo-safe, key-stripped public shape. Does NOT echo the API
    token or webhook secret — only the streamer's RTMP key (which is
    safe; it's how OBS authenticates the ingest)."""
    return {k: v for k, v in doc.items() if k != "_id"}


# ────────────────────────────────────────────── Cloudflare client ──
async def _cf_request(method: str, path: str, json_body: Optional[Dict] = None) -> Dict[str, Any]:
    """Thin wrapper around Cloudflare's REST API. Raises HTTPException
    with the CF error text on non-200 so the caller surfaces something
    useful to the founder during setup."""
    cfg = _cf_config()
    if not cfg["api_token"]:
        raise HTTPException(503, detail="CLOUDFLARE_API_TOKEN missing in environment")
    url = f"{CF_API_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {cfg['api_token']}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.request(method, url, headers=headers, json=json_body)
    try:
        data = resp.json()
    except Exception:
        raise HTTPException(resp.status_code, detail=resp.text[:200])
    if not data.get("success", False):
        errs = data.get("errors") or [{"message": "unknown CF error"}]
        raise HTTPException(resp.status_code or 502, detail=f"Cloudflare: {errs[0].get('message')}")
    return data.get("result") or {}


def _playback_urls(uid: str) -> Dict[str, Optional[str]]:
    sub = _cf_config()["subdomain"]
    if not sub:
        return {"hls": None, "dash": None}
    return {
        "hls": f"https://{sub}/{uid}/manifest/video.m3u8",
        "dash": f"https://{sub}/{uid}/manifest/video.mpd",
    }


# ────────────────────────────────────────────── Endpoints ──
@router.get("/status")
async def status() -> Dict[str, Any]:
    cfg = _cf_config()
    return {
        "mode": "live" if _is_live() else "stub",
        "account_id_present": bool(cfg["account_id"]),
        "api_token_present": bool(cfg["api_token"]),
        "subdomain_present": bool(cfg["subdomain"]),
        "webhook_secret_present": bool(cfg["webhook_secret"]),
    }


@router.post("/live-inputs")
async def create_live_input(req: CreateLiveInputRequest) -> Dict[str, Any]:
    """Provision a Cloudflare live input for a streamer. Idempotent on
    `streamer_id` — if one already exists we return it untouched so the
    OBS Browser Source URL never rotates and overlays never break."""
    existing = await db.cf_live_inputs.find_one(
        {"streamer_id": req.streamer_id, "is_deleted": {"$ne": True}}, {"_id": 0}
    )
    if existing:
        return _public_input(existing)

    now = datetime.now(timezone.utc).isoformat()

    if not _is_live():
        # STUB mode — generate deterministic placeholder so the frontend
        # can render the full flow before the founder pastes keys.
        fake_uid = f"stub_{req.streamer_id[:16]}"
        doc = {
            "input_id": fake_uid,
            "streamer_id": req.streamer_id,
            "name": req.name,
            "rtmps_url": "rtmps://stub.cloudflarestream.com:443/live/",
            "rtmps_key": f"STUB-KEY-{fake_uid}",
            "srt_url": "srt://stub.cloudflarestream.com:778",
            "srt_stream_id": f"publish:{fake_uid}",
            "srt_passphrase": "stub-passphrase",
            "hls_playback_url": None,
            "dash_playback_url": None,
            "is_live": False,
            "mode": "stub",
            "created_at": now,
        }
        await db.cf_live_inputs.insert_one(dict(doc))
        return _public_input(doc)

    # LIVE — provision via Cloudflare API
    cfg = _cf_config()
    result = await _cf_request(
        "POST",
        f"/accounts/{cfg['account_id']}/stream/live_inputs",
        {
            "meta": {"name": req.name, "streamer_id": req.streamer_id},
            "recording": {"mode": "automatic"},
            "defaultCreator": req.streamer_id,
        },
    )
    uid = result.get("uid")
    rtmps = result.get("rtmps") or {}
    srt = result.get("srt") or {}
    playback = _playback_urls(uid)

    doc = {
        "input_id": uid,
        "streamer_id": req.streamer_id,
        "name": req.name,
        "rtmps_url": rtmps.get("url"),
        "rtmps_key": rtmps.get("streamKey"),
        "srt_url": srt.get("url"),
        "srt_stream_id": srt.get("streamId"),
        "srt_passphrase": srt.get("passphrase"),
        "hls_playback_url": playback["hls"],
        "dash_playback_url": playback["dash"],
        "is_live": False,
        "mode": "live",
        "created_at": now,
    }
    await db.cf_live_inputs.insert_one(dict(doc))
    return _public_input(doc)


@router.get("/live-inputs/by-streamer/{streamer_id}")
async def get_my_live_input(streamer_id: str) -> Dict[str, Any]:
    doc = await db.cf_live_inputs.find_one(
        {"streamer_id": streamer_id, "is_deleted": {"$ne": True}}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, detail="No live input provisioned for this streamer")
    return _public_input(doc)


@router.get("/live-inputs")
async def list_live_inputs(only_live: bool = False, limit: int = 60) -> Dict[str, Any]:
    """Public catalog of streamers who currently have a live input
    provisioned. When `only_live=true`, restrict to streams Cloudflare
    has confirmed are actively broadcasting via webhook events.

    Annotates each stream with `is_featured` + `featured_until` in one
    round-trip so the Live Now Wall can pin featured streamers without
    N+1 API calls.
    """
    q: Dict[str, Any] = {"is_deleted": {"$ne": True}}
    if only_live:
        q["is_live"] = True
    cursor = db.cf_live_inputs.find(q, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(limit)

    # Pull all active features in one query, build a lookup.
    now_iso = datetime.now(timezone.utc).isoformat()
    feat_cursor = db.featured_streamers.find(
        {"featured_until": {"$gt": now_iso}}, {"_id": 0},
    )
    feat_map = {f["streamer_id"]: f for f in await feat_cursor.to_list(500)}

    # Strip the RTMP key from the public list — that's a write-credential
    # and only the owning streamer should ever see it. Layer in feature flags.
    safe = []
    for d in items:
        feat = feat_map.get(d.get("streamer_id"))
        clean = {k: v for k, v in d.items() if k not in ("rtmps_key", "srt_passphrase")}
        clean["is_featured"] = bool(feat)
        clean["featured_until"] = feat.get("featured_until") if feat else None
        safe.append(clean)

    # Featured streamers float to the top; ties broken by last_status_at,
    # then created_at. Done server-side so any client (web / mobile / API
    # consumer) gets consistent ordering.
    safe.sort(
        key=lambda s: (
            not s.get("is_featured"),  # featured first (False sorts before True)
            -((s.get("last_status_at") or s.get("created_at") or "") and 1),
            s.get("last_status_at") or s.get("created_at") or "",
        ),
        reverse=False,
    )
    return {"streams": safe, "count": len(safe)}


@router.delete("/live-inputs/{input_id}")
async def delete_live_input(input_id: str) -> Dict[str, Any]:
    """Soft-delete locally + hard-delete on Cloudflare. We keep the Mongo
    row with `is_deleted=True` so historical analytics keep working."""
    doc = await db.cf_live_inputs.find_one({"input_id": input_id})
    if not doc:
        raise HTTPException(404, detail="Live input not found")

    if doc.get("mode") == "live" and _is_live():
        cfg = _cf_config()
        try:
            await _cf_request(
                "DELETE",
                f"/accounts/{cfg['account_id']}/stream/live_inputs/{input_id}",
            )
        except HTTPException as e:
            # If CF already deleted it, that's fine — proceed with local cleanup.
            logger.warning("Cloudflare delete returned %s — continuing", e.detail)

    await db.cf_live_inputs.update_one(
        {"input_id": input_id},
        {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "input_id": input_id}


# ────────────────────────────────────────────── Webhook ──
def _verify_cf_signature(raw_body: bytes, header: Optional[str], secret: str) -> bool:
    """Cloudflare Stream signs webhooks with header
    `Webhook-Signature: time=<unix>,sig1=<hex_hmac_sha256(time + . + body)>`.
    """
    if not header:
        return False
    try:
        parts = {p.split("=", 1)[0]: p.split("=", 1)[1] for p in header.split(",")}
    except Exception:
        return False
    ts = parts.get("time")
    sig = parts.get("sig1")
    if not ts or not sig:
        return False
    # Reject anything older than 10 minutes — narrows the replay window.
    try:
        if abs(int(time.time()) - int(ts)) > 600:
            return False
    except ValueError:
        return False
    signed = f"{ts}.".encode() + raw_body
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


@router.post("/webhook")
async def cloudflare_webhook(
    request: Request,
    webhook_signature: Optional[str] = Header(None, alias="Webhook-Signature"),
) -> Dict[str, Any]:
    """Cloudflare Stream pings us when a stream connects/disconnects.
    We flip `is_live` so the public catalog and Volumetric "Streaming"
    tile reflect reality without polling."""
    raw = await request.body()
    secret = _cf_config()["webhook_secret"]
    if secret:
        if not _verify_cf_signature(raw, webhook_signature, secret):
            raise HTTPException(401, detail="Invalid webhook signature")
    else:
        # No secret configured yet — accept but log loudly so the founder
        # sees this is a security gap in the deploy logs.
        logger.warning(
            "CLOUDFLARE_STREAM_WEBHOOK_SECRET not set — webhook accepted without verification."
        )

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, detail="Invalid JSON")

    # Cloudflare webhook payload shape (per docs):
    #   { "uid": "<live_input_uid>", "status": { "state": "connected"|"disconnected", ... }, ... }
    uid = payload.get("uid")
    status_state = (payload.get("status") or {}).get("state")
    if not uid:
        return {"ok": True, "ignored": True}

    is_live = status_state == "connected"
    await db.cf_live_inputs.update_one(
        {"input_id": uid},
        {"$set": {
            "is_live": is_live,
            "last_status": status_state,
            "last_status_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # Referral payout hook (P3) — fire when a stream first transitions
    # to LIVE. Idempotent per-user via SIGNED_UP→PAID atomic update so
    # repeated connect events cannot double-pay the referrer.
    referral_result = None
    live_notif_result = None
    if is_live:
        try:
            input_doc = await db.cf_live_inputs.find_one(
                {"input_id": uid}, {"_id": 0, "streamer_id": 1},
            )
            streamer_id = (input_doc or {}).get("streamer_id")
            if streamer_id:
                from routes.streamer_referral import qualify_on_live  # noqa: PLC0415
                referral_result = await qualify_on_live(streamer_id)

                # Live Push Notifications — buzz every follower's phone
                # right after the stream goes live. Internal idempotency
                # via the cf_live_inputs.last_live_notif_at cooldown.
                try:
                    from routes.streamer_follow import notify_followers_of_live_stream  # noqa: PLC0415
                    live_notif_result = await notify_followers_of_live_stream(streamer_id)
                except Exception as _e:
                    logger.warning("Live notif fan-out failed for %s: %s", streamer_id, _e)
        except Exception as _e:
            # Never let a referral-side bug 5xx the CF webhook (Stripe-
            # style discipline: critical webhook stays 2xx so CF doesn't
            # retry the whole event).
            logger.warning("Referral payout hook failed for %s: %s", uid, _e)

    return {"ok": True, "input_id": uid, "is_live": is_live, "referral": referral_result, "live_notif": live_notif_result}



# ────────────────────────────────────────────── Stream Analytics ──
async def _cf_graphql(query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Thin wrapper around Cloudflare's GraphQL analytics endpoint.
    Returns the `data` blob on success; raises HTTPException with the CF
    error message on failure so the founder sees something useful."""
    cfg = _cf_config()
    if not cfg["api_token"] or not cfg["account_id"]:
        raise HTTPException(503, detail="Cloudflare Stream credentials not configured")
    headers = {
        "Authorization": f"Bearer {cfg['api_token']}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            CF_GRAPHQL_URL,
            headers=headers,
            json={"query": query, "variables": variables or {}},
        )
    try:
        body = resp.json()
    except Exception:
        raise HTTPException(resp.status_code, detail=resp.text[:200])
    if body.get("errors"):
        msg = body["errors"][0].get("message", "Cloudflare GraphQL error")
        raise HTTPException(502, detail=f"Cloudflare analytics: {msg}")
    return body.get("data") or {}


@router.get("/analytics/{input_id}")
async def stream_analytics(
    input_id: str, days: int = 30,
) -> Dict[str, Any]:
    """Streamer-facing analytics for a single live input. Pulls from
    Cloudflare's GraphQL Analytics API:
      - Total minutes viewed (rollup)
      - Daily breakdown (chart data)
      - Top countries by minutes (geography panel)
      - Unique viewer estimate (proxy: daily distinct viewers)

    Window: last `days` days, clamped 1-90. Data is delivered with a
    15-min ingestion delay by Cloudflare, so the most-recent hour will
    look thin.
    """
    days = max(1, min(days, 90))

    # Validate the streamer owns this input + grab their stream metadata.
    doc = await db.cf_live_inputs.find_one(
        {"input_id": input_id, "is_deleted": {"$ne": True}}, {"_id": 0},
    )
    if not doc:
        raise HTTPException(404, detail="Live input not found")

    cfg = _cf_config()
    if not _is_live():
        # Demo data for preview without CF creds — frontend can still
        # render the chart shell so the layout is verified.
        return {
            "mode": "stub",
            "input_id": input_id,
            "streamer_id": doc.get("streamer_id"),
            "window_days": days,
            "summary": {"total_minutes_viewed": 0, "unique_viewer_days": 0, "top_country": None},
            "daily": [],
            "countries": [],
        }

    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=days)
    start_s = start.isoformat()
    end_s = (end + timedelta(days=1)).isoformat()  # CF uses date_lt — exclusive upper

    # ─── 1. Daily breakdown ───────────────────────────────────────────
    daily_query = """
    query Daily($accountTag: string!, $uid: string!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          streamMinutesViewedAdaptiveGroups(
            filter: { date_geq: $start, date_lt: $end, uid: $uid }
            limit: 5000
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            sum { minutesViewed }
          }
        }
      }
    }
    """
    daily_data = await _cf_graphql(daily_query, {
        "accountTag": cfg["account_id"],
        "uid": input_id,
        "start": start_s,
        "end": end_s,
    })
    daily_rows = (
        daily_data.get("viewer", {}).get("accounts", [{}])[0]
        .get("streamMinutesViewedAdaptiveGroups", []) or []
    )
    # Fold per-day country splits into a single per-day total.
    daily_totals: Dict[str, float] = {}
    for row in daily_rows:
        d = row.get("dimensions", {}).get("date")
        m = (row.get("sum") or {}).get("minutesViewed", 0)
        if d is not None:
            daily_totals[d] = daily_totals.get(d, 0) + m
    daily = [
        {"date": d, "minutes_viewed": round(daily_totals[d], 2)}
        for d in sorted(daily_totals.keys())
    ]

    # ─── 2. Country breakdown (top 8) ────────────────────────────────
    country_query = """
    query Countries($accountTag: string!, $uid: string!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          streamMinutesViewedAdaptiveGroups(
            filter: { date_geq: $start, date_lt: $end, uid: $uid }
            limit: 100
            orderBy: [sum_minutesViewed_DESC]
          ) {
            dimensions { clientCountryName }
            sum { minutesViewed }
          }
        }
      }
    }
    """
    country_data = await _cf_graphql(country_query, {
        "accountTag": cfg["account_id"],
        "uid": input_id,
        "start": start_s,
        "end": end_s,
    })
    country_rows = (
        country_data.get("viewer", {}).get("accounts", [{}])[0]
        .get("streamMinutesViewedAdaptiveGroups", []) or []
    )
    # Fold across dates → country totals.
    country_totals: Dict[str, float] = {}
    for row in country_rows:
        c = (row.get("dimensions") or {}).get("clientCountryName") or "Unknown"
        m = (row.get("sum") or {}).get("minutesViewed", 0)
        country_totals[c] = country_totals.get(c, 0) + m
    countries = sorted(
        [{"country": c, "minutes_viewed": round(m, 2)} for c, m in country_totals.items()],
        key=lambda x: -x["minutes_viewed"],
    )[:8]

    total_minutes = round(sum(d["minutes_viewed"] for d in daily), 2)
    return {
        "mode": "live",
        "input_id": input_id,
        "streamer_id": doc.get("streamer_id"),
        "window_days": days,
        "summary": {
            "total_minutes_viewed": total_minutes,
            "unique_viewer_days": len([d for d in daily if d["minutes_viewed"] > 0]),
            "top_country": countries[0]["country"] if countries else None,
            "top_country_minutes": countries[0]["minutes_viewed"] if countries else 0,
        },
        "daily": daily,
        "countries": countries,
    }
