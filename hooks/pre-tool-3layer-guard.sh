#!/bin/bash
# 3-Layer Tool Access Control Guard
# Layer 1 (Orchestrator): Agent + lifecycle MCP only
# Layer 2 (Coordinator): Agent + non-lifecycle MCP only
# Layer 3 (Worker): Standard tools + Agent only, no MCP

# Prevent inherited strict mode from causing crashes (grep returns 1 on no-match)
set +e

# Safety net: any unexpected exit code becomes 0 (allow) rather than "hook error"
trap 'code=$?; if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit 2; fi' EXIT

INPUT=$(cat)

# Empty stdin — allow
if [ -z "$INPUT" ]; then exit 0; fi

# Bypass via environment variable
if [ "$ORCHESTRATOR_GUARD_DISABLE" = "true" ]; then exit 0; fi

# Extract fields (|| true guards against grep exit code 1 on no-match)
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' 2>/dev/null | head -1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//;s/"$//' || true)
AGENT_ID=$(echo "$INPUT" | grep -o '"agent_id"[[:space:]]*:[[:space:]]*"[^"]*"' 2>/dev/null | head -1 | sed 's/.*"agent_id"[[:space:]]*:[[:space:]]*"//;s/"$//' || true)

# Empty tool — allow
if [ -z "$TOOL_NAME" ]; then exit 0; fi

# Observability logging
LOG_FILE="/tmp/harness-hook-obs.log"
log_obs() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] 3layer-guard tool=$TOOL_NAME agent=$AGENT_ID layer=$LAYER $1" >> "$LOG_FILE" 2>/dev/null
}

# --- Determine project root (absolute path for COORD_FILE) ---
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# --- Determine layer ---
LAYER="orchestrator"
if [ -n "$AGENT_ID" ]; then
  COORD_FILE="$PROJECT_ROOT/.agent/.coordinator-ids"
  if [ -f "$COORD_FILE" ] && grep -qF "$AGENT_ID" "$COORD_FILE" 2>/dev/null; then
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

# --- Agent/Skill/ToolSearch: layer-aware access ---
case "$TOOL_NAME" in
  Agent)
    if [ "$LAYER" = "orchestrator" ] || [ "$LAYER" = "coordinator" ]; then
      log_obs "ALLOWED($TOOL_NAME)"
      exit 0
    fi
    # worker: fall through to worker rules (blocked)
    ;;
  Skill|ToolSearch)
    if [ "$LAYER" = "orchestrator" ]; then
      log_obs "ALLOWED($TOOL_NAME)"
      exit 0
    fi
    # coordinator/worker: fall through to layer rules (blocked)
    ;;
esac

# === Orchestrator rules ===
if [ "$LAYER" = "orchestrator" ]; then
  case "$TOOL_NAME" in
    mcp__harness__*)
      if is_lifecycle "$TOOL_NAME"; then
        log_obs "ALLOWED(lifecycle-mcp)"
        exit 0
      fi
      log_obs "BLOCKED(non-lifecycle-mcp)"
      echo "BLOCKED: オーケストレーター層はライフサイクルMCPツールのみ許可。サブエージェントに委譲してください。" >&2
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
    mcp__harness__*)
      if is_lifecycle "$TOOL_NAME"; then
        log_obs "BLOCKED(lifecycle-mcp)"
        echo "BLOCKED: コーディネーター層はライフサイクルMCPツール($TOOL_NAME)使用禁止。オーケストレーターのみ許可。" >&2
        exit 2
      fi
      log_obs "ALLOWED(non-lifecycle-mcp)"
      exit 0
      ;;
    *)
      log_obs "BLOCKED(standard-tool)"
      echo "BLOCKED: コーディネーター層は直接ツール($TOOL_NAME)使用禁止。ワーカーサブエージェントに委譲してください。" >&2
      exit 2
      ;;
  esac
fi

# === Worker rules ===
if [ "$LAYER" = "worker" ]; then
  # Read phase-specific allowed tools
  ALLOWED_TOOLS_FILE="$PROJECT_ROOT/.agent/.worker-allowed-tools"
  if [ -f "$ALLOWED_TOOLS_FILE" ]; then
    ALLOWED_TOOLS=$(cat "$ALLOWED_TOOLS_FILE" 2>/dev/null || echo "Read,Glob,Grep,Write,Edit,Bash")
  else
    ALLOWED_TOOLS="Read,Glob,Grep,Write,Edit,Bash"
  fi

  case ",$ALLOWED_TOOLS," in
    *",$TOOL_NAME,"*)
      log_obs "ALLOWED(phase-tool)"
      exit 0
      ;;
  esac

  case "$TOOL_NAME" in
    mcp__harness__*)
      log_obs "BLOCKED(mcp-tool)"
      echo "BLOCKED: ワーカー層はMCPツール($TOOL_NAME)使用禁止。コーディネーター経由で実行してください。" >&2
      exit 2
      ;;
    *)
      log_obs "BLOCKED(phase-restricted)"
      echo "BLOCKED: 現フェーズではツール($TOOL_NAME)使用禁止。許可ツール: $ALLOWED_TOOLS" >&2
      exit 2
      ;;
  esac
fi

exit 0
