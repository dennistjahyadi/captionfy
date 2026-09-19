#!/usr/bin/env bash
# Put `public/` back: the app's own fonts and the demo clip.
#
# Neither is in git here. The fonts are tracked once, in assets/fonts, and the
# ads must set their type in the same files the burn-in does or they are
# advertising a product nobody can download. The demo clip is out of git for
# the reason the root .gitignore gives, and scripts/make-demo-clip.py rebuilds
# it byte for byte.
set -euo pipefail
cd "$(dirname "$0")"
root=../..

mkdir -p public/fonts
cp "$root"/assets/fonts/BeVietnamPro-ExtraBold.ttf \
   "$root"/assets/fonts/BeVietnamPro-SemiBold.ttf \
   "$root"/assets/fonts/BeVietnamPro-Medium.ttf \
   "$root"/assets/fonts/Spectral-ExtraBold.ttf \
   public/fonts/

clip="$root/test-clips/demo/demo-1080x1920.mp4"
if [ -f "$clip" ]; then
  cp "$clip" public/
else
  echo "No demo clip. Run scripts/make-demo-clip.py first." >&2
  exit 1
fi

echo "public/ is ready."
