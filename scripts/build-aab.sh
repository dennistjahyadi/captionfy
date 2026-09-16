#!/usr/bin/env bash
#
# The Android App Bundle that goes to Play, and nothing else.
#
# `run.sh` builds APKs and puts them on a device. Play does not take an APK from
# a new app and an AAB cannot be installed with `adb install`, so the two have
# no steps in common past the models and the native project, and this is its own
# script rather than a flag on that one.
#
# Everything here is the same local Gradle build `run.sh` already runs. The only
# additions are the upload key, the `bundleRelease` task in place of
# `assembleRelease`, and a check on the way out that the thing produced is
# actually signed with a key Play will accept.
#
#     ./scripts/build-aab.sh
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

BUNDLE="android/app/build/outputs/bundle/release/app-release.aab"
GRADLE_PROPERTIES="$HOME/.gradle/gradle.properties"

step() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mx\033[0m %s\n' "$1" >&2; exit 1; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$1" >&2; }

. scripts/version.sh

# Same resolution as run.sh, and for the same reason: Gradle wants an SDK path
# and there is no ANDROID_HOME in the shell here, only Android Studio's default
# location. Without this the build dies at "SDK location not found".
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
[ -d "$SDK" ] || fail "No Android SDK at $SDK. Install it via Android Studio, or set ANDROID_HOME."
export ANDROID_HOME="$SDK"

# ---------------------------------------------------------------- the key

# Gradle reads these from ~/.gradle/gradle.properties, from the environment as
# ORG_GRADLE_PROJECT_*, or from -P on the command line. Any of the three is
# fine; all this checks is that one of them happened, so the failure is a
# sentence here rather than a debug-signed bundle Play rejects on upload.
if ! grep -q '^WORDBURN_UPLOAD_STORE_FILE=' "$GRADLE_PROPERTIES" 2>/dev/null \
  && [ -z "${ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_STORE_FILE:-}" ]; then
  cat >&2 <<EOF

x No upload key. Play refuses a bundle signed with the debug keystore, which is
  the same key on every React Native machine in the world.

  Make one. It never expires in any way that matters — 10000 days is the
  convention, and Play App Signing means this key only ever signs uploads:

    keytool -genkeypair -v \\
      -keystore ~/keys/wordburn-upload.jks \\
      -alias upload -keyalg RSA -keysize 2048 -validity 10000

  Then name it in $GRADLE_PROPERTIES, which is outside this
  repository and outside the generated android/ directory, both of which get
  thrown away and written again:

    WORDBURN_UPLOAD_STORE_FILE=$HOME/keys/wordburn-upload.jks
    WORDBURN_UPLOAD_STORE_PASSWORD=the store password
    WORDBURN_UPLOAD_KEY_ALIAS=upload
    WORDBURN_UPLOAD_KEY_PASSWORD=the key password

  Back that .jks up somewhere that is not this Mac. Enrol in Play App Signing
  at the first upload and losing it costs a support request rather than the app.

EOF
  exit 1
fi

# --------------------------------------------------------------- the version

# Checked before anything slow happens, because the answer can be "don't build".
version_read

case "$VERSION" in
  0.*) warn "app.json still says version $VERSION. Play takes it, but 1.0.0 is what a first release calls itself." ;;
esac

# Play refuses an upload whose versionCode it has already seen, and it refuses it
# at the end — after the whole bundle has gone up the wire. Cheaper to refuse it
# here. The archive under build/ is the record of which codes have been produced;
# if a bundle for this one exists, it either went to Play or is about to.
ARCHIVE="$(version_archive_name aab)"
if [ -f "$ARCHIVE" ]; then
  cat >&2 <<EOF

x versionCode $VERSION_CODE has already been built:

    $ARCHIVE

  Play will not take that number twice. Bump it first:

    npm run bump

  If that bundle never reached Play and you want the number back, delete the
  file and run this again.

EOF
  exit 1
fi

# ---------------------------------------------------------------- the build

# 82 MB of weights that ride inside the bundle. Not in git, cheap when already
# fetched, and the one thing in this project that needs the network.
step "Checking the speech models"
./scripts/fetch-models.sh

if [ ! -d android ]; then
  step "Generating the native project"
  npx expo prebuild --platform android
fi

# The generated project is a copy of the version, not the version. It goes stale
# the moment app.json moves and nothing in a Gradle build notices.
version_sync_native

step "Building the bundle — $VERSION ($VERSION_CODE)"
echo "    Every architecture in app.json, not just this machine's. Play splits them."
(cd android && ./gradlew :app:bundleRelease --console=plain)

[ -f "$BUNDLE" ] || fail "Gradle finished but $BUNDLE is not there."

# Read out of the bundle, not out of app.json. Saying the version back to
# yourself proves nothing; this is the check that would have caught the 0.0.1.
step "Checking the version it came out with"
version_verify "$BUNDLE" aab
echo "    $VERSION ($VERSION_CODE), read back from the bundle's own manifest."

# ---------------------------------------------------------------- the check

# The one failure this script exists to catch. A bundle signed with the debug
# key builds perfectly and is rejected at upload, which is a slow way to find
# out — and the signing config falls back to the debug key on purpose, so this
# is a real path and not a hypothetical one.
step "Checking what signed it"
CERT="$(keytool -printcert -jarfile "$BUNDLE" 2>/dev/null || true)"

case "$CERT" in
  '') fail "Nothing signed it. The bundle has no certificate at all." ;;
  *'CN=Android Debug'*) fail "Signed with the debug keystore. Play will reject it. See the note above about the upload key." ;;
esac

OWNER="$(printf '%s\n' "$CERT" | sed -n 's/^Owner: //p' | head -1)"
SHA="$(printf '%s\n' "$CERT" | sed -n 's/.*SHA256: //p' | head -1)"
SIZE="$(du -h "$BUNDLE" | cut -f1)"

# ------------------------------------------------------------- the archive

# Gradle's own output is always app-release.aab, so the next build erases the
# evidence of this one. The copy carries the version in its name, which is the
# only way to tell two bundles apart on disk, and its checksum is what proves
# the file you upload months later is the file this run produced.
step "Archiving"
version_archive "$BUNDLE" aab
shasum -a 256 "$ARCHIVED" | awk '{print $1}' > "$ARCHIVED.sha256"
echo "    $ARCHIVED"

cat <<EOF

==> Done.

  $ARCHIVED
  $SIZE, version $VERSION, versionCode $VERSION_CODE
  Signed by $OWNER

  SHA-256 $SHA

That fingerprint is what Play Console shows under Setup, App signing, as the
upload key certificate. If they ever disagree, the bundle was signed by
something else.

Upload it at Play Console, Release, Testing, Internal testing. The bundle is
larger than what anyone downloads: Play repacks it per device and sends one
architecture, so the install is roughly half of this.

Once this one has gone up, versionCode $VERSION_CODE is spent — Play will not take it
again. The next bundle needs:

  npm run bump

EOF
