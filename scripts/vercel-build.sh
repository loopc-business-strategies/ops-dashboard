#!/usr/bin/env sh
# Vercel build: stage Vite output to vercel-output (see root vercel.json).
# Use a non-hidden directory name — dot-prefixed paths can be skipped or mishandled.
# When Vercel "Root Directory" is `frontend`, outputDirectory is resolved under
# `frontend/` — mirror the staged bundle there as well as at repo root.
set -e
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

if [ -d frontend ] && [ -f frontend/package.json ]; then
  npm run build --prefix frontend
  SRC="$ROOT/frontend/dist"
else
  npm run build
  SRC="$ROOT/dist"
fi

rm -rf "$ROOT/vercel-output"
mkdir -p "$ROOT/vercel-output"
cp -a "$SRC"/. "$ROOT/vercel-output/"

if [ -f "$ROOT/frontend/package.json" ]; then
  rm -rf "$ROOT/frontend/vercel-output"
  mkdir -p "$ROOT/frontend/vercel-output"
  cp -a "$ROOT/vercel-output"/. "$ROOT/frontend/vercel-output/"
fi

if [ ! -f "$ROOT/vercel-output/index.html" ]; then
  echo "vercel-build: missing $ROOT/vercel-output/index.html (Vite build output not copied)" >&2
  exit 1
fi
if [ -f "$ROOT/frontend/package.json" ] && [ ! -f "$ROOT/frontend/vercel-output/index.html" ]; then
  echo "vercel-build: missing $ROOT/frontend/vercel-output/index.html for frontend-root Vercel projects" >&2
  exit 1
fi
