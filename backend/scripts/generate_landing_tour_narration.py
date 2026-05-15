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
# Tone: HIGH-ENERGY / hype / inviting — Feb-15-2026 founder ask:
#   "Make sure the voice of the character that is talking is more
#    energetic and alive and excited about Global Vibez DSG. The tour
#    can be a little bit longer due to all the new information."
# Length: ~520 words → ~3:00-3:15 at speed=1.10× (nova voice).
# Voice: NOVA — OpenAI's most energetic / alive voice (higher pitch,
# more dynamic prosody than shimmer or onyx). Speed bumped to 1.10
# for an even more excited delivery.
SCRIPT = """YO! Welcome to GLOBAL VIBEZ DSG — and listen up, because this is NOT another app. This is your seat at a brand-new economy that pays you back!

Picture this: every single thing you do here puts coins in YOUR pocket. Every game played, every ride given, every meal cooked, every stream gone live, every chair booked, every business listed — ALL OF IT EARNS. That's the Vibez promise. That's the whole vibe!

Let's dive in. The Cyber Casino. Thirty-plus AAA card rooms — neon-drenched, live multiplayer. Spades, Bid Whist, Hearts, UNO, Pinochle, Euchre, Gin Rummy — the way they were MEANT to be played. Plus the crown jewel — Vibez Six-Five-Four! Chess, baccarat, blackjack, three-card poker, slots that pay in real currency. Every spin, every hand, every trick taken — you're earning real $VIBEZ.

Now let's talk HIGH ROLLER VIP — brand new! Ten-thousand-coin minimums. Diamond-tier blackjack, roulette, baccarat. VIP-gated. This is where the heavy hitters play, and the energy is UNREAL.

STREAMING. Go LIVE on DSG TV in thirty seconds flat. Plug your phone in, hit the button, and you're broadcasting to the world. Keep seventy percent of every tip, every gift, every Featured unlock. Top streamers get pinned on the Live Now Wall — gold-bordered, instant visibility. And the Media Master Hub? DSG TV, Vibe Radio, Music Group, AI Scout — your whole broadcast empire in one place. Plus we just dropped Regional Hubs — Chicago, Atlanta, NYC, LA, Miami, Houston — every impression feeds the House Revenue Pool.

The hustle hats. Drive a VibeRidez — keep seventy percent. Deliver Hungry VIBEZ — seventy percent. Cook as a Vibe Artisan from your kitchen — seventy percent. Host a Vibe Venue — seventy percent. Cinema creators? Eighty percent on every ticket sold!

Now the BIG one — the AMBASSADOR Care Package! This is YOU as a Walking Advertisement. Founder's Circle status. Scan a vendor, scan a sponsor, your Master QR Code walks them through onboarding. Restaurants get Hungry Vibez. Businesses get Yellow Pages. Sponsors get DSG TV ad slots. And you? You earn FOREVER. Chair Dividends quarterly. Referral Bounties instantly. Override Commissions on every transaction your vendors make. Hit the three-month Diamond Challenge — onboard three vendors, drive a thousand $VIBEZ, cast your first vote — and unlock Tier-Two Equity Status PLUS Pit Boss management rights!

And here's where it gets serious — EQUITY MASTER v2! The four-tier Value Matrix. Floor Level: five-hundred-thousand monthly gross unlocks an eighteen-dollar chair. Genesis Target: two-point-seven-five million gross unlocks a NINETY-NINE-dollar chair! Diamond Status: ten million gross — three-hundred-sixty dollars per chair! Platinum Scale: fifty million gross — EIGHTEEN-HUNDRED dollars per chair! Block-Release Governance — new chairs ONLY mint in fifty-thousand-unit blocks, gated by a fifty-one-percent majority vote. Twelve-month Crewmate lock-up. Twenty-dollar House Treasury buy-back floor!

The economy. Three billion VIBEZ burning to one-point-five billion. Five percent dynamic burn rate that drops as supply meets the floor. Every fee dollar from rides, restaurants, and gaming splits fifty-fifty — half to Buyback-and-burn, half to liquidity. The Credits standard locks in your value: One coin equals ten Credits. Thirty percent of all gross revenue flows to chair holders — paid every ninety days. Five-times mining multiplier for chair holders. $VIBEZ bridges to Solana at four-to-one.

ONE MILLION CHAIRS. Globally. Forever. The first cohort to sit at the table OWNS the network!

This is the Sovereign Casino. The Social Network. The Walking Advertisement Economy. One currency. One economy. YOU OWN IT.

Take your seat. RIGHT NOW.

GLOBAL VIBEZ DSG. Own the network. Feel the VIBEZ. LET'S GOOO!
"""

OUTPUT_PATH = Path("/app/frontend/public/landing-tour-narration.mp3")


async def main() -> None:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise SystemExit("EMERGENT_LLM_KEY missing from /app/backend/.env")

    tts = OpenAITextToSpeech(api_key=api_key)
    print(f"[narration] generating {len(SCRIPT)} chars via OpenAI TTS (nova · tts-1-hd · 1.10×)…")

    audio_bytes = await tts.generate_speech(
        text=SCRIPT.strip(),
        model="tts-1-hd",
        voice="nova",      # 🔥 most energetic / alive OpenAI voice
        response_format="mp3",
        speed=1.10,        # higher tempo → more excited feel
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_bytes(audio_bytes)
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"[narration] wrote {OUTPUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    asyncio.run(main())
