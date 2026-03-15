#!/bin/bash
# Test suite for pre-tool-guard.sh
# Tests: Orchestrator (TC-O), Coordinator (TC-C), Worker (TC-W), Edge (TC-E)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_SCRIPT="$SCRIPT_DIR/pre-tool-guard.sh"

PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# Temp dir for .coordinator-ids isolation
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

# Run as coordinator (agent_id in .coordinator-ids)
run_as_coordinator() {
  local tool_name="$1" agent_id="$2"
  local workdir="$TMPDIR_BASE/coord-$$"
  mkdir -p "$workdir/.agent"
  echo "$agent_id" > "$workdir/.agent/.coordinator-ids"
  local json="{\"tool_name\":\"$tool_name\",\"tool_input\":{},\"agent_id\":\"$agent_id\"}"
  HOOK_STDERR=$(cd "$workdir" && echo "$json" | env -u ORCHESTRATOR_GUARD_DISABLE bash "$TARGET_SCRIPT" 2>&1 >/dev/null)
  HOOK_EXIT=$?
}

# Run as worker (agent_id NOT in .coordinator-ids)
run_as_worker() {
  local tool_name="$1" agent_id="$2"
  local workdir="$TMPDIR_BASE/work-$$"
  mkdir -p "$workdir"
  # No .coordinator-ids file, or agent_id not in it
  local json="{\"tool_name\":\"$tool_name\",\"tool_input\":{},\"agent_id\":\"$agent_id\"}"
  HOOK_STDERR=$(cd "$workdir" && echo "$json" | env -u ORCHESTRATOR_GUARD_DISABLE bash "$TARGET_SCRIPT" 2>&1 >/dev/null)
  HOOK_EXIT=$?
}

echo "=== 3-Layer Tool Access Control Guard Test Suite ==="
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

# TC-O-17: workflow_next → exit 0
run_as_orchestrator "mcp__workflow__workflow_next"
assert_exit "TC-O-17 workflow_next" 0 "$HOOK_EXIT"

# TC-O-18: workflow_add_ac → exit 2
run_as_orchestrator "mcp__workflow__workflow_add_ac"
assert_exit "TC-O-18 workflow_add_ac blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-O-18 stderr" "BLOCKED" "$HOOK_STDERR"

# ============================================================
echo ""
echo "--- Coordinator Tests ---"

# TC-C-01: Agent → exit 0
run_as_coordinator "Agent" "coord-001"
assert_exit "TC-C-01 Agent" 0 "$HOOK_EXIT"
assert_stderr_empty "TC-C-01 stderr" "$HOOK_STDERR"

# TC-C-02: harness_add_ac → exit 0
run_as_coordinator "mcp__harness__harness_add_ac" "coord-002"
assert_exit "TC-C-02 harness_add_ac" 0 "$HOOK_EXIT"

# TC-C-03: harness_add_rtm → exit 0
run_as_coordinator "mcp__harness__harness_add_rtm" "coord-003"
assert_exit "TC-C-03 harness_add_rtm" 0 "$HOOK_EXIT"

# TC-C-04: harness_record_proof → exit 0
run_as_coordinator "mcp__harness__harness_record_proof" "coord-004"
assert_exit "TC-C-04 harness_record_proof" 0 "$HOOK_EXIT"

# TC-C-05: harness_pre_validate → exit 0
run_as_coordinator "mcp__harness__harness_pre_validate" "coord-005"
assert_exit "TC-C-05 harness_pre_validate" 0 "$HOOK_EXIT"

# TC-C-06: harness_get_subphase_template → exit 0
run_as_coordinator "mcp__harness__harness_get_subphase_template" "coord-006"
assert_exit "TC-C-06 harness_get_subphase_template" 0 "$HOOK_EXIT"

# TC-C-07: harness_record_test_result → exit 0
run_as_coordinator "mcp__harness__harness_record_test_result" "coord-007"
assert_exit "TC-C-07 harness_record_test_result" 0 "$HOOK_EXIT"

# TC-C-08: harness_capture_baseline → exit 0
run_as_coordinator "mcp__harness__harness_capture_baseline" "coord-008"
assert_exit "TC-C-08 harness_capture_baseline" 0 "$HOOK_EXIT"

# TC-C-09: harness_set_scope → exit 0
run_as_coordinator "mcp__harness__harness_set_scope" "coord-009"
assert_exit "TC-C-09 harness_set_scope" 0 "$HOOK_EXIT"

# TC-C-10: harness_complete_sub → exit 0
run_as_coordinator "mcp__harness__harness_complete_sub" "coord-010"
assert_exit "TC-C-10 harness_complete_sub" 0 "$HOOK_EXIT"

# TC-C-11: Read → exit 2
run_as_coordinator "Read" "coord-011"
assert_exit "TC-C-11 Read blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-C-11 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-C-12: Write → exit 2
run_as_coordinator "Write" "coord-012"
assert_exit "TC-C-12 Write blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-C-12 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-C-13: Bash → exit 2
run_as_coordinator "Bash" "coord-013"
assert_exit "TC-C-13 Bash blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-C-13 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-C-14: harness_start → exit 2 (lifecycle)
run_as_coordinator "mcp__harness__harness_start" "coord-014"
assert_exit "TC-C-14 harness_start blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-C-14 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-C-15: harness_next → exit 2 (lifecycle)
run_as_coordinator "mcp__harness__harness_next" "coord-015"
assert_exit "TC-C-15 harness_next blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-C-15 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-C-16: harness_approve → exit 2 (lifecycle)
run_as_coordinator "mcp__harness__harness_approve" "coord-016"
assert_exit "TC-C-16 harness_approve blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-C-16 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-C-17: harness_status → exit 2 (lifecycle)
run_as_coordinator "mcp__harness__harness_status" "coord-017"
assert_exit "TC-C-17 harness_status blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-C-17 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-C-18: harness_back → exit 2 (lifecycle)
run_as_coordinator "mcp__harness__harness_back" "coord-018"
assert_exit "TC-C-18 harness_back blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-C-18 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-C-19: harness_reset → exit 2 (lifecycle)
run_as_coordinator "mcp__harness__harness_reset" "coord-019"
assert_exit "TC-C-19 harness_reset blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-C-19 stderr" "BLOCKED" "$HOOK_STDERR"

# ============================================================
echo ""
echo "--- Worker Tests ---"

# TC-W-01: Read → exit 0
run_as_worker "Read" "worker-001"
assert_exit "TC-W-01 Read" 0 "$HOOK_EXIT"

# TC-W-02: Write → exit 0
run_as_worker "Write" "worker-002"
assert_exit "TC-W-02 Write" 0 "$HOOK_EXIT"

# TC-W-03: Edit → exit 0
run_as_worker "Edit" "worker-003"
assert_exit "TC-W-03 Edit" 0 "$HOOK_EXIT"

# TC-W-04: Bash → exit 0
run_as_worker "Bash" "worker-004"
assert_exit "TC-W-04 Bash" 0 "$HOOK_EXIT"

# TC-W-05: Grep → exit 0
run_as_worker "Grep" "worker-005"
assert_exit "TC-W-05 Grep" 0 "$HOOK_EXIT"

# TC-W-06: Glob → exit 0
run_as_worker "Glob" "worker-006"
assert_exit "TC-W-06 Glob" 0 "$HOOK_EXIT"

# TC-W-07: Agent → exit 0
run_as_worker "Agent" "worker-007"
assert_exit "TC-W-07 Agent" 0 "$HOOK_EXIT"

# TC-W-08: harness_add_ac → exit 2
run_as_worker "mcp__harness__harness_add_ac" "worker-008"
assert_exit "TC-W-08 harness_add_ac blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-W-08 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-W-09: harness_record_proof → exit 2
run_as_worker "mcp__harness__harness_record_proof" "worker-009"
assert_exit "TC-W-09 harness_record_proof blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-W-09 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-W-10: harness_next → exit 2
run_as_worker "mcp__harness__harness_next" "worker-010"
assert_exit "TC-W-10 harness_next blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-W-10 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-W-11: harness_start → exit 2
run_as_worker "mcp__harness__harness_start" "worker-011"
assert_exit "TC-W-11 harness_start blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-W-11 stderr" "BLOCKED" "$HOOK_STDERR"

# TC-W-12: workflow_add_ac → exit 2
run_as_worker "mcp__workflow__workflow_add_ac" "worker-012"
assert_exit "TC-W-12 workflow_add_ac blocked" 2 "$HOOK_EXIT"
assert_stderr_contains "TC-W-12 stderr" "BLOCKED" "$HOOK_STDERR"

# ============================================================
echo ""
echo "--- Edge Case Tests ---"

# TC-E-01: Empty stdin → exit 0
HOOK_STDERR=$(echo "" | env -u ORCHESTRATOR_GUARD_DISABLE bash "$TARGET_SCRIPT" 2>&1 >/dev/null)
HOOK_EXIT=$?
assert_exit "TC-E-01 empty stdin" 0 "$HOOK_EXIT"
assert_stderr_empty "TC-E-01 stderr" "$HOOK_STDERR"

# TC-E-02: Unknown tool → exit 0 (orchestrator allows unknown? No — blocks)
# Actually unknown tools at orchestrator level get blocked. Let's test at worker level.
run_as_worker "SomeUnknownTool" "worker-edge"
assert_exit "TC-E-02 unknown tool (worker)" 0 "$HOOK_EXIT"

# TC-E-03: ORCHESTRATOR_GUARD_DISABLE=true → exit 0 (bypass)
HOOK_STDERR=$(echo '{"tool_name":"Read","tool_input":{}}' | env ORCHESTRATOR_GUARD_DISABLE=true bash "$TARGET_SCRIPT" 2>&1 >/dev/null)
HOOK_EXIT=$?
assert_exit "TC-E-03 bypass enabled" 0 "$HOOK_EXIT"
assert_stderr_empty "TC-E-03 stderr" "$HOOK_STDERR"

# TC-E-04: No .coordinator-ids file → agent_id treated as worker
WORKDIR_E4=$(mktemp -d)
HOOK_STDERR=$(cd "$WORKDIR_E4" && echo '{"tool_name":"Read","tool_input":{},"agent_id":"some-agent"}' | env -u ORCHESTRATOR_GUARD_DISABLE bash "$TARGET_SCRIPT" 2>&1 >/dev/null)
HOOK_EXIT=$?
assert_exit "TC-E-04 no coordinator-ids = worker" 0 "$HOOK_EXIT"
rm -rf "$WORKDIR_E4"

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
