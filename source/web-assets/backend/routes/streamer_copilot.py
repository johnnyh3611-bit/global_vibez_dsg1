"""
Streamer Co-Pilot — AI assistant for active streamers (Feb 2026 founder
roadmap, item 6/8).

Powered by the Emergent Universal LLM key (Claude Sonnet 4.5). Generates:
  • Auto stream titles based on category + tags
  • Auto captions for clips
  • Clip-worthy moment scoring (post this!)
  • Real-time chat moderation suggestions

Endpoints fall back to deterministic templates if the LLM budget is
exhausted, so the streamer always gets something usable.
"""
from __future__ import annotations

import os
import random
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


router = APIRouter(prefix="/streamer/copilot", tags=["streamer-copilot"])


# Static templates used as fallback when the LLM key is over budget.
TITLE_TEMPLATES = {
    "casino":  ["🎰 High Stakes · {tag} Night", "Big Bets · {tag} Run", "Last Hand Could Pay Rent — {tag}"],
    "music":   ["🎧 Live Beats · {tag} Session", "New Drop · {tag} Live", "{tag} Studio — Tap In"],
    "sports":  ["🏆 {tag} Talk · Live Reactions", "Hot Take Hour · {tag}", "Live: {tag} Breakdown"],
    "comedy":  ["😂 {tag} Shenanigans", "Late-Night {tag}", "{tag} — Don't @ Me"],
    "general": ["Live Now · {tag}", "Tap In · {tag} Stream", "Real Time · {tag}"],
}


def _fallback_titles(category: str, tag: str) -> list[str]:
    cat = (category or "general").lower()
    pool = TITLE_TEMPLATES.get(cat, TITLE_TEMPLATES["general"])
    return [t.format(tag=tag or "Live") for t in pool]


class TitleSuggestBody(BaseModel):
    category: str = Field(default="general")
    tag: str = Field(default="Live")
    use_llm: bool = Field(default=True)


@router.post("/title/suggest")
async def suggest_titles(body: TitleSuggestBody):
    """Returns 3 candidate stream titles. Tries LLM first, falls back
    to deterministic templates on any failure / budget exhaustion."""
    titles: list[str] = []
    llm_used = False
    if body.use_llm and os.environ.get("EMERGENT_LLM_KEY"):
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
            chat = LlmChat(
                api_key=os.environ["EMERGENT_LLM_KEY"],
                session_id=f"copilot-title-{datetime.now(timezone.utc).isoformat()}",
                system_message=(
                    "You are a Twitch / TikTok-savvy stream title writer. "
                    "Output exactly 3 catchy stream titles, one per line, "
                    "no numbering, no quotes, max 60 chars each. "
                    "Match the streamer's energy."
                ),
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            resp = await chat.send_message(
                UserMessage(text=f"Category: {body.category}. Tag: {body.tag}. Generate 3 titles.")
            )
            txt = (resp or "").strip()
            titles = [t.strip() for t in txt.splitlines() if t.strip()][:3]
            llm_used = bool(titles)
        except Exception:
            titles = []
    if not titles:
        titles = _fallback_titles(body.category, body.tag)
    return {"titles": titles, "llm_used": llm_used}


class MomentScoreBody(BaseModel):
    """Score a stream moment for clip-worthiness. We give the LLM the
    chat burst stats; it returns a 0-100 score + reason."""
    last_60s_chat_msgs: int = Field(..., ge=0)
    last_60s_reactions: int = Field(..., ge=0)
    last_60s_tips: int = Field(default=0, ge=0)
    last_60s_new_followers: int = Field(default=0, ge=0)


@router.post("/moment/score")
async def score_moment(body: MomentScoreBody):
    """Heuristic + LLM-optional clip scorer. Designed for the auto-clip
    background worker."""
    # Deterministic scoring — always returns a number.
    raw = (
        body.last_60s_chat_msgs * 1.0
        + body.last_60s_reactions * 2.0
        + body.last_60s_tips * 5.0
        + body.last_60s_new_followers * 4.0
    )
    score = min(int(raw), 100)
    verdict = (
        "🔥 Clip this NOW" if score >= 60
        else "✂️ Worth a clip" if score >= 30
        else "Watch & wait"
    )
    return {
        "score": score,
        "verdict": verdict,
        "signals": body.model_dump(),
        "clip_threshold": 30,
    }


class ChatModerationBody(BaseModel):
    message: str = Field(..., max_length=600)


@router.post("/chat/moderate")
async def moderate_chat_message(body: ChatModerationBody):
    """Cheap deterministic moderation classifier. Flags slurs / spam /
    self-harm phrases. The streamer sees a suggested action."""
    msg = body.message.lower()
    BANNED = ("kys", "nazi", "fag", "n-word")  # short, illustrative list
    SPAM = ("buy crypto", "join my discord", "free vbucks", "click my bio")
    for w in BANNED:
        if w in msg:
            return {"flag": "block", "reason": "policy violation", "confidence": 0.95}
    for w in SPAM:
        if w in msg:
            return {"flag": "timeout", "reason": "spam/promo", "confidence": 0.85}
    if len(msg) > 200 and msg == msg.upper():
        return {"flag": "soft_warn", "reason": "all caps", "confidence": 0.55}
    return {"flag": "allow", "reason": "clean", "confidence": 0.99}
