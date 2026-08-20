#!/bin/sh
# Write store/assetlinks.json with the real SHA-256 fingerprint of your signing key.
#
#   ./tools/assetlinks.sh <keystore-path> [key-alias]
#
# e.g. ./tools/assetlinks.sh ~/coachz-twa/android.keystore android
#
# Why this exists: the fingerprint is 32 colon-separated hex pairs. Typing one
# by hand and getting a character wrong does not produce an error anywhere — the
# app just opens with a browser address bar forever, and nothing tells you why.
# So it gets extracted rather than transcribed.
#
# Run this AFTER `bubblewrap init` has created the keystore, then re-run
# ./publish.sh and push the site repo. Play also re-signs your app with its own
# key by default (Play App Signing) — if it does, take the fingerprint Play
# shows under Setup > App signing instead, and pass it with --fingerprint below.
set -e
cd "$(dirname "$0")/.."

PKG=fit.coachz.app
OUT=store/assetlinks.json

if [ "$1" = "--fingerprint" ]; then
  FP="$2"
  [ -n "$FP" ] || { echo "usage: $0 --fingerprint <AA:BB:...>" >&2; exit 1; }
else
  KS="$1"
  ALIAS="${2:-android}"
  [ -n "$KS" ] || { echo "usage: $0 <keystore-path> [key-alias]" >&2
                    echo "   or: $0 --fingerprint <AA:BB:...>" >&2; exit 1; }
  [ -f "$KS" ] || { echo "no keystore at $KS" >&2; exit 1; }
  command -v keytool >/dev/null || { echo "keytool not found — install a JDK, or use --fingerprint" >&2; exit 1; }

  echo "Reading $ALIAS from $KS (you will be asked for the keystore password)..."
  FP=$(keytool -list -v -keystore "$KS" -alias "$ALIAS" \
       | grep -i 'SHA256:' | head -1 | sed 's/.*SHA256: *//' | tr -d ' \r')
fi

# 32 bytes as colon-separated hex pairs, and nothing else. A truncated or
# lowercase-but-otherwise-fine value is still valid; a wrong LENGTH never is.
echo "$FP" | grep -Eq '^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$' || {
  echo "that does not look like a SHA-256 fingerprint:" >&2
  echo "  $FP" >&2
  echo "expected 32 hex pairs separated by colons" >&2
  exit 1
}

cat > "$OUT" <<EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "$PKG",
      "sha256_cert_fingerprints": [
        "$FP"
      ]
    }
  }
]
EOF

echo "wrote $OUT for $PKG"
echo "  $FP"
echo
echo "Next: ./publish.sh, then push site/ to the malaygrowth.github.io repo."
echo "Verify it is live at https://malaygrowth.github.io/.well-known/assetlinks.json"
echo "before you build the bundle — the check happens at install time, not build time."
