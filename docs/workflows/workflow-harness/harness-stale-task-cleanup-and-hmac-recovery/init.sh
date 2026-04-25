#!/usr/bin/env bash
# init.sh — harness-stale-task-cleanup-and-hmac-recovery
# Build and test setup commands

set -euo pipefail

cd "$(git rev-parse --show-toplevel)/workflow-harness/mcp-server"

# Install dependencies
npm install

# Build
npm run build

# Run existing tests
npm test

# Verify current state
echo "=== Workflow directories ==="
ls -1 "../../.claude/state/workflows/" | wc -l

echo "=== HMAC keys format ==="
node -e "const d=JSON.parse(require('fs').readFileSync('../../.claude/state/hmac-keys.json','utf8'));console.log(Array.isArray(d)?'legacy-array':'current-format')"

echo "=== Active tasks ==="
node -e "const d=require('fs').readdirSync('../../.claude/state/workflows/',{withFileTypes:true});let c=0;for(const e of d){if(e.isDirectory()){try{const s=JSON.parse(require('fs').readFileSync('../../.claude/state/workflows/'+e.name+'/workflow-state.json','utf8'));if(s.phase!=='completed')c++}catch{}}};console.log(c+' active')"
