"""
One-shot script — generates the LANDING-PAGE TOUR narration MP3 using
OpenAI TTS (Onyx voice, HD model). Output saved to:
    /app/frontend/public/landing-tour-narration.mp3

Run:
    cd /home/johnnie/master-project && python scripts/generate_landing_tour_narration.py

To re-generate after editing the SCRIPT below, just re-run.
The MP3 is committed alongside the React frontend so deploy doesn't
need a runtime API call. Idempotent — overwrites the existing file.
"""
import asyncio
import os
import sys
from pathlib import Path

# Ensure /home/johnnie/master-project is on sys.path when invoked from any cwd.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv  # noqa: E402
from emergentintegrations.llm.openai import OpenAITextToSpeech  # noqa: E402

load_dotenv()

# Founder-locked spelling: VIBEZ (with Z), DSG, $VIBEZ for the token.
# Tone: HIGH-ENERGY / hype / inviting — Feb-15-2026 founder ask:
#   "Make sure the voice of the character that is talking is more
#    energetic and alive and excited about Global Vibez DSG. The tour
#    can be a little bit longer due to all the new information."
# Length: ~680 words → ~4:30-4:45 at speed=1.10× (nova voice).
# 2026-05-16 update: ADDED two 15-second founder commercials at the end
# of the existing 3:45 script, per dsg_commercial_scripts.pdf. Did NOT
# remove anything from the original narration.
# Voice: NOVA — OpenAI's most energetic / alive voice (higher pitch,
# more dynamic prosody than shimmer or onyx). Speed bumped to 1.10
# for an even more excited delivery.
SCRIPT = """YO! Welcome to GLOBAL VIBEZ DSG — and listen up, because this is NOT another app. This is your seat at a brand-new economy that pays you back!

Picture this: every single thing you do here puts coins in YOUR pocket. Every game played, every ride given, every meal cooked, every stream gone live, every chair booked, every business listed — ALL OF IT EARNS. That's the Vibez promise. That's the whole vibe!

Let's dive in. The Cyber Casino. Thirty-plus AAA card rooms — neon-drenched, live multiplayer. Spades, Bid Whist, Hearts, UNO, Pinochle, Euchre, Gin Rummy — the way they were MEANT to be played. Plus the crown jewel — Vibez Six-Five-Four! Chess, baccarat, blackjack, three-card poker, slots that pay in real currency. Every spin, every hand, every trick taken — you're earning real $VIBEZ.

Now let's talk HIGH ROLLER VIP — brand new! Ten-thousand-coin minimums. Diamond-tier blackjack, roulette, baccarat. VIP-gated. This is where the heavy hitters play, and the energy is UNREAL.

STREAMING. Go LIVE on DSG TV in thirty seconds flat. Plug your phone in, hit the button, and you're broadcasting to the world. Keep seventy percent of every tip, every gift, every Featured unlock. Top streamers get pinned on the Live Now Wall — gold-bordered, instant visibility. And the Media Master Hub? DSG TV, Vibe Radio, Music Group, AI Scout — your whole broadcast empire in one place. Plus we just dropped Regional Hubs — Chicago, Atlanta, NYC, LA, Miami, Houston — every impression feeds the House Revenue Pool.

Now the heart of it — DATING. Real connections, no swipe-fatigue. Start with AI-powered compatibility matching — our Vigilant Matchmaker scores every spark before you even say hi. Gamer Dating? Match through Spades, UNO, Chess — date by PLAYING together. Cultural Onboarding rooms welcome new members with their own community first. Hit the Blind Auction — anonymous bids on connection, identity revealed at the close. Voice Mirror compatibility check before you commit your camera. Memory Bank vault — your shared video memories, only between you two. And Cinema Dates? Sync-watch a movie with your match, frame-accurate, with live chat overlay. Just For The Night rooms for adults who want something casual — verified, safe, opt-in age-gated. VibeRidez gets you there safely, every ride driver background-checked. Your date, your pace, your safety, your earn.

The hustle hats. Drive a VibeRidez — keep seventy percent. Deliver Hungry VIBEZ — seventy percent. Cook as a Vibe Artisan from your kitchen — seventy percent. Host a Vibe Venue — seventy percent. Cinema creators? Eighty percent on every ticket sold!

Now the BIG one — the AMBASSADOR Care Package! This is YOU as a Walking Advertisement. Founder's Circle status. Scan a vendor, scan a sponsor, your Master QR Code walks them through onboarding. Restaurants get Hungry Vibez. Businesses get Yellow Pages. Sponsors get DSG TV ad slots. And you? You earn FOREVER. Chair Dividends quarterly. Referral Bounties instantly. Override Commissions on every transaction your vendors make. Hit the three-month Diamond Challenge — onboard three vendors, drive a thousand $VIBEZ, cast your first vote — and unlock Tier-Two Equity Status PLUS Pit Boss management rights!

And here's where it gets serious — EQUITY MASTER v2! The four-tier Value Matrix. Floor Level: five-hundred-thousand monthly gross unlocks an eighteen-dollar chair. Genesis Target: two-point-seven-five million gross unlocks a NINETY-NINE-dollar chair! Diamond Status: ten million gross — three-hundred-sixty dollars per chair! Platinum Scale: fifty million gross — EIGHTEEN-HUNDRED dollars per chair! Block-Release Governance — new chairs ONLY mint in fifty-thousand-unit blocks, gated by a fifty-one-percent majority vote. Twelve-month Crewmate lock-up. Twenty-dollar House Treasury buy-back floor!

The economy. Two economies, one network. Three billion VIBEZ — fixed forever — RECIRCULATE. Forty percent feeds tournament prize pools. Thirty percent powers the platform treasury. Thirty percent locks into a seventy-two-hour vault, then releases right back into circulation. Coins don't BURN — they CYCLE. Every spend funds someone's next win. And on Solana? The DSG token has its OWN engine — seven-hundred-fifty million total, burning down to a three-hundred-fifty million floor, protecting long-term holders. The Credits standard locks in your value: One coin equals ten Credits. Thirty percent of all gross revenue flows to chair holders — paid every ninety days. Five-times mining multiplier for chair holders.

ONE MILLION CHAIRS. Globally. Forever. The first cohort to sit at the table OWNS the network!

This is the Sovereign Casino. The Social Network. The Walking Advertisement Economy. One currency. One economy. YOU OWN IT.

Take your seat. RIGHT NOW.

GLOBAL VIBEZ DSG. Own the network. Feel the VIBEZ. LET'S GOOO!

— And one more thing. Two new spots. Fifteen seconds each. Listen close.

Commercial One. The Sovereign Casino. Picture this — neon-soaked card rooms. Diamond-tier blackjack tables. And every chip you win? That's REAL $VIBEZ in your wallet. Coins that pay your rent. This isn't a casino. It's an ECONOMY. Global Vibez DSG — take your seat.

Commercial Two. From streamer, to seat-holder. Go live, build your audience, KEEP seventy percent of every tip. Onboard three vendors and unlock TIER-TWO EQUITY — chair dividends every ninety days, FOREVER. Your hustle just became ownership. Global Vibez DSG — own the network.
"""

OUTPUT_PATH = Path("/app/frontend/public/landing-tour-narration.mp3")


async def main() -> None:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise SystemExit("EMERGENT_LLM_KEY missing from /home/johnnie/master-project/.env")

    tts = OpenAITextToSpeech(api_key=api_key)

    # OpenAI TTS caps input at 4096 chars. The narration grew past that
    # in May 2026 when the two founder-commercial spots were appended.
    # Split on paragraph boundaries into segments, generate each MP3,
    # concatenate the raw bytes — MP3 frames are self-delimiting so
    # this stitches losslessly with no re-encode.
    full = SCRIPT.strip()
    CHUNK_LIMIT = 3800  # safety buffer under the 4096 hard cap
    paragraphs = [p.strip() for p in full.split("\n\n") if p.strip()]
    chunks: list[str] = []
    buf = ""
    for para in paragraphs:
        candidate = (buf + "\n\n" + para) if buf else para
        if len(candidate) <= CHUNK_LIMIT:
            buf = candidate
        else:
            if buf:
                chunks.append(buf)
            buf = para
    if buf:
        chunks.append(buf)

    print(f"[narration] generating {len(full)} chars in {len(chunks)} TTS chunk(s) (nova · tts-1-hd · 1.10×)…")

    all_bytes = b""
    for i, chunk in enumerate(chunks, start=1):
        print(f"[narration]   chunk {i}/{len(chunks)} · {len(chunk)} chars")
        audio_bytes = await tts.generate_speech(
            text=chunk,
            model="tts-1-hd",
            voice="nova",      # 🔥 most energetic / alive OpenAI voice
            response_format="mp3",
            speed=1.10,        # higher tempo → more excited feel
        )
        all_bytes += audio_bytes

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_bytes(all_bytes)
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"[narration] wrote {OUTPUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    asyncio.run(main())
