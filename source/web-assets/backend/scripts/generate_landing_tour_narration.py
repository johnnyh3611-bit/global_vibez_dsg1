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

# Voice: AndrewNeural is warm/confident/clear. Slightly faster (+8%) so
# the tour doesn't drag while still landing brand terms and payouts.
VOICE = "en-US-AndrewNeural"
RATE = "+8%"
CACHE_BUSTER = "2026-07-16-natural"

# Tour script — conversational pacing. We deliberately do NOT spell
# "D S G" letter-by-letter anymore (founder feedback Jul 2026).
# Each tuple is (tts_text, caption_text).
SEGMENTS: list[tuple[str, str]] = [
    (
        "YO! Welcome to Global Vibez DSG — and listen up, because this is "
        "NOT another app. This is your seat at a brand-new economy that pays "
        "you back!",
        "Welcome to GLOBAL VIBEZ DSG — your seat at a brand-new economy!",
    ),
    (
        "Picture this: everything you do here puts coins in YOUR pocket. "
        "Games, rides, meals, streams, chairs, businesses — it all earns. "
        "That's the Vibez promise.",
        "Every game · every ride · every meal · every stream · every chair · "
        "every business = you EARN.",
    ),
    (
        "Let's dive in. The Cyber Casino — thirty-plus AAA card rooms, "
        "neon-drenched, live multiplayer. Spades, Bid Whist, Hearts, UNO, "
        "and the crown jewel: Vibez six-fifty-four. Chess, baccarat, "
        "blackjack, slots — every hand earns real Vibez coins.",
        "Cyber Casino — 30+ AAA card rooms, neon-drenched, live multiplayer.",
    ),
    (
        "HIGH ROLLER VIP — ten-thousand-coin minimums. Diamond blackjack, "
        "roulette, baccarat. VIP-gated. Heavy hitters only.",
        "HIGH ROLLER VIP — 10,000-coin minimums · Diamond blackjack, "
        "roulette, baccarat · VIP-gated.",
    ),
    (
        "STREAMING. Go live on DSG TV in thirty seconds. Keep seventy percent "
        "of tips, gifts, and Featured unlocks. The Media Master Hub puts "
        "DSG TV, Vibe Radio, and Music Group in one place — and Regional "
        "Hubs feed the House Revenue Pool.",
        "Go LIVE on DSG TV in 30 seconds. Keep 70% of tips, gifts, and "
        "Featured unlocks.",
    ),
    (
        "DATING — real connections, no swipe fatigue. AI matchmaking, "
        "Gamer Dating, Cinema Dates, and Just For The Night for adults who "
        "want something casual. Your pace. Your safety.",
        "DATING — AI matchmaking, Gamer Dating, Cinema Dates, Just For The "
        "Night. Real connections, zero swipe-fatigue.",
    ),
    (
        "The hustle hats. Drive, deliver, cook, host — keep seventy percent. "
        "Cinema creators keep eighty percent on every ticket.",
        "Drive, deliver, cook, host — keep 70%. Cinema creators keep 80%.",
    ),
    (
        "The AMBASSADOR Care Package — you as a Walking Advertisement. "
        "Scan vendors, earn forever through chair dividends, referral "
        "bounties, and override commissions. Hit the Diamond Challenge and "
        "unlock Tier-Two Equity.",
        "AMBASSADOR Care Package — scan vendors, earn forever. Chair "
        "Dividends, Referral Bounties, Override Commissions.",
    ),
    (
        "EQUITY MASTER version two — Floor, Genesis, Diamond, and Platinum "
        "chair values, with Block-Release Governance so new chairs only mint "
        "when the network votes yes.",
        "EQUITY MASTER v2 — Floor, Genesis, Diamond, Platinum chair values + "
        "Block-Release Governance.",
    ),
    (
        "Two economies, one network. Three billion Vibez recirculate — they "
        "don't burn, they cycle. On Solana, the DSG token protects "
        "long-term holders. Chair holders earn thirty percent of gross "
        "revenue every ninety days, plus a five-times mining multiplier.",
        "Two economies, one network. 3B VIBEZ recirculate. DSG token burns on "
        "Solana. 5× mining for chair holders.",
    ),
    (
        "ONE MILLION CHAIRS. Globally. Forever. The first cohort to sit at "
        "the table OWNS the network!",
        "ONE MILLION CHAIRS. The first cohort OWNS the network.",
    ),
    (
        "Sovereign Casino. Social Network. Walking Advertisement Economy. "
        "One currency. One economy. YOU OWN IT!",
        "Sovereign Casino · Social Network · Walking Advertisement Economy. "
        "YOU OWN IT.",
    ),
    (
        "Take your seat. RIGHT NOW.",
        "Take your seat. RIGHT NOW.",
    ),
    (
        "Global Vibez DSG. Own the network. Feel the Vibez. Let's go!",
        "GLOBAL VIBEZ DSG. Own the network. Feel the VIBEZ.",
    ),
    (
        "And one more thing. Two quick spots. Listen close.",
        "— And one more thing. Two new spots. Listen close.",
    ),
    (
        "Commercial One. The Sovereign Casino — neon rooms, diamond tables, "
        "and every chip is real Vibez coins. Global Vibez DSG — take your seat.",
        "Commercial One — The Sovereign Casino. Every chip is REAL VIBEZ.",
    ),
    (
        "Commercial Two. From streamer to seat-holder. Keep seventy percent "
        "of tips, unlock Tier-Two Equity, and earn chair dividends forever. "
        "Global Vibez DSG — own the network.",
        "Commercial Two — streamer to seat-holder. TIER-TWO EQUITY, forever "
        "dividends.",
    ),
]


def clean_tts_text(text: str) -> str:
    """Normalize branding/numbers for natural Edge TTS delivery.

    Jul 2026: stop letter-spacing DSG ("D S G") — it made the tour sound
    like a spelling bee. Keep "DSG" intact; Edge TTS handles the acronym.
    """
    text = text.replace("$VIBEZ", "Vibez coins")
    text = re.sub(r"\bVIBEZ\b", "Vibez", text)
    # Collapse any legacy letter-spaced acronyms if someone re-introduces them.
    text = re.sub(r"\bD\s+S\s+G\b", "DSG", text)
    text = text.replace("Vibez 6-5-4", "Vibez six-fifty-four")
    text = text.replace("Vibez six five four", "Vibez six-fifty-four")
    text = text.replace("—", " — ")
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
