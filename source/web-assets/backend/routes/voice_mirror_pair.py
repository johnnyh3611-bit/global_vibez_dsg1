"""
Voice Mirror Pair Room — bidirectional, real-time voice translation between
two users who each speak their own native language and hear the other
translated into theirs.

Flow:
  1. Alice calls POST /api/voice-mirror/pair/create → returns pair_code + room_id.
     She sets her native_lang = "EN".
  2. Bob calls  POST /api/voice-mirror/pair/join?pair_code=ABC123 → joins the
     same room. He sets native_lang = "ES".
  3. Each side records audio clips and POSTs them to
     /api/voice-mirror/pair/{room_id}/send. The server transcribes, translates
     to the peer's native_lang, synthesises TTS, and drops the result into the
     peer's inbox.
  4. Each side polls /api/voice-mirror/pair/{room_id}/inbox?since=<timestamp>
     every ~1s to pick up new messages. Audio autoplays on arrival.

Room state is kept in-memory (same pattern as http_multiplayer). Rooms expire
after 30 min of inactivity.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime, timezone, timedelta
import base64
import secrets
import time

from routes.voice_mirror import _whisper_stt, _openai_tts, _get_preferred_voice, _save_transcript
from routes.chat import translate_message

router = APIRouter(prefix="/voice-mirror/pair", tags=["voice-mirror-pair"])

# In-memory rooms. Keyed by room_id. Each room holds pair_code, participants
# {user_id: {native_lang, joined_at, inbox: [msg, ...]}}, and created_at.
_rooms: Dict[str, Dict] = {}
_code_index: Dict[str, str] = {}  # pair_code -> room_id
_ROOM_TTL = timedelta(minutes=30)


def _gc_rooms() -> None:
    now = datetime.now(timezone.utc)
    expired = [rid for rid, r in _rooms.items() if now - r["touched_at"] > _ROOM_TTL]
    for rid in expired:
        code = _rooms[rid].get("pair_code")
        _rooms.pop(rid, None)
        if code:
            _code_index.pop(code, None)


def _new_pair_code() -> str:
    # 6 chars, uppercase, no 0/O/1/I/L to avoid confusion
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(6))
        if code not in _code_index:
            return code


class CreateRoomPayload(BaseModel):
    user_id: str
    user_name: Optional[str] = None
    native_lang: str = "EN"


class JoinRoomPayload(BaseModel):
    user_id: str
    user_name: Optional[str] = None
    native_lang: str = "EN"
    pair_code: str


class SendAudioPayload(BaseModel):
    user_id: str
    audio_base64: str


class SetLangPayload(BaseModel):
    user_id: str
    native_lang: str


def _room_state(room_id: str, viewer_user_id: Optional[str] = None) -> Dict:
    r = _rooms[room_id]
    peers = {
        uid: {"user_id": uid, "user_name": p.get("user_name"), "native_lang": p.get("native_lang", "EN")}
        for uid, p in r["participants"].items()
    }
    return {
        "room_id": room_id,
        "pair_code": r["pair_code"],
        "created_at": r["created_at"],
        "participants": list(peers.values()),
        "is_full": len(peers) >= 2,
        "you": peers.get(viewer_user_id) if viewer_user_id else None,
    }


@router.post("/create")
async def create_pair_room(data: CreateRoomPayload) -> Dict:
    _gc_rooms()
    room_id = secrets.token_hex(8)
    code = _new_pair_code()
    now = datetime.now(timezone.utc)
    _rooms[room_id] = {
        "room_id": room_id,
        "pair_code": code,
        "created_at": now.isoformat(),
        "touched_at": now,
        "participants": {
            data.user_id: {
                "user_name": data.user_name or data.user_id,
                "native_lang": (data.native_lang or "EN").upper(),
                "joined_at": now.isoformat(),
                "inbox": [],
            }
        },
    }
    _code_index[code] = room_id
    return _room_state(room_id, data.user_id)


@router.post("/join")
async def join_pair_room(data: JoinRoomPayload) -> Dict:
    _gc_rooms()
    code = (data.pair_code or "").upper().strip()
    room_id = _code_index.get(code)
    if not room_id or room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Pair code not found or expired")
    r = _rooms[room_id]
    if data.user_id not in r["participants"] and len(r["participants"]) >= 2:
        raise HTTPException(status_code=409, detail="Room already full (2 players)")
    now = datetime.now(timezone.utc)
    r["participants"].setdefault(data.user_id, {
        "user_name": data.user_name or data.user_id,
        "native_lang": (data.native_lang or "EN").upper(),
        "joined_at": now.isoformat(),
        "inbox": [],
    })
    # Update lang if rejoining
    r["participants"][data.user_id]["native_lang"] = (data.native_lang or "EN").upper()
    r["touched_at"] = now
    return _room_state(room_id, data.user_id)


@router.get("/{room_id}")
async def get_room(room_id: str, user_id: str) -> Dict:
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    _rooms[room_id]["touched_at"] = datetime.now(timezone.utc)
    return _room_state(room_id, user_id)


@router.post("/{room_id}/set-lang")
async def set_lang(room_id: str, data: SetLangPayload) -> Dict:
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    r = _rooms[room_id]
    if data.user_id not in r["participants"]:
        raise HTTPException(status_code=403, detail="You are not in this room")
    r["participants"][data.user_id]["native_lang"] = (data.native_lang or "EN").upper()
    r["touched_at"] = datetime.now(timezone.utc)
    return _room_state(room_id, data.user_id)


@router.post("/{room_id}/send")
async def send_audio(room_id: str, data: SendAudioPayload) -> Dict:
    """Transcribe my audio, translate to the peer's native_lang, TTS, drop
    the result in the peer's inbox. Also echoes the transcript back to me.
    """
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    r = _rooms[room_id]
    if data.user_id not in r["participants"]:
        raise HTTPException(status_code=403, detail="You are not in this room")

    # Identify peer (if any)
    peer_id: Optional[str] = None
    for uid in r["participants"]:
        if uid != data.user_id:
            peer_id = uid
            break

    me = r["participants"][data.user_id]
    peer = r["participants"].get(peer_id) if peer_id else None
    target_lang = (peer or me)["native_lang"]  # if solo, translate to own lang (noop-ish)

    # Decode audio
    try:
        audio_bytes = base64.b64decode(data.audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio")

    # STT
    try:
        stt = await _whisper_stt(audio_bytes)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"STT failed: {e}")

    source_text = (stt.get("text") or "").strip()
    source_lang = (stt.get("language") or "").upper()

    if not source_text:
        return {"ok": True, "empty": True, "original": "", "translated": ""}

    # Translate
    tr = await translate_message(source_text, target_lang, source_hint=source_lang)
    translated = tr.get("translated") or source_text
    same_lang = bool(tr.get("same_language"))

    # TTS using the *speaker's* preferred voice (or saved pref / deterministic default).
    voice = await _get_preferred_voice(data.user_id)
    audio_out_b64 = ""
    try:
        audio_out = await _openai_tts(translated, voice)
        audio_out_b64 = base64.b64encode(audio_out).decode()
    except Exception:
        pass

    now_iso = datetime.now(timezone.utc).isoformat()
    now_ms = int(time.time() * 1000)
    msg = {
        "msg_id": secrets.token_hex(6),
        "from_user_id": data.user_id,
        "from_user_name": me.get("user_name"),
        "original": source_text,
        "source_lang": source_lang,
        "translated": translated,
        "target_lang": target_lang,
        "audio_base64": audio_out_b64,
        "voice": voice,
        "same_language": same_lang,
        "at": now_iso,
        "at_ms": now_ms,
    }

    # Deliver to peer's inbox
    if peer:
        peer["inbox"].append(msg)
        # Keep last 50 messages per inbox
        if len(peer["inbox"]) > 50:
            peer["inbox"] = peer["inbox"][-50:]

    # Persist to shared transcript history (best-effort)
    await _save_transcript(
        data.user_id, source_text, translated,
        source_lang, target_lang, voice, channel="pair", room_id=room_id,
    )

    r["touched_at"] = datetime.now(timezone.utc)

    # Return the ack to the speaker (so they see their own transcript)
    return {
        "ok": True,
        "empty": False,
        "peer_online": peer is not None,
        "original": source_text,
        "source_lang": source_lang,
        "translated": translated,
        "target_lang": target_lang,
        "at_ms": now_ms,
    }


@router.get("/{room_id}/inbox")
async def poll_inbox(room_id: str, user_id: str, since_ms: int = 0) -> Dict:
    """Poll for new messages delivered to me since the given ms timestamp.

    Messages are NOT removed from inbox on read (so two clients could replay).
    They're capped at 50 per user and auto-GC'd when the room expires.
    """
    if room_id not in _rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    r = _rooms[room_id]
    if user_id not in r["participants"]:
        raise HTTPException(status_code=403, detail="You are not in this room")
    r["touched_at"] = datetime.now(timezone.utc)
    inbox = r["participants"][user_id]["inbox"]
    fresh = [m for m in inbox if int(m.get("at_ms", 0)) > int(since_ms)]
    return {"count": len(fresh), "messages": fresh, "server_ms": int(time.time() * 1000)}


@router.post("/{room_id}/leave")
async def leave_room(room_id: str, user_id: str = Body(..., embed=True)) -> Dict:
    if room_id not in _rooms:
        return {"ok": True}
    r = _rooms[room_id]
    r["participants"].pop(user_id, None)
    if not r["participants"]:
        code = r.get("pair_code")
        _rooms.pop(room_id, None)
        if code:
            _code_index.pop(code, None)
    return {"ok": True}
