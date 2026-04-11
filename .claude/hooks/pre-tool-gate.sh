#!/bin/bash
# TEMP DISABLE FOR AGENT TEAMS TEST
HOOK="$(cd "$(dirname "$0")/../.." && pwd)/workflow-harness/hooks/tool-gate.js"
if [ -f "$HOOK" ]; then exec node "$HOOK"; fi
exit 0
