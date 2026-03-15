#!/usr/bin/env bash
# Auto-build before MCP server start to prevent stale dist/ issues

# Auto-install tool access guard hooks if not present
HARNESS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_ROOT="$(cd "$HARNESS_DIR/.." && pwd)"
# Always run setup.sh — it's fast, idempotent, and ensures the wrapper stays current
echo "[harness] Ensuring tool access guard hooks are up-to-date..." >&2
(cd "$PROJECT_ROOT" && bash "$HARNESS_DIR/setup.sh" 2>&1 | sed 's/^/[harness-setup] /' >&2) || true

cd "$(dirname "$0")" && npm run build --silent 2>/dev/null && node dist/index.js
