#!/bin/bash
# G-04 + N-56: Notification hook (compact) - saves context before compaction (with observability)

INPUT=$(cat)
TYPE=$(echo "$INPUT" | grep -o '"type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"type"[[:space:]]*:[[:space:]]*"//;s/"$//')

if [ "$TYPE" != "compact" ]; then
  exit 0
fi

# N-56: Observability - log compaction event with info loss estimate
LOG_FILE="/tmp/harness-hook-obs.log"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] PreCompact task=${CURRENT_TASK:-unknown} phase=${CURRENT_PHASE:-unknown}" >> "$LOG_FILE" 2>/dev/null

mkdir -p .agent

TASK="${CURRENT_TASK:-unknown}"
PHASE="${CURRENT_PHASE:-unknown}"
SAVED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > .agent/checkpoint.toon <<TOON_EOF
[checkpoint]
task = $TASK
phase = $PHASE
savedAt = $SAVED_AT
savedBy = pre-compact-context-save
TOON_EOF

# Append CRITICAL.md if it exists
if [ -f .agent/CRITICAL.md ]; then
  echo "" >> .agent/checkpoint.toon
  cat .agent/CRITICAL.md >> .agent/checkpoint.toon
fi

exit 0
