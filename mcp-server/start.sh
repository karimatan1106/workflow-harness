#!/usr/bin/env bash
# Auto-build before MCP server start to prevent stale dist/ issues

# Resolve harness and project roots as absolute paths (ADR-029 / AC-3).
# Using $(pwd -P) defangs cwd-relative STATE_DIR values and prevents the
# double-nested workflow-harness/mcp-server/workflow-harness/mcp-server/... tree.
HARNESS_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
PROJECT_ROOT="$(cd "$HARNESS_DIR/.." && pwd -P)"

# Fallback: if STATE_DIR is empty OR relative, pin it to an absolute path
# under the project root so hook and MCP server read/write the same directory.
if [ -z "$STATE_DIR" ] || [ "${STATE_DIR#/}" = "$STATE_DIR" ] && [ "${STATE_DIR#[A-Za-z]:/}" = "$STATE_DIR" ] && [ "${STATE_DIR#[A-Za-z]:\\}" = "$STATE_DIR" ]; then
  STATE_DIR="$PROJECT_ROOT/.claude/state"
fi
export STATE_DIR

# Always run setup.sh — it's fast, idempotent, and ensures the wrapper stays current
echo "[harness] Ensuring tool access guard hooks are up-to-date..." >&2
(cd "$PROJECT_ROOT" && bash "$HARNESS_DIR/setup.sh" 2>&1 | sed 's/^/[harness-setup] /' >&2) || true

cd "$(dirname "$0")" && npm run build --silent 2>/dev/null && node dist/index.js
