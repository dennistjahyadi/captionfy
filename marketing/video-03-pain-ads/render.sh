#!/usr/bin/env bash
# Render one of the video 03 ads.
#
#   ./render.sh                     # payonce → out/wordburn-03-pay-once.mp4
#   ./render.sh nointernet          # → out/wordburn-03-no-internet.mp4
#   ./render.sh justcaptions        # → out/wordburn-03-just-captions.mp4
#   ./render.sh nocredits           # → out/wordburn-03-no-credits.mp4
#   ./render.sh payonce --scale=0.5 # a quick half-size preview, under out/preview/
#
# Stages what the composition reads and nothing else: the voice from
# `input/voice/` into `public/payonce/`, and — through video 02's own staging
# script — the app recordings and the sound effects into `public/tutorial/`,
# because this ad is cut from the same captures and generates no footage of
# its own. Anything under `public/` is a copy; see the root .gitignore.
set -euo pipefail
cd "$(dirname "$0")"
here="$PWD"
remotion="$here/../remotion"

scale=""
ad="payonce"
for a in "$@"; do
  case "$a" in
    --scale=*) scale="$a" ;;
    payonce|nointernet|justcaptions|nocredits) ad="$a" ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

# One recording per ad, both from references/ at the repo root.
case "$ad" in
  payonce)    voice="$here/input/voice/pay_once_mark.mp3"; name="wordburn-03-pay-once" ;;
  nointernet) voice="$here/input/voice/offline_mark.mp3";  name="wordburn-03-no-internet" ;;
  justcaptions) voice="$here/input/voice/just_caption_mark.mp3"; name="wordburn-03-just-captions" ;;
  nocredits)  voice="$here/input/voice/no_credit_mark.mp3"; name="wordburn-03-no-credits" ;;
esac
if [ ! -f "$voice" ]; then
  echo "No voice at $voice — copy references/$(basename "$voice") there first." >&2
  exit 1
fi

# Video 02's recordings, sound and fonts. Its staging script wipes and refills
# `public/tutorial/` from `../video-02-tutorial/input/`, which is where the
# captures live; the flag names the subfolder.
WB_PROJECT="$here/../video-02-tutorial" "$here/../pipeline/sync-public.sh" tutorial

mkdir -p "$remotion/public/payonce"
cp "$voice" "$remotion/public/payonce/"

if [ -n "$scale" ]; then
  out="$here/out/preview/$name.mp4"
else
  out="$here/out/$name.mp4"
fi
mkdir -p "$(dirname "$out")"

(cd "$remotion" && npx remotion render src/index.ts "$ad" "$out" --log=error ${scale:+"$scale"})

echo
echo "$out"
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$out" | sed 's/^/duration  /'
