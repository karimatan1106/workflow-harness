#!/bin/bash
# 2-Layer per-process guard (part of 3-layer architecture via delegate_work)
# Layer 1 (Orchestrator): No AGENT_ID → Agent/Skill/ToolSearch/AskUserQuestion + lifecycle MCP only
# Layer 2 (Subagent):     Has AGENT_ID → phase-restricted standard tools + non-lifecycle MCP + ToolSearch

# Prevent inherited strict mode from causing crashes (grep returns 1 on no-match)
set +e

# Safety net: any unexpected exit code becomes 2 (block) rather than ambiguous "hook error".
# Fail-closed: only exit 0 (explicit allow) or exit 2 (explicit block) are valid outcomes.
trap 'code=$?; if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit 2; fi' EXIT

INPUT=$(cat)

# Empty stdin — allow
if [ -z "$INPUT" ]; then exit 0; fi

# Extract fields (|| true guards against grep exit code 1 on no-match)
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' 2>/dev/null | head -1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//;s/"$//' || true)
AGENT_ID=$(echo "$INPUT" | grep -o '"agent_id"[[:space:]]*:[[:space:]]*"[^"]*"' 2>/dev/null | head -1 | sed 's/.*"agent_id"[[:space:]]*:[[:space:]]*"//;s/"$//' || true)

# Empty tool — allow
if [ -z "$TOOL_NAME" ]; then exit 0; fi

# Observability logging
LOG_FILE="/tmp/harness-hook-obs.log"
log_obs() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] 2layer-guard tool=$TOOL_NAME agent=$AGENT_ID layer=$LAYER $1" >> "$LOG_FILE" 2>/dev/null
}

# --- Determine project root ---
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# --- Determine layer ---
if [ -n "$AGENT_ID" ]; then
  LAYER="subagent"
else
  LAYER="orchestrator"
fi

# --- Helper: is this a lifecycle MCP tool? ---
is_lifecycle() {
  case "$1" in
    *_start|*_next|*_approve|*_status|*_back|*_reset|*_delegate_work) return 0 ;;
    *) return 1 ;;
  esac
}

# === Orchestrator rules ===
if [ "$LAYER" = "orchestrator" ]; then
  case "$TOOL_NAME" in
    Skill|ToolSearch|AskUserQuestion)
      log_obs "ALLOWED($TOOL_NAME)"
      exit 0
      ;;
    mcp__harness__*)
      if is_lifecycle "$TOOL_NAME"; then
        log_obs "ALLOWED(lifecycle-mcp)"
        exit 0
      fi
      log_obs "BLOCKED(non-lifecycle-mcp)"
      echo "BLOCKED: 非lifecycleツール($TOOL_NAME)はsubagentに委譲してください" >&2
      exit 2
      ;;
    *)
      log_obs "BLOCKED(standard-tool)"
      echo "BLOCKED: 直接ツール($TOOL_NAME)使用禁止。subagentに委譲してください" >&2
      exit 2
      ;;
  esac
fi

# === Subagent rules ===
if [ "$LAYER" = "subagent" ]; then
  # ToolSearch is always allowed for subagents (needed for deferred MCP tools)
  if [ "$TOOL_NAME" = "ToolSearch" ]; then
    log_obs "ALLOWED(ToolSearch)"
    exit 0
  fi

  # Block Agent/Skill — orchestrator only
  case "$TOOL_NAME" in
    Agent|Skill)
      log_obs "BLOCKED(orchestrator-only)"
      echo "BLOCKED: このツール($TOOL_NAME)はオーケストレーター専用です" >&2
      exit 2
      ;;
  esac

  # MCP tools: allow non-lifecycle, block lifecycle
  case "$TOOL_NAME" in
    mcp__harness__*|mcp__ide__*|mcp__vision-ocr__*)
      if is_lifecycle "$TOOL_NAME"; then
        log_obs "BLOCKED(lifecycle-mcp)"
        echo "BLOCKED: lifecycle操作はオーケストレーターのみ。subagentから呼び出さないでください" >&2
        exit 2
      fi
      log_obs "ALLOWED(non-lifecycle-mcp)"
      exit 0
      ;;
  esac

  # Standard tools: check phase-restricted allowlist
  ALLOWED_TOOLS_FILE="$PROJECT_ROOT/.agent/.worker-allowed-tools"
  if [ -f "$ALLOWED_TOOLS_FILE" ]; then
    ALLOWED_TOOLS=$(cat "$ALLOWED_TOOLS_FILE" 2>/dev/null || echo "Read,Glob,Grep,Write,Edit,Bash")
  else
    # No file = no active task = full access. Per-phase restrictions written by harness_start/harness_next.
    ALLOWED_TOOLS="Read,Glob,Grep,Write,Edit,Bash"
  fi

  case ",$ALLOWED_TOOLS," in
    *",$TOOL_NAME,"*)
      # Tool is allowed — now check file extension for Write/Edit
      if [ "$TOOL_NAME" = "Write" ] || [ "$TOOL_NAME" = "Edit" ]; then
        EXT_FILE="$PROJECT_ROOT/.agent/.worker-allowed-extensions"
        if [ -f "$EXT_FILE" ]; then
          ALLOWED_EXTS=$(cat "$EXT_FILE" 2>/dev/null || true)
          if [ -n "$ALLOWED_EXTS" ]; then
            # Extract file_path from tool input JSON
            TOOL_INPUT=$(echo "$INPUT" | grep -o '"tool_input"[[:space:]]*:[[:space:]]*{[^}]*}' 2>/dev/null | head -1 || true)
            FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' 2>/dev/null | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' || true)
            if [ -n "$FILE_PATH" ]; then
              FILE_EXT=".${FILE_PATH##*.}"
              if ! echo ",$ALLOWED_EXTS," | grep -q ",$FILE_EXT,"; then
                log_obs "BLOCKED(extension-restricted)"
                echo "BLOCKED: Extension $FILE_EXT not allowed in current phase. Allowed: $ALLOWED_EXTS" >&2
                exit 2
              fi
            fi
          fi
        fi
      fi
      log_obs "ALLOWED(phase-tool)"
      exit 0
      ;;
  esac

  log_obs "BLOCKED(phase-restricted)"
  echo "BLOCKED: このフェーズでは${TOOL_NAME}は許可されていません。許可ツール: $ALLOWED_TOOLS" >&2
  exit 2
fi

exit 0
