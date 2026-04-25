#!/usr/bin/env bash
# init.sh - ハーネスMCPサーバー ビルド・テスト・セットアップ
# Generated: 2026-03-08

set -euo pipefail

cd "$(dirname "$0")/../../../workflow-harness/mcp-server"

echo "=== Environment ==="
node --version
npx tsc --version
npm --version

echo "=== Install Dependencies ==="
npm ci

echo "=== Build ==="
npm run build

echo "=== Test ==="
npx vitest run --reporter=verbose

echo "=== Lint (if configured) ==="
npm run lint 2>/dev/null || echo "No lint script configured"

echo "=== Done ==="
