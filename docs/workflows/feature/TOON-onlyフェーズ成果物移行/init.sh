#!/bin/bash
# init.sh - TOON-onlyフェーズ成果物移行 環境確認スクリプト
# 実行場所: C:\ツール\Workflow\workflow-harness\mcp-server

set -e

echo "=== 環境確認 ==="
node --version
npm --version
npx tsc --version

echo ""
echo "=== ビルド確認 ==="
cd "$(dirname "$0")/../../../workflow-harness/mcp-server"
npm run build

echo ""
echo "=== テスト確認 ==="
npm test

echo ""
echo "=== 環境確認完了 ==="
