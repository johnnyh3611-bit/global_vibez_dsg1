"""
i18n translation service — bulletproof replacement for the Google
Translate widget which has been failing on production.

Founder ask 2026-02-19: "The front page language changer for the app
still do not work. I changed it to five different languages and it
stayed on English the whole time."

Why this exists
---------------
The Google Translate widget (`translate.google.com/translate_a/element.js`)
is fragile in production:
  - Cloudflare's Rocket Loader / minifier can defer or strip the iframe
  - Some ad-blockers nuke `googleads/translate` paths
  - The `googtrans` cookie strategy depends on a same-domain reload
    that the deployed CDN may cache around
  - Google has been deprecating the widget since 2024

This route replaces the widget with a server-side translator powered
by the Emergent Universal LLM key (Gemini Flash 3 — cheap, fast,
high-quality). The frontend `<DomTranslator>` provider walks the DOM,
batches text nodes, and asks this endpoint for translations.

Endpoint
--------
POST /api/i18n/translate
    body: { target: "es", texts: ["Sign In", "Join Now", ...] }
    returns: { translations: ["Iniciar sesión", "Únete ahora", ...] }

Cache strategy
--------------
- L1: in-memory dict per-process keyed by hash(text + target)
- L2: persisted to mongo `i18n_translations` collection so a re-deploy
  doesn't blow away the cache
- L3: localStorage on the client so we don't even hit the network

The LLM is only called for cache misses → very cheap at scale.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from utils.database import get_database

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/i18n", tags=["i18n"])

# Languages we actively support. Codes are BCP-47 short forms.
SUPPORTED_LANGS = {
    "es": "Spanish",  "fr": "French",   "de": "German",  "it": "Italian",
    "pt": "Portuguese", "ja": "Japanese", "ko": "Korean", "zh": "Simplified Chinese",
    "ar": "Arabic",   "hi": "Hindi",    "ru": "Russian", "tr": "Turkish",
    "nl": "Dutch",    "sv": "Swedish",  "vi": "Vietnamese","th": "Thai",
    "id": "Indonesian","pl": "Polish",  "el": "Greek",   "he": "Hebrew",
    "fa": "Persian",
}

# In-process L1 cache. Bounded — evicts oldest after 10k entries.
_L1: Dict[str, str] = {}
_L1_MAX = 10_000


def _cache_key(text: str, target: str) -> str:
    h = hashlib.sha256(f"{target}|{text}".encode("utf-8")).hexdigest()
    return h[:24]


async def _l2_lookup(db, keys: List[str]) -> Dict[str, str]:
    """Read the mongo cache. Returns { cache_key → translation }."""
    if not keys:
        return {}
    out: Dict[str, str] = {}
    cursor = db.i18n_translations.find(
        {"_id": {"$in": keys}}, {"_id": 1, "translation": 1}
    )
    async for doc in cursor:
        out[doc["_id"]] = doc.get("translation", "")
    return out


async def _l2_persist(db, mapping: Dict[str, str], target: str) -> None:
    """Bulk-upsert translations into the mongo cache."""
    if not mapping:
        return
    from pymongo import UpdateOne
    ops = [
        UpdateOne(
            {"_id": key},
            {"$set": {"translation": tr, "target": target}},
            upsert=True,
        )
        for key, tr in mapping.items()
    ]
    try:
        await db.i18n_translations.bulk_write(ops, ordered=False)
    except Exception as e:
        logger.warning(f"i18n L2 persist skipped: {e}")


def _strip_translation_artifacts(raw: str) -> str:
    """Strip common LLM wrappers like quotes, markdown, leading numbering."""
    s = raw.strip()
    # Strip outer matching quotes
    if len(s) >= 2 and ((s[0] == s[-1] == '"') or (s[0] == s[-1] == "'")):
        s = s[1:-1]
    # Strip leading "1." / "1)" / "- " numbering artifacts
    s = re.sub(r"^\s*(\d+[\.\)]|[-*])\s+", "", s)
    return s.strip()


async def _llm_translate_batch(texts: List[str], target_lang: str) -> List[str]:
    """Ask the Emergent LLM (Gemini Flash 3) to translate a batch.

    Returns translations in the same order. On any error returns the
    original texts so the page never breaks.
    """
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    lang_name = SUPPORTED_LANGS.get(target_lang, target_lang)
    if not api_key or not texts:
        return list(texts)
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: PLC0415
        chat = LlmChat(
            api_key=api_key,
            session_id=f"i18n-{target_lang}-{hashlib.sha1(str(texts).encode()).hexdigest()[:8]}",
            system_message=(
                "You are a professional UI translator. Return ONLY the "
                f"{lang_name} translation of each numbered string. "
                "Do not include the original. Do not add commentary. "
                "Preserve placeholders like {name}, %s, ${x}, # symbols, "
                "emojis, and HTML entities verbatim. Do not translate "
                "brand names like 'Global Vibez', 'DSG', 'VibeRidez', "
                "'Vibe TV', 'Vibe Eats'. One translation per line, "
                "numbered identically to the input."
            ),
        ).with_model("gemini", "gemini-2.5-flash")
        # Build numbered input so we can recover order even if the model
        # adds explanations.
        numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))
        msg = UserMessage(text=numbered)
        raw = await chat.send_message(msg)
        # Parse — split on newlines, strip "N." prefix, ignore blanks.
        lines = [ln.strip() for ln in raw.split("\n") if ln.strip()]
        translations: List[str] = []
        for ln in lines:
            m = re.match(r"^(\d+)[\.\)]\s+(.+)$", ln)
            if m:
                idx = int(m.group(1)) - 1
                while len(translations) < idx:
                    translations.append("")  # pad gaps with empties
                translations.append(_strip_translation_artifacts(m.group(2)))
            else:
                # No number — treat as continuation of previous line
                if translations:
                    translations[-1] = (translations[-1] + " " + _strip_translation_artifacts(ln)).strip()
        # If we got fewer than expected, pad with the originals so the
        # page never shows blanks.
        while len(translations) < len(texts):
            translations.append(texts[len(translations)])
        return translations[: len(texts)]
    except Exception as e:
        logger.error(f"i18n LLM translate failed for {target_lang}: {e}")
        return list(texts)


def _l1_set(key: str, value: str) -> None:
    if len(_L1) >= _L1_MAX:
        # Cheap LRU-ish — drop ~25% oldest by insertion order.
        for k in list(_L1.keys())[: _L1_MAX // 4]:
            _L1.pop(k, None)
    _L1[key] = value


# ── Public API ───────────────────────────────────────────────────────────
class TranslateRequest(BaseModel):
    target: str = Field(..., min_length=2, max_length=8)
    texts: List[str] = Field(..., min_length=1, max_length=120)

    @field_validator("target")
    @classmethod
    def _norm_target(cls, v: str) -> str:
        v = v.lower().split("-")[0]
        if v == "en" or v in SUPPORTED_LANGS:
            return v
        # Unknown — allow but the LLM will best-effort
        return v


class TranslateResponse(BaseModel):
    translations: List[str]
    cached_l1: int
    cached_l2: int
    fresh: int
    target: str


@router.get("/supported")
async def supported_languages() -> Dict[str, Dict[str, str]]:
    """Public — language code → human label."""
    return {"languages": SUPPORTED_LANGS, "default": "en"}


@router.post("/translate", response_model=TranslateResponse)
async def translate(payload: TranslateRequest) -> TranslateResponse:
    target = payload.target
    texts = [t for t in payload.texts if isinstance(t, str)]

    # Short-circuit: target is English → return originals untouched.
    if target == "en":
        return TranslateResponse(
            translations=texts, cached_l1=0, cached_l2=0,
            fresh=0, target="en",
        )

    # 1. L1 lookups
    out: List[Optional[str]] = [None] * len(texts)
    keys = [_cache_key(t, target) for t in texts]
    l1_hits = 0
    l2_keys: List[str] = []
    l2_idx_map: Dict[str, int] = {}
    for i, k in enumerate(keys):
        if k in _L1:
            out[i] = _L1[k]
            l1_hits += 1
        else:
            l2_keys.append(k)
            l2_idx_map[k] = i

    # 2. L2 lookups
    db = get_database()
    l2_hits = 0
    misses_idx: List[int] = []
    if l2_keys:
        l2_found = await _l2_lookup(db, l2_keys)
        for k in l2_keys:
            i = l2_idx_map[k]
            if k in l2_found:
                out[i] = l2_found[k]
                _l1_set(k, l2_found[k])
                l2_hits += 1
            else:
                misses_idx.append(i)
    else:
        misses_idx = []

    # 3. LLM call for the misses
    fresh_count = 0
    if misses_idx:
        miss_texts = [texts[i] for i in misses_idx]
        translations = await _llm_translate_batch(miss_texts, target)
        new_for_l2: Dict[str, str] = {}
        for j, idx in enumerate(misses_idx):
            tr = translations[j] if j < len(translations) else miss_texts[j]
            out[idx] = tr
            _l1_set(keys[idx], tr)
            new_for_l2[keys[idx]] = tr
            fresh_count += 1
        await _l2_persist(db, new_for_l2, target)

    # Replace any remaining None with the original (defensive)
    final = [out[i] if out[i] is not None else texts[i] for i in range(len(texts))]
    return TranslateResponse(
        translations=final,
        cached_l1=l1_hits,
        cached_l2=l2_hits,
        fresh=fresh_count,
        target=target,
    )


__all__ = ["router"]
