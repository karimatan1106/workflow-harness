#!/bin/bash
# G-05: lefthook-precommit init script
# Purpose: Install lefthook and register git pre-commit hooks
# Safe to run multiple times (idempotent)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

echo "[init] Repository root: $REPO_ROOT"

# Step 1: Check prerequisites
echo "[init] Checking prerequisites..."
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] node is not installed. Install Node.js >= 18.0.0"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm is not installed."
  exit 1
fi

NODE_VERSION=$(node --version)
echo "[init] Node.js version: $NODE_VERSION"
echo "[init] npm version: $(npm --version)"

# Step 2: Install root package.json dependencies (includes lefthook)
if [ ! -f "package.json" ]; then
  echo "[ERROR] package.json not found at repository root. Create it first."
  exit 1
fi

echo "[init] Installing dependencies..."
npm install

# Step 3: Verify lefthook binary
if ! npx lefthook version >/dev/null 2>&1; then
  echo "[ERROR] lefthook binary not found after npm install."
  exit 1
fi

echo "[init] lefthook version: $(npx lefthook version)"

# Step 4: Register git hooks via lefthook
echo "[init] Registering git hooks..."
npx lefthook install

# Step 5: Verify .git/hooks/pre-commit exists
if [ -f ".git/hooks/pre-commit" ]; then
  echo "[init] pre-commit hook registered successfully at .git/hooks/pre-commit"
else
  echo "[WARN] .git/hooks/pre-commit not found. lefthook install may have failed."
  exit 1
fi

# Step 6: Verify lefthook.yml exists
if [ -f "lefthook.yml" ]; then
  echo "[init] lefthook.yml found."
else
  echo "[WARN] lefthook.yml not found at repository root. Create it before committing."
fi

# Step 7: Check submodule node_modules
echo "[init] Checking submodule dependencies..."
for dir in workflow-harness/mcp-server workflow-plugin/mcp-server src/frontend; do
  if [ -d "$dir/node_modules" ]; then
    echo "[init]   $dir/node_modules: present"
  else
    echo "[WARN]   $dir/node_modules: missing (run npm/pnpm install in $dir)"
  fi
done

echo "[init] Setup complete. Pre-commit hooks are active."
echo "[init] Test with: npx lefthook run pre-commit"
