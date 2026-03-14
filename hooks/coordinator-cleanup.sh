#!/bin/bash
# coordinator-cleanup.sh — Remove coordinator ID when Agent tool completes
# Paired with coordinator-recorder.sh (PreToolUse → add, PostToolUse → remove)

INPUT=$(cat)

# Only process Agent tool completions
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//;s/"$//' || true)
[ "$TOOL_NAME" = "Agent" ] || exit 0

# Get caller's agent_id
AGENT_ID=$(echo "$INPUT" | grep -o '"agent_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"agent_id"[[:space:]]*:[[:space:]]*"//;s/"$//' || true)
[ -n "$AGENT_ID" ] || exit 0

# Resolve project root for absolute path
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
COORD_FILE="$PROJECT_ROOT/.agent/.coordinator-ids"
[ -f "$COORD_FILE" ] || exit 0

# Remove the agent_id from coordinator-ids (exact line match)
grep -vxF "$AGENT_ID" "$COORD_FILE" > "$COORD_FILE.tmp" 2>/dev/null && mv "$COORD_FILE.tmp" "$COORD_FILE" || true

exit 0
