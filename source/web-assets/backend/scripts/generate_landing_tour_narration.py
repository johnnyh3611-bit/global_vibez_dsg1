"""
One-shot script — generates the LANDING-PAGE TOUR narration MP3 using
Microsoft Edge TTS (JennyNeural, energetic prosody). Output saved to:
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
import subprocess
from pathlib import Path

import edge_tts

# Resolve frontend/public from this script's location:
# backend/scripts -> backend -> source/web-assets -> frontend/public
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public"
OUTPUT_MP3 = OUTPUT_DIR / "landing-tour-narration.mp3"
OUTPUT_MP3_EN = OUTPUT_DIR / "landing-tour-narration-en.mp3"
I18N_PATH = OUTPUT_DIR / "landing-tour-i18n.json"

# Founder-locked spelling: VIBEZ (with Z), DSG, $VIBEZ for the token.
# Tone: HIGH-ENERGY / hype / inviting — 2026-07-15 founder ask:
#   "Complete overhaul of the tour video. Update the script to match
#    the current app. Make the voice sound more human and excited."
# Length: ~150 words → ~74s at rate=+25% (JennyNeural).
SEGMENTS: list[tuple[str, str]] = [
    (
        "intro",
        "YO! Welcome to GLOBAL VIBEZ DSG! The only platform that pays you "
        "back for everything you already love. Games. Dating. Rides. Food. "
        "Venues. Streaming. ONE token. ONE wallet. Real rewards.",
    ),
    (
        "casino",
        "Step into the Cyber Casino. 30 plus AAA card rooms. Spades, Bid "
        "Whist, Hearts, UNO, Vibez 654, blackjack, roulette, slots. Every "
        "hand, every spin, every trick, pays VIBEZ coins.",
    ),
    (
        "dating",
        "Find your Player 2. AI matchmaker, Cinema Dates, Voice Mirror, "
        "Just For The Night. Real connections, zero swipe fatigue.",
    ),
    (
        "hustle",
        "Drive a VibeRidez, deliver Hungry Vibez, cook as a Vibe Artisan, "
        "host a Vibe Venue, keep 70 percent of every transaction.",
    ),
    (
        "stream",
        "Go live on DSG TV, drop a track, build your broadcast empire, keep "
        "70 percent of tips, gifts, and ticket sales.",
    ),
    (
        "chair",
        "The chair is the crown. One million chairs. 13.5 percent Sovereign "
        "Tax recirculates. 5x mining. Ambassador dividends. "
        "This is ownership.",
    ),
    (
        "outro",
        "Take your seat NOW at Global Vibez DSG. Own the network. Feel the "
        "VIBEZ. LET'S GOOO!",
    ),
]

VOICE = "en-US-JennyNeural"
RATE = "+25%"


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


async def generate_segment(text: str, tmp_dir: Path, idx: int) -> Path:
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
        f"with {VOICE} @ {RATE}…"
    )
    segment_paths: list[Path] = []
    for i, (_, text) in enumerate(SEGMENTS):
        seg = await generate_segment(text, tmp_dir, i)
        segment_paths.append(seg)
        print(
            f"[narration]   segment {i + 1}/{len(SEGMENTS)} "
            f"-> {seg} ({seg.stat().st_size / 1024:.1f} KB)"
        )

    # Concatenate MP3 frames losslessly.
    all_bytes = b"".join(p.read_bytes() for p in segment_paths)
    OUTPUT_MP3.write_bytes(all_bytes)
    OUTPUT_MP3_EN.write_bytes(all_bytes)
    print(f"[narration] wrote {OUTPUT_MP3} ({len(all_bytes) / 1024:.1f} KB)")

    # Build i18n manifest from exact segment durations.
    cues: list[dict[str, float | str]] = []
    t = 0.0
    for (_, text), seg in zip(SEGMENTS, segment_paths):
        d = mp3_duration(seg)
        cues.append({"t": round(t, 3), "text": text})
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
                    "?v=2026-07-15-overhaul"
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
