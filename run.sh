#!/usr/bin/env bash
#
# Build the Stage 0 rig and run it, on a phone plugged into this Mac or on an
# emulator booted here. One script: `--emulator` changes which device is
# targeted, `--dev` changes which build lands on it. Everything after that is
# the same steps in the same order.
#
# Only a release build on a real phone produces reportable timings.
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

PACKAGE="com.wordburn.app"
SCHEME="wordburn"          # must match expo.scheme in app.json
RELEASE_APK="android/app/build/outputs/apk/release/app-release.apk"
DEBUG_APK="android/app/build/outputs/apk/debug/app-debug.apk"
METRO_PORT=8081

# Cold boots on a first run can be slow. Snapshot resumes take a few seconds.
BOOT_TIMEOUT=300

step() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mx\033[0m %s\n' "$1" >&2; exit 1; }

usage() {
  cat <<'EOF'
Build the Stage 0 rig and run it.

  ./run.sh                        phone, release build. The only reportable timings.
  ./run.sh --dev                  phone, debug build wired to Metro, for UI work
  ./run.sh --emulator             boot an emulator here, debug build, Metro
  ./run.sh --emulator <avd>       use a named AVD instead of the first one
  ./run.sh --emulator --release   release build on the emulator

Options:
  --dev           debug build that pulls JS from Metro and redraws on save
  --release       release build. The default everywhere except --emulator.
  --emulator      target an emulator, booting one if none is already up
  --cold          with --emulator, ignore the saved snapshot and boot from scratch
  --fresh         wipe app data first: projects, settings and what has been paid for
  --skip-build    install the APK that is already built
  --logs          after a release run, tail the pipeline log
  -h, --help      this

Emulator timings are never reportable. Use a phone for numbers.
EOF
}

# ------------------------------------------------------------------ arguments

DEV=""              # empty until the default is decided, which --emulator moves
EMULATOR=false
COLD=false
FRESH=false
SKIP_BUILD=false
TAIL_LOGS=false
AVD=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dev) DEV=true ;;
    --release) DEV=false ;;
    --emulator) EMULATOR=true ;;
    --cold) COLD=true ;;
    --fresh) FRESH=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --logs) TAIL_LOGS=true ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "unknown option: $1 (try --help)" >&2; exit 2 ;;
    *)
      [ -z "$AVD" ] || { echo "give at most one AVD name" >&2; exit 2; }
      AVD="$1" ;;
  esac
  shift
done

# An emulator cannot produce a reportable number whatever is built for it, so the
# build that is quick to iterate on is the right default there. A phone is the
# opposite: it is only worth plugging in for a release build.
if [ -z "$DEV" ]; then
  if [ "$EMULATOR" = true ]; then DEV=true; else DEV=false; fi
fi

if [ "$EMULATOR" = false ]; then
  [ -z "$AVD" ] || fail "An AVD name only means something with --emulator."
  [ "$COLD" = false ] || fail "--cold only means something with --emulator."
fi

if [ "$DEV" = true ]; then
  [ "$SKIP_BUILD" = false ] || fail "--skip-build means nothing with --dev."
  [ "$TAIL_LOGS" = false ] || fail "--logs would fight Metro for the terminal. Tail it in a second one."
fi

# ---------------------------------------------------------------- Android SDK

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
[ -d "$SDK" ] || fail "No Android SDK at $SDK. Install it via Android Studio, or set ANDROID_HOME."
ADB="$SDK/platform-tools/adb"
EMULATOR_BIN="$SDK/emulator/emulator"
[ -x "$ADB" ] || fail "adb is missing from $SDK/platform-tools. Install 'Android SDK Platform-Tools' in Android Studio."
export ANDROID_HOME="$SDK"

command -v java >/dev/null || fail "No java on PATH. Gradle needs a JDK 17 or newer."

"$ADB" start-server >/dev/null 2>&1 || true

# ----------------------------------------------------------- pick the emulator

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

boot_emulator() {
  [ -x "$EMULATOR_BIN" ] || fail "No emulator at $SDK/emulator. Install 'Android Emulator' in Android Studio."

  step "Picking an emulator"
  local avds
  avds="$("$EMULATOR_BIN" -list-avds 2>/dev/null | grep -v '^[[:space:]]*$' || true)"
  if [ -z "$avds" ]; then
    cat >&2 <<'EOF'

x No emulators are defined. In Android Studio:

    Device Manager > Add a device > pick a phone > choose an arm64-v8a
    system image. On Apple Silicon the x86_64 images are not worth running.

  Then run this script again.
EOF
    exit 1
  fi

  [ -n "$AVD" ] || AVD="${WORDBURN_AVD:-}"
  if [ -z "$AVD" ]; then
    AVD="$(echo "$avds" | head -1)"
    if [ "$(echo "$avds" | wc -l | tr -d ' ')" -gt 1 ]; then
      echo "    more than one AVD. Using $AVD. Pass a name, or set WORDBURN_AVD, to pick another:"
      echo "$avds" | sed 's/^/      /'
    fi
  fi
  echo "$avds" | grep -qxF "$AVD" || fail "No AVD called $AVD. There is: $(echo "$avds" | tr '\n' ' ')"

  SERIAL="$(serial_for_avd)"
  if [ -n "$SERIAL" ]; then
    echo "    $AVD is already running ($SERIAL), reusing it"
    return
  fi

  local log="${TMPDIR:-/tmp}/wordburn-emulator.log"
  step "Booting $AVD"

  if [ "$COLD" = true ]; then
    nohup "$EMULATOR_BIN" -avd "$AVD" -no-boot-anim -no-snapshot-load >"$log" 2>&1 &
  else
    nohup "$EMULATOR_BIN" -avd "$AVD" -no-boot-anim >"$log" 2>&1 &
  fi
  local emu_pid=$!

  # The emulator dies quietly on a corrupt snapshot or a missing system image,
  # so watch the process as well as the clock.
  alive_or_fail() {
    kill -0 "$emu_pid" 2>/dev/null && return
    tail -3 "$log" >&2 2>/dev/null || true
    fail "The emulator quit. Full output in $log. A corrupt snapshot is the usual cause, so try --cold."
  }

  local deadline=$(( SECONDS + BOOT_TIMEOUT ))
  while [ -z "$SERIAL" ]; do
    alive_or_fail
    [ "$SECONDS" -lt "$deadline" ] || fail "$AVD never appeared on adb within ${BOOT_TIMEOUT}s. Output in $log."
    sleep 2
    SERIAL="$(serial_for_avd)"
  done

  echo "    $SERIAL, waiting for Android to finish starting"
  while [ "$("$ADB" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
    alive_or_fail
    [ "$SECONDS" -lt "$deadline" ] || fail "$AVD booted but never reported ready within ${BOOT_TIMEOUT}s. Try --cold."
    sleep 2
  done

  "$ADB" -s "$SERIAL" shell wm dismiss-keyguard >/dev/null 2>&1 || true
}

# -------------------------------------------------------------- pick the phone

find_phone() {
  step "Looking for a phone"

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

  Or run with --emulator to boot one on this Mac instead.
EOF
    exit 1
  fi
}

SERIAL=""
if [ "$EMULATOR" = true ]; then
  boot_emulator
else
  find_phone
fi

MODEL="$("$ADB" -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
ABI="$("$ADB" -s "$SERIAL" shell getprop ro.product.cpu.abi | tr -d '\r')"
step "Target: $MODEL ($SERIAL), $ABI"
case "$SERIAL" in
  emulator-*) echo "    This is an emulator. Timings from it are not reportable." ;;
esac

# ------------------------------------------------------- build and install steps

ensure_native_project() {
  # The models ride in the APK, and they are not in git. Cheap when they are
  # already there, and the one thing in this project that needs the network.
  step "Checking the speech models"
  ./scripts/fetch-models.sh

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
  if [ "$EMULATOR" = true ]; then
    echo "    The emulator keeps running after Ctrl-C, so the next run skips the boot."
  fi

  npx expo start --dev-client &
  METRO_PID=$!
  trap 'kill "$METRO_PID" 2>/dev/null || true' INT TERM

  # Launch only once the bundler answers, or the dev client opens on its server
  # picker with nothing to pick. Starting MainActivity on its own also stops at
  # that picker, so open the app against Metro by deep link instead. localhost
  # resolves on the device because of the adb reverse above.
  (
    DEADLINE=$(( SECONDS + 120 ))
    while [ "$SECONDS" -lt "$DEADLINE" ]; do
      if curl -sf -o /dev/null "http://127.0.0.1:$METRO_PORT/status"; then
        "$ADB" -s "$SERIAL" shell am start -a android.intent.action.VIEW \
          -d "$SCHEME://expo-development-client/?url=http%3A%2F%2Flocalhost%3A$METRO_PORT" \
          >/dev/null 2>&1 || true
        exit 0
      fi
      sleep 1
    done
  ) &

  wait "$METRO_PID"
  exit $?
fi

# ------------------------------------------------------------- release build

if [ "$SKIP_BUILD" = false ]; then
  ensure_native_project

  # Building only the target's own architecture keeps whisper.cpp compile times sane.
  step "Building the release APK for $ABI"
  (cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures="$ABI" --console=plain -q)
fi

[ "$FRESH" = false ] || remove_existing_install
install_apk "$RELEASE_APK"

step "Launching"
"$ADB" -s "$SERIAL" shell am start -n "$PACKAGE/.MainActivity" >/dev/null

cat <<EOF

Done. On the device:

  1. "New video" opens the system picker. The models are already in the APK, so
     there is nothing to download and no network involved from here on.
  2. Transcription runs itself and hands you the editor.
  3. Export writes into the gallery's Wordburn album.

Watch the pipeline from here any time with:

  $ADB -s $SERIAL logcat -s RNWhisper:* Caption:*

EOF

if [ "$TAIL_LOGS" = true ]; then
  step "Tailing the log, press Ctrl-C to stop"
  "$ADB" -s "$SERIAL" logcat -c
  "$ADB" -s "$SERIAL" logcat -s "RNWhisper:*" "Caption:*"
fi
