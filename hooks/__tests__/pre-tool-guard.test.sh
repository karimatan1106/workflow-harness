#!/bin/bash
# TC-AC1-01: wildcard match for harness_* tools
# TC-AC1-02: non-harness tool rejection
# TDD Red phase: CHG-1 already applied, these tests should pass

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GUARD="$SCRIPT_DIR/../pre-tool-guard.sh"

# Source just the is_lifecycle_mcp function from pre-tool-guard.sh
eval "$(sed -n '/^is_lifecycle_mcp()/,/^}/p' "$GUARD")"

PASS=0
FAIL=0

# TC-AC1-01: harness tools should be allowed (wildcard match)
HARNESS_TOOLS=(
  mcp__harness__harness_record_proof
  mcp__harness__harness_add_ac
  mcp__harness__harness_set_scope
  mcp__harness__harness_start
  mcp__harness__harness_status
  mcp__harness__harness_advance
  mcp__harness__harness_get_subphase_template
)

for tool in "${HARNESS_TOOLS[@]}"; do
  if is_lifecycle_mcp "$tool"; then
    PASS=$((PASS + 1))
  else
    echo "FAIL TC-AC1-01: $tool should be allowed"
    FAIL=$((FAIL + 1))
  fi
done

# TC-AC1-02: non-harness tools should be rejected
REJECT_TOOLS=(
  mcp__other__some_tool
  mcp__harness__other_tool
  Write
  Glob
  mcp__harness__not_harness_prefixed
)

for tool in "${REJECT_TOOLS[@]}"; do
  if is_lifecycle_mcp "$tool"; then
    echo "FAIL TC-AC1-02: $tool should be rejected"
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
  fi
done

echo ""
echo "TC-AC1-01 + TC-AC1-02 Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
