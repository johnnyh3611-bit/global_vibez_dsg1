"""
One-shot script — generates the LANDING-PAGE TOUR narration MP3 using
Microsoft Edge TTS (AndrewNeural, slower/clearer delivery). Output saved to:
    source/web-assets/frontend/public/landing-tour-narration.mp3

Run from the backend directory:
    . .venv/bin/activate
    python scripts/generate_landing_tour_narration.py

To re-generate after editing the SCRIPT below, just re-run.
The MP3 is committed alongside the React frontend so deploy doesn't
need a runtime API call. Idempotent — overwrites the existing file.
"""

import asyncio
import json
import re
import subprocess
from pathlib import Path

import edge_tts

# Resolve frontend/public from this script's location:
# backend/scripts -> backend -> source/web-assets -> frontend/public
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public"
OUTPUT_MP3 = OUTPUT_DIR / "landing-tour-narration.mp3"
OUTPUT_MP3_EN = OUTPUT_DIR / "landing-tour-narration-en.mp3"
I18N_PATH = OUTPUT_DIR / "landing-tour-i18n.json"

# Voice: AndrewNeural is warm/confident/clear. Rate +0% keeps the delivery
# slow enough for every term (Global Vibez DSG, Vibez 6-5-4, percentages,
# equity tiers) to land, while still feeling human and energetic.
VOICE = "en-US-AndrewNeural"
RATE = "+0%"
CACHE_BUSTER = "2026-07-15-v2"

# Original Feb-2026 tour script, lightly normalized for Edge TTS so the
# branding and numbers are enunciated cleanly.
# Each tuple is (tts_text, caption_text).  `tts_text` is what the voice
# speaks; `caption_text` is what appears on-screen in the player.
SEGMENTS: list[tuple[str, str]] = [
    (
        "YO! Welcome to Global Vibez D S G — and listen up, because this is "
        "NOT another app. This is your seat at a brand-new economy that pays "
        "you back!",
        "Welcome to GLOBAL VIBEZ DSG — your seat at a brand-new economy!",
    ),
    (
        "Picture this: every single thing you do here puts coins in YOUR "
        "pocket. Every game played, every ride given, every meal cooked, "
        "every "
        "stream gone live, every chair booked, every business listed — ALL OF "
        "IT EARNS. That's the Vibez promise. That's the whole vibe!",
        "Every game · every ride · every meal · every stream · every chair · "
        "every business = you EARN.",
    ),
    (
        "Let's dive in. The Cyber Casino. Thirty-plus AAA card rooms — "
        "neon-drenched, live multiplayer. Spades, Bid Whist, Hearts, UNO, "
        "Pinochle, Euchre, Gin Rummy — the way they were MEANT to be played. "
        "Plus the crown jewel — Vibez six five four! Chess, baccarat, "
        "blackjack, three-card poker, slots that pay in real currency. Every "
        "spin, every hand, every trick taken — you're earning real Vibez "
        "coins.",
        "Cyber Casino — 30+ AAA card rooms, neon-drenched, live multiplayer.",
    ),
    (
        "Now let's talk HIGH ROLLER VIP — brand new! Ten-thousand-coin "
        "minimums. Diamond-tier blackjack, roulette, baccarat. VIP-gated. "
        "This is where the heavy hitters play, and the energy is UNREAL.",
        "HIGH ROLLER VIP — 10,000-coin minimums · Diamond blackjack, "
        "roulette, baccarat · VIP-gated.",
    ),
    (
        "STREAMING. Go LIVE on D S G TV in thirty seconds flat. Plug your "
        "phone in, hit the button, and you're broadcasting to the world. Keep "
        "seventy percent of every tip, every gift, every Featured unlock. Top "
        "streamers get pinned on the Live Now Wall — gold-bordered, instant "
        "visibility. And the Media Master Hub? D S G TV, Vibe Radio, Music "
        "Group, AI Scout — your whole broadcast empire in one place. Plus we "
        "just dropped Regional Hubs — Chicago, Atlanta, NYC, LA, Miami, "
        "Houston — every impression feeds the House Revenue Pool.",
        "Go LIVE on DSG TV in 30 seconds. Keep 70% of tips, gifts, and "
        "Featured unlocks.",
    ),
    (
        "Now the heart of it — DATING. Real connections, no swipe-fatigue. "
        "Start with AI-powered compatibility matching — our Vigilant "
        "Matchmaker scores every spark before you even say hi. Gamer Dating? "
        "Match through Spades, UNO, Chess — date by PLAYING together. "
        "Cultural "
        "Onboarding rooms welcome new members with their own community first. "
        "Hit the Blind Auction — anonymous bids on connection, identity "
        "revealed at the close. Voice Mirror compatibility check before you "
        "commit your camera. Memory Bank vault — your shared video memories, "
        "only between you two. And Cinema Dates? Sync-watch a movie with your "
        "match, frame-accurate, with live chat overlay. Just For The Night "
        "rooms for adults who want something casual — verified, safe, opt-in "
        "age-gated. VibeRidez gets you there safely, every ride driver "
        "background-checked. Your date, your pace, your safety, your earn.",
        "DATING — AI matchmaking, Gamer Dating, Cinema Dates, Just For The "
        "Night. Real connections, zero swipe-fatigue.",
    ),
    (
        "The hustle hats. Drive a VibeRidez — keep seventy percent. Deliver "
        "Hungry Vibez — seventy percent. Cook as a Vibe Artisan from your "
        "kitchen — seventy percent. Host a Vibe Venue — seventy percent. "
        "Cinema creators? Eighty percent on every ticket sold!",
        "Drive, deliver, cook, host — keep 70%. Cinema creators keep 80%.",
    ),
    (
        "Now the BIG one — the AMBASSADOR Care Package! This is YOU as a "
        "Walking Advertisement. Founder's Circle status. Scan a vendor, "
        "scan a "
        "sponsor, your Master QR Code walks them through onboarding. "
        "Restaurants get Hungry Vibez. Businesses get Yellow Pages. "
        "Sponsors get D S G TV ad slots. And you? You earn FOREVER. Chair "
        "Dividends quarterly. Referral Bounties instantly. Override "
        "Commissions on every transaction your vendors make. Hit the "
        "three-month Diamond Challenge — onboard three vendors, drive a "
        "thousand Vibez coins, cast "
        "your first vote — and unlock Tier-Two Equity Status PLUS Pit Boss "
        "management rights!",
        "AMBASSADOR Care Package — scan vendors, earn forever. Chair "
        "Dividends, Referral Bounties, Override Commissions.",
    ),
    (
        "And here's where it gets serious — EQUITY MASTER version 2! The "
        "four-tier Value Matrix. Floor Level: five-hundred-thousand monthly "
        "gross unlocks an eighteen-dollar chair. Genesis Target: "
        "two-point-seven-five million gross unlocks a NINETY-NINE-dollar "
        "chair! Diamond Status: ten million gross — three-hundred-sixty "
        "dollars per chair! Platinum Scale: fifty million gross — "
        "EIGHTEEN-HUNDRED dollars per chair! Block-Release Governance — new "
        "chairs ONLY mint in fifty-thousand-unit blocks, gated by a "
        "fifty-one-percent majority vote. Twelve-month Crewmate lock-up. "
        "Twenty-dollar House Treasury buy-back floor!",
        "EQUITY MASTER v2 — Floor, Genesis, Diamond, Platinum chair values + "
        "Block-Release Governance.",
    ),
    (
        "The economy. Two economies, one network. Three billion Vibez — fixed "
        "forever — RECIRCULATE. Forty percent feeds tournament prize pools. "
        "Thirty percent powers the platform treasury. Thirty percent locks "
        "into a seventy-two-hour vault, then releases right back into "
        "circulation. Coins don't BURN — they CYCLE. Every spend funds "
        "someone's next win. And on Solana? The D S G token has its OWN "
        "engine — seven-hundred-fifty million total, burning down to a "
        "three-hundred-fifty million floor, protecting long-term holders. The "
        "Credits standard locks in your value: One coin equals ten Credits. "
        "Thirty percent of all gross revenue flows to chair holders — paid "
        "every ninety days. Five-times mining multiplier for chair holders.",
        "Two economies, one network. 3B VIBEZ recirculate. DSG token burns on "
        "Solana. 5× mining for chair holders.",
    ),
    (
        "ONE MILLION CHAIRS. Globally. Forever. The first cohort to sit at "
        "the table OWNS the network!",
        "ONE MILLION CHAIRS. The first cohort OWNS the network.",
    ),
    (
        "This is the Sovereign Casino. The Social Network. The Walking "
        "Advertisement Economy. One currency. One economy. YOU OWN IT!",
        "Sovereign Casino · Social Network · Walking Advertisement Economy. "
        "YOU OWN IT.",
    ),
    (
        "Take your seat. RIGHT NOW.",
        "Take your seat. RIGHT NOW.",
    ),
    (
        "GLOBAL VIBEZ DSG. Own the network. Feel the VIBEZ. LET'S GOOO!",
        "GLOBAL VIBEZ DSG. Own the network. Feel the VIBEZ.",
    ),
    (
        "— And one more thing. Two new spots. Fifteen seconds each. Listen "
        "close.",
        "— And one more thing. Two new spots. Listen close.",
    ),
    (
        "Commercial One. The Sovereign Casino. Picture this — neon-soaked "
        "card rooms. Diamond-tier blackjack tables. And every chip you win? "
        "That's REAL Vibez coins in your wallet. Coins that pay your rent. "
        "This isn't a casino. It's an ECONOMY. Global Vibez D S G — take your "
        "seat.",
        "Commercial One — The Sovereign Casino. Every chip is REAL VIBEZ.",
    ),
    (
        "Commercial Two. From streamer, to seat-holder. Go live, build your "
        "audience, KEEP seventy percent of every tip. Onboard three vendors "
        "and unlock TIER-TWO EQUITY — chair dividends every ninety days, "
        "FOREVER. Your hustle just became ownership. Global Vibez D S G — own "
        "the network.",
        "Commercial Two — streamer to seat-holder. TIER-TWO EQUITY, forever "
        "dividends.",
    ),
]


def clean_tts_text(text: str) -> str:
    """Normalize branding/numbers so Edge TTS enunciates cleanly."""
    # Spell out DSG letter-by-letter, keep VIBEZ as Vibez, drop $ prefix.
    text = text.replace("$VIBEZ", "Vibez coins")
    text = text.replace("$VIBEZ", "Vibez coins")
    text = re.sub(r"\bVIBEZ\b", "Vibez", text)
    text = re.sub(r"\bDSG\b", "D S G", text)
    # Read the flagship card game as digits, not a hyphenated range.
    text = text.replace("Vibez 6-5-4", "Vibez six five four")
    # Force a brief pause after em-dashes for clarity.
    text = text.replace("—", " — ")
    # Collapse multiple spaces introduced above.
    text = re.sub(r" +", " ", text)
    return text.strip()


def mp3_duration(path: Path) -> float:
    return float(
        subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ]
        )
        .decode()
        .strip()
    )


async def generate_segment(
    text: str, tmp_dir: Path, idx: int
) -> Path:
    out = tmp_dir / f"segment_{idx:02d}.mp3"
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
    audio = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    out.write_bytes(audio)
    return out


async def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp_dir = OUTPUT_DIR / ".tts-tmp"
    tmp_dir.mkdir(exist_ok=True)

    print(
        f"[narration] generating {len(SEGMENTS)} segment(s) "
        f"with {VOICE} @ {RATE}..."
    )
    segment_paths: list[Path] = []
    for i, (tts_text, _caption) in enumerate(SEGMENTS):
        cleaned = clean_tts_text(tts_text)
        seg = await generate_segment(cleaned, tmp_dir, i)
        segment_paths.append(seg)
        print(
            f"[narration]   segment {i + 1}/{len(SEGMENTS)} "
            f"-> {seg} ({seg.stat().st_size / 1024:.1f} KB, "
            f"{mp3_duration(seg):.2f}s)"
        )

    # Concatenate MP3 frames losslessly.
    all_bytes = b"".join(p.read_bytes() for p in segment_paths)
    OUTPUT_MP3.write_bytes(all_bytes)
    OUTPUT_MP3_EN.write_bytes(all_bytes)
    print(f"[narration] wrote {OUTPUT_MP3} ({len(all_bytes) / 1024:.1f} KB)")

    # Build i18n manifest from exact segment durations.
    cues: list[dict[str, float | str]] = []
    t = 0.0
    for (_, caption), seg in zip(SEGMENTS, segment_paths):
        d = mp3_duration(seg)
        cues.append({"t": round(t, 3), "text": caption})
        t += d

    manifest = {
        "default": "en",
        "languages": {
            "en": {
                "label": "English",
                "native": "English",
                "rtl": False,
                "audio": (
                    "/landing-tour-narration-en.mp3"
                    f"?v={CACHE_BUSTER}"
                ),
                "duration": round(t, 3),
                "cues": cues,
            }
        },
    }
    I18N_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[narration] updated {I18N_PATH} (duration={t:.3f}s)")

    # Clean tmp.
    for p in segment_paths:
        p.unlink()
    tmp_dir.rmdir()


if __name__ == "__main__":
    asyncio.run(main())
