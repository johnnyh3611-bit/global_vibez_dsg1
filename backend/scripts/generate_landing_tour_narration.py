"""
One-shot script — generates the LANDING-PAGE TOUR narration MP3 using
OpenAI TTS (Onyx voice, HD model). Output saved to:
    /app/frontend/public/landing-tour-narration.mp3

Run:
    cd /app/backend && python scripts/generate_landing_tour_narration.py

To re-generate after editing the SCRIPT below, just re-run.
The MP3 is committed alongside the React frontend so deploy doesn't
need a runtime API call. Idempotent — overwrites the existing file.
"""
import asyncio
import os
import sys
from pathlib import Path

# Ensure /app/backend is on sys.path when invoked from any cwd.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv  # noqa: E402
from emergentintegrations.llm.openai import OpenAITextToSpeech  # noqa: E402

load_dotenv()

# Founder-locked spelling: VIBEZ (with Z), DSG, $VIBEZ for the token.
# Tone: cinematic / authoritative / visionary — matches Onyx.
# Length: ~240 words → ~95-100s at Onyx 1.0× speed. Tested below.
SCRIPT = """GLOBAL VIBEZ DSG.

The world's first social infrastructure network — built on Solana — where every interaction is economically monetized.

One token. Six utility rooms. Real payouts.

Inside, you'll find more than thirty AAA card rooms — Spades, Bid Whist, Hearts, UNO, and more. A neon Cyber-Casino — chess, Vibez six-five-four, baccarat, blackjack, three-card poker. Every win flows back to you.

Match your perfect player two in the Dating Universe. Drive a VibeRidez — keep seventy percent of every fare. Deliver Hungry VIBEZ. Host a Vibe Venue. Stream live on DSG TV — get tipped in $VIBEZ that bridges to Solana at four-to-one.

The economy? Three billion VIBEZ coins. Hard-capped. A thirteen-point-five percent Sovereign Tax recirculates every transaction back to the players. A five-times mining multiplier waits for chair holders.

Speaking of chairs — the Chair Hall is open. Three tiers: Genius, Genesis, Apex. Two hundred thousand seats. Real ownership. A perpetual share of the network's upside.

This isn't another play-to-earn. This isn't another chat app. This is the Sovereign Casino plus Social Network where games, dating, rides, food, venues, and streaming all run on one currency you actually own.

Lock in your seat. Claim your VIBEZ.

GLOBAL VIBEZ DSG. Own the network. Feel the VIBEZ.
"""

OUTPUT_PATH = Path("/app/frontend/public/landing-tour-narration.mp3")


async def main() -> None:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise SystemExit("EMERGENT_LLM_KEY missing from /app/backend/.env")

    tts = OpenAITextToSpeech(api_key=api_key)
    print(f"[narration] generating {len(SCRIPT)} chars via OpenAI TTS (onyx · tts-1-hd)…")

    audio_bytes = await tts.generate_speech(
        text=SCRIPT.strip(),
        model="tts-1-hd",
        voice="onyx",
        response_format="mp3",
        speed=1.0,
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_bytes(audio_bytes)
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"[narration] wrote {OUTPUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    asyncio.run(main())
