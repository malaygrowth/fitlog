#!/bin/sh
# Assemble the shippable app.
#   ./build.sh   -> index.html   (hostable PWA)
#                -> artifact.html (same app, for a host that supplies its own
#                                  page skeleton: no doctype, no service worker)
set -e
cd "$(dirname "$0")"
# sync.html goes before core.html: core calls into window.Sync as it boots.
cat head.html sync.html core.html tail.html > index.html
echo "built index.html ($(wc -c < index.html) bytes)"

{ echo '<title>MoneyZ</title>'; cat sync.html core.html; } > artifact.html
echo "built artifact.html ($(wc -c < artifact.html) bytes)"
