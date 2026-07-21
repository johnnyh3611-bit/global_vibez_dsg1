"""
voice_coach_router — Cyber-Casino Voice Coach (Revolutionary Games
Blueprint v1, May 2026).

Endpoints
---------
POST /api/voice-coach/move-tip
    Body: { fen: str, last_move: str, side: "white" | "black", elo: int? }
    Returns: { tip: str }
    Calls Gemini (via LlmChat) for a 1-2 sentence coaching tip on the
    last move. Stateless — no chat history is preserved server-side.

POST /api/voice-coach/voice-question  (multipart/form-data)
    Form fields:
        audio: UploadFile  (mp3/wav/m4a/webm, max 25 MB)
        fen: str
        side: "white" | "black"
    Returns: { question: str, answer: str }
    Whisper STT (OPENAI_API_KEY) → Gemini answer in one round-trip.
"""
from __future__ import annotations
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from config import GEMINI_API_KEY
from services.ai_engine import LlmChat, UserMessage
from services.openai_audio import resolve_openai_api_key, whisper_transcribe

log = logging.getLogger(__name__)

router = APIRouter(prefix="/voice-coach", tags=["voice-coach"])


# ─────────────────────────────────────────────────────────────────
# Move-tip — stateless one-shot coaching call
# ─────────────────────────────────────────────────────────────────
class MoveTipRequest(BaseModel):
    fen: str
    last_move: str
    side: str  # "white" | "black"
    elo: Optional[int] = 1200


class MoveTipResponse(BaseModel):
    tip: str


SYSTEM_PROMPT = (
    "You are a witty, sharp Chess coach for the Global Vibez DSG cyber-casino "
    "platform. Reply with a SINGLE sentence (max 35 words) of strategic insight "
    "on the last move. Be encouraging when the move is good, blunt when it's a "
    "mistake. Never explain rules. Never use the player's name. Use modern "
    "casino-floor energy without slang."
)


@router.post("/move-tip", response_model=MoveTipResponse)
async def move_tip(req: MoveTipRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(503, "Voice coach unavailable: missing GEMINI_API_KEY")
    try:
        chat = LlmChat(
            session_id=f"voice-coach-{req.fen[:16]}",
            system_message=SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        prompt = (
            f"FEN: {req.fen}\n"
            f"Side to move next: {req.side}\n"
            f"Last move played: {req.last_move}\n"
            f"Player Elo: {req.elo or 1200}\n\n"
            "Give one sentence of coaching."
        )
        response = await chat.send_message(UserMessage(text=prompt))
        return MoveTipResponse(tip=str(response).strip().strip('"'))
    except Exception as e:
        log.exception("voice_coach.move_tip failed")
        raise HTTPException(502, f"Coach unavailable: {e}")


# ─────────────────────────────────────────────────────────────────
# Voice-question — Whisper STT → Gemini answer
# ─────────────────────────────────────────────────────────────────
class VoiceQuestionResponse(BaseModel):
    question: str
    answer: str


@router.post("/voice-question", response_model=VoiceQuestionResponse)
async def voice_question(
    audio: UploadFile = File(...),
    fen: str = Form(...),
    side: str = Form("white"),
):
    if not GEMINI_API_KEY:
        raise HTTPException(503, "Voice coach unavailable: missing GEMINI_API_KEY")
    if not resolve_openai_api_key():
        raise HTTPException(503, "Voice coach STT unavailable: missing OPENAI_API_KEY")

    # Whisper has a 25 MB cap; reject early.
    raw = await audio.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(413, "Audio too large (max 25 MB)")
    if len(raw) < 100:
        raise HTTPException(400, "Audio is empty")

    try:
        transcription = await whisper_transcribe(
            raw,
            filename=audio.filename or "voice-coach.webm",
            language="en",
            prompt="Chess coaching question for an online casino game.",
            response_format="json",
        )
        question = (transcription.get("text") or "").strip()
        if not question:
            raise HTTPException(422, "Could not understand audio")

        chat = LlmChat(
            session_id=f"voice-coach-q-{fen[:16]}",
            system_message=(
                SYSTEM_PROMPT + " For voice questions, give 2-3 sentences max."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        prompt = (
            f"Current FEN: {fen}\n"
            f"Side to move: {side}\n"
            f"Player's question (transcribed): \"{question}\"\n\n"
            "Answer concisely."
        )
        response = await chat.send_message(UserMessage(text=prompt))
        return VoiceQuestionResponse(
            question=question,
            answer=str(response).strip().strip('"'),
        )
    except HTTPException:
        raise
    except Exception as e:
        log.exception("voice_coach.voice_question failed")
        raise HTTPException(502, f"Coach unavailable: {e}")
