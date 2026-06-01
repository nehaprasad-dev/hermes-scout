#!/usr/bin/env bash
# Converts .recordings/compliscore-demo.webm into:
#   - compliscore-demo.mp4  (h.264, social-ready, small file)
#   - compliscore-demo.gif  (palette-optimized, ~5-8MB)
set -euo pipefail

IN=".recordings/compliscore-demo.webm"
OUT_MP4="compliscore-demo.mp4"
OUT_GIF="compliscore-demo.gif"
PALETTE=".recordings/palette.png"

if [ ! -f "$IN" ]; then
  echo "missing $IN — run \`node scripts/record-demo.mjs\` first" >&2
  exit 1
fi

echo "→ encoding $OUT_MP4 (h.264)"
ffmpeg -y -loglevel error -i "$IN" \
  -vf "scale=1280:800:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset slow -crf 20 \
  -movflags +faststart \
  -an \
  "$OUT_MP4"

echo "→ generating palette for GIF"
ffmpeg -y -loglevel error -i "$IN" \
  -vf "fps=15,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff" \
  "$PALETTE"

echo "→ encoding $OUT_GIF (15fps, 960px wide)"
ffmpeg -y -loglevel error -i "$IN" -i "$PALETTE" \
  -lavfi "fps=15,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  "$OUT_GIF"

echo
ls -lh "$OUT_MP4" "$OUT_GIF"
