#!/usr/bin/env bash
# Regenerate the entire landing-tour audio + video pipeline in one shot.
#
# Use this whenever you rewrite the tour script or change the narration
# voice. Running this script + `git add public/ build/` + redeploy
# guarantees every cache layer is in sync.
#
# Steps:
#   1. Regenerate the English narration MP3 (OpenAI TTS Nova).
#   2. Regenerate the i18n manifest (cue timings + duration).
#   3. Re-render the 9:16 vertical MP4 (ffmpeg → 1080×1920, captions
#      burned in, Nova audio muxed).
#   4. Mirror every asset from `public/` → `build/` so the deploy
#      pipeline ships the freshly-rendered bytes.
#   5. Print a summary so you can sanity-check sizes + timestamps
#      before you redeploy.
#
# Reqs: ffmpeg + the `EMERGENT_LLM_KEY` env var (or OPENAI_API_KEY).
set -euo pipefail

PUBLIC="/app/frontend/public"
BUILD="/app/frontend/build"
SCRIPTS="/app/backend/scripts"

echo "🎙  Step 1/4 — regenerating Nova narration MP3 …"
python "${SCRIPTS}/generate_landing_tour_narration.py"

echo "🗂  Step 2/4 — regenerating i18n manifest (cues + duration) …"
python "${SCRIPTS}/generate_landing_tour_i18n.py"

echo "🎬 Step 3/4 — re-rendering 9:16 vertical MP4 (this takes ~10 min) …"
RENDER_LANGS=en python "${SCRIPTS}/render_landing_tour_vertical.py"

echo "📦 Step 4/4 — mirroring public/ → build/ …"
for f in \
    landing-tour-narration.mp3 \
    landing-tour-narration-en.mp3 \
    landing-tour-tiktok-9x16.mp4 \
    landing-tour-tiktok-en-9x16.mp4 \
    landing-tour-i18n.json \
    gv-sw.js
do
    if [ -f "${PUBLIC}/${f}" ]; then
        cp "${PUBLIC}/${f}" "${BUILD}/${f}"
        echo "   ✓ ${f}"
    fi
done

echo ""
echo "✅ Done. Final asset sizes / timestamps:"
ls -la \
    "${PUBLIC}/landing-tour-narration-en.mp3" \
    "${PUBLIC}/landing-tour-tiktok-9x16.mp4" \
    "${PUBLIC}/landing-tour-i18n.json" \
    "${PUBLIC}/gv-sw.js"

echo ""
echo "💡  Now run: cd /app/backend && python -m pytest tests/regression_shield.py -k landing_tour"
echo "   Then commit + redeploy."
