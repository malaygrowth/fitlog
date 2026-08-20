#!/bin/sh
# Assemble the folder that gets served at https://malaygrowth.github.io/
#
#   ./publish.sh          -> build site/ from the public variant
#
# Copy the contents of site/ into the root of the repo named exactly
# `malaygrowth.github.io` and push. That repo's root IS the origin root, which
# is the only place a Trusted Web Activity will look for .well-known/assetlinks.json.
#
# Deliberately NOT copied: core.html, fonts.html, head/tail.html, eximg.html,
# build.sh, test/, PLAYSTORE.md, README.md. They are sources and notes; serving
# them publishes the seed data and the personal build's source for no reason.
set -e
cd "$(dirname "$0")"

OUT=site
./build.sh public >/dev/null

rm -rf "$OUT"
mkdir -p "$OUT/.well-known" "$OUT/img"

cp index.html manifest.webmanifest privacy.html sw.js "$OUT/"
cp icon-192.png icon-512.png icon-maskable-512.png icon.svg "$OUT/"
cp -R img/ex "$OUT/img/ex"
cp store/assetlinks.json "$OUT/.well-known/assetlinks.json"

# The manifest declares these, and Chrome uses them for a richer install prompt.
# A manifest pointing at files that 404 is worse than one with no screenshots.
if [ -d store/screenshots ]; then
  mkdir -p "$OUT/screenshots"
  cp store/screenshots/*.png "$OUT/screenshots/"
else
  echo "  NOTE: no store/screenshots — run tools/shots.cjs, the manifest references them"
fi

# Without this, Pages runs the site through Jekyll, which silently drops paths
# beginning with an underscore and has historically been unhelpful about
# dotfile directories. There is no Jekyll here to run.
: > "$OUT/.nojekyll"

# Leave the personal build in place: publishing should not change what the
# working copy is pointed at.
./build.sh >/dev/null

FILES=$(find "$OUT" -type f | wc -l | tr -d ' ')
BYTES=$(du -sh "$OUT" | cut -f1)
echo "built $OUT/ — $FILES files, $BYTES"

if grep -q REPLACE_ME "$OUT/.well-known/assetlinks.json"; then
  echo
  echo "  NOTE: assetlinks.json still has a placeholder fingerprint."
  echo "  After Bubblewrap creates your keystore, run:"
  echo "      ./tools/assetlinks.sh <path-to-android.keystore> <key-alias>"
  echo "  and re-run ./publish.sh. Until then the app opens with a browser bar."
fi
