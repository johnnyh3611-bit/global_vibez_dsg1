"""
GET /api/integrations/health — public (no secrets) readiness for third-party wiring.

Surfaces which launch integrations are configured so ops can finish Railway
env vars without digging through code. Never returns secret values.
"""
from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter

router = APIRouter(tags=["integrations"])


def _present(*names: str) -> bool:
    return all(bool(os.environ.get(n)) for n in names)


@router.get("/integrations/health")
async def integrations_health() -> Dict[str, Any]:
    from services.helio_client import helio_status

    agora = {
        "configured": _present("AGORA_APP_ID", "AGORA_APP_CERTIFICATE"),
        "purpose": "In-app voice/video (Vibe Phone)",
    }
    solana = {
        "configured": bool(
            os.environ.get("GLOBAL_VIBEZ_SOLANA_RECEIVE_WALLET")
            or os.environ.get("SOLANA_RECEIVE_WALLET")
        ),
        "purpose": "SOL deposit top-up + memo credit",
    }
    helio = {
        **helio_status(),
        "purpose": "Fiat (card) → crypto checkout for coin packs (Stripe alternative)",
    }
    resend = {
        "configured": _present("RESEND_API_KEY"),
        "sender_present": bool(os.environ.get("RESEND_SENDER_EMAIL")),
        "purpose": "Transactional email (password reset, digests)",
    }
    llm = {
        "configured": bool(
            os.environ.get("GEMINI_API_KEY")
            or os.environ.get("GOOGLE_API_KEY")
            or os.environ.get("EMERGENT_LLM_KEY")
        ),
        "purpose": "AI date planner, coaches, content matching, practice (Gemini)",
        "provider": "gemini",
        "set": "GEMINI_API_KEY",
        "get_key": "https://aistudio.google.com/apikey",
    }
    openai_audio = {
        "configured": bool(os.environ.get("OPENAI_API_KEY")),
        "purpose": "Voice Mirror + Voice Coach Whisper STT / OpenAI TTS",
        "provider": "openai",
        "set": "OPENAI_API_KEY",
        "get_key": "https://platform.openai.com/api-keys",
    }
    twilio = {
        "configured": _present("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"),
        "optional": True,
        "purpose": "Optional PSTN / SMS (not required for in-app Vibe Phone)",
    }
    stripe = {
        "configured": bool(
            os.environ.get("STRIPE_API_KEY")
            or os.environ.get("STRIPE_SECRET_KEY")
        ),
        "optional": True,
        "purpose": "Legacy card checkout (de-emphasized; prefer Solana / Helio)",
    }
    cloudflare_stream = {
        "configured": _present("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"),
        "subdomain_present": bool(os.environ.get("CLOUDFLARE_STREAM_SUBDOMAIN")),
        "purpose": "DSG TV / streamer live ingest (RTMPS) → HLS playback",
        "set": "CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_STREAM_SUBDOMAIN",
        "docs": "https://developers.cloudflare.com/stream/stream-live/",
        "status_path": "/api/streaming/cloudflare/status",
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
        "stripe_legacy": stripe,
    }
    # Required launch rails only — optional/legacy keys must not ding ready_count.
    required = {
        k: v
        for k, v in services.items()
        if not v.get("optional")
    }
    ready = sum(1 for s in required.values() if s.get("configured"))
    notes = [
        "In-app calling uses Agora — Twilio PSTN is optional.",
        "Coin top-up preferred order: Solana deposit → Helio card → Stripe legacy.",
        "Stripe is optional/legacy and excluded from ready_count.",
    ]
    if not helio.get("configured"):
        notes.append("Set HELIO_* on Railway to enable Helio pack checkout.")
    if not cloudflare_stream.get("configured"):
        notes.append(
            "DSG TV live needs Cloudflare Stream vars — until set, "
            "/api/streaming/cloudflare/* runs in stub mode."
        )
    if not openai_audio.get("configured"):
        notes.append("Set OPENAI_API_KEY on Railway for Voice Mirror STT/TTS.")

    return {
        "ok": ready == len(required),
        "ready_count": ready,
        "total": len(required),
        "optional_count": sum(
            1 for s in services.values() if s.get("optional")
        ),
        "services": services,
        "notes": notes,
    }
