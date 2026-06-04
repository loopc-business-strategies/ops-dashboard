#!/usr/bin/env sh
# Vercel install: monorepo root (npm --prefix frontend) or app root only (npm ci).
set -e
if [ -d frontend ] && [ -f frontend/package.json ]; then
  npm ci --prefix frontend
else
  npm ci
fi
