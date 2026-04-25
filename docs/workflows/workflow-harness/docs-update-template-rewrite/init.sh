#!/usr/bin/env bash
# init.sh for docs-update-template-rewrite
# Build and test setup commands

set -euo pipefail

cd "$(git rev-parse --show-toplevel)/workflow-harness/mcp-server"

# Install dependencies
npm ci

# TypeScript compile check
npx tsc --noEmit

# Run relevant tests
npx vitest run --reporter=verbose 2>&1 | head -100

echo "init.sh complete"
