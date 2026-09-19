#!/usr/bin/env bash
#
# One version, and the three places it has to agree with itself.
#
# Sourced by run.sh and scripts/build-aab.sh. Not run on its own — to change a
# version, use scripts/bump-version.sh.
#
#     . scripts/version.sh
#     version_read              # sets VERSION and VERSION_CODE from app.json
#     version_sync_native       # makes the generated project say the same
#     version_archive out.aab aab
#
# **app.json is the version.** `android/` is generated, is not in git, and is
# thrown away and written again by every prebuild, which makes it a copy of the
# version rather than the version — the same reason the release signing config
# had to become a plugin instead of an edit.
#
# The bug this file exists to stop has already happened once. app.json said
# 1.0.0, the generated android/ predated that bump and still said 0.0.1, and
# build-aab.sh printed "version 1.0.0" on the way out because it read app.json
# and not the bundle. A bundle was sitting on this disk carrying a version
# nobody had asked for, under a message saying otherwise. So: sync the generated
# project from app.json before Gradle runs, and read the version back out of the
# finished artifact afterwards rather than repeating what went in.

VERSION=""
VERSION_CODE=""

_version_fail() { printf '\n\033[1;31mx\033[0m %s\n' "$1" >&2; exit 1; }
_version_note() { printf '    %s\n' "$1"; }

# The first line of whatever is piped in, and nothing else.
#
# Stands in for `| head -1` throughout this file. head leaves as soon as it has
# its line, which closes the pipe and kills whatever is still writing with
# SIGPIPE; every caller here runs under `set -o pipefail`, which then calls the
# pipeline failed even though the line was read correctly. This reads its input
# to the end first, so nothing upstream is ever cut off.
_first_line() { local all; all="$(cat)"; printf '%s\n' "${all%%$'\n'*}"; }

# ------------------------------------------------------------------ app.json

version_read() {
  [ -f app.json ] || _version_fail "No app.json here. Run this from the repository root."
  VERSION="$(node -p "require('./app.json').expo.version" 2>/dev/null)" \
    || _version_fail "app.json has no expo.version."
  VERSION_CODE="$(node -p "require('./app.json').expo.android.versionCode" 2>/dev/null)" \
    || _version_fail "app.json has no expo.android.versionCode."

  case "$VERSION_CODE" in
    ''|*[!0-9]*) _version_fail "versionCode must be a whole number, not '$VERSION_CODE'." ;;
  esac
}

# ---------------------------------------------------- the generated project

# Expo writes versionName and versionCode into android/app/build.gradle during
# prebuild, and AGP puts them into the manifest from there. So build.gradle is
# the one place Gradle reads a version from, and patching it is enough.
#
# Patched rather than re-prebuilt on purpose. A prebuild costs half a minute and
# rewrites a directory this script has no business rewriting; two sed lines cost
# nothing and are exact. It survives nothing — the next prebuild overwrites it —
# which is fine, because this runs before every build rather than once.
version_sync_native() {
  local gradle="android/app/build.gradle" have_name have_code tmp
  [ -f "$gradle" ] || _version_fail "No $gradle. The native project has not been generated yet."

  have_name="$(sed -n 's/^[[:space:]]*versionName "\(.*\)"$/\1/p' "$gradle" | _first_line)"
  have_code="$(sed -n 's/^[[:space:]]*versionCode \([0-9][0-9]*\)$/\1/p' "$gradle" | _first_line)"

  [ -n "$have_name" ] && [ -n "$have_code" ] \
    || _version_fail "Could not find versionName/versionCode in $gradle. Has the AGP template changed?"

  if [ "$have_name" = "$VERSION" ] && [ "$have_code" = "$VERSION_CODE" ]; then
    return 0
  fi

  _version_note "android/ said $have_name ($have_code); app.json says $VERSION ($VERSION_CODE). Syncing."

  tmp="$(mktemp)"
  sed -e "s/^\([[:space:]]*\)versionName \".*\"$/\1versionName \"$VERSION\"/" \
      -e "s/^\([[:space:]]*\)versionCode [0-9][0-9]*$/\1versionCode $VERSION_CODE/" \
      "$gradle" > "$tmp"
  mv "$tmp" "$gradle"

  have_name="$(sed -n 's/^[[:space:]]*versionName "\(.*\)"$/\1/p' "$gradle" | _first_line)"
  have_code="$(sed -n 's/^[[:space:]]*versionCode \([0-9][0-9]*\)$/\1/p' "$gradle" | _first_line)"
  [ "$have_name" = "$VERSION" ] && [ "$have_code" = "$VERSION_CODE" ] \
    || _version_fail "Tried to sync $gradle and it still reads $have_name ($have_code)."
}

# ------------------------------------------------------- reading it back out

# An APK carries binary XML, which aapt2 reads. A bundle carries protobuf, which
# it does not — hence the python next door. Both print "name code".
version_of_apk() {
  local apk="$1" aapt2 badging line
  aapt2="$(ls "$ANDROID_HOME"/build-tools/*/aapt2 2>/dev/null | sort -V | tail -1)"
  [ -n "$aapt2" ] || return 1

  # Deliberately not `| head -1`. Callers run under `set -o pipefail`, badging
  # prints a screenful, and head closing the pipe after the first line kills
  # aapt2 with SIGPIPE — which pipefail then reports as a failed pipeline even
  # though the line arrived whole. It is a race between how fast aapt2 writes and
  # how fast head leaves, so it struck at random and more often the bigger the
  # APK got. Take the whole thing, which is kilobytes, and cut the first line
  # here where no pipe can close under it.
  badging="$("$aapt2" dump badging "$apk" 2>/dev/null)" || return 1
  line="${badging%%$'\n'*}"
  printf '%s %s\n' \
    "$(printf '%s' "$line" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")" \
    "$(printf '%s' "$line" | sed -n "s/.*versionCode='\([^']*\)'.*/\1/p")"
}

version_of_aab() {
  python3 ./scripts/aab-version.py "$1" 2>/dev/null
}

# Reads the artifact and stops the build if it disagrees with app.json. The
# whole reason this file exists, so it fails rather than warns.
version_verify() {
  local artifact="$1" kind="$2" got
  # `|| got=""` on both, because the caller runs under `set -e` and a bare
  # assignment from a command substitution that returns non-zero kills the script
  # where it stands — which is how the unreadable-version case below, written to
  # warn and carry on, spent its whole life unreachable. A build that cannot be
  # read back is a warning; a build that disagrees is fatal. Neither is a crash.
  case "$kind" in
    apk) got="$(version_of_apk "$artifact")" || got="" ;;
    aab) got="$(version_of_aab "$artifact")" || got="" ;;
  esac

  if [ -z "$got" ]; then
    printf '\033[1;33m!\033[0m %s\n' "Could not read the version back out of $artifact. Not fatal, but unverified." >&2
    return 0
  fi

  if [ "$got" != "$VERSION $VERSION_CODE" ]; then
    _version_fail "$(printf '%s\n  %-9s %s\n  %-9s %s\n\n  %s' \
      "The built $kind does not carry the version app.json asked for." \
      "app.json" "$VERSION ($VERSION_CODE)" \
      "the $kind" "${got% *} (${got#* })" \
      "A stale android/ is the usual cause. Try: npx expo prebuild --clean")"
  fi
}

# ----------------------------------------------------------------- archiving

# Gradle always writes app-release.aab, so every build overwrites the last one
# and nothing on disk says which is which. A copy under build/ keeps the name
# honest: one file per version that was actually produced.
# The optional third argument is a tag, for artifacts that are one of several at
# the same version: run.sh builds a release APK for one architecture at a time,
# so two phones would otherwise overwrite each other's file.
version_archive() {
  local src="$1" ext="$2" tag="${3:-}" dest
  dest="$(version_archive_name "$ext" "$tag")"
  mkdir -p build
  cp "$src" "$dest"
  ARCHIVED="$dest"
}

version_archive_name() {
  local ext="$1" tag="${2:-}"
  printf 'build/wordburn-%s-%s%s.%s\n' "$VERSION" "$VERSION_CODE" "${tag:+-$tag}" "$ext"
}
