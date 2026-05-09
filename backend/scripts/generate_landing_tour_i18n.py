"""
Multi-language landing-tour narration pipeline.

For each target language:
  1. Translate the English `SCRIPT` and `CAPTION_CUES` via Claude Haiku
     (preserving brand terms like VIBEZ, DSG, $VIBEZ, VibeRidez, DSG TV).
  2. Generate the MP3 via OpenAI TTS Onyx (works natively for every
     listed language — Onyx adapts pronunciation to the input text).
  3. Capture the actual MP3 duration so caption timings can be
     re-scaled proportionally.
  4. Write everything to a static manifest at:
        /app/frontend/public/landing-tour-i18n.json
     plus per-language MP3s at:
        /app/frontend/public/landing-tour-narration-{lang}.mp3

Run once after editing SCRIPT or LANGUAGES:
    cd /app/backend && python scripts/generate_landing_tour_i18n.py
"""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv  # noqa: E402
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402
from emergentintegrations.llm.openai import OpenAITextToSpeech  # noqa: E402
from mutagen.mp3 import MP3  # noqa: E402

load_dotenv()

PUBLIC_DIR = Path("/app/frontend/public")
MANIFEST = PUBLIC_DIR / "landing-tour-i18n.json"

# Brand-locked constants — must NEVER be translated.
BRAND_TERMS = [
    "GLOBAL VIBEZ DSG", "VIBEZ", "DSG", "$VIBEZ", "DSG TV",
    "VibeRidez", "Hungry VIBEZ", "Vibe Venue", "Vibe Artisan",
    "Solana", "Cyber-Casino", "Dating Universe", "Player Two",
    "Spades", "Bid Whist", "Hearts", "UNO", "Pinochle", "Euchre",
    "Gin Rummy", "chess", "Vibez", "baccarat", "blackjack",
    "Sovereign Tax", "Chair Hall", "Genius", "Genesis", "Apex",
    "Beat Vault", "Freestyle Battles", "Collab Matchmaker",
    "Totem Pole", "Vibe Yellow Pages", "DSG Guard",
]

# (start_seconds_in_english_master, english_caption_text)
ENGLISH_CAPTIONS = [
    (0.0,   "GLOBAL VIBEZ DSG."),
    (3.0,   "The world's first sovereign infrastructure network — built on Solana — where every interaction earns."),
    (13.0,  "Six utility rooms · one currency · a real economy you actually own."),
    (22.0,  "30+ AAA card rooms — Spades, Bid Whist, Hearts, UNO, Pinochle, Euchre, Gin Rummy."),
    (33.0,  "Neon casino floor — chess, Vibez 6-5-4, baccarat, blackjack, three-card poker. Every win → $VIBEZ."),
    (44.0,  "Find your Player Two · 98% synergy-logic matchmaking · Cinema Dates · culturally-aware AI dealer."),
    (56.0,  "Drive VibeRidez · keep 70% · Hungry VIBEZ · Vibe Artisan · Vibe Venue · DSG TV 24/7."),
    (70.0,  "70/30 Music Revolution · Beat Vault · Freestyle Battles · Collab Matchmaker · Totem Pole."),
    (80.0,  "Vibe Yellow Pages · Mom & Pop · hyper-local · DSG Guard safety protocol."),
    (88.0,  "3 BILLION VIBEZ · hard-capped · 13.5% Sovereign Tax recirculates back to the players."),
    (98.0,  "5× mining multiplier for chair holders · $VIBEZ bridges to Solana 4:1."),
    (105.0, "Chair Hall is OPEN · Genius · Genesis · Apex · 1,000,000 seats · forever."),
    (115.0, "First cohort to sit at the table owns the network."),
    (120.0, "Right now is the best time to take your seat at the table."),
    (127.0, "GLOBAL VIBEZ DSG. Own the network. Feel the VIBEZ."),
]
ENGLISH_DURATION = 122.0

# English narration script (matches the in-app script).
ENGLISH_SCRIPT = open(
    "/app/backend/scripts/_landing_tour_english_script.txt"
).read().strip() if Path(
    "/app/backend/scripts/_landing_tour_english_script.txt"
).exists() else None

if ENGLISH_SCRIPT is None:
    # Fallback — read from the existing generator.
    GEN = Path("/app/backend/scripts/generate_landing_tour_narration.py").read_text()
    m = re.search(r'SCRIPT = """(.+?)"""', GEN, re.DOTALL)
    if not m:
        raise SystemExit("Could not extract SCRIPT from generate_landing_tour_narration.py")
    ENGLISH_SCRIPT = m.group(1).strip()

# Languages to ship. Add/remove as needed — pipeline regenerates everything.
LANGUAGES = {
    "en": {"label": "English",            "native": "English",   "rtl": False},
    "es": {"label": "Spanish",            "native": "Español",   "rtl": False},
    "fr": {"label": "French",             "native": "Français",  "rtl": False},
    "pt": {"label": "Portuguese (BR)",    "native": "Português", "rtl": False},
    "zh": {"label": "Mandarin (zh-CN)",   "native": "中文",       "rtl": False},
    "hi": {"label": "Hindi",              "native": "हिन्दी",     "rtl": False},
    "ar": {"label": "Arabic",             "native": "العربية",    "rtl": True},
    "ja": {"label": "Japanese",           "native": "日本語",     "rtl": False},
}


async def translate(target_label: str, text: str, kind: str) -> str:
    """Single-shot Claude Haiku translation that preserves brand terms.

    `kind` is either 'script' (full narration) or 'cues' (joined caption
    track separated by `\n###\n`). The chat session is one-shot per
    request — we never accumulate context between calls.
    """
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise SystemExit("EMERGENT_LLM_KEY missing from /app/backend/.env")
    chat = (
        LlmChat(
            api_key=api_key,
            session_id=f"i18n-{target_label}-{kind}",
            system_message=(
                "You are a precision translator for marketing copy. "
                "Translate exactly into the target language while keeping "
                "the cinematic, confident tone. NEVER translate these brand "
                "/ proper-noun terms — keep them verbatim in English: "
                + ", ".join(BRAND_TERMS) + ". "
                "Translate numbers as words ONLY when they read more "
                "naturally that way in the target language; otherwise keep "
                "Arabic numerals. Output nothing but the translation — no "
                "preamble, no quotes, no markdown."
            ),
        )
        .with_model("anthropic", "claude-3-5-haiku-20241022")
        .with_params(max_tokens=2048)
    )
    user = UserMessage(text=f"Target language: {target_label}\n\nSource:\n{text}")
    out = await chat.send_message(user)
    return out.strip()


async def generate_all() -> None:
    if not os.getenv("EMERGENT_LLM_KEY"):
        raise SystemExit("EMERGENT_LLM_KEY missing")
    tts = OpenAITextToSpeech(api_key=os.getenv("EMERGENT_LLM_KEY"))

    # Resume from existing manifest so re-runs after a budget top-up
    # don't re-bill for already-generated languages.
    manifest: dict = {"default": "en", "languages": {}}
    if MANIFEST.exists():
        try:
            existing = json.loads(MANIFEST.read_text(encoding="utf-8"))
            if isinstance(existing, dict) and existing.get("languages"):
                manifest = existing
                manifest["default"] = "en"
                print(f"[i18n] resume: found {len(manifest['languages'])} existing languages")
        except Exception:
            pass

    # Seed English from the legacy single-language MP3 if we already
    # have it, so TTS budget can be saved for the new languages.
    legacy_en = PUBLIC_DIR / "landing-tour-narration.mp3"
    en_alias = PUBLIC_DIR / "landing-tour-narration-en.mp3"
    if legacy_en.exists() and not en_alias.exists():
        en_alias.write_bytes(legacy_en.read_bytes())
        print(f"[i18n] seeded English MP3 from legacy {legacy_en.name}")

    for code, meta in LANGUAGES.items():
        print(f"\n[i18n] {code} ({meta['native']}) ────────────────────")
        out_mp3 = PUBLIC_DIR / f"landing-tour-narration-{code}.mp3"

        # Resume: if the MP3 already exists and the manifest already
        # has cues for this language, skip the whole pipeline.
        if out_mp3.exists() and code in manifest["languages"] and manifest["languages"][code].get("cues"):
            # Refresh the audio path so legacy entries point at the
            # per-language MP3 alias even after we seeded en.
            manifest["languages"][code]["audio"] = f"/landing-tour-narration-{code}.mp3"
            print(f"  ↻ skip — already generated ({out_mp3.stat().st_size // 1024} KB)")
            continue

        try:
            # 1. Translate (or use English source).
            if code == "en":
                translated_script = ENGLISH_SCRIPT
                translated_cues = [c[1] for c in ENGLISH_CAPTIONS]
            else:
                print(f"  → translating script via Claude Haiku…")
                translated_script = await translate(meta["label"], ENGLISH_SCRIPT, "script")
                joined_cues = "\n###\n".join(c[1] for c in ENGLISH_CAPTIONS)
                print(f"  → translating {len(ENGLISH_CAPTIONS)} caption cues…")
                joined_translated = await translate(meta["label"], joined_cues, "cues")
                translated_cues = [s.strip() for s in joined_translated.split("###")]
                if len(translated_cues) != len(ENGLISH_CAPTIONS):
                    while len(translated_cues) < len(ENGLISH_CAPTIONS):
                        translated_cues.append(ENGLISH_CAPTIONS[len(translated_cues)][1])
                    translated_cues = translated_cues[: len(ENGLISH_CAPTIONS)]
                    print(f"    ⚠ caption count drift, padded to {len(ENGLISH_CAPTIONS)}")

            # 2. Generate the MP3 via OpenAI TTS Onyx (unless already on disk).
            if out_mp3.exists() and out_mp3.stat().st_size > 0:
                print(f"  ↻ MP3 already on disk — reusing ({out_mp3.stat().st_size // 1024} KB)")
            else:
                print(f"  → TTS → {out_mp3.name}")
                audio_bytes = await tts.generate_speech(
                    text=translated_script,
                    model="tts-1-hd",
                    voice="onyx",
                    response_format="mp3",
                    speed=1.0,
                )
                out_mp3.write_bytes(audio_bytes)

            # 3. Capture actual duration + scale cue timings.
            try:
                actual_dur = MP3(str(out_mp3)).info.length
            except Exception:
                actual_dur = ENGLISH_DURATION
            scale = actual_dur / ENGLISH_DURATION if ENGLISH_DURATION else 1.0
            cues = [
                {"t": round(t * scale, 2), "text": text}
                for (t, _), text in zip(ENGLISH_CAPTIONS, translated_cues)
            ]

            manifest["languages"][code] = {
                "label": meta["label"],
                "native": meta["native"],
                "rtl": meta["rtl"],
                "audio": f"/landing-tour-narration-{code}.mp3",
                "duration": round(actual_dur, 2),
                "cues": cues,
            }
            # Save manifest after each language so partial runs persist.
            MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  ✅ {actual_dur:.1f}s · {out_mp3.stat().st_size // 1024} KB")
        except Exception as exc:
            msg = str(exc)
            if "Budget" in msg or "budget" in msg:
                print(f"  ⛔ budget exceeded — stopping. Top up Universal Key, then re-run this script.")
                break
            print(f"  ⚠ skipped {code} due to error: {msg[:200]}")
            continue

    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✅ Manifest → {MANIFEST}")
    print(f"   {len(manifest['languages'])} languages ready.")


if __name__ == "__main__":
    asyncio.run(generate_all())
