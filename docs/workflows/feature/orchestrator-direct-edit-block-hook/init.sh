#!/bin/bash
# init.sh — orchestrator-direct-edit-block-hook タスクのビルド・テスト・セットアップコマンド
# 生成日: 2026-03-11
# S1-10準拠: プロジェクトのビルド・テスト環境の初期化手順

set -euo pipefail

echo "=== orchestrator-direct-edit-block-hook: Environment Check ==="

# 1. バージョン確認
echo "--- Runtime Versions ---"
node --version
npm --version
bash --version | head -1
tsc --version 2>/dev/null || npx tsc --version 2>/dev/null || echo "tsc: not available"

# 2. 既存PreToolUseフック一覧
echo "--- PreToolUse Hooks (current) ---"
if [ -f .claude/settings.json ]; then
  grep -A2 '"PreToolUse"' .claude/settings.json || echo "  PreToolUse section not found"
else
  echo "  .claude/settings.json not found"
fi

# 3. 既存フックファイル確認
echo "--- Hook Scripts ---"
for hook in .claude/hooks/pre-tool-*.sh; do
  if [ -f "$hook" ]; then
    LINES=$(wc -l < "$hook")
    echo "  $(basename "$hook"): ${LINES} lines — $(head -2 "$hook" | tail -1 | sed 's/^# //')"
  fi
done

# 4. 対象ディレクトリ存在確認
echo "--- Target Directories ---"
if [ -d docs/workflows ]; then
  TASK_DIRS=$(find docs/workflows -maxdepth 1 -type d | wc -l)
  echo "  docs/workflows/: exists (${TASK_DIRS} entries)"
else
  echo "  docs/workflows/: not found"
fi

# 5. Node.js版フック参照確認
echo "--- Node.js Hook Layer ---"
if [ -f workflow-plugin/hooks/phase-edit-guard.js ]; then
  LINES=$(wc -l < workflow-plugin/hooks/phase-edit-guard.js)
  echo "  phase-edit-guard.js: ${LINES} lines (reference only, not modified by this task)"
else
  echo "  phase-edit-guard.js: not found"
fi

# 6. テストランナー確認
echo "--- Test Runner ---"
if [ -f workflow-plugin/hooks/package.json ]; then
  echo "  workflow-plugin/hooks/package.json: exists"
  grep -o '"test"[^,]*' workflow-plugin/hooks/package.json 2>/dev/null || echo "  test script not found"
fi

echo ""
echo "=== Environment check complete ==="
