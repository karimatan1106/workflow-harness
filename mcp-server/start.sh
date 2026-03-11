#!/usr/bin/env bash
# Auto-build before MCP server start to prevent stale dist/ issues
cd "$(dirname "$0")" && npm run build --silent 2>/dev/null && node dist/index.js
