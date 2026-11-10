#!/usr/bin/env bash
# Usage: bash scripts/prepare-studio-journey.sh exterior.mp4 interior.mp4 [output-dir]
# The source clips are supplied by the operator; they are not downloaded here.
# Eight-second, silent, scroll-seekable edit at 24 fps:
#   0.0–4.8 s: exterior 8.0→1.1 s, reversed and retimed to 4.8 s;
#   4.2–8.0 s: interior 0.0→3.8 s, with a 0.6 s crossfade.
# Mobile crop placement: exterior 40%, interior 45% of available horizontal
# travel; vertical placement 50%. These are crop offsets, not subject positions.
# The transition keeps a visible image when scrolling stops halfway through it.
set -euo pipefail

exterior="${1:?Pass the supplied exterior film}"
interior="${2:?Pass the supplied interior film}"
output_dir="${3:-public/media/scroll-film/studio-journey}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

for input in "$exterior" "$interior"; do
  if [[ ! -f "$input" ]]; then
    echo "Input film does not exist: $input" >&2
    exit 1
  fi
done

journey_tmp="$(mktemp -d "${TMPDIR:-/tmp}/white-gloss-journey.XXXXXX")"
trap 'rm -rf -- "$journey_tmp"' EXIT

# Normalize pixel aspect, fit without stretching, then crop at the chosen offset.
fit() {
  local width="$1" height="$2" horizontal="$3"
  printf 'scale=ceil(iw*sar/2)*2:ih,setsar=1,scale=%s:%s:force_original_aspect_ratio=increase:force_divisible_by=2,crop=%s:%s:(iw-ow)*%s:(ih-oh)*0.5,setsar=1' \
    "$width" "$height" "$width" "$height" "$horizontal"
}

compose() {
  local width="$1" height="$2" exterior_x="$3" interior_x="$4" output="$5"
  local exterior_fit interior_fit filter
  exterior_fit="$(fit "$width" "$height" "$exterior_x")"
  interior_fit="$(fit "$width" "$height" "$interior_x")"
  filter="[0:v]trim=start=1.1:end=8,reverse,setpts=(PTS-STARTPTS)*4.8/6.9,${exterior_fit},fps=24,tpad=stop_mode=clone:stop_duration=0.1,trim=duration=4.8,settb=AVTB[exterior];"
  filter+="[1:v]trim=start=0:end=3.8,setpts=PTS-STARTPTS,${interior_fit},fps=24,tpad=stop_mode=clone:stop_duration=0.1,trim=duration=3.8,settb=AVTB[interior];"
  filter+="[exterior][interior]xfade=transition=fade:duration=0.6:offset=4.2,fps=24,trim=duration=8,format=yuv420p[out]"
  # FFV1 is lossless: only prepare-scroll-film.sh performs a lossy encode.
  # Masters retain the largest poster dimensions so posters are not upscaled.
  ffmpeg -hide_banner -loglevel error -nostdin -y -i "$exterior" -i "$interior" \
    -filter_complex "$filter" -map '[out]' -an -frames:v 192 \
    -c:v ffv1 -level 3 "$output"
}

compose 1920 1080 0.5 0.5 "$journey_tmp/landscape.mkv"
compose 720 1280 0.4 0.45 "$journey_tmp/portrait.mkv"
bash "$script_dir/prepare-scroll-film.sh" \
  "$journey_tmp/portrait.mkv" "$journey_tmp/landscape.mkv" "$output_dir"
