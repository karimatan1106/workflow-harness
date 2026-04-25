#!/bin/bash
# init.sh — claude-hooks-4layer タスクのビルド・テスト・セットアップコマンド
# 生成日: 2026-03-10
# S1-10準拠: プロジェクトのビルド・テスト環境の初期化手順

set -euo pipefail

echo "=== claude-hooks-4layer: Environment Check ==="

# 1. バージョン確認
echo "--- Runtime Versions ---"
node --version
npm --version
tsc --version 2>/dev/null || npx tsc --version 2>/dev/null || echo "tsc: not available"

# 2. プロジェクト構造確認
echo "--- Project Structure ---"
echo "Hooks directory:"
ls -la .claude/hooks/ 2>/dev/null || echo "  .claude/hooks/ not found"
echo ""
echo "Settings file:"
ls -la .claude/settings.json 2>/dev/null || echo "  .claude/settings.json not found"
echo ""
echo "Agent directory:"
ls -la .agent/ 2>/dev/null || echo "  .agent/ not found"

# 3. 既存フック動作確認
echo "--- Existing Hooks ---"
for hook in .claude/hooks/*.sh; do
  if [ -f "$hook" ]; then
    echo "  $(basename "$hook"): $(head -2 "$hook" | tail -1 | sed 's/^# //')"
  fi
done

# 4. tsconfig.json探索
echo "--- TypeScript Config Locations ---"
find . -maxdepth 3 -name "tsconfig.json" -not -path "*/node_modules/*" 2>/dev/null | while read -r f; do
  echo "  $f"
done

# 5. テストランナー確認
echo "--- Test Runner ---"
find . -maxdepth 3 -name "vitest.config.*" -not -path "*/node_modules/*" 2>/dev/null | while read -r f; do
  echo "  vitest config: $f"
done

# 6. MCP設定確認
echo "--- MCP Configuration ---"
if [ -f .mcp.json ]; then
  echo "  .mcp.json exists"
else
  echo "  .mcp.json not found"
fi

echo ""
echo "=== Environment check complete ==="
