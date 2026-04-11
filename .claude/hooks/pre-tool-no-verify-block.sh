#!/bin/bash
# pre-tool-no-verify-block.sh — エージェントの --no-verify 使用を構造的にブロック
# トリガー: PreToolUse (matcher: Bash)
# exit 2 = ブロック, exit 0 = 許可

INPUT=$(cat)

# Bash tool の command を抽出
COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//')

# command が空なら許可
if [ -z "$COMMAND" ]; then
  exit 0
fi

# git commit --no-verify / git commit -n パターンを検出
if echo "$COMMAND" | grep -qE 'git\s+commit\s+.*--no-verify|git\s+commit\s+.*\s-[a-zA-Z]*n'; then
  echo "[NO-VERIFY-BLOCK] git commit --no-verify は禁止されています。"
  echo "pre-commitフックをスキップせずにコミットしてください。"
  echo "フックの問題を修正するか、根本原因を調査してください。"
  exit 2
fi

exit 0
