#!/bin/bash
# 3-Layer Tool Access Control Guard
# Layer 1 (Orchestrator): Agent + lifecycle MCP only
# Layer 2 (Coordinator): Agent + non-lifecycle MCP only
# Layer 3 (Worker): Standard tools + Agent only, no MCP

INPUT=$(cat)

# Empty stdin — allow
if [ -z "$INPUT" ]; then exit 0; fi

# Bypass via environment variable
if [ "$ORCHESTRATOR_GUARD_DISABLE" = "true" ]; then exit 0; fi

# Extract fields
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//;s/"$//')
AGENT_ID=$(echo "$INPUT" | grep -o '"agent_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"agent_id"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Empty tool — allow
if [ -z "$TOOL_NAME" ]; then exit 0; fi

# Observability logging
LOG_FILE="/tmp/harness-hook-obs.log"
log_obs() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] 3layer-guard tool=$TOOL_NAME agent=$AGENT_ID layer=$LAYER $1" >> "$LOG_FILE" 2>/dev/null
}

# --- Determine layer ---
LAYER="orchestrator"
if [ -n "$AGENT_ID" ]; then
  COORD_FILE=".agent/.coordinator-ids"
  if [ -f "$COORD_FILE" ] && grep -qF "$AGENT_ID" "$COORD_FILE"; then
    LAYER="coordinator"
  else
    LAYER="worker"
  fi
fi

# --- Helper: is this a lifecycle MCP tool? ---
is_lifecycle() {
  case "$1" in
    *_start|*_next|*_approve|*_status|*_back|*_reset) return 0 ;;
    *) return 1 ;;
  esac
}

# --- Agent is always allowed ---
if [ "$TOOL_NAME" = "Agent" ]; then
  log_obs "ALLOWED(Agent)"
  exit 0
fi

# === Orchestrator rules ===
if [ "$LAYER" = "orchestrator" ]; then
  case "$TOOL_NAME" in
    mcp__harness__*|mcp__workflow__*)
      if is_lifecycle "$TOOL_NAME"; then
        log_obs "ALLOWED(lifecycle-mcp)"
        exit 0
      fi
      log_obs "BLOCKED(non-lifecycle-mcp)"
      echo "BLOCKED: オーケストレーター層はライフサイクルMCPツール(start/next/approve/status/back/reset)のみ許可。サブエージェントに委譲してください。" >&2
      exit 2
      ;;
    *)
      log_obs "BLOCKED(standard-tool)"
      echo "BLOCKED: オーケストレーター層は直接ツール($TOOL_NAME)使用禁止。Agentサブエージェントに委譲してください。" >&2
      exit 2
      ;;
  esac
fi

# === Coordinator rules ===
if [ "$LAYER" = "coordinator" ]; then
  case "$TOOL_NAME" in
    Read|Grep|Glob|Write|Edit|Bash)
      log_obs "BLOCKED(standard-tool)"
      echo "BLOCKED: コーディネーター層は直接ツール($TOOL_NAME)使用禁止。ワーカーサブエージェントに委譲してください。" >&2
      exit 2
      ;;
    mcp__harness__*|mcp__workflow__*)
      if is_lifecycle "$TOOL_NAME"; then
        log_obs "BLOCKED(lifecycle-mcp)"
        echo "BLOCKED: コーディネーター層はライフサイクルMCPツール($TOOL_NAME)使用禁止。オーケストレーターのみ許可。" >&2
        exit 2
      fi
      log_obs "ALLOWED(non-lifecycle-mcp)"
      exit 0
      ;;
    *)
      log_obs "ALLOWED(unknown)"
      exit 0
      ;;
  esac
fi

# === Worker rules ===
if [ "$LAYER" = "worker" ]; then
  case "$TOOL_NAME" in
    Read|Grep|Glob|Write|Edit|Bash)
      log_obs "ALLOWED(standard-tool)"
      exit 0
      ;;
    mcp__harness__*|mcp__workflow__*)
      log_obs "BLOCKED(mcp-tool)"
      echo "BLOCKED: ワーカー層はMCPツール($TOOL_NAME)使用禁止。コーディネーター経由で実行してください。" >&2
      exit 2
      ;;
    *)
      log_obs "ALLOWED(unknown)"
      exit 0
      ;;
  esac
fi

exit 0
