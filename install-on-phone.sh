#!/usr/bin/env bash
#
# Build the Stage 0 rig and put it on the phone plugged into this Mac.
#
#   ./install-on-phone.sh            build, install, launch
#   ./install-on-phone.sh --logs     ...then tail the pipeline log
#   ./install-on-phone.sh --fresh    wipe app data first (re-downloads 465 MB of models)
#   ./install-on-phone.sh --skip-build   install the APK that is already built
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

PACKAGE="com.captionfy.app"
APK="android/app/build/outputs/apk/release/app-release.apk"

TAIL_LOGS=false
FRESH=false
SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --logs) TAIL_LOGS=true ;;
    --fresh) FRESH=true ;;
    --skip-build) SKIP_BUILD=true ;;
    -h|--help) sed -n '2,9p' "${BASH_SOURCE[0]}" | cut -c3-; exit 0 ;;
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

# ---------------------------------------------------------------------- build

if [ "$SKIP_BUILD" = false ]; then
  if [ ! -d android ]; then
    step "Generating the native project"
    npx expo prebuild --platform android
  fi

  # Building only the phone's own architecture keeps whisper.cpp compile times sane.
  step "Building the release APK for $ABI"
  (cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures="$ABI" --console=plain -q)
fi

[ -f "$APK" ] || fail "No APK at $APK. Run without --skip-build."

# -------------------------------------------------------------------- install

if [ "$FRESH" = true ]; then
  step "Removing the existing install"
  "$ADB" -s "$SERIAL" uninstall "$PACKAGE" >/dev/null 2>&1 || true
fi

step "Installing"
if ! OUTPUT="$("$ADB" -s "$SERIAL" install -r "$APK" 2>&1)"; then
  echo "$OUTPUT" >&2
  case "$OUTPUT" in
    *INSTALL_FAILED_UPDATE_INCOMPATIBLE*|*signatures\ do\ not\ match*)
      fail "A build signed with a different key is already installed. Re-run with --fresh." ;;
    *INSTALL_FAILED_NO_MATCHING_ABIS*)
      fail "This phone does not run $ABI binaries. Tell Claude and it will rebuild for all architectures." ;;
    *)
      fail "Install failed. The adb output above says why." ;;
  esac
fi
echo "$OUTPUT" | tail -1

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
