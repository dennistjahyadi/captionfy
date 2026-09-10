#!/usr/bin/env bash
#
# Download Indonesian and Vietnamese accented English from the Speech Accent
# Archive and convert it to 16-bit WAV.
#
#   ./scripts/fetch-accent-samples.sh                    5 speakers each
#   ./scripts/fetch-accent-samples.sh --count 10         10 each
#   ./scripts/fetch-accent-samples.sh --language korean --count 3
#
# Every speaker reads the same paragraph, so ground truth for hand-scoring word
# error rate is one known sentence rather than something you transcribe yourself.
# The paragraph is written to ground-truth.txt beside the audio.
#
# These recordings are clean and read aloud. They isolate the accent and nothing
# else: no music, no street, no phone mic, no code-switching. Treat a good score
# here as a floor, not as evidence the app survives real creator audio.
#
# Source: https://accent.gmu.edu  Licence: CC BY-NC-SA 4.0. Internal benchmarking
# only. Do not ship these files or any derivative of them.
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

OUT="test-clips/accent"
COUNT=5
LANGUAGES=(indonesian vietnamese)

while [ $# -gt 0 ]; do
  case "$1" in
    --count) COUNT="$2"; shift 2 ;;
    --language) LANGUAGES=("$2"); shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    -h|--help) sed -n '2,19p' "${BASH_SOURCE[0]}" | cut -c3-; exit 0 ;;
    *) echo "unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
done

command -v afconvert >/dev/null || { echo "afconvert is missing. This script needs macOS." >&2; exit 1; }

mkdir -p "$OUT"

# The paragraph every speaker in the archive reads.
cat > "$OUT/ground-truth.txt" <<'EOF'
Please call Stella. Ask her to bring these things with her from the store: six
spoons of fresh snow peas, five thick slabs of blue cheese, and maybe a snack for
her brother Bob. We also need a small plastic snake and a big toy frog for the
kids. She can scoop these things into three red bags, and we will go meet her
Wednesday at the train station.
EOF

echo "Ground truth written to $OUT/ground-truth.txt"

for language in "${LANGUAGES[@]}"; do
  for n in $(seq 1 "$COUNT"); do
    name="$language$n"
    wav="$OUT/$name.wav"
    if [ -f "$wav" ]; then
      echo "  $name.wav already here"
      continue
    fi

    mp3="$OUT/$name.mp3"
    if ! curl -fsSL --max-time 60 -A "Mozilla/5.0" \
        -o "$mp3" "https://accent.gmu.edu/audio/$name.mp3"; then
      echo "  $name: not available, skipping" >&2
      rm -f "$mp3"
      continue
    fi

    # 16 kHz mono 16-bit, which is what the pipeline reduces everything to anyway.
    # Converting here keeps the music mixer's inputs at one rate.
    afconvert -f WAVE -d LEI16@16000 -c 1 "$mp3" "$wav"
    rm -f "$mp3"
    echo "  $name.wav"
  done
done

cat <<EOF

Done. $(find "$OUT" -name '*.wav' | wc -l | tr -d ' ') clips in $OUT

Tag these clean-accented in the rig. For the music-under-voice half of the gate,
put a Creative Commons music bed through the mixer at several ratios:

  afconvert -f WAVE -d LEI16@16000 -c 1 bed.mp3 bed.wav
  ./scripts/mix-music-bed.py $OUT/indonesian1.wav bed.wav test-clips/music/ --snr 20 10 5 0

Then push them to the phone and pick them with "Pick audio":

  adb push test-clips /sdcard/Download/
EOF
