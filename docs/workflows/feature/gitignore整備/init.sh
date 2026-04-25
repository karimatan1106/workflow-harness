#!/bin/bash
# gitignore整備タスク - ビルド・テスト初期化スクリプト
set -euo pipefail

echo "=== Environment ==="
echo "Node: $(node --version)"
echo "npm: $(npm --version)"

echo "=== Parent repo git status ==="
git status --short

echo "=== Submodule mcp-server build ==="
cd workflow-harness/mcp-server && npm run build 2>&1 | tail -5

echo "=== Submodule mcp-server test ==="
npm test 2>&1 | tail -5
