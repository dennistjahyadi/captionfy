#!/usr/bin/env bash
#
# The bundle for Play, with the upload key already in hand.
#
#     ./aab.sh
#
# All this does is read `.env.signing.local` and hand the build the key, which
# is the half of the command nobody should have to remember. Everything that
# actually builds, signs and checks the bundle is in scripts/build-aab.sh, and
# that script still runs on its own for anyone who keeps the key in
# ~/.gradle/gradle.properties instead.
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

SIGNING=".env.signing.local"

fail() { printf '\n\033[1;31mx\033[0m %s\n' "$1" >&2; exit 1; }

# Not an error on its own: the key may be in ~/.gradle/gradle.properties, which
# is where the build script's own instructions put it. Let that script decide,
# since it is the one with the paragraph about how to make one.
if [ -f "$SIGNING" ]; then
  # shellcheck source=/dev/null
  . "./$SIGNING"

  case "${ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_STORE_PASSWORD:-}" in
    'replace me'|'')
      fail "$SIGNING still has its placeholder password in it. Put the real one in, or delete the file if the key lives in ~/.gradle/gradle.properties." ;;
  esac

  STORE="${ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_STORE_FILE:-}"
  [ -f "$STORE" ] || fail "No keystore at ${STORE:-(unset)}. Make one with the keytool command in $SIGNING."
fi

exec ./scripts/build-aab.sh "$@"
