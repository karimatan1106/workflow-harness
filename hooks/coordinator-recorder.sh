#!/bin/bash
# coordinator-recorder.sh — コーディネーター（中間層）のagent_idを記録
# トリガー: PreToolUse（全ツール）
#
# 検出ロジック:
#   agent_id を持つサブエージェントが Agent ツールを呼び出した場合、
#   そのサブエージェントは「コーディネーター」（中間層）と判定。
#   Agent(Explore) は読み取り専用のため除外。

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Agent ツール呼び出し以外は無視
if [ "$TOOL_NAME" != "Agent" ] && [ "$TOOL_NAME" != "agent" ]; then
  exit 0
fi

# agent_id がなければオーケストレーター（別の仕組みで制御）
AGENT_ID=$(echo "$INPUT" | grep -o '"agent_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"agent_id"[[:space:]]*:[[:space:]]*"//;s/"$//')
if [ -z "$AGENT_ID" ]; then
  exit 0
fi

# subagent_type を抽出（Explore は読み取り専用→コーディネーター扱いしない）
SUBAGENT_TYPE=$(echo "$INPUT" | grep -o '"subagent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"subagent_type"[[:space:]]*:[[:space:]]*"//;s/"$//')
if [ "$SUBAGENT_TYPE" = "Explore" ]; then
  exit 0
fi

# コーディネーターとして記録（重複排除）
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
COORD_FILE="$PROJECT_ROOT/.agent/.coordinator-ids"
mkdir -p "$(dirname "$COORD_FILE")"
if ! grep -qF "$AGENT_ID" "$COORD_FILE" 2>/dev/null; then
  echo "$AGENT_ID" >> "$COORD_FILE"
fi

exit 0
