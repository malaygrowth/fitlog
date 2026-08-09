#!/bin/sh
# Assemble the shippable app. Edit core.html (app), head.html (shell), eximg.html (generated image map).
set -e
cd "$(dirname "$0")"
cat head.html core.html eximg.html tail.html > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
