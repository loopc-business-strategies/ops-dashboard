#!/usr/bin/env sh
# Vercel build: Vite production bundle at frontend/dist (see root vercel.json).
# Vercel uses vercel.json install/build commands (no git). This script is for local parity.
# Requires Vercel Project Root Directory = repository root (empty), not `frontend`.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build --prefix frontend

if [ ! -f "$ROOT/frontend/dist/index.html" ]; then
  echo "vercel-build: missing $ROOT/frontend/dist/index.html" >&2
  exit 1
fi
