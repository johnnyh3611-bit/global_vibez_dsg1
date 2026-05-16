"""
Render the landing tour as a vertical 9:16 MP4 ready to upload to
TikTok / YouTube Shorts / Instagram Reels.

Renders ONE export per language present in the i18n manifest at:
    /app/frontend/public/landing-tour-i18n.json

Outputs:
    /app/frontend/public/landing-tour-tiktok-{lang}-9x16.mp4

The English export ALSO duplicates to the legacy filename for
backwards-compat:
    /app/frontend/public/landing-tour-tiktok-9x16.mp4

To limit which languages render this run, set:
    RENDER_LANGS=en,es,pt,zh python scripts/render_landing_tour_vertical.py

Pipeline (per language):
  1. Re-encode the 4 founder MP4 clips → 1080×1920 (9:16) center-crop.
  2. Concat + trim to the language's narration runtime.
  3. Burn in the language's caption track (white text · black box).
  4. Mux the language's narration MP3 as the audio track.
  5. Final encode @ CRF 28 / 2.5 Mbps for shippable file size.

Requires: ffmpeg (apt-get install -y ffmpeg) + the i18n manifest +
the per-language MP3s (run generate_landing_tour_i18n.py first).
"""
import json
import os
import shlex
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import List

# Brand-locked: VIBEZ (with Z), DSG, $VIBEZ.
PUBLIC_DIR  = Path("/app/frontend/public")
MANIFEST    = PUBLIC_DIR / "landing-tour-i18n.json"
LEGACY_MP4  = PUBLIC_DIR / "landing-tour-tiktok-9x16.mp4"

CLIPS = [
    "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/aeaebfxp_e_c_a_d_d_db_c_e_videomp_.mp4",
    "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/8s795ybg_mp_%20%281%29.mp4",
    "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/n612sxdb__The_video_will_be_available_for_hours.mp4",
    "https://customer-assets.emergentagent.com/job_social-connect-953/artifacts/p21nztqq_mp_.mp4",
]


def run(cmd: str, *, check: bool = True) -> None:
    print(f"[ffmpeg] {cmd[:120]}{'…' if len(cmd) > 120 else ''}")
    subprocess.run(shlex.split(cmd), check=check)


def download_clips(target_dir: Path) -> List[Path]:
    target_dir.mkdir(parents=True, exist_ok=True)
    out: List[Path] = []
    for i, url in enumerate(CLIPS):
        local = target_dir / f"clip_{i}.mp4"
        if not local.exists():
            print(f"[download] {url} → {local}")
            urllib.request.urlretrieve(url, local)
        out.append(local)
    return out


def reencode_vertical(src: Path, dst: Path) -> None:
    vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"
    run(
        f'ffmpeg -y -i {shlex.quote(str(src))} '
        f'-vf "{vf}" -an -c:v libx264 -preset veryfast -crf 22 '
        f'-pix_fmt yuv420p -movflags +faststart {shlex.quote(str(dst))}'
    )


def write_concat_list(paths: List[Path], target: Path) -> None:
    target.write_text("".join(f"file {shlex.quote(str(p))}\n" for p in paths))


def build_srt(target: Path, cues: list, total_duration: float) -> None:
    """SRT subtitle track from the language's caption cues."""
    def fmt(t: float) -> str:
        h = int(t // 3600)
        m = int((t % 3600) // 60)
        s = int(t % 60)
        ms = int((t - int(t)) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    lines: List[str] = []
    for i, cue in enumerate(cues, 1):
        start = float(cue["t"])
        end = float(cues[i]["t"]) - 0.05 if i < len(cues) else total_duration
        # Keep cues at least 0.5s on screen.
        if end - start < 0.5:
            end = start + 0.5
        lines.append(str(i))
        lines.append(f"{fmt(start)} --> {fmt(end)}")
        # Wrap long captions into 2 lines for the burn-in.
        text = cue["text"]
        if len(text) > 42 and " " in text:
            half = len(text) // 2
            split = text.rfind(" ", 0, half + 10)
            if split > 0:
                text = text[:split] + "\n" + text[split + 1:]
        lines.append(text)
        lines.append("")
    target.write_text("\n".join(lines), encoding="utf-8")


def render_language(lang: str, track: dict, sources: List[Path]) -> Path:
    """Render the 9:16 export for one language."""
    # Strip any cache-buster query string (e.g. "?v=nova-2026-05-16")
    # that the i18n manifest may carry for browser cache invalidation —
    # those aren't part of the filename on disk.
    audio_rel = track["audio"].split("?", 1)[0].lstrip("/")
    audio_path = PUBLIC_DIR / audio_rel
    if not audio_path.exists():
        raise SystemExit(f"Audio missing for {lang}: {audio_path}")
    duration = float(track["duration"])
    cues = track["cues"]
    output = PUBLIC_DIR / f"landing-tour-tiktok-{lang}-9x16.mp4"

    print(f"\n══ Rendering {lang} ({track.get('native', lang)}) → {output.name} ══")

    with tempfile.TemporaryDirectory(prefix=f"vtour_{lang}_") as tmp_str:
        tmp = Path(tmp_str)
        # Vertical re-encode of source clips.
        verticals = []
        for i, s in enumerate(sources):
            v = tmp / f"vert_{i}.mp4"
            reencode_vertical(s, v)
            verticals.append(v)
        # Loop concat to cover the duration.
        approx_clip_len = 8.0
        loops_needed = int(duration // (approx_clip_len * len(verticals))) + 2
        loop_set = []
        for _ in range(loops_needed):
            loop_set.extend(verticals)
        concat_list = tmp / "concat.txt"
        write_concat_list(loop_set, concat_list)
        concatted = tmp / "concat.mp4"
        run(f'ffmpeg -y -f concat -safe 0 -i {shlex.quote(str(concat_list))} -c copy {shlex.quote(str(concatted))}')
        # Trim to duration.
        trimmed = tmp / "video_only.mp4"
        run(
            f'ffmpeg -y -i {shlex.quote(str(concatted))} -t {duration} '
            f'-c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p '
            f'{shlex.quote(str(trimmed))}'
        )
        # Burn captions.
        srt = tmp / "captions.srt"
        build_srt(srt, cues, duration)
        burned = tmp / "burned.mp4"
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
        # Mux audio + final compress.
        muxed = tmp / "muxed.mp4"
        run(
            f'ffmpeg -y -i {shlex.quote(str(burned))} -i {shlex.quote(str(audio_path))} '
            f'-map 0:v:0 -map 1:a:0 '
            f'-c:v libx264 -preset slow -crf 28 -maxrate 2500k -bufsize 5000k '
            f'-pix_fmt yuv420p -movflags +faststart '
            f'-c:a aac -b:a 128k -shortest '
            f'{shlex.quote(str(muxed))}'
        )
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(muxed, output)
    size_mb = output.stat().st_size / (1024 * 1024)
    print(f"✅ {output} ({size_mb:.1f} MB)")
    return output


def main() -> None:
    if shutil.which("ffmpeg") is None:
        sys.exit("ffmpeg not installed. Install with: apt-get install -y ffmpeg")
    if not MANIFEST.exists():
        sys.exit(
            f"Manifest missing: {MANIFEST}\n"
            "Run scripts/generate_landing_tour_i18n.py first."
        )

    manifest = json.loads(MANIFEST.read_text())
    requested = os.getenv("RENDER_LANGS")
    if requested:
        wanted = [l.strip() for l in requested.split(",") if l.strip()]
    else:
        # Default: render English + the three top global non-English markets.
        wanted = ["en", "es", "pt", "zh"]
    wanted = [l for l in wanted if l in manifest["languages"]]
    if not wanted:
        sys.exit(f"None of the requested languages exist in the manifest. Available: {list(manifest['languages'])}")

    print(f"Rendering 9:16 vertical exports for: {', '.join(wanted)}")

    # Reuse the same downloaded source clips across every language.
    with tempfile.TemporaryDirectory(prefix="vtour_src_") as src_str:
        sources = download_clips(Path(src_str) / "src")
        last_path = None
        for lang in wanted:
            last_path = render_language(lang, manifest["languages"][lang], sources)
            # Update legacy filename with the EN render for backwards-compat.
            if lang == "en":
                shutil.copy2(last_path, LEGACY_MP4)
                print(f"  ↳ also wrote legacy {LEGACY_MP4.name}")

    print("\n✅ All requested 9:16 exports complete.")


if __name__ == "__main__":
    main()
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
