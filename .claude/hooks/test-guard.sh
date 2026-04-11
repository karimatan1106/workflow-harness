#!/bin/bash
# Test suite for pre-tool-guard.sh
# Tests: Orchestrator (TC-O), Subagent (TC-S), Edge (TC-E)
#
# Guard model: 2-layer per-process
#   Layer 1 (Orchestrator): No AGENT_ID → lifecycle MCP + Agent/Skill/ToolSearch/AskUserQuestion
#   Layer 2 (Subagent):     Has AGENT_ID → phase-restricted standard tools + non-lifecycle MCP
#
# The overall 3-layer architecture (Orchestrator → Coordinator → Worker) is achieved
# by delegate_work spawning separate processes, each running this same 2-layer guard.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_SCRIPT="$SCRIPT_DIR/pre-tool-guard.sh"

PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# Temp dir for workdir isolation
TMPDIR_BASE=$(mktemp -d)
trap "rm -rf $TMPDIR_BASE" EXIT

# === Helper Functions ===

assert_exit() {
  local test_name="$1" expected="$2" actual="$3"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if [ "$expected" = "$actual" ]; then
    echo "PASS $test_name (exit=$actual)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL $test_name expected_exit=$expected actual_exit=$actual"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_stderr_contains() {
  local test_name="$1" pattern="$2" actual="$3"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if echo "$actual" | grep -q "$pattern"; then
    echo "PASS $test_name (stderr contains '$pattern')"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL $test_name expected_stderr_contains='$pattern' actual_stderr='$actual'"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_stderr_empty() {
  local test_name="$1" actual="$2"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if [ -z "$actual" ]; then
    echo "PASS $test_name (stderr empty)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL $test_name expected_stderr=empty actual_stderr='$actual'"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# Run as orchestrator (no agent_id)
run_as_orchestrator() {
  local tool_name="$1"
  local workdir="$TMPDIR_BASE/orch-$$"
  mkdir -p "$workdir"
  local json="{\"tool_name\":\"$tool_name\",\"tool_input\":{}}"
  HOOK_STDERR=$(cd "$workdir" && echo "$json" | env -u ORCHESTRATOR_GUARD_DISABLE bash "$TARGET_SCRIPT" 2>&1 >/dev/null)
  HOOK_EXIT=$?
}

# Run as subagent (has agent_id)
run_as_subagent() {
  local tool_name="$1" agent_id="$2"
  local workdir="$TMPDIR_BASE/sub-$$"
  mkdir -p "$workdir"
  local json="{\"tool_name\":\"$tool_name\",\"tool_input\":{},\"agent_id\":\"$agent_id\"}"
  HOOK_STDERR=$(cd "$workdir" && echo "$json" | env -u ORCHESTRATOR_GUARD_DISABLE bash "$TARGET_SCRIPT" 2>&1 >/dev/null)
  HOOK_EXIT=$?
}

echo "=== 2-Layer Tool Access Control Guard Test Suite ==="
echo "Target: $TARGET_SCRIPT"
echo ""

# ============================================================
echo "--- Orchestrator Tests ---"

# TC-O-01: Agent → exit 0
run_as_orchestrator "Agent"
assert_exit "TC-O-01 Agent" 0 "$HOOK_EXIT"
assert_stderr_empty "TC-O-01 stderr" "$HOOK_STDERR"

# TC-O-02: harness_start → exit 0
run_as_orchestrator "mcp__harness__harness_start"
assert_exit "TC-O-02 harness_start" 0 "$HOOK_EXIT"

# TC-O-03: harness_next → exit 0
run_as_orchestrator "mcp__harness__harness_next"
assert_exit "TC-O-03 harness_next" 0 "$HOOK_EXIT"

# TC-O-04: harness_approve → exit 0
run_as_orchestrator "mcp__harness__harness_approve"
assert_exit "TC-O-04 harness_approve" 0 "$HOOK_EXIT"

# TC-O-05: harness_status → exit 0
run_as_orchestrator "mcp__harness__harness_status"
assert_exit "TC-O-05 harness_status" 0 "$HOOK_EXIT"

# TC-O-06: harness_back → exit 0
run_as_orchestrator "mcp__harness__harness_back"
assert_exit "TC-O-06 harness_back" 0 "$HOOK_EXIT"

# TC-O-07: harness_reset → exit 0
run_as_orchestrator "mcp__harness__harness_reset"
assert_exit "TC-O-07 harness_reset" 0 "$HOOK_EXIT"

# TC-O-08: Read → exit 2
run_as_orchestrator "Read"
assert_exit "TC-O-08 Read blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-08 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-O-09: Grep → exit 2
run_as_orchestrator "Grep"
assert_exit "TC-O-09 Grep blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-09 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-O-10: Glob → exit 2
run_as_orchestrator "Glob"
assert_exit "TC-O-10 Glob blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-10 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-O-11: Write → exit 2
run_as_orchestrator "Write"
assert_exit "TC-O-11 Write blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-11 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-O-12: Edit → exit 2
run_as_orchestrator "Edit"
assert_exit "TC-O-12 Edit blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-12 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-O-13: Bash → exit 2
run_as_orchestrator "Bash"
assert_exit "TC-O-13 Bash blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-13 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-O-14: harness_add_ac → exit 2
run_as_orchestrator "mcp__harness__harness_add_ac"
assert_exit "TC-O-14 harness_add_ac blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-14 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-O-15: harness_record_proof → exit 2
run_as_orchestrator "mcp__harness__harness_record_proof"
assert_exit "TC-O-15 harness_record_proof blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-15 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-O-16: harness_get_subphase_template → exit 2
run_as_orchestrator "mcp__harness__harness_get_subphase_template"
assert_exit "TC-O-16 harness_get_subphase_template blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-16 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-O-17: non-harness MCP (workflow_next) → exit 2 (not mcp__harness__, falls to catch-all)
run_as_orchestrator "mcp__workflow__workflow_next"
assert_exit "TC-O-17 workflow_next blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-17 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-O-18: non-harness MCP (workflow_add_ac) → exit 2
run_as_orchestrator "mcp__workflow__workflow_add_ac"
assert_exit "TC-O-18 workflow_add_ac blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-18 stderr" "BLOCKED" "$HOOK_STDERR"

# ============================================================
echo ""
echo "--- Subagent Tests ---"

# TC-S-01: Read → exit 0
run_as_subagent "Read" "sub-001"
assert_exit "TC-S-01 Read" 0 "$HOOK_EXIT"

# TC-S-02: Write → exit 0
run_as_subagent "Write" "sub-002"
assert_exit "TC-S-02 Write" 0 "$HOOK_EXIT"

# TC-S-03: Edit → exit 0
run_as_subagent "Edit" "sub-003"
assert_exit "TC-S-03 Edit" 0 "$HOOK_EXIT"

# TC-S-04: Bash → exit 0
run_as_subagent "Bash" "sub-004"
assert_exit "TC-S-04 Bash" 0 "$HOOK_EXIT"

# TC-S-05: Grep → exit 0
run_as_subagent "Grep" "sub-005"
assert_exit "TC-S-05 Grep" 0 "$HOOK_EXIT"

# TC-S-06: Glob → exit 0
run_as_subagent "Glob" "sub-006"
assert_exit "TC-S-06 Glob" 0 "$HOOK_EXIT"

# TC-S-07: Agent → exit 2 (orchestrator only)
run_as_subagent "Agent" "sub-007"
assert_exit "TC-S-07 Agent blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-S-07 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-S-08: harness_add_ac → exit 0 (non-lifecycle MCP)
run_as_subagent "mcp__harness__harness_add_ac" "sub-008"
assert_exit "TC-S-08 harness_add_ac" 0 "$HOOK_EXIT"

# TC-S-09: harness_record_proof → exit 0 (non-lifecycle MCP)
run_as_subagent "mcp__harness__harness_record_proof" "sub-009"
assert_exit "TC-S-09 harness_record_proof" 0 "$HOOK_EXIT"

# TC-S-10: harness_next → exit 2 (lifecycle blocked)
run_as_subagent "mcp__harness__harness_next" "sub-010"
assert_exit "TC-S-10 harness_next blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-S-10 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-S-11: harness_start → exit 2 (lifecycle blocked)
run_as_subagent "mcp__harness__harness_start" "sub-011"
assert_exit "TC-S-11 harness_start blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-S-11 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-S-12: workflow_add_ac → exit 2 (non-harness MCP)
run_as_subagent "mcp__workflow__workflow_add_ac" "sub-012"
assert_exit "TC-S-12 workflow_add_ac blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-S-12 stderr" "BLOCKED" "$HOOK_STDERR"

# ============================================================
echo ""
echo "--- Edge Case Tests ---"

# TC-E-01: Empty stdin → exit 0
HOOK_STDERR=$(echo "" | bash "$TARGET_SCRIPT" 2>&1 >/dev/null)
HOOK_EXIT=$?
assert_exit "TC-E-01 empty stdin" 0 "$HOOK_EXIT"
assert_stderr_empty "TC-E-01 stderr" "$HOOK_STDERR"

# TC-E-02: Unknown tool (subagent) → exit 2 (not in phase-restricted allowlist)
run_as_subagent "SomeUnknownTool" "sub-edge"
assert_exit "TC-E-02 unknown tool (subagent) blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-E-02 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-E-03: Subagent with agent_id gets subagent rules (no special files needed)
WORKDIR_E3=$(mktemp -d)
HOOK_STDERR=$(cd "$WORKDIR_E3" && echo '{"tool_name":"Read","tool_input":{},"agent_id":"some-agent"}' | bash "$TARGET_SCRIPT" 2>&1 >/dev/null)
HOOK_EXIT=$?
assert_exit "TC-E-03 agent_id = subagent layer" 0 "$HOOK_EXIT"
rm -rf "$WORKDIR_E3"

echo ""
echo "=== Summary ==="
echo "PASS: $PASS_COUNT / TOTAL: $TOTAL_COUNT"
echo "FAIL: $FAIL_COUNT / TOTAL: $TOTAL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
else
  echo "All tests passed!"
  exit 0
fi
