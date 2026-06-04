#!/usr/bin/env sh
# Local / optional install: monorepo root (npm --prefix frontend) or app root only (npm ci).
# Production Vercel uses vercel.json: npm ci --prefix frontend (repo root only).
set -e
if [ -d frontend ] && [ -f frontend/package.json ]; then
  npm ci --prefix frontend
else
  npm ci
fi
