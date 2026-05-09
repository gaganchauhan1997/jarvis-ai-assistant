#!/usr/bin/env bash
set -e

echo "=== Node version ==="
node --version
echo "=== npm version ==="
npm --version

echo "=== Installing pnpm ==="
npm install -g pnpm@10.26.1

echo "=== pnpm version ==="
pnpm --version

echo "=== Installing dependencies ==="
pnpm install --no-frozen-lockfile

echo "=== Building frontend ==="
BASE_PATH=/ PORT=3000 pnpm --filter @workspace/jarvis-web run build

echo "=== Building API server ==="
pnpm --filter @workspace/api-server run build

echo "=== Build complete ==="
