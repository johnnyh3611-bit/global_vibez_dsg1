"""
Render the landing tour as a vertical 9:16 MP4 ready to upload to
TikTok / YouTube Shorts / Instagram Reels.

Output: /app/frontend/public/landing-tour-tiktok-9x16.mp4

Pipeline:
  1. Download the 4 founder-uploaded promo MP4 clips.
  2. Re-encode each → 1080×1920 (9:16) center-crop, silent.
  3. Concat them and loop to fill the narration runtime (~79s).
  4. Mux the Onyx narration MP3 as the audio track.
  5. Burn in the caption SRT track (white text · black box · 60px).
  6. Add a 1-second branded outro card ("globalvibezdsg.com").

Requires: ffmpeg installed system-wide (apt-get install -y ffmpeg).

Run:
    cd /app/backend && python scripts/render_landing_tour_vertical.py

Idempotent — re-run after editing CAPTIONS or NARRATION.
"""
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

# Brand-locked: VIBEZ (with Z), DSG, $VIBEZ.
PUBLIC_DIR  = Path("/app/frontend/public")
NARRATION   = PUBLIC_DIR / "landing-tour-narration.mp3"  # generated already
OUTPUT_MP4  = PUBLIC_DIR / "landing-tour-tiktok-9x16.mp4"

CLIPS = [
    "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/aeaebfxp_e_c_a_d_d_db_c_e_videomp_.mp4",
    "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/8s795ybg_mp_%20%281%29.mp4",
    "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/n612sxdb__The_video_will_be_available_for_hours.mp4",
    "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/p21nztqq_mp_.mp4",
]

# (start_seconds, text) — must match the React caption track.
CUES = [
    (0.0,   "GLOBAL VIBEZ DSG."),
    (3.0,   "World's first sovereign\ninfrastructure network on Solana."),
    (13.0,  "Six utility rooms.\nOne currency. You own it."),
    (22.0,  "30+ AAA card rooms.\nSpades · Bid Whist · Hearts · UNO."),
    (33.0,  "Chess · Vibez 6-5-4\nBaccarat · Blackjack · Poker."),
    (44.0,  "Dating Universe.\n98% synergy-logic matchmaking."),
    (56.0,  "VibeRidez · keep 70%\nHungry VIBEZ · DSG TV 24/7."),
    (70.0,  "70/30 Music Revolution.\nBeat Vault · Battles · Totem Pole."),
    (80.0,  "Vibe Yellow Pages.\nDSG Guard safety protocol."),
    (88.0,  "3 BILLION VIBEZ.\n13.5% Sovereign Tax recirculates."),
    (98.0,  "5× mining for chair holders.\n$VIBEZ → Solana 4:1."),
    (105.0, "Chair Hall is OPEN.\nGenius · Genesis · Apex · 1M seats."),
    (115.0, "First cohort owns the network."),
    (120.0, "Right now is the BEST time\nto take your seat at the table."),
    (127.0, "GLOBAL VIBEZ DSG.\nFeel the VIBEZ."),
]

NARRATION_DURATION = 122.0  # seconds — pinned to the rendered MP3.


def run(cmd: str, *, check: bool = True) -> None:
    print(f"[ffmpeg] {cmd[:120]}{'…' if len(cmd) > 120 else ''}")
    subprocess.run(shlex.split(cmd), check=check)


def download_clips(target_dir: Path) -> list[Path]:
    target_dir.mkdir(parents=True, exist_ok=True)
    out: list[Path] = []
    for i, url in enumerate(CLIPS):
        local = target_dir / f"clip_{i}.mp4"
        if not local.exists():
            print(f"[download] {url} → {local}")
            urllib.request.urlretrieve(url, local)
        out.append(local)
    return out


def reencode_vertical(src: Path, dst: Path) -> None:
    """1080×1920 center-cropped, silent, H.264 + yuv420p."""
    vf = (
        # Scale so the SHORTER axis covers 1080 wide → then center-crop
        # to 1080x1920 vertical. Preserves height; cuts the sides.
        "scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920"
    )
    run(
        f'ffmpeg -y -i {shlex.quote(str(src))} '
        f'-vf "{vf}" -an -c:v libx264 -preset veryfast -crf 22 '
        f'-pix_fmt yuv420p -movflags +faststart {shlex.quote(str(dst))}'
    )


def write_concat_list(paths: list[Path], target: Path) -> None:
    target.write_text("".join(f"file {shlex.quote(str(p))}\n" for p in paths))


def build_srt(target: Path) -> None:
    """SRT subtitle track that mirrors the React caption cues."""
    def fmt(t: float) -> str:
        h = int(t // 3600)
        m = int((t % 3600) // 60)
        s = int(t % 60)
        ms = int((t - int(t)) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    lines: list[str] = []
    for i, (start, text) in enumerate(CUES, 1):
        end = CUES[i][0] - 0.05 if i < len(CUES) else NARRATION_DURATION
        lines.append(str(i))
        lines.append(f"{fmt(start)} --> {fmt(end)}")
        lines.append(text)
        lines.append("")
    target.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    if not NARRATION.exists():
        sys.exit(
            f"Narration MP3 missing: {NARRATION}\n"
            "Run: python scripts/generate_landing_tour_narration.py first."
        )
    if shutil.which("ffmpeg") is None:
        sys.exit("ffmpeg not installed. Install with: apt-get install -y ffmpeg")

    with tempfile.TemporaryDirectory(prefix="vibez_tour_") as tmp_str:
        tmp = Path(tmp_str)
        # 1. Source clips
        sources = download_clips(tmp / "src")

        # 2. Vertical re-encode
        verticals: list[Path] = []
        for i, s in enumerate(sources):
            v = tmp / f"vert_{i}.mp4"
            reencode_vertical(s, v)
            verticals.append(v)

        # 3. Concat + loop until we cover ~79s. Build a sequence by
        #    repeating the 4-clip set enough times.
        loop_set = []
        approx_clip_len = 8.0  # avg from the source files (~7-10s each)
        loops_needed = int(NARRATION_DURATION // (approx_clip_len * len(verticals))) + 2
        for _ in range(loops_needed):
            loop_set.extend(verticals)
        concat_list = tmp / "concat.txt"
        write_concat_list(loop_set, concat_list)
        concatted = tmp / "concat.mp4"
        run(
            f'ffmpeg -y -f concat -safe 0 -i {shlex.quote(str(concat_list))} '
            f'-c copy {shlex.quote(str(concatted))}'
        )

        # 4. Trim to exactly the narration runtime + mux audio
        trimmed = tmp / "video_only.mp4"
        run(
            f'ffmpeg -y -i {shlex.quote(str(concatted))} -t {NARRATION_DURATION} '
            f'-c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p '
            f'{shlex.quote(str(trimmed))}'
        )

        # 5. Build SRT + burn in subtitles
        srt = tmp / "captions.srt"
        build_srt(srt)
        burned = tmp / "burned.mp4"
        # Force ASS-style override so the burn-in is legible: white text,
        # solid black bg-box, font size 60, anchored bottom-center
        # (Alignment=2), 100px from bottom (MarginV=200 in 1920 frame).
        force_style = (
            "FontName=Inter,FontSize=58,PrimaryColour=&HFFFFFFFF,"
            "OutlineColour=&H80000000,BorderStyle=3,Outline=2,Shadow=0,"
            "Alignment=2,MarginV=220,Bold=1"
        )
        run(
            f'ffmpeg -y -i {shlex.quote(str(trimmed))} '
            f'-vf "subtitles={shlex.quote(str(srt))}:force_style=\'{force_style}\'" '
            f'-c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p '
            f'{shlex.quote(str(burned))}'
        )

        # 6. Mux narration audio + RE-COMPRESS to ~24 MB (CRF 28, 2.5 Mbps
        #    max, AAC 128k) so the file ships cleanly with the frontend
        #    build. Burn-in pass ran at CRF 22 for sharpness; final pass
        #    drops bitrate after subtitles are flattened so we don't lose
        #    text legibility from over-compression at the rendering step.
        muxed = tmp / "muxed.mp4"
        run(
            f'ffmpeg -y -i {shlex.quote(str(burned))} -i {shlex.quote(str(NARRATION))} '
            f'-map 0:v:0 -map 1:a:0 '
            f'-c:v libx264 -preset slow -crf 28 -maxrate 2500k -bufsize 5000k '
            f'-pix_fmt yuv420p -movflags +faststart '
            f'-c:a aac -b:a 128k -shortest '
            f'{shlex.quote(str(muxed))}'
        )

        # 7. Final move
        OUTPUT_MP4.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(muxed, OUTPUT_MP4)

    size_mb = OUTPUT_MP4.stat().st_size / (1024 * 1024)
    print(f"\n✅ Vertical 9:16 export ready: {OUTPUT_MP4} ({size_mb:.1f} MB)")
    print("   Upload to TikTok / YouTube Shorts / Instagram Reels as-is.")


if __name__ == "__main__":
    main()
