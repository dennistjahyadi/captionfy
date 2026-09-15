#!/usr/bin/env bash
#
# The bundle for Play, with the upload key already in hand.
#
#     ./aab.sh
#
# All this does is find the key and hand it to the build, which is the half of
# the command nobody should have to remember. Everything that actually builds,
# signs and checks the bundle is in scripts/build-aab.sh, and that script still
# runs on its own for anyone who keeps the key in ~/.gradle/gradle.properties.
#
# The password is asked for rather than stored. `.env.signing.local` says where
# the keystore is; the password lives in this one shell for this one build, so
# the repository holds a keystore nobody can open rather than a keystore and the
# words that open it. Export ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_STORE_PASSWORD
# beforehand and nothing is asked — which is the only way this runs where there
# is no terminal to ask at.
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
fi

STORE="${ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_STORE_FILE:-}"

if [ -n "$STORE" ]; then
  [ -f "$STORE" ] || fail "No keystore at $STORE. Make one with the keytool command in $SIGNING."

  if [ -z "${ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_STORE_PASSWORD:-}" ]; then
    [ -t 0 ] || fail "No password, and no terminal to ask at. Export ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_STORE_PASSWORD before running this."

    printf 'Upload key password for %s: ' "$(basename "$STORE")" >&2
    read -rs PASSWORD
    printf '\n' >&2
    [ -n "$PASSWORD" ] || fail "Nothing typed."

    export ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_STORE_PASSWORD="$PASSWORD"
    unset PASSWORD
  fi

  # keytool's own default, and what a keystore made by the command in
  # .env.signing.local ends up with unless its second prompt was answered
  # differently. Set the key password in the environment to say otherwise.
  if [ -z "${ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_KEY_PASSWORD:-}" ]; then
    export ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_KEY_PASSWORD="$ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_STORE_PASSWORD"
  fi

  # Checked here because the alternative is finding out at the signing step,
  # which is eight minutes of Gradle later. Down keytool's stdin rather than
  # through -storepass, so the password is never an argument anything can read
  # out of the process list.
  ALIAS="${ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_KEY_ALIAS:-upload}"
  printf '%s\n' "$ORG_GRADLE_PROJECT_WORDBURN_UPLOAD_STORE_PASSWORD" \
    | keytool -list -keystore "$STORE" -alias "$ALIAS" >/dev/null 2>&1 \
    || fail "That password does not open $STORE, or it holds no key called \"$ALIAS\"."
fi

exec ./scripts/build-aab.sh "$@"
