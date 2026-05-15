"""Cloudflare Stream — Live Clipping helper for AI Scout auto-clips.

Cuts a fixed-length clip from a currently-recording live input using
Cloudflare's Live Clipping endpoint:

    POST /accounts/{account_id}/stream/live_inputs/{input_id}/clip
    body: { "duration": 30 }

Returns the spawned video UID + HLS playback URL on success. When CF
credentials are missing (preview env), gracefully no-ops so the AI Scout
ingest endpoint still works — the clip metadata gets recorded, the
`playback_url` field stays None, and the founder can wire credentials
later without code changes.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

CF_API_BASE = "https://api.cloudflare.com/client/v4"


def _cf_cfg() -> Dict[str, Optional[str]]:
    return {
        "account_id": os.environ.get("CLOUDFLARE_ACCOUNT_ID"),
        "api_token": os.environ.get("CLOUDFLARE_API_TOKEN"),
        "subdomain": os.environ.get("CLOUDFLARE_STREAM_SUBDOMAIN"),
    }


def _hls_url(uid: str) -> Optional[str]:
    sub = _cf_cfg()["subdomain"]
    if not sub or not uid:
        return None
    return f"https://{sub}/{uid}/manifest/video.m3u8"


async def clip_live_input(
    input_id: str,
    duration_seconds: int = 30,
) -> Dict[str, Any]:
    """Issue a clip request to Cloudflare Stream. Returns a dict shaped:

        {ok: bool, clip_uid: str|None, hls_url: str|None,
         duration_seconds: int, reason: str|None}

    Never raises — failures degrade to ``{ok: False, reason: ...}``
    so the AI Scout pipeline keeps recording metadata even when CF is
    misconfigured.
    """
    cfg = _cf_cfg()
    if not cfg["api_token"] or not cfg["account_id"]:
        return {
            "ok": False,
            "clip_uid": None,
            "hls_url": None,
            "duration_seconds": duration_seconds,
            "reason": "cf_not_configured",
        }
    # Stub live inputs created in preview mode start with `stub_` — skip
    # the API call so we don't burn quota on synthetic IDs.
    if input_id.startswith("stub_"):
        return {
            "ok": False,
            "clip_uid": None,
            "hls_url": None,
            "duration_seconds": duration_seconds,
            "reason": "stub_input",
        }
    url = f"{CF_API_BASE}/accounts/{cfg['account_id']}/stream/live_inputs/{input_id}/clip"
    headers = {
        "Authorization": f"Bearer {cfg['api_token']}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json={"duration": int(duration_seconds)})
    except Exception as e:
        logger.warning("clip_live_input(%s) network error: %s", input_id, e)
        return {
            "ok": False,
            "clip_uid": None,
            "hls_url": None,
            "duration_seconds": duration_seconds,
            "reason": f"network_error: {e}",
        }
    try:
        data = resp.json()
    except Exception:
        return {
            "ok": False, "clip_uid": None, "hls_url": None,
            "duration_seconds": duration_seconds, "reason": resp.text[:200],
        }
    if not data.get("success"):
        errs = (data.get("errors") or [{}])[0]
        return {
            "ok": False, "clip_uid": None, "hls_url": None,
            "duration_seconds": duration_seconds,
            "reason": f"cf_error: {errs.get('message')}",
        }
    clip_uid = (data.get("result") or {}).get("uid")
    return {
        "ok": True,
        "clip_uid": clip_uid,
        "hls_url": _hls_url(clip_uid),
        "duration_seconds": duration_seconds,
        "reason": None,
    }
