#!/bin/sh
# Assemble the shippable app.
#   ./build.sh          -> personal build (index.html)
#   ./build.sh public   -> public build   (index.html with PUBLIC_BUILD flag)
set -e
cd "$(dirname "$0")"
if [ "$1" = "public" ]; then
  cat head.html fonts.html variant-public.html core.html eximg.html tail.html > index.html
  echo "built PUBLIC index.html ($(wc -c < index.html) bytes)"
else
  cat head.html fonts.html core.html eximg.html tail.html > index.html
  echo "built personal index.html ($(wc -c < index.html) bytes)"
fi
