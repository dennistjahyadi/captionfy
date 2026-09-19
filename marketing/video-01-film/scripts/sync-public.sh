#!/usr/bin/env bash
# Stage this video's media where Remotion can see it.
#
# Remotion serves `staticFile()` out of its own `public/`, which is out of git
# for the reason the root .gitignore gives: it is nothing but copies. The source
# of truth for each kind lives where it belongs — the fonts in `assets/fonts/`
# with the burn-in module, the app recordings and the export in this project's
# `input/app/` where `capture.mjs` and `pull-export.mjs` put them, the voice in
# `input/voice/`.
#
# Run it before any render. `render.mjs` does.
set -euo pipefail
cd "$(dirname "$0")/.."

project="$PWD"
public="$project/../remotion/public"

# The app's own faces, and the demo clip the other three ads use.
"$project/../remotion/sync-assets.sh" >/dev/null

mkdir -p "$public/film"

# A clean slate each time, except `preview.mp4` — that is the render being
# sheeted by storyboard.mjs, not an input, and wiping it here would mean the
# storyboard could only ever be built in the same command as the render.
find "$public/film" -maxdepth 1 -type f ! -name 'preview.mp4' -delete

shopt -s nullglob
copied=0
for f in "$project"/input/app/*.mp4; do
  case "$(basename "$f")" in
    *.raw.mp4) continue ;;   # the un-normalised screenrecord capture, VFR, not for the timeline
  esac
  cp "$f" "$public/film/"
  copied=$((copied + 1))
done

voice=0
for f in "$project"/input/voice/*; do
  cp "$f" "$public/film/"
  voice=$((voice + 1))
done

echo "public/film is ready — $copied app clip(s), $voice voice file(s)"

if [ "$copied" -eq 0 ]; then
  echo "  ! No app clips. Boot an emulator and run:  node scripts/capture.mjs && node scripts/pull-export.mjs" >&2
fi
