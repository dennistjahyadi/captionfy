#!/usr/bin/env bash
#
# Boot an Android emulator on this Mac and run the rig on it, no phone needed.
#
#   ./run-on-emulator.sh             boot the AVD, build the debug APK, start Metro
#   ./run-on-emulator.sh <avd>       use a named AVD instead of the first one
#   ./run-on-emulator.sh --cold      ignore the saved snapshot and boot from scratch
#   ./run-on-emulator.sh --fresh     wipe app data first (re-downloads 465 MB of models)
#
# Emulator timings are never reportable. Use ./install-on-phone.sh for numbers.
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

# Cold boots on a first run can be slow. Snapshot resumes take a few seconds.
BOOT_TIMEOUT=300

AVD=""
COLD=false
FRESH=false
for arg in "$@"; do
  case "$arg" in
    --cold) COLD=true ;;
    --fresh) FRESH=true ;;
    -h|--help) sed -n '2,11p' "${BASH_SOURCE[0]}" | cut -c3-; exit 0 ;;
    -*) echo "unknown option: $arg (try --help)" >&2; exit 2 ;;
    *)
      [ -z "$AVD" ] || { echo "give at most one AVD name" >&2; exit 2; }
      AVD="$arg" ;;
  esac
done

step() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mx\033[0m %s\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- Android SDK

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
[ -d "$SDK" ] || fail "No Android SDK at $SDK. Install it via Android Studio, or set ANDROID_HOME."
ADB="$SDK/platform-tools/adb"
EMULATOR="$SDK/emulator/emulator"
[ -x "$ADB" ] || fail "adb is missing from $SDK/platform-tools. Install 'Android SDK Platform-Tools' in Android Studio."
[ -x "$EMULATOR" ] || fail "No emulator at $SDK/emulator. Install 'Android Emulator' in Android Studio."
export ANDROID_HOME="$SDK"

# -------------------------------------------------------------------- the AVD

step "Picking an emulator"
"$ADB" start-server >/dev/null 2>&1 || true

AVDS="$("$EMULATOR" -list-avds 2>/dev/null | grep -v '^[[:space:]]*$' || true)"
if [ -z "$AVDS" ]; then
  cat >&2 <<'EOF'

x No emulators are defined. In Android Studio:

    Device Manager > Add a device > pick a phone > choose an arm64-v8a
    system image. On Apple Silicon the x86_64 images are not worth running.

  Then run this script again.
EOF
  exit 1
fi

[ -n "$AVD" ] || AVD="${CAPTIONFY_AVD:-}"
if [ -z "$AVD" ]; then
  AVD="$(echo "$AVDS" | head -1)"
  if [ "$(echo "$AVDS" | wc -l | tr -d ' ')" -gt 1 ]; then
    echo "    more than one AVD. Using $AVD. Pass a name, or set CAPTIONFY_AVD, to pick another:"
    echo "$AVDS" | sed 's/^/      /'
  fi
fi
echo "$AVDS" | grep -qxF "$AVD" || fail "No AVD called $AVD. There is: $(echo "$AVDS" | tr '\n' ' ')"

# The console answers with the AVD name once it is up, which is how a serial gets
# tied back to the AVD that owns it. Anything else running stays untouched.
serial_for_avd() {
  local candidate name
  for candidate in $("$ADB" devices | awk 'NR>1 && $1 ~ /^emulator-/ && $2=="device" {print $1}'); do
    name="$("$ADB" -s "$candidate" emu avd name 2>/dev/null | head -1 | tr -d '\r')"
    if [ "$name" = "$AVD" ]; then
      echo "$candidate"
      return
    fi
  done
}

# ---------------------------------------------------------------------- boot

SERIAL="$(serial_for_avd)"

if [ -n "$SERIAL" ]; then
  echo "    $AVD is already running ($SERIAL), reusing it"
else
  LOG="${TMPDIR:-/tmp}/captionfy-emulator.log"
  step "Booting $AVD"

  if [ "$COLD" = true ]; then
    nohup "$EMULATOR" -avd "$AVD" -no-boot-anim -no-snapshot-load >"$LOG" 2>&1 &
  else
    nohup "$EMULATOR" -avd "$AVD" -no-boot-anim >"$LOG" 2>&1 &
  fi
  EMU_PID=$!

  # The emulator dies quietly on a corrupt snapshot or a missing system image,
  # so watch the process as well as the clock.
  alive_or_fail() {
    kill -0 "$EMU_PID" 2>/dev/null && return
    tail -3 "$LOG" >&2 2>/dev/null || true
    fail "The emulator quit. Full output in $LOG. A corrupt snapshot is the usual cause, so try --cold."
  }

  DEADLINE=$(( SECONDS + BOOT_TIMEOUT ))
  while [ -z "$SERIAL" ]; do
    alive_or_fail
    [ "$SECONDS" -lt "$DEADLINE" ] || fail "$AVD never appeared on adb within ${BOOT_TIMEOUT}s. Output in $LOG."
    sleep 2
    SERIAL="$(serial_for_avd)"
  done

  echo "    $SERIAL, waiting for Android to finish starting"
  while [ "$("$ADB" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
    alive_or_fail
    [ "$SECONDS" -lt "$DEADLINE" ] || fail "$AVD booted but never reported ready within ${BOOT_TIMEOUT}s. Try --cold."
    sleep 2
  done

  "$ADB" -s "$SERIAL" shell wm dismiss-keyguard >/dev/null 2>&1 || true
fi

# ----------------------------------------------------------------- hand over

ABI="$("$ADB" -s "$SERIAL" shell getprop ro.product.cpu.abi | tr -d '\r')"
step "$AVD is up ($SERIAL, $ABI)"
echo "    Building against it now. The emulator keeps running after Ctrl-C stops Metro,"
echo "    so a second run of this script skips the boot."

# install-on-phone.sh reads ANDROID_SERIAL, so the build, the install and the ABI
# choice all stay in one place rather than being duplicated here.
export ANDROID_SERIAL="$SERIAL"
if [ "$FRESH" = true ]; then
  exec ./install-on-phone.sh --dev --fresh
else
  exec ./install-on-phone.sh --dev
fi
