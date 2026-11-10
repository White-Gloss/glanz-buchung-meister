#!/usr/bin/env bash
# Usage: bash scripts/prepare-scroll-film.sh portrait.mp4 landscape.mp4 [output-dir]
# Alternatively set SCROLL_FILM_OUTPUT_DIR to prepare a review/test export.
# Inputs with a different aspect ratio are center-cropped, never stretched.
# For an intentional off-center composition, crop the source before this step.
set -euo pipefail
portrait="${1:?Pass the original portrait film}"
landscape="${2:?Pass the original landscape film}"
output_dir="${3:-${SCROLL_FILM_OUTPUT_DIR:-public/media/scroll-film}}"

for input in "$portrait" "$landscape"; do
  if [[ ! -f "$input" ]]; then
    echo "Input film does not exist: $input" >&2
    exit 1
  fi
done

# Normalize non-square source pixels before fitting the target rectangle.
# Cropping after aspect-preserving scaling guarantees the advertised dimensions.
fit() {
  local width="$1" height="$2"
  printf 'scale=ceil(iw*sar/2)*2:ih,setsar=1,scale=%s:%s:force_original_aspect_ratio=increase:force_divisible_by=2,crop=%s:%s,setsar=1' \
    "$width" "$height" "$width" "$height"
}

mkdir -p "$output_dir"
ffmpeg -hide_banner -loglevel error -y -i "$portrait" -map 0:v:0 -an -vf "$(fit 540 960)" \
  -c:v libx264 -preset slow -crf 23 -g 3 -keyint_min 3 -sc_threshold 0 -bf 0 \
  -pix_fmt yuv420p -movflags +faststart "$output_dir/classic-mobile-540.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$landscape" -map 0:v:0 -an -vf "$(fit 1280 720)" \
  -c:v libx264 -preset slow -crf 21 -g 3 -keyint_min 3 -sc_threshold 0 -bf 0 \
  -pix_fmt yuv420p -movflags +faststart "$output_dir/classic-desktop-1280.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$portrait" -map 0:v:0 -frames:v 1 -vf "$(fit 720 1280)" -quality 84 "$output_dir/poster-mobile-720.webp"
ffmpeg -hide_banner -loglevel error -y -i "$portrait" -map 0:v:0 -frames:v 1 -vf "$(fit 540 960)" -quality 80 "$output_dir/poster-mobile-540.webp"
ffmpeg -hide_banner -loglevel error -y -i "$landscape" -map 0:v:0 -frames:v 1 -vf "$(fit 1280 720)" -quality 84 "$output_dir/poster-desktop-1280.webp"
ffmpeg -hide_banner -loglevel error -y -i "$landscape" -map 0:v:0 -frames:v 1 -vf "$(fit 1920 1080)" -quality 84 "$output_dir/poster-desktop-1920.webp"
