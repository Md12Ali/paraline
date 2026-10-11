#!/bin/sh
# Collects the website into ./public (the same page the Android app uses, plus web-only files).
set -e
rm -rf public
mkdir -p public
cp app/src/main/assets/index.html app/src/main/assets/app.js app/src/main/assets/engine.js public/
cp web/* public/
ls -l public
