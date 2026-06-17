"""
Voice Mirroring (Phase 3) — user choice 4(b): OpenAI stack via Emergent LLM Key only.

Pipeline per audio chunk (~2-4s clips):
    1. Whisper STT       → transcript + source language
    2. Claude translate  → target language text (reuses chat.translate_message)
    3. OpenAI TTS        → translated audio bytes

The client uploads WebM/Opus chunks via WebSocket. Returns TTS audio bytes
(MP3) plus metadata. The implementation uses the Emergent LLM Key so no
extra 3rd-party keys are required.

NOTE: Voice *cloning* (sender's specific voice) requires ElevenLabs. Not
used here per user direction. We use a deterministic voice per speaker
(mapped from user_id hash → one of OpenAI's 6 voices) so each user gets a
stable, recognizable translated voice — not their real cloned one.
"""
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import base64
import hashlib
import os
import secrets

from routes.chat import translate_message
from utils.database import get_database

router = APIRouter(prefix="/voice-mirror", tags=["voice-mirror"])

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
OPENAI_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]

# Display metadata for the voice picker UI.
VOICE_CATALOG: List[Dict[str, str]] = [
    {"id": "alloy", "label": "Alloy", "vibe": "Balanced · neutral"},
    {"id": "echo", "label": "Echo", "vibe": "Warm · low"},
    {"id": "fable", "label": "Fable", "vibe": "British · storyteller"},
    {"id": "onyx", "label": "Onyx", "vibe": "Deep · commanding"},
    {"id": "nova", "label": "Nova", "vibe": "Bright · upbeat"},
    {"id": "shimmer", "label": "Shimmer", "vibe": "Soft · soothing"},
]

# Quick-phrase packs for the (d) preset buttons. Each phrase is in English;
# translation happens per-request against the user's target language.
PHRASE_PACKS: Dict[str, Dict[str, Any]] = {
    "gaming": {
        "id": "gaming",
        "label": "Gaming",
        "emoji": "🎮",
        "phrases": [
            "Good game!",
            "Your turn.",
            "Nice play!",
            "I'm ready.",
            "One more round?",
            "Let's team up.",
            "Watch out!",
            "That was clutch.",
            "I need a break.",
            "Say 'gg' if you're in.",
        ],
    },
    "dating": {
        "id": "dating",
        "label": "Dating",
        "emoji": "💫",
        "phrases": [
            "You look amazing tonight.",
            "What's your favorite song?",
            "Can I get you a drink?",
            "I had a really great time.",
            "Want to do this again?",
            "Tell me more about you.",
            "Where are you from originally?",
            "What do you do for fun?",
            "I like your style.",
            "Can I have your number?",
        ],
    },
    "travel": {
        "id": "travel",
        "label": "Travel",
        "emoji": "🌍",
        "phrases": [
            "Where's the bathroom?",
            "How much does this cost?",
            "Can I have the menu, please?",
            "I don't speak the language well.",
            "Can you help me?",
            "Where's the nearest train station?",
            "Is there Wi-Fi here?",
            "Can I pay with card?",
            "I'm looking for my hotel.",
            "Thank you so much.",
        ],
    },
}


def _voice_for_user(user_id: str) -> str:
    """Deterministic default voice from user_id — each user gets a stable translated voice."""
    h = hashlib.sha256(user_id.encode()).digest()
    return OPENAI_VOICES[h[0] % len(OPENAI_VOICES)]


async def _get_preferred_voice(user_id: str, override: Optional[str] = None) -> str:
    """Resolve the voice for a user: explicit override > saved pref > deterministic default."""
    if override and override in OPENAI_VOICES:
        return override
    try:
        db = get_database()
        pref = await db.voice_mirror_prefs.find_one({"user_id": user_id}, {"_id": 0, "voice": 1})
        if pref and pref.get("voice") in OPENAI_VOICES:
            return pref["voice"]
    except Exception:
        pass
    return _voice_for_user(user_id)


async def _save_transcript(
    user_id: str,
    original: str,
    translated: str,
    source_lang: str,
    target_lang: str,
    voice: str,
    channel: str,  # "solo" | "pair" | "phrase"
    room_id: Optional[str] = None,
) -> None:
    """Persist a translation event for the user's history. Best-effort — never raises."""
    if not user_id or not (original or translated):
        return
    try:
        db = get_database()
        doc = {
            "entry_id": secrets.token_hex(8),
            "user_id": user_id,
            "original": original,
            "translated": translated,
            "source_lang": (source_lang or "").upper(),
            "target_lang": (target_lang or "").upper(),
            "voice": voice,
            "channel": channel,
            "room_id": room_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.voice_mirror_transcripts.insert_one(doc)
    except Exception:
        # History is best-effort; don't fail the main call.
        return


class TranscribePayload(BaseModel):
    audio_base64: str
    target_lang: str = "EN"
    user_id: str
    voice: Optional[str] = None


class SetVoicePayload(BaseModel):
    user_id: str
    voice: str


class SpeakPhrasePayload(BaseModel):
    user_id: str
    text: str
    target_lang: str = "EN"
    voice: Optional[str] = None


async def _whisper_stt(audio_bytes: bytes) -> Dict[str, Any]:
    """
    STT via OpenAI Whisper through the Emergent LLM Key gateway.
    Uses emergentintegrations.OpenAISpeechToText which routes through the
    Emergent proxy (https://integrations.emergentagent.com/llm) when the key
    starts with `sk-emergent-`.
    Returns {text, language}.
    """
    from io import BytesIO
    from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText

    stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
    buf = BytesIO(audio_bytes)
    buf.name = "clip.webm"  # litellm infers format from the filename suffix
    resp = await stt.transcribe(
        file=buf,
        model="whisper-1",
        response_format="verbose_json",
    )
    # Response may be a pydantic model, dict, or an object with .text / .language
    if isinstance(resp, dict):
        text = resp.get("text", "")
        lang = resp.get("language", "")
    else:
        text = getattr(resp, "text", "") or ""
        lang = getattr(resp, "language", "") or ""
    return {"text": text, "language": lang}


async def _openai_tts(text: str, voice: str) -> bytes:
    """
    TTS via OpenAI through the Emergent LLM Key gateway. Returns MP3 bytes.
    Uses emergentintegrations.OpenAITextToSpeech.
    """
    from emergentintegrations.llm.openai.text_to_speech import OpenAITextToSpeech

    tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
    # Safety: OpenAITextToSpeech only accepts its whitelisted voices; fall
    # back to 'nova' if the caller passed something unsupported (e.g. legacy
    # 'alloy-hd' or a gpt-4o-mini-tts-only voice like 'ballad').
    voice_safe = voice if voice in OpenAITextToSpeech.VOICES else "nova"
    return await tts.generate_speech(
        text=text,
        model="tts-1",
        voice=voice_safe,
        response_format="mp3",
    )


@router.post("/transcribe-and-translate")
async def transcribe_and_translate(payload: TranscribePayload) -> Dict[str, Any]:
    """
    REST one-shot: client sends base64 audio + target_lang → gets back
    translated text + base64-encoded translated MP3.
    """
    try:
        audio_bytes = base64.b64decode(payload.audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio")

    # 1. STT
    try:
        stt = await _whisper_stt(audio_bytes)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"STT failed: {e}")

    source_text = stt.get("text", "").strip()
    source_lang = stt.get("language", "")
    if not source_text:
        return {"original": "", "translated": "", "audio_base64": "", "source_lang": source_lang}

    # 2. Translate
    tr = await translate_message(source_text, payload.target_lang, source_hint=source_lang)

    # 3. TTS on translated text
    voice = await _get_preferred_voice(payload.user_id, payload.voice)
    try:
        audio_out = await _openai_tts(tr["translated"], voice)
    except Exception as e:
        # Still return text even if TTS fails
        await _save_transcript(
            payload.user_id, source_text, tr["translated"],
            source_lang, payload.target_lang, voice, channel="solo",
        )
        return {
            "original": source_text,
            "translated": tr["translated"],
            "source_lang": source_lang,
            "target_lang": payload.target_lang.upper(),
            "voice": voice,
            "audio_base64": "",
            "tts_error": str(e),
        }

    await _save_transcript(
        payload.user_id, source_text, tr["translated"],
        source_lang, payload.target_lang, voice, channel="solo",
    )

    return {
        "original": source_text,
        "translated": tr["translated"],
        "source_lang": source_lang,
        "target_lang": payload.target_lang.upper(),
        "voice": voice,
        "audio_base64": base64.b64encode(audio_out).decode(),
        "same_language": tr.get("same_language", False),
    }


# ---------------------------------------------------------------------------
# (B) Voice picker endpoints
# ---------------------------------------------------------------------------
@router.get("/voices")
async def list_voices(user_id: Optional[str] = None) -> Dict[str, Any]:
    """Return catalog + user's currently-preferred voice (explicit or default)."""
    current = None
    if user_id:
        current = await _get_preferred_voice(user_id)
    return {"voices": VOICE_CATALOG, "current": current}


@router.post("/voices/set")
async def set_voice(payload: SetVoicePayload) -> Dict[str, Any]:
    if payload.voice not in OPENAI_VOICES:
        raise HTTPException(status_code=400, detail=f"Unknown voice '{payload.voice}'")
    db = get_database()
    await db.voice_mirror_prefs.update_one(
        {"user_id": payload.user_id},
        {"$set": {"voice": payload.voice, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "voice": payload.voice}


# ---------------------------------------------------------------------------
# (C) Transcript history
# ---------------------------------------------------------------------------
@router.get("/history")
async def list_history(user_id: str, limit: int = 50) -> Dict[str, Any]:
    """Recent translations for the current user, newest first."""
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    db = get_database()
    limit = max(1, min(200, limit))
    rows = await db.voice_mirror_transcripts.find(
        {"user_id": user_id}, {"_id": 0, "audio_base64": 0},
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    return {"count": len(rows), "rows": rows}


@router.delete("/history")
async def clear_history(user_id: str) -> Dict[str, Any]:
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    db = get_database()
    result = await db.voice_mirror_transcripts.delete_many({"user_id": user_id})
    return {"deleted": result.deleted_count}


# ---------------------------------------------------------------------------
# (D) Quick-phrase packs + speak-phrase
# ---------------------------------------------------------------------------
@router.get("/phrase-packs")
async def list_phrase_packs() -> Dict[str, Any]:
    return {"packs": list(PHRASE_PACKS.values())}


@router.post("/speak-phrase")
async def speak_phrase(payload: SpeakPhrasePayload) -> Dict[str, Any]:
    """Translate a preset phrase to the target language and return TTS audio.

    Skips the Whisper step — `text` is already typed.
    """
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    tr = await translate_message(text, payload.target_lang, source_hint="EN")
    voice = await _get_preferred_voice(payload.user_id, payload.voice)

    audio_b64 = ""
    tts_error: Optional[str] = None
    try:
        audio_out = await _openai_tts(tr["translated"], voice)
        audio_b64 = base64.b64encode(audio_out).decode()
    except Exception as e:
        tts_error = str(e)

    await _save_transcript(
        payload.user_id, text, tr["translated"],
        "EN", payload.target_lang, voice, channel="phrase",
    )

    resp = {
        "original": text,
        "translated": tr["translated"],
        "target_lang": payload.target_lang.upper(),
        "voice": voice,
        "audio_base64": audio_b64,
        "same_language": tr.get("same_language", False),
    }
    if tts_error:
        resp["tts_error"] = tts_error
    return resp


@router.websocket("/ws/{user_id}")
async def voice_mirror_socket(websocket: WebSocket, user_id: str):
    """
    Streaming voice mirroring.

    Client sends JSON per utterance:
        {"audio_base64": "...", "target_lang": "EN"}

    Server replies:
        {"original": "...", "translated": "...", "audio_base64": "..."}
    """
    await websocket.accept()
    voice = _voice_for_user(user_id)
    try:
        while True:
            msg = await websocket.receive_json()
            audio_b64 = msg.get("audio_base64", "")
            target = msg.get("target_lang", "EN")
            if not audio_b64:
                await websocket.send_json({"error": "empty audio"})
                continue
            try:
                audio_bytes = base64.b64decode(audio_b64)
                stt = await _whisper_stt(audio_bytes)
                text = stt.get("text", "").strip()
                if not text:
                    await websocket.send_json({"original": "", "translated": "", "audio_base64": ""})
                    continue
                tr = await translate_message(text, target, source_hint=stt.get("language"))
                try:
                    audio_out = await _openai_tts(tr["translated"], voice)
                    out_b64 = base64.b64encode(audio_out).decode()
                except Exception:
                    out_b64 = ""
                await websocket.send_json({
                    "original": text,
                    "translated": tr["translated"],
                    "source_lang": stt.get("language", ""),
                    "target_lang": target.upper(),
                    "voice": voice,
                    "audio_base64": out_b64,
                    "same_language": tr.get("same_language", False),
                })
            except Exception as e:
                await websocket.send_json({"error": str(e)})
    except WebSocketDisconnect:
        return
