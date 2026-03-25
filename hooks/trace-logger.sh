#!/usr/bin/env bash
# trace-logger.sh — Shell-level trace logger for hook observability
# Sourced by pre-tool-guard.sh to log tool access events

log_trace_event() {
  local event="$1"
  local tool="$2"
  local layer="$3"
  local decision="$4"
  local detail="$5"

  # Locate docsDir from workflow state
  local state_file=".agent/workflow-state.toon"
  if [ ! -f "$state_file" ]; then
    return 0
  fi
  local docs_dir
  docs_dir=$(grep -m1 'docsDir:' "$state_file" | sed 's/^docsDir: *//' | tr -d '\r')
  if [ -z "$docs_dir" ]; then
    return 0
  fi

  local trace_file="$docs_dir/observability-events.toon"

  # Size check (10MB limit, MINGW compatible)
  if [ -f "$trace_file" ]; then
    local file_size
    file_size=$(wc -c < "$trace_file" | tr -d ' ')
    if [ "$file_size" -gt 10485760 ] 2>/dev/null; then
      return 0
    fi
  fi

  # Epoch timestamp
  local ts
  ts=$(date +%s)

  # Append trace line
  echo "timestamp: ${ts}, axis: tool-access, layer: ${layer}, event: ${event}, detail: ${tool} ${decision} ${detail}" >> "$trace_file" 2>/dev/null
  return 0
}
