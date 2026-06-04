#!/usr/bin/env sh
# Vercel build: stage Vite output to .vercel-output (see root vercel.json).
set -e
if [ -d frontend ] && [ -f frontend/package.json ]; then
  npm run build --prefix frontend
  SRC=frontend/dist
else
  npm run build
  SRC=dist
fi
rm -rf .vercel-output
mkdir -p .vercel-output
cp -a "$SRC"/. .vercel-output/
