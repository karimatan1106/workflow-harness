#!/usr/bin/env bash
# init.sh - INV-N / ProofTier build and test bootstrap
# Usage: bash docs/workflows/inv-n-proof-tier/init.sh

set -euo pipefail

HARNESS_DIR="workflow-harness/mcp-server"

echo "=== Node version ==="
node --version

echo "=== npm version ==="
npm --version

echo "=== Install dependencies ==="
cd "$HARNESS_DIR"
npm install

echo "=== TypeScript compile check ==="
npx tsc --noEmit

echo "=== Run test suite ==="
npx vitest run --reporter=verbose

echo "=== init.sh complete ==="
