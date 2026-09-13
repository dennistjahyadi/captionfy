#!/usr/bin/env bash
#
# Puts the two speech models where the build can pack them into the APK.
#
# They are not in git: 83 MB of weights in a repository is a clone nobody wants
# and a diff nobody can read. This is the one thing in the project that needs the
# network, and it needs it at build time on this Mac, never on the user's phone.
#
# Idempotent. Run it as often as you like; it downloads only what is missing.
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

DEST="assets/models"

# Name, URL, exact byte count. The size is the check: a download killed halfway
# leaves a file that looks fine to `test -f` and then fails deep inside whisper's
# loader, which reads on the phone as a mysteriously empty transcript.
MODELS=(
  "ggml-base.en-q8_0.bin|https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en-q8_0.bin|81781811"
  "ggml-silero-v6.2.0.bin|https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin|885098"
)

mkdir -p "$DEST"

size_of() {
  # BSD stat here, GNU stat if this ever runs on Linux CI.
  stat -f%z "$1" 2>/dev/null || stat -c%s "$1"
}

for entry in "${MODELS[@]}"; do
  IFS='|' read -r name url bytes <<<"$entry"
  target="$DEST/$name"

  if [ -f "$target" ] && [ "$(size_of "$target")" = "$bytes" ]; then
    continue
  fi

  if [ -f "$target" ]; then
    echo "==> $name is $(size_of "$target") bytes, expected $bytes. Fetching it again."
    rm -f "$target"
  else
    echo "==> Fetching $name ($((bytes / 1024 / 1024)) MB)"
  fi

  # Into a .part first, renamed on success, so an interrupted run never leaves a
  # short file at the real name for the next build to pack.
  curl -fL --progress-bar -o "$target.part" "$url"

  got="$(size_of "$target.part")"
  if [ "$got" != "$bytes" ]; then
    rm -f "$target.part"
    echo "x $name came back $got bytes, expected $bytes. Not packing that." >&2
    exit 1
  fi

  mv "$target.part" "$target"
done
