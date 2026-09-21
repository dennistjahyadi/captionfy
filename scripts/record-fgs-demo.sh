#!/usr/bin/env bash
#
# Record the Play Console "Foreground service permissions" declaration video.
#
# Play wants proof that the foreground service does user-visible work that
# continues while the app is off-screen. That is exactly what an export is:
# `src/export/run.ts` starts TranscriptionService, ticks it with a percentage,
# and stops it when the file lands. So the demo is one export, backgrounded
# half way through, with the shade open over it.
#
# The taps are not in here. A picker's rows and an editor's buttons move with
# the device, the clip and the style, so the script owns the parts that are the
# same every time — the recorder, Home, the shade, the pull — and stops at each
# point where a human has to touch the phone. Every stop says what to do.
#
# Usage:  ./scripts/record-fgs-demo.sh [--serial <adb serial>]
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PACKAGE="com.wordburn.app"
OUT_DIR="play-assets"
OUT="$OUT_DIR/fgs-demo.mp4"
REMOTE="/sdcard/fgs-demo.mp4"

# 720p-equivalent on a 1080x2340 panel, and a bitrate that keeps 90 seconds
# well under Play's 100 MB. screenrecord caps a single invocation at 180s.
SIZE="720x1560"
BITRATE="5000000"
TIME_LIMIT=180

SERIAL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --serial) SERIAL="$2"; shift 2 ;;
    -h|--help) sed -n '3,17p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
ADB="$SDK/platform-tools/adb"
[ -x "$ADB" ] || { echo "x adb is missing from $SDK/platform-tools" >&2; exit 1; }

if [ -z "$SERIAL" ]; then
  SERIAL="$("$ADB" devices | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1}' | head -1)"
fi
[ -n "$SERIAL" ] || {
  echo "x No phone on adb. Plug the A54 in and accept the USB-debugging prompt." >&2
  echo "  (An emulator is skipped on purpose: it is not the shipping behaviour.)" >&2
  exit 1
}

sh() { "$ADB" -s "$SERIAL" shell "$@"; }
step() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
pause() { printf '\033[1;33m    %s\033[0m\n    press return when done ... ' "$1"; read -r _; }

MODEL="$(sh getprop ro.product.model | tr -d '\r')"
RELEASE="$(sh getprop ro.build.version.release | tr -d '\r')"
SDK_INT="$(sh getprop ro.build.version.sdk | tr -d '\r')"
step "Target: $MODEL, Android $RELEASE (API $SDK_INT), $SERIAL"

# Which foreground service type this recording will actually show. The service
# picks at runtime and the gate is API 35, so a phone below that demonstrates
# dataSync however the manifest reads.
if [ "$SDK_INT" -ge 35 ]; then
  echo "    This records the mediaProcessing path."
else
  echo "    API $SDK_INT is under 35, so TranscriptionService starts as dataSync."
  echo "    This recording demonstrates FOREGROUND_SERVICE_DATA_SYNC, not MEDIA_PROCESSING."
fi

# ------------------------------------------------------------------ a clean frame

step "Clearing the shade so nobody else's notifications are in the video"
sh service call notification 1 >/dev/null 2>&1 || true
sh cmd statusbar collapse >/dev/null 2>&1 || true

cat <<'EOF'

    Two things only a hand can do, and both are in the deliverable:

      1. Airplane mode on. The app is offline anyway, and it stops a message
         arriving in the shade half way through the take.
      2. The gallery the picker will show has to be clean. Either the phone
         has nothing personal on it, or put one test clip on it and clear the
         rest. The picker is on camera.

EOF
pause "Do both on the phone"

step "Installing the release APK"
APK="android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || { echo "x No APK at $APK. Run ./run.sh first." >&2; exit 1; }
"$ADB" -s "$SERIAL" install -r -d "$APK"

sh rm -f "$REMOTE" >/dev/null 2>&1 || true

# ------------------------------------------------------------------ the take

step "Rolling"
sh screenrecord --size "$SIZE" --bit-rate "$BITRATE" --time-limit "$TIME_LIMIT" "$REMOTE" &
RECORDER=$!
sleep 2

step "Opening Wordburn"
sh monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 3

pause "Pick a clip long enough that the export runs 20-30s, get to Export, and tap Save to gallery"

step "Letting the render get going"
sleep 4

step "Home — the app goes off-screen with the render still running"
sh input keyevent KEYCODE_HOME
sleep 3

step "Opening the shade over it"
sh cmd statusbar expand-notifications
# The notification carries a live percentage, so dwelling on it is the proof:
# the number climbs with the app off-screen. Long-pressing would open the
# channel sheet and cover the thing being demonstrated.
sleep 8

step "Closing the shade"
sh cmd statusbar collapse
sleep 2

step "Back into Wordburn"
sh monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 3

pause "Let the export finish and leave the Saved screen on camera for a few seconds"

# SIGINT has to reach screenrecord on the phone. Killing the adb client here
# would leave the remote process running and the mp4 without its moov atom,
# which is a file no player will open.
step "Cut"
sh pkill -INT screenrecord >/dev/null 2>&1 || true
wait "$RECORDER" 2>/dev/null || true
sleep 3

# ------------------------------------------------------------------ the file

step "Pulling"
mkdir -p "$OUT_DIR"
"$ADB" -s "$SERIAL" pull "$REMOTE" "$OUT" >/dev/null
sh rm -f "$REMOTE" >/dev/null 2>&1 || true

BYTES="$(stat -f%z "$OUT")"
MB="$(echo "scale=1; $BYTES/1048576" | bc)"
step "Done"
echo "    $(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
echo "    ${MB} MB"
if command -v ffprobe >/dev/null 2>&1; then
  ffprobe -v error -show_entries format=duration -show_entries stream=width,height \
    -of default=noprint_wrappers=1 "$OUT" | sed 's/^/    /'
fi
echo
echo "    Watch it before uploading. Check: nothing personal in the picker,"
echo "    nobody else's notifications in the shade, and the percentage on the"
echo "    ongoing notification visibly climbing while Wordburn is off-screen."
