#!/usr/bin/env bash
# 2-Layer Tool Access Guard (Orchestrator / Subagent)
#
# Architecture (Agent Teams):
#   Orchestrator -> TeamCreate -> Agent(Coordinator) -> Agent(Worker)
#
# Data arrives via stdin JSON from Claude Code:
#   { "tool_name": "...", "tool_input": {...}, "agent_id": "..." (optional) }
#
# Layer detection:
# - No agent_id  = Orchestrator (high-level control only)
# - Has agent_id = Subagent (Coordinator or Worker — full tool access)
#
# Env overrides:
# - TOOL_GUARD_DISABLE=true  → bypass all checks (emergency escape)

set -euo pipefail
trap 'exit 2' ERR

# Emergency bypass
if [ "${TOOL_GUARD_DISABLE:-}" = "true" ]; then
  exit 0
fi

# Read stdin JSON
INPUT=$(cat)

# Extract fields from JSON (no jq on MINGW)
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name":"[^"]*"' | head -1 | sed 's/"tool_name":"//;s/"//g' || echo "")
AGENT_ID=$(echo "$INPUT" | grep -o '"agent_id":"[^"]*"' | head -1 | sed 's/"agent_id":"//;s/"//g' || echo "")

# ============================================================
# Subagent: full tool access (Coordinator, Worker, Explore, etc.)
# ============================================================
if [ -n "$AGENT_ID" ]; then
  exit 0
fi

# ============================================================
# Orchestrator: restricted to control-plane tools only
# ============================================================

# Lifecycle MCP tools
is_lifecycle_mcp() {
  case "$1" in
    mcp__harness__harness_*)
      return 0 ;;
    *) return 1 ;;
  esac
}

# Allow .toon and .mmd artifact writes from Orchestrator
if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"//g')
  if [[ "$FILE_PATH" == *.toon || "$FILE_PATH" == *.mmd ]]; then
    exit 0
  fi
fi

# Control-plane tools (no Edit — handled separately below)
case "$TOOL_NAME" in
  Agent|Skill|ToolSearch|AskUserQuestion|TeamCreate|SendMessage|TaskCreate|TaskGet|TaskList|TaskUpdate|TaskStop|TaskOutput|Read|Bash)
    exit 0
    ;;
esac

# Edit tool: only allowed if file is authorized by Worker (edit-preview mode)
if [ "$TOOL_NAME" = "Edit" ]; then
  AUTH_FILE=".agent/edit-auth.txt"
  if [ ! -f "$AUTH_FILE" ]; then
    echo "BLOCKED: Edit not authorized - no pending edit authorizations from Worker" >&2
    exit 2
  fi
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"//g')
  if [ -z "$FILE_PATH" ]; then
    echo "BLOCKED: Edit - could not extract file_path" >&2
    exit 2
  fi
  if grep -qF "$FILE_PATH" "$AUTH_FILE"; then
    exit 0
  else
    echo "BLOCKED: Edit not authorized for $FILE_PATH - not in Worker edit-auth list" >&2
    exit 2
  fi
fi

# Lifecycle MCP
if is_lifecycle_mcp "$TOOL_NAME"; then
  exit 0
fi

echo "BLOCKED: Orchestrator can only use Agent, Skill, ToolSearch, AskUserQuestion, TeamCreate, SendMessage, Task*, and lifecycle MCP tools" >&2
exit 2
