#!/usr/bin/env bash
#
# Build the Stage 0 rig and put it on the phone plugged into this Mac.
#
#   ./install-on-phone.sh            release build: build, install, launch
#   ./install-on-phone.sh --dev      debug build wired to Metro, for UI work
#   ./install-on-phone.sh --logs     ...then tail the pipeline log
#   ./install-on-phone.sh --fresh    wipe app data first (re-downloads 465 MB of models)
#   ./install-on-phone.sh --skip-build   install the APK that is already built
#
# Only the release build produces reportable timings.
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

PACKAGE="com.captionfy.app"
APK="android/app/build/outputs/apk/release/app-release.apk"
DEBUG_APK="android/app/build/outputs/apk/debug/app-debug.apk"
METRO_PORT=8081

TAIL_LOGS=false
FRESH=false
SKIP_BUILD=false
DEV=false
for arg in "$@"; do
  case "$arg" in
    --logs) TAIL_LOGS=true ;;
    --fresh) FRESH=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --dev) DEV=true ;;
    -h|--help) sed -n '2,11p' "${BASH_SOURCE[0]}" | cut -c3-; exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mx\033[0m %s\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- Android SDK

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
[ -d "$SDK" ] || fail "No Android SDK at $SDK. Install it via Android Studio, or set ANDROID_HOME."
ADB="$SDK/platform-tools/adb"
[ -x "$ADB" ] || fail "adb is missing from $SDK/platform-tools. Install 'Android SDK Platform-Tools' in Android Studio."
export ANDROID_HOME="$SDK"

command -v java >/dev/null || fail "No java on PATH. Gradle needs a JDK 17 or newer."

# ------------------------------------------------------------------- the phone

step "Looking for a phone"
"$ADB" start-server >/dev/null 2>&1 || true

if "$ADB" devices | awk 'NR>1 && $2=="unauthorized"' | grep -q .; then
  fail "The phone is connected but not authorised. Unlock it and tap Allow on the USB debugging prompt."
fi

# Prefer a real handset over any emulator that happens to be running.
SERIAL="${ANDROID_SERIAL:-}"
if [ -z "$SERIAL" ]; then
  SERIAL="$("$ADB" devices | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1; exit}')"
fi
if [ -z "$SERIAL" ]; then
  SERIAL="$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
fi

if [ -z "$SERIAL" ]; then
  cat >&2 <<'EOF'

x No device found. On the phone:

    1. Settings > About phone > tap "Build number" seven times.
    2. Settings > System > Developer options > turn on "USB debugging".
    3. Plug it into this Mac and tap Allow on the prompt.

  Then run this script again.
EOF
  exit 1
fi

MODEL="$("$ADB" -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
ABI="$("$ADB" -s "$SERIAL" shell getprop ro.product.cpu.abi | tr -d '\r')"
echo "    $MODEL ($SERIAL), $ABI"
case "$SERIAL" in
  emulator-*) echo "    note: this is an emulator. Timings from it are not reportable." ;;
esac

# ------------------------------------------------------- build and install steps

ensure_native_project() {
  if [ ! -d android ]; then
    step "Generating the native project"
    npx expo prebuild --platform android
  fi
}

remove_existing_install() {
  step "Removing the existing install"
  "$ADB" -s "$SERIAL" uninstall "$PACKAGE" >/dev/null 2>&1 || true
}

install_apk() {
  local apk="$1" output
  [ -f "$apk" ] || fail "No APK at $apk. Run without --skip-build."
  step "Installing"
  if ! output="$("$ADB" -s "$SERIAL" install -r "$apk" 2>&1)"; then
    echo "$output" >&2
    case "$output" in
      *INSTALL_FAILED_UPDATE_INCOMPATIBLE*|*signatures\ do\ not\ match*)
        fail "A build signed with a different key is already installed. Re-run with --fresh." ;;
      *INSTALL_FAILED_NO_MATCHING_ABIS*)
        fail "This device does not run $ABI binaries. Add its ABI to buildArchs in app.json." ;;
      *)
        fail "Install failed. The adb output above says why." ;;
    esac
  fi
  echo "$output" | tail -1
}

# ------------------------------------------------------------------ dev build

# The release APK bakes the JS bundle in, so every UI tweak costs a reinstall.
# The debug build pulls JS from Metro instead and redraws the device on save.
# Both variants are signed with the same debug keystore and share a package name,
# so swapping between them leaves the downloaded models in place.
if [ "$DEV" = true ]; then
  [ "$SKIP_BUILD" = false ] || fail "--skip-build means nothing with --dev."
  [ "$TAIL_LOGS" = false ] || fail "--logs would fight Metro for the terminal. Tail it in a second one."

  ensure_native_project
  [ "$FRESH" = false ] || remove_existing_install

  step "Building the debug APK for $ABI"
  (cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures="$ABI" --console=plain -q)
  install_apk "$DEBUG_APK"

  # The dev client pulls its JS from Metro on this Mac. adb reverse republishes
  # the Mac's port as localhost on the device, over USB or the emulator loopback,
  # so no wifi and no IP address are involved.
  "$ADB" -s "$SERIAL" reverse "tcp:$METRO_PORT" "tcp:$METRO_PORT" >/dev/null

  step "Starting Metro"
  echo "    Save a UI change and the screen reloads. Ctrl-C stops Metro."
  echo "    Changes under modules/ are native and need this command again."
  echo "    The banner will read DEBUG BUILD in red. That is correct here."

  npx expo start --dev-client &
  METRO_PID=$!
  trap 'kill "$METRO_PID" 2>/dev/null || true' INT TERM

  # Launch only once the bundler answers, or the dev client opens on its "no
  # development server" screen and has to be reloaded by hand.
  (
    DEADLINE=$(( SECONDS + 120 ))
    while [ "$SECONDS" -lt "$DEADLINE" ]; do
      if curl -sf -o /dev/null "http://127.0.0.1:$METRO_PORT/status"; then
        "$ADB" -s "$SERIAL" shell am start -n "$PACKAGE/.MainActivity" >/dev/null 2>&1 || true
        exit 0
      fi
      sleep 1
    done
  ) &

  wait "$METRO_PID"
  exit $?
fi

# ---------------------------------------------------------------------- build

if [ "$SKIP_BUILD" = false ]; then
  ensure_native_project

  # Building only the phone's own architecture keeps whisper.cpp compile times sane.
  step "Building the release APK for $ABI"
  (cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures="$ABI" --console=plain -q)
fi

# -------------------------------------------------------------------- install

[ "$FRESH" = false ] || remove_existing_install
install_apk "$APK"

step "Launching"
"$ADB" -s "$SERIAL" shell am start -n "$PACKAGE/.MainActivity" >/dev/null

cat <<EOF

Done. On the phone:

  1. Check the banner says RELEASE BUILD in green. If it is red, the timings are worthless.
  2. Tap "Download models" once, on wifi. About 465 MB for all four.
  3. Pick a video, name the clip, choose its tag, and run.
  4. "Share CSV" sends the results off the phone.

Watch the pipeline from here any time with:

  $ADB -s $SERIAL logcat -s RNWhisper:* Caption:*

EOF

if [ "$TAIL_LOGS" = true ]; then
  step "Tailing the log, press Ctrl-C to stop"
  "$ADB" -s "$SERIAL" logcat -c
  "$ADB" -s "$SERIAL" logcat -s "RNWhisper:*" "Caption:*"
fi
