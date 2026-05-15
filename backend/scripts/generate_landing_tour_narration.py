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
# Tone: ENTHUSIASTIC / hype / inviting — May-13-2026 founder ask:
#   "the guy that's talking in the video should be more enthused, and
#    make sure you give more information... more information on how the
#    different ways you could earn and stream and make money, and what
#    is the Vibe Yellow Pages, a little bit more detail about the app
#    and how the functionality, and how it works."
# Length: ~360 words → ~145-155s at Onyx 1.0× speed (2:25-2:35 min).
# Voice: switched to "shimmer" for higher-energy delivery; falls back
# to "onyx" on regenerate if shimmer ever gets deprecated.
SCRIPT = """Welcome to GLOBAL VIBEZ DSG — and listen, this is not another app, this is your seat at a brand-new economy!

Picture this: every single thing you do here puts coins in your pocket. Yes — every game you play, every ride you give, every meal you cook, every stream you go live on, every chair you book, every business you list. ALL of it earns. That's the whole point. That's the Vibez promise.

Let's break it down. First — the Cyber Casino. Thirty-plus AAA card rooms, neon-drenched, live multiplayer. Spades, Bid Whist, Hearts, UNO, Pinochle, Euchre, Gin Rummy — the way they're MEANT to be played. Plus our crown jewel — Vibez Six-Five-Four — chess, baccarat, blackjack, three-card poker, slots that pay in real currency. Every spin, every hand, every trick taken — you're earning $VIBEZ.

Now — STREAMING. This is huge. Go live on DSG TV in 30 seconds flat. Plug your phone in, hit the button, and you're broadcasting to the world. You keep seventy percent of every tip, every gift, every Featured tier unlock. We pin top streamers on the Live Now Wall — gold-bordered, instant visibility. Tag-team with another creator? You both earn. Get followed? Your followers get a push notification the SECOND you go live. That's retention. That's growth. That's money.

The hustle hats. Drive a VibeRidez, you keep seventy percent of every fare. Deliver Hungry VIBEZ — seventy percent. Cook as a Vibe Artisan from your kitchen, build a customer base — seventy percent. Host a Vibe Venue, list your spot, book private parties — seventy percent.

And here's a game-changer — the VIBE YELLOW PAGES. This is your local-business launchpad. Geo-pinned. Verified. Every Mom and Pop shop in your city gets a free profile, hyper-local sponsorship deals, in-app coupons, AND they earn coins every time a Vibez user books or buys. We backed it with the DSG Guard safety protocol so listings are real, people are real, transactions are real.

Independent artists — keep seventy percent of every beat, every track, every collab. Beat Vault. Freestyle Battles. Collab Matchmaker. The Totem Pole leaderboard. The seventy-thirty Revolution is HERE.

Now the economy itself — and this is what makes it work. Three billion VIBEZ coins, burning down to one-point-five billion. Five percent dynamic burn rate that drops as supply meets the floor. Every fee dollar from rides, restaurants, and gaming splits fifty-fifty — half goes straight into Buyback-and-burn, half strengthens the liquidity pool. The Credits standard locks in your value: One coin equals ten Credits. One dollar equals one hundred Credits. A thirteen-point-five percent Sovereign Tax recirculates every win back to the players. A five-times mining multiplier locked in for chair holders. $VIBEZ bridges to Solana at four-to-one.

And the chair. Apex. Genesis. Genius. One million seats. Globally. Forever. The first cohort to sit at the table owns the network.

This is the Sovereign Casino plus Social Network. One currency. One economy. You OWN it.

Take your seat. RIGHT NOW.

GLOBAL VIBEZ DSG. Own the network. Feel the VIBEZ.
"""

OUTPUT_PATH = Path("/app/frontend/public/landing-tour-narration.mp3")


async def main() -> None:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise SystemExit("EMERGENT_LLM_KEY missing from /app/backend/.env")

    tts = OpenAITextToSpeech(api_key=api_key)
    print(f"[narration] generating {len(SCRIPT)} chars via OpenAI TTS (shimmer · tts-1-hd)…")

    audio_bytes = await tts.generate_speech(
        text=SCRIPT.strip(),
        model="tts-1-hd",
        voice="shimmer",
        response_format="mp3",
        speed=1.05,
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_bytes(audio_bytes)
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"[narration] wrote {OUTPUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    asyncio.run(main())
