#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

# Only operates on UserPromptSubmit (has user_prompt field)
if ! echo "$INPUT" | jq -e '.user_prompt' >/dev/null 2>&1; then
  exit 0
fi

PROMPT=$(echo "$INPUT" | jq -r '.user_prompt // empty')

if echo "$PROMPT" | grep -iqE 'ハーネス|harness'; then
  cat << 'MSG'
[HARNESS-ENFORCE] ハーネス/harness キーワード検出。
ユーザーの意図を解釈してください:
- ハーネス起動が求められている場合 → harness_start を他の一切の処理より先に実行。事前調査（Explore/Agent/Grep等）は禁止。
- 「ハーネスを使わずに」等、ハーネスを使わない指示の場合 → 通常処理。
MSG
fi

exit 0
