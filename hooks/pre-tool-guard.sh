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
source "$(dirname "$0")/trace-logger.sh"

# Emergency bypass
if [ "${TOOL_GUARD_DISABLE:-}" = "true" ]; then
  log_trace_event "ALLOW" "unknown" "system" "bypass" "TOOL_GUARD_DISABLE"
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
  log_trace_event "ALLOW" "$TOOL_NAME" "worker" "subagent" "agent_id=$AGENT_ID"
  exit 0
fi

# ============================================================
# Orchestrator: restricted to control-plane tools only
# ============================================================

# Harness MCP tools (all allowed except harness_get_subphase_template)
is_lifecycle_mcp() {
  case "$1" in
    mcp__harness__harness_get_subphase_template) return 1 ;;  # BLOCKED: delegate to coordinator
    mcp__harness__harness_*) return 0 ;;  # All other harness tools allowed
    *) return 1 ;;
  esac
}

# Allow .toon and .mmd artifact writes from Orchestrator
if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"//g')
  if [[ "$FILE_PATH" == *.toon || "$FILE_PATH" == *.mmd ]]; then
    log_trace_event "ALLOW" "$TOOL_NAME" "orchestrator" "artifact-write" "$FILE_PATH"
    exit 0
  fi
fi

# Orchestrator Agent whitelist: only coordinator, worker allowed
if [ "$TOOL_NAME" = "Agent" ]; then
  SUBAGENT_TYPE=$(echo "$INPUT" | grep -o '"subagent_type" *: *"[^"]*"' | head -1 | sed 's/"subagent_type" *: *"//;s/"//g' || echo "")
  SUBAGENT_TYPE_LOWER=$(echo "$SUBAGENT_TYPE" | tr '[:upper:]' '[:lower:]')
  case "$SUBAGENT_TYPE_LOWER" in
    coordinator|worker|hearing-worker)
      ;; # allowed
    *)
      log_trace_event "BLOCK" "Agent" "orchestrator" "invalid-subagent" "$SUBAGENT_TYPE"
      echo "BLOCKED: Orchestrator Agent() requires subagent_type=coordinator|worker|hearing-worker. Got: '$SUBAGENT_TYPE'" >&2
      exit 2
      ;;
  esac
fi

# Control-plane tools (no Edit — handled separately below)
case "$TOOL_NAME" in
  Agent|Skill|ToolSearch|AskUserQuestion|TeamCreate|SendMessage|TaskCreate|TaskGet|TaskList|TaskUpdate|TaskStop|TaskOutput|Read|Bash)
    log_trace_event "ALLOW" "$TOOL_NAME" "orchestrator" "control-plane" ""
    exit 0
    ;;
esac

# Edit tool: only allowed if file is authorized by Worker (edit-preview mode)
if [ "$TOOL_NAME" = "Edit" ]; then
  AUTH_FILE=".agent/edit-auth.txt"
  if [ ! -f "$AUTH_FILE" ]; then
    log_trace_event "BLOCK" "Edit" "orchestrator" "no-auth-file" ""
    echo "BLOCKED: Edit not authorized - no pending edit authorizations from Worker" >&2
    exit 2
  fi
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"//g')
  if [ -z "$FILE_PATH" ]; then
    log_trace_event "BLOCK" "Edit" "orchestrator" "no-file-path" ""
    echo "BLOCKED: Edit - could not extract file_path" >&2
    exit 2
  fi
  if grep -qF "$FILE_PATH" "$AUTH_FILE"; then
    log_trace_event "ALLOW" "Edit" "orchestrator" "edit-authorized" "$FILE_PATH"
    exit 0
  else
    log_trace_event "BLOCK" "Edit" "orchestrator" "not-authorized" "$FILE_PATH"
    echo "BLOCKED: Edit not authorized for $FILE_PATH - not in Worker edit-auth list" >&2
    exit 2
  fi
fi

# Lifecycle MCP
if is_lifecycle_mcp "$TOOL_NAME"; then
  log_trace_event "ALLOW" "$TOOL_NAME" "orchestrator" "lifecycle-mcp" ""
  exit 0
fi

log_trace_event "BLOCK" "$TOOL_NAME" "orchestrator" "not-whitelisted" ""
echo "BLOCKED: Orchestrator can only use Agent, Skill, ToolSearch, AskUserQuestion, TeamCreate, SendMessage, Task*, and lifecycle MCP tools" >&2
exit 2
