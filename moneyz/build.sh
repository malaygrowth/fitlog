#!/bin/sh
# Assemble the shippable app.
#   ./build.sh   -> index.html
set -e
cd "$(dirname "$0")"
# sync.html goes before core.html: core calls into window.Sync as it boots.
cat head.html sync.html core.html tail.html > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
