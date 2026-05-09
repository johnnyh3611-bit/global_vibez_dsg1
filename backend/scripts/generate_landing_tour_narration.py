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

The world's first sovereign infrastructure network — built on Solana — where every interaction earns.

This isn't a chat app. This isn't another play-to-earn. This is six utility rooms. One currency. And a real economy you actually own.

Welcome to the Cyber-Casino. Thirty-plus AAA card rooms — Spades, Bid Whist, Hearts, UNO, Pinochle, Euchre, Gin Rummy. A neon casino floor — chess, Vibez six-five-four, baccarat, blackjack, three-card poker. Every win flows back to you in $VIBEZ.

Find your Player Two in the Dating Universe. Ninety-eight percent synergy-logic matchmaking. Synced streaming. Cinema Dates. Voice rooms. A culturally-aware AI dealer that actually gets you.

Drive a VibeRidez and keep seventy percent of every fare. Deliver Hungry VIBEZ. Cook as a Vibe Artisan. Host a Vibe Venue. Stream live on DSG TV — twenty-four seven channels, independent movies, thirty-minute episodes, the Memory Bank Cinema.

Independent artists keep seventy percent. Beat Vault. Freestyle Battles. Collab Matchmaker. The Totem Pole. The seventy-thirty Revolution is here.

Local Mom and Pop earn back. Vibe Yellow Pages — geo-pinned, verified businesses. Hyper-local sponsorship. Backed by the DSG Guard safety protocol.

The economy. Three billion VIBEZ coins. Hard-capped forever. A thirteen-point-five percent Sovereign Tax recirculates every transaction back to the players. A five-times mining multiplier locked in for chair holders. $VIBEZ bridges to Solana at four-to-one.

Speaking of chairs — the Chair Hall is open. Three tiers. Genius. Genesis. Apex. One million seats. Globally. Forever. Eight hundred thousand reserve seats unlock after Chair number fifty thousand. The first cohort to sit at the table owns the network.

This is the Sovereign Casino plus Social Network. Where games, dating, rides, food, venues, music, and streaming all run on one currency you control.

Right now is the best time to take your seat at the table.

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
