#!/usr/bin/env bash
#
# Move the version on. The only thing in this project that edits app.json.
#
#     ./scripts/bump-version.sh              versionCode + 1, same version name
#     ./scripts/bump-version.sh 1.1.0        set the name too, and bump the code
#     ./scripts/bump-version.sh --show       say what it is now and change nothing
#
# Also `npm run bump`.
#
# Two numbers, and they answer different questions.
#
# **versionCode** is Play's identity for an upload. It is an integer, it must go
# up, and a number Play has already seen is refused at upload — so every bundle
# that leaves this machine for the console needs a fresh one. Users never see it.
#
# **version** (versionName) is the string on the store listing. It means whatever
# you want it to mean and Play does not check it at all.
#
# So the code moves on every release and the name moves when you have something
# to say. That is why a bare run bumps only the code: needing a new upload is
# common and deciding it is 1.1.0 rather than 1.0.1 is a judgement.
#
# app.json is edited by regex rather than parsed and re-serialised, because
# JSON.stringify would reflow the whole file — "granularPermissions": ["video"]
# is one line today and would come back as three. A version bump should be a
# two-line diff.
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

step() { printf '\n\033[1;36m==>\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mx\033[0m %s\n' "$1" >&2; exit 1; }

. scripts/version.sh

usage() {
  cat <<'EOF'
Move the version on.

  ./scripts/bump-version.sh              versionCode + 1, version name unchanged
  ./scripts/bump-version.sh 1.1.0        set the version name, and bump the code
  ./scripts/bump-version.sh --show       print the current version, change nothing

versionCode is what Play refuses to see twice. Bump it for every upload.
The version name is what the listing shows. Bump it when it means something.
EOF
}

NEW_VERSION=""
SHOW=false

while [ $# -gt 0 ]; do
  case "$1" in
    --show) SHOW=true ;;
    -h|--help) usage; exit 0 ;;
    -*) fail "unknown option: $1 (try --help)" ;;
    *)
      [ -z "$NEW_VERSION" ] || fail "Give at most one version."
      NEW_VERSION="$1" ;;
  esac
  shift
done

version_read

if [ "$SHOW" = true ]; then
  [ -z "$NEW_VERSION" ] || fail "--show changes nothing, so it takes no version."
  echo "$VERSION ($VERSION_CODE)"
  exit 0
fi

# Play wants something it can order. Three dot-separated numbers is the
# convention and anything else is a conversation with a reviewer.
if [ -n "$NEW_VERSION" ]; then
  case "$NEW_VERSION" in
    [0-9]*.[0-9]*.[0-9]*) ;;
    *) fail "'$NEW_VERSION' is not a version. Use three numbers, like 1.1.0." ;;
  esac
  case "$NEW_VERSION" in
    *[!0-9.]*) fail "'$NEW_VERSION' has something other than digits and dots in it." ;;
  esac
fi

TARGET_VERSION="${NEW_VERSION:-$VERSION}"
TARGET_CODE=$((VERSION_CODE + 1))

node -e '
  const fs = require("fs");
  const [version, code] = process.argv.slice(1);
  const path = "app.json";
  let text = fs.readFileSync(path, "utf8");

  const before = text;
  text = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
  text = text.replace(/("versionCode"\s*:\s*)\d+/, `$1${code}`);

  if (text === before) {
    console.error("Nothing in app.json matched. Has its shape changed?");
    process.exit(1);
  }
  fs.writeFileSync(path, text);
' "$TARGET_VERSION" "$TARGET_CODE"

# Read it back rather than trusting the write. The regexes above are the kind of
# thing that silently matches the wrong key one refactor from now.
version_read
[ "$VERSION" = "$TARGET_VERSION" ] && [ "$VERSION_CODE" = "$TARGET_CODE" ] \
  || fail "app.json was edited but now reads $VERSION ($VERSION_CODE), not $TARGET_VERSION ($TARGET_CODE)."

step "versionCode $((TARGET_CODE - 1)) -> $TARGET_CODE   (version $VERSION)"
echo "    app.json updated. android/ picks it up on the next build."
echo
echo "    Next:  ./aab.sh        the bundle for Play"
echo "           ./run.sh        a release APK on the phone"
