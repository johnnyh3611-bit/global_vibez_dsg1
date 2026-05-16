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
        # Concat the clip stack ONCE with consistent codec params, then
        # let `-stream_loop -1 + -t {duration}` extend it to whatever
        # length the narration needs. Using `-c copy` here is safe
        # because every input came from `reencode_vertical()` and shares
        # encoder settings.
        concat_list = tmp / "concat.txt"
        write_concat_list(verticals, concat_list)
        concatted = tmp / "concat.mp4"
        run(f'ffmpeg -y -f concat -safe 0 -i {shlex.quote(str(concat_list))} -c copy {shlex.quote(str(concatted))}')
        # Loop the concat stack to cover the full narration runtime.
        # `-stream_loop -1` repeats the input infinitely; `-t {duration}`
        # caps at exactly the audio length. This single ffmpeg invocation
        # replaces the old buggy "loop N times then trim down" logic
        # which silently produced short videos when the source stack
        # was shorter than the narration.
        trimmed = tmp / "video_only.mp4"
        run(
            f'ffmpeg -y -stream_loop -1 -i {shlex.quote(str(concatted))} -t {duration} '
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
