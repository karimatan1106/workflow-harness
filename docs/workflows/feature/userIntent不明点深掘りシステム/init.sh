#!/bin/bash
# init.sh — userIntent不明点深掘りシステム
# このタスクはドキュメント変更（スキル文書の手順記述）のみであり、ビルドは不要。
# 変更対象ファイルの存在確認のみ実施する。

set -e

echo "=== userIntent不明点深掘りシステム — 環境確認 ==="

SKILL_MD="C:/ツール/Workflow/.claude/skills/harness/SKILL.md"
WORKFLOW_MD="C:/ツール/Workflow/workflow-harness/skills/workflow.md"

echo "--- 変更対象ファイル確認 ---"
if [ -f "$SKILL_MD" ]; then
  echo "[OK] SKILL.md 存在確認: $SKILL_MD ($(wc -l < "$SKILL_MD") 行)"
else
  echo "[NG] SKILL.md が見つかりません: $SKILL_MD"
  exit 1
fi

if [ -f "$WORKFLOW_MD" ]; then
  echo "[OK] workflow.md 存在確認: $WORKFLOW_MD ($(wc -l < "$WORKFLOW_MD") 行)"
else
  echo "[NG] workflow.md が見つかりません: $WORKFLOW_MD"
  exit 1
fi

echo "--- ミラー整合性確認 ---"
if diff "$SKILL_MD" "$WORKFLOW_MD" > /dev/null 2>&1; then
  echo "[OK] 両ファイルは同一内容（ミラー整合性 OK）"
else
  echo "[WARN] 両ファイルに差分あり（更新前に確認してください）"
  diff "$SKILL_MD" "$WORKFLOW_MD" || true
fi

echo "--- 成果物ディレクトリ確認 ---"
DOCS_DIR="C:/ツール/Workflow/docs/workflows/userIntent不明点深掘りシステム"
ls -la "$DOCS_DIR"

echo "=== 環境確認完了 — ビルド不要（ドキュメント変更のみ） ==="
