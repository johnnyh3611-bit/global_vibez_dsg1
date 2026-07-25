"""
GET /api/integrations/health — public (no secrets) readiness for third-party wiring.

Single source of truth for runtime readiness:
  JWT secret strength, MongoDB connectivity, Gemini/OpenAI keys,
  Helio config, Socket.IO Redis adapter for multi-replica sync.

Never returns secret values. Card checkout is Helio only.
"""
from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter

router = APIRouter(tags=["integrations"])

_WEAK_JWT = {
    "",
    "change-me",
    "secret",
    "your-super-secret-jwt-key-change-in-production",
    "jwt-secret",
    "test-secret",
}


def _present(*names: str) -> bool:
    return all(bool((os.environ.get(n) or "").strip()) for n in names)


def _jwt_status() -> Dict[str, Any]:
    secret = (os.environ.get("JWT_SECRET") or "").strip()
    present = bool(secret)
    weak = (not present) or secret.lower() in _WEAK_JWT or len(secret) < 24
    return {
        "configured": present and not weak,
        "present": present,
        "weak_or_default": weak,
        "purpose": "Session / API JWT signing",
        "set": "JWT_SECRET",
    }


async def _mongo_status() -> Dict[str, Any]:
    url_present = bool((os.environ.get("MONGO_URL") or "").strip())
    db_name = (os.environ.get("DB_NAME") or "").strip() or "global_vibez"
    out: Dict[str, Any] = {
        "configured": False,
        "url_present": url_present,
        "db_name_set": bool((os.environ.get("DB_NAME") or "").strip()),
        "reachable": False,
        "purpose": "Primary application database",
        "db_name": db_name,
    }
    if not url_present:
        return out
    try:
        from utils.database import get_client  # noqa: PLC0415

        client = get_client()
        await client.admin.command("ping")
        out["reachable"] = True
        out["configured"] = True
    except Exception as exc:  # noqa: BLE001
        out["reachable"] = False
        out["configured"] = False
        out["error"] = str(exc)[:160]
    return out


@router.get("/integrations/health")
async def integrations_health() -> Dict[str, Any]:
    from services.helio_client import helio_status
    from utils.socketio_manager import socketio_adapter_status

    jwt = _jwt_status()
    mongo = await _mongo_status()
    socketio_redis = {
        **socketio_adapter_status(),
        "optional": True,
        "configured": socketio_adapter_status()["redis_url_present"],
    }

    agora = {
        "configured": _present("AGORA_APP_ID", "AGORA_APP_CERTIFICATE"),
        "purpose": "In-app voice/video (Vibe Phone)",
    }
    solana = {
        "configured": bool(
            (os.environ.get("GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET") or "").strip()
            or (os.environ.get("SOLANA_RECEIVE_WALLET") or "").strip()
        ),
        "purpose": "SOL deposit top-up + memo credit (primary coin rail)",
    }
    helio = {
        **helio_status(),
        "purpose": "Fiat (card) → crypto checkout for coin packs (Helio only · Beta)",
    }
    resend = {
        "configured": _present("RESEND_API_KEY"),
        "sender_present": bool((os.environ.get("RESEND_SENDER_EMAIL") or "").strip()),
        "purpose": "Transactional email (password reset, digests)",
    }
    llm = {
        "configured": bool(
            (os.environ.get("GEMINI_API_KEY") or "").strip()
            or (os.environ.get("GOOGLE_API_KEY") or "").strip()
            or (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
        ),
        "purpose": "AI date planner, coaches, content matching, practice (Gemini)",
        "provider": "gemini",
        "set": "GEMINI_API_KEY",
        "get_key": "https://aistudio.google.com/apikey",
    }
    openai_audio = {
        "configured": bool((os.environ.get("OPENAI_API_KEY") or "").strip()),
        "purpose": "Voice Mirror + Voice Coach Whisper STT / OpenAI TTS",
        "provider": "openai",
        "set": "OPENAI_API_KEY",
        "get_key": "https://platform.openai.com/api-keys",
    }
    twilio = {
        "configured": _present(
            "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"
        ),
        "optional": True,
        "purpose": "Optional PSTN / SMS (not required for in-app Vibe Phone)",
    }
    cloudflare_stream = {
        "configured": _present("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"),
        "subdomain_present": bool(
            (os.environ.get("CLOUDFLARE_STREAM_SUBDOMAIN") or "").strip()
        ),
        "purpose": "DSG TV / streamer live ingest (RTMPS) → HLS playback",
        "set": "CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_STREAM_SUBDOMAIN",
        "docs": "https://developers.cloudflare.com/stream/stream-live/",
        "status_path": "/api/streaming/cloudflare/status",
    }

    runtime = {
        "jwt": jwt,
        "mongodb": mongo,
        "socketio": socketio_redis,
    }

    services = {
        "agora": agora,
        "solana_deposit": solana,
        "helio": helio,
        "resend_email": resend,
        "ai_llm": llm,
        "openai_audio": openai_audio,
        "twilio": twilio,
        "cloudflare_stream": cloudflare_stream,
        "socketio_redis": socketio_redis,
    }
    required = {k: v for k, v in services.items() if not v.get("optional")}
    ready = sum(1 for s in required.values() if s.get("configured"))
    notes = [
        "In-app calling uses Agora — Twilio PSTN is optional.",
        "Coin top-up: Solana deposit (primary) → Helio card. Stripe is not used.",
        "Multi-replica Socket.IO requires REDIS_URL (python-socketio AsyncRedisManager).",
    ]
    if not jwt.get("configured"):
        notes.append("Set a strong JWT_SECRET (16+ chars, non-default) on Railway.")
    if not mongo.get("configured"):
        notes.append("MongoDB unreachable — API will 500 until MONGO_URL is live.")
    if not helio.get("configured"):
        notes.append("Set HELIO_* on Railway to enable Helio pack checkout.")
    if not socketio_redis.get("redis_url_present"):
        notes.append(
            "REDIS_URL unset — Socket.IO is single-replica only; set before scaling out."
        )
    if not cloudflare_stream.get("configured"):
        notes.append(
            "DSG TV live needs Cloudflare Stream vars — until set, "
            "/api/streaming/cloudflare/* runs in stub mode."
        )
    if not openai_audio.get("configured"):
        notes.append("Set OPENAI_API_KEY on Railway for Voice Mirror STT/TTS.")

    runtime_ok = bool(jwt.get("configured") and mongo.get("configured"))
    return {
        "ok": ready == len(required) and runtime_ok,
        "ready_count": ready,
        "total": len(required),
        "optional_count": sum(1 for s in services.values() if s.get("optional")),
        "runtime": runtime,
        "runtime_ok": runtime_ok,
        "services": services,
        "notes": notes,
        "card_provider": "helio",
    }
