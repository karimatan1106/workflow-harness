#!/usr/bin/env bash
# 3-Layer Tool Access Guard (Orchestrator / Coordinator / Worker)
#
# Architecture: Orchestrator -> Agent(Coordinator) -> delegate_work -> claude -p(Worker)
#
# Data arrives via stdin JSON from Claude Code:
#   { "tool_name": "...", "tool_input": {...}, "agent_id": "..." (optional) }
#
# Layer detection:
# - No agent_id + no HARNESS_LAYER       = Orchestrator
# - Has agent_id + no HARNESS_LAYER      = Coordinator (Agent subagent)
# - No agent_id + HARNESS_LAYER=worker   = Worker (claude -p via delegate_work)

set -euo pipefail
trap 'exit 2' ERR

# Read stdin JSON
INPUT=$(cat)

# Extract fields from JSON (no jq on MINGW)
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name":"[^"]*"' | head -1 | sed 's/"tool_name":"//;s/"//g' || echo "")
AGENT_ID=$(echo "$INPUT" | grep -o '"agent_id":"[^"]*"' | head -1 | sed 's/"agent_id":"//;s/"//g' || echo "")

# HARNESS_LAYER is set by delegate_work in child env
HARNESS_LAYER="${HARNESS_LAYER:-}"

# Project root detection
PROJECT_ROOT=$(git rev-parse --show-superproject-working-tree 2>/dev/null | head -1 || true)
if [ -z "$PROJECT_ROOT" ]; then
  PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
fi

# Lifecycle MCP tools (Orchestrator only)
is_lifecycle_mcp() {
  case "$1" in
    mcp__harness__harness_start|mcp__harness__harness_next|mcp__harness__harness_back|\
       mcp__harness__harness_reset|mcp__harness__harness_status|mcp__harness__harness_approve)
      return 0 ;;
    *) return 1 ;;
  esac
}

# Non-lifecycle harness MCP tools
is_nonlifecycle_mcp() {
  if is_lifecycle_mcp "$1"; then
    return 1
  fi
  case "$1" in
    mcp__harness__*) return 0 ;;
    *) return 1 ;;
  esac
}

# ============================================================
# Layer 3: Worker (claude -p via delegate_work, HARNESS_LAYER=worker)
# ============================================================
if [ "$HARNESS_LAYER" = "worker" ]; then
  case "$TOOL_NAME" in
    Read|Glob|Grep)
      exit 0
      ;;
    Write|Edit)
      # Extension check from .worker-allowed-extensions
      EXT_FILE="$PROJECT_ROOT/.agent/.worker-allowed-extensions"
      if [ -f "$EXT_FILE" ]; then
        ALLOWED_EXTS=$(cat "$EXT_FILE")
        FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"//g')
        if [ -n "$FILE_PATH" ]; then
          FILE_EXT=".${FILE_PATH##*.}"
          if ! echo ",$ALLOWED_EXTS," | grep -q ",$FILE_EXT,"; then
            echo "BLOCKED: Extension $FILE_EXT not allowed. Allowed: $ALLOWED_EXTS" >&2
            exit 2
          fi
        fi
      fi
      exit 0
      ;;
    Bash)
      exit 0
      ;;
  esac

  echo "BLOCKED: Worker can only use Read, Write, Edit, Glob, Grep, Bash" >&2
  exit 2
fi

# ============================================================
# Layer 2: Coordinator (Agent subagent, has agent_id)
# ============================================================
if [ -n "$AGENT_ID" ]; then
  case "$TOOL_NAME" in
    ToolSearch)
      exit 0
      ;;
  esac

  # delegate_work allowed for Coordinator
  if [ "$TOOL_NAME" = "mcp__harness__harness_delegate_work" ]; then
    exit 0
  fi

  # Non-lifecycle MCP allowed
  if is_nonlifecycle_mcp "$TOOL_NAME"; then
    exit 0
  fi

  echo "BLOCKED: Coordinator can only use delegate_work, ToolSearch, and non-lifecycle MCP tools. Delegate file operations to Worker via delegate_work." >&2
  exit 2
fi

# ============================================================
# Layer 1: Orchestrator (no agent_id, no HARNESS_LAYER)
# ============================================================
case "$TOOL_NAME" in
  Agent|Skill|ToolSearch|AskUserQuestion)
    exit 0
    ;;
esac

# Lifecycle MCP allowed (except delegate_work — that's for Coordinator)
if is_lifecycle_mcp "$TOOL_NAME"; then
  exit 0
fi

echo "BLOCKED: Orchestrator can only use Agent, Skill, ToolSearch, AskUserQuestion, and lifecycle MCP tools (except delegate_work)" >&2
exit 2
