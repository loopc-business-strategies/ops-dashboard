#!/usr/bin/env sh
# Vercel build: Vite production bundle at frontend/dist (see root vercel.json).
# Requires Vercel Project Root Directory = repository root (empty), not `frontend`.
set -e
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

npm run build --prefix frontend

if [ ! -f "$ROOT/frontend/dist/index.html" ]; then
  echo "vercel-build: missing $ROOT/frontend/dist/index.html" >&2
  exit 1
fi
