#!/usr/bin/env bash
# Builds public/katago/ - KataGo analysis in the browser - from the KataGo
# engine of Web KaTrain (MIT, https://github.com/Sir-Teo/web-katrain) at a
# fixed commit. The result is committed, so the app build needs neither
# esbuild nor TypeScript; run this only to update the engine.
#
#   bash tools/katago-worker/build.sh
#
# Output:
#   public/katago/katago-worker.js        engine + TensorFlow.js (Web Worker)
#   public/katago/tfjs/*.wasm             TensorFlow.js WASM backend
#   public/katago/models/katago-small.bin.gz  KataGo g170 b6c96 net (CC0)
#   public/katago/LICENSE-web-katrain.txt
set -euo pipefail

WEB_KATRAIN_REPO="https://github.com/Sir-Teo/web-katrain.git"
WEB_KATRAIN_COMMIT="a6a67d6"

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
out="$repo/public/katago"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

git clone --quiet "$WEB_KATRAIN_REPO" "$work/web-katrain"
git -C "$work/web-katrain" checkout --quiet "$WEB_KATRAIN_COMMIT"

cd "$here"
npm install --no-audit --no-fund --loglevel=error

mkdir -p "$out/tfjs" "$out/models"
# Asset paths inside the worker resolve next to the worker file.
NODE_PATH="$here/node_modules" "$here/node_modules/.bin/esbuild" \
  "$work/web-katrain/src/engine/katago/worker.ts" \
  --bundle --format=iife --target=es2020 --minify --legal-comments=eof \
  --define:import.meta.env.BASE_URL='"./"' \
  --define:import.meta.env.DEV=false \
  --define:import.meta.env.PROD=true \
  --define:import.meta.env.MODE='"production"' \
  --outfile="$out/katago-worker.js"

cp "$here"/node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm "$out/tfjs/"
cp "$work/web-katrain/public/models/katago-small.bin.gz" "$out/models/"
cp "$work/web-katrain/LICENSE" "$out/LICENSE-web-katrain.txt"
echo "Built $out from web-katrain $WEB_KATRAIN_COMMIT"
