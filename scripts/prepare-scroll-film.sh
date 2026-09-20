#!/usr/bin/env bash
# Usage: bash scripts/prepare-scroll-film.sh portrait.mp4 landscape.mp4
set -euo pipefail
portrait="${1:?Pass the original portrait film}"
landscape="${2:?Pass the original landscape film}"
output_dir="public/media/scroll-film"
mkdir -p "$output_dir"
ffmpeg -hide_banner -loglevel error -y -i "$portrait" -an -vf scale=540:960 \
  -c:v libx264 -preset slow -crf 23 -g 3 -keyint_min 3 -sc_threshold 0 -bf 0 \
  -pix_fmt yuv420p -movflags +faststart "$output_dir/classic-mobile-540.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$landscape" -an -vf scale=1280:720 \
  -c:v libx264 -preset slow -crf 21 -g 3 -keyint_min 3 -sc_threshold 0 -bf 0 \
  -pix_fmt yuv420p -movflags +faststart "$output_dir/classic-desktop-1280.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$portrait" -frames:v 1 -vf scale=720:1280 -quality 84 "$output_dir/poster-mobile-720.webp"
ffmpeg -hide_banner -loglevel error -y -i "$portrait" -frames:v 1 -vf scale=540:960 -quality 80 "$output_dir/poster-mobile-540.webp"
ffmpeg -hide_banner -loglevel error -y -i "$landscape" -frames:v 1 -vf scale=1280:720 -quality 84 "$output_dir/poster-desktop-1280.webp"
ffmpeg -hide_banner -loglevel error -y -i "$landscape" -frames:v 1 -quality 84 "$output_dir/poster-desktop-1920.webp"
