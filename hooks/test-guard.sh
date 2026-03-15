#!/bin/bash
# Test suite for pre-tool-guard.sh
# Tests: Orchestrator (TC-O), Coordinator (TC-C), Worker (TC-W), Extension (TC-E), Edge (TC-X)
#
# Guard model: 3-layer AGENT_ID-based
#   Layer 1 (Orchestrator): No AGENT_ID → Agent/Skill/ToolSearch/AskUserQuestion + lifecycle MCP
#   Layer 2 (Coordinator):  AGENT_ID matches .coordinator-agent-id → Agent/ToolSearch/AskUserQuestion + non-lifecycle MCP
#   Layer 3 (Worker):       AGENT_ID differs from coordinator → Read/Write/Edit/Glob/Grep/Bash + non-lifecycle MCP

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_SCRIPT="$SCRIPT_DIR/pre-tool-guard.sh"

PASS=0
FAIL=0
TOTAL=0

# Project root for coordinator ID file
PROJECT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
COORD_ID_FILE="$PROJECT_ROOT/.agent/.coordinator-agent-id"

# Ensure .agent dir exists
mkdir -p "$PROJECT_ROOT/.agent"

# === Helper ===
run_test() {
  local id="$1" expected_exit="$2" desc="$3"
  TOTAL=$((TOTAL + 1))

  # Run the guard script with env vars
  local stderr_file
  stderr_file=$(mktemp)
  (
    cd "$PROJECT_ROOT"
    env TOOL_NAME="$TOOL_NAME" TOOL_INPUT="$TOOL_INPUT" AGENT_ID="${AGENT_ID:-}" \
      bash "$TARGET_SCRIPT" 2>"$stderr_file" >/dev/null
  )
  local actual_exit=$?
  local stderr_content
  stderr_content=$(cat "$stderr_file")
  rm -f "$stderr_file"

  if [ "$actual_exit" -eq "$expected_exit" ]; then
    echo "PASS $id: $desc (exit=$actual_exit)"
    PASS=$((PASS + 1))
  else
    echo "FAIL $id: $desc (expected=$expected_exit actual=$actual_exit stderr=$stderr_content)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== 3-Layer Tool Access Control Guard Test Suite ==="
echo "Target: $TARGET_SCRIPT"
echo ""

# ============================================================
echo "--- Orchestrator Tests (TC-O) ---"
# ============================================================

# TC-O-01: Agent allowed
TOOL_NAME="Agent" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-01" 0 "Orchestrator: Agent allowed"

# TC-O-02: Skill allowed
TOOL_NAME="Skill" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-02" 0 "Orchestrator: Skill allowed"

# TC-O-03: ToolSearch allowed
TOOL_NAME="ToolSearch" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-03" 0 "Orchestrator: ToolSearch allowed"

# TC-O-04: AskUserQuestion allowed
TOOL_NAME="AskUserQuestion" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-04" 0 "Orchestrator: AskUserQuestion allowed"

# TC-O-05: Lifecycle MCP allowed (harness_start)
TOOL_NAME="mcp__harness__harness_start" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-05" 0 "Orchestrator: lifecycle MCP allowed"

# TC-O-06: Lifecycle MCP allowed (harness_next)
TOOL_NAME="mcp__harness__harness_next" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-06" 0 "Orchestrator: harness_next allowed"

# TC-O-07: Read blocked
TOOL_NAME="Read" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-07" 2 "Orchestrator: Read blocked"

# TC-O-08: Write blocked
TOOL_NAME="Write" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-08" 2 "Orchestrator: Write blocked"

# TC-O-09: Edit blocked
TOOL_NAME="Edit" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-09" 2 "Orchestrator: Edit blocked"

# TC-O-10: Bash blocked
TOOL_NAME="Bash" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-10" 2 "Orchestrator: Bash blocked"

# TC-O-11: Glob blocked
TOOL_NAME="Glob" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-11" 2 "Orchestrator: Glob blocked"

# TC-O-12: Grep blocked
TOOL_NAME="Grep" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-12" 2 "Orchestrator: Grep blocked"

# TC-O-13: Non-lifecycle MCP blocked
TOOL_NAME="mcp__harness__harness_get_subphase_template" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-13" 2 "Orchestrator: non-lifecycle MCP blocked"

# TC-O-14: Clears coordinator ID file
rm -f "$COORD_ID_FILE"
echo "old-id" > "$COORD_ID_FILE"
TOOL_NAME="Agent" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-O-14" 0 "Orchestrator: clears coordinator ID"
if [ -f "$COORD_ID_FILE" ]; then
  echo "FAIL TC-O-14b: coordinator ID file should be cleared"
  FAIL=$((FAIL + 1))
else
  echo "PASS TC-O-14b: coordinator ID file cleared"
  PASS=$((PASS + 1))
fi
TOTAL=$((TOTAL + 1))

# ============================================================
echo ""
echo "--- Coordinator Tests (TC-C) ---"
# ============================================================

# Setup: clear coordinator ID so first AGENT_ID is recorded as coordinator
rm -f "$COORD_ID_FILE"

# TC-C-01: Agent allowed (to spawn Worker)
AGENT_ID="coord-001" TOOL_NAME="Agent" TOOL_INPUT='{}' run_test "TC-C-01" 0 "Coordinator: Agent allowed"

# Verify coordinator ID was recorded
RECORDED=$(cat "$COORD_ID_FILE" 2>/dev/null || echo "")
TOTAL=$((TOTAL + 1))
if [ "$RECORDED" = "coord-001" ]; then
  echo "PASS TC-C-01b: coordinator ID recorded"
  PASS=$((PASS + 1))
else
  echo "FAIL TC-C-01b: coordinator ID not recorded (got: $RECORDED)"
  FAIL=$((FAIL + 1))
fi

# TC-C-02: ToolSearch allowed
AGENT_ID="coord-001" TOOL_NAME="ToolSearch" TOOL_INPUT='{}' run_test "TC-C-02" 0 "Coordinator: ToolSearch allowed"

# TC-C-03: AskUserQuestion allowed
AGENT_ID="coord-001" TOOL_NAME="AskUserQuestion" TOOL_INPUT='{}' run_test "TC-C-03" 0 "Coordinator: AskUserQuestion allowed"

# TC-C-04: Non-lifecycle MCP allowed
AGENT_ID="coord-001" TOOL_NAME="mcp__harness__harness_get_subphase_template" TOOL_INPUT='{}' run_test "TC-C-04" 0 "Coordinator: non-lifecycle MCP allowed"

# TC-C-05: Read blocked
AGENT_ID="coord-001" TOOL_NAME="Read" TOOL_INPUT='{}' run_test "TC-C-05" 2 "Coordinator: Read blocked"

# TC-C-06: Write blocked
AGENT_ID="coord-001" TOOL_NAME="Write" TOOL_INPUT='{}' run_test "TC-C-06" 2 "Coordinator: Write blocked"

# TC-C-07: Edit blocked
AGENT_ID="coord-001" TOOL_NAME="Edit" TOOL_INPUT='{}' run_test "TC-C-07" 2 "Coordinator: Edit blocked"

# TC-C-08: Bash blocked
AGENT_ID="coord-001" TOOL_NAME="Bash" TOOL_INPUT='{}' run_test "TC-C-08" 2 "Coordinator: Bash blocked"

# TC-C-09: Glob blocked
AGENT_ID="coord-001" TOOL_NAME="Glob" TOOL_INPUT='{}' run_test "TC-C-09" 2 "Coordinator: Glob blocked"

# TC-C-10: Grep blocked
AGENT_ID="coord-001" TOOL_NAME="Grep" TOOL_INPUT='{}' run_test "TC-C-10" 2 "Coordinator: Grep blocked"

# TC-C-11: Lifecycle MCP blocked
AGENT_ID="coord-001" TOOL_NAME="mcp__harness__harness_start" TOOL_INPUT='{}' run_test "TC-C-11" 2 "Coordinator: lifecycle MCP blocked"

# TC-C-12: Skill blocked
AGENT_ID="coord-001" TOOL_NAME="Skill" TOOL_INPUT='{}' run_test "TC-C-12" 2 "Coordinator: Skill blocked"

# ============================================================
echo ""
echo "--- Worker Tests (TC-W) ---"
# ============================================================

# TC-W-01: Read allowed
AGENT_ID="worker-002" TOOL_NAME="Read" TOOL_INPUT='{}' run_test "TC-W-01" 0 "Worker: Read allowed"

# TC-W-02: Write allowed (no extension file)
rm -f "$PROJECT_ROOT/.agent/.worker-allowed-extensions"
AGENT_ID="worker-002" TOOL_NAME="Write" TOOL_INPUT='{"file_path":"/tmp/test.ts"}' run_test "TC-W-02" 0 "Worker: Write allowed"

# TC-W-03: Edit allowed
AGENT_ID="worker-002" TOOL_NAME="Edit" TOOL_INPUT='{"file_path":"/tmp/test.ts"}' run_test "TC-W-03" 0 "Worker: Edit allowed"

# TC-W-04: Glob allowed
AGENT_ID="worker-002" TOOL_NAME="Glob" TOOL_INPUT='{}' run_test "TC-W-04" 0 "Worker: Glob allowed"

# TC-W-05: Grep allowed
AGENT_ID="worker-002" TOOL_NAME="Grep" TOOL_INPUT='{}' run_test "TC-W-05" 0 "Worker: Grep allowed"

# TC-W-06: Bash allowed
AGENT_ID="worker-002" TOOL_NAME="Bash" TOOL_INPUT='{}' run_test "TC-W-06" 0 "Worker: Bash allowed"

# TC-W-07: Agent blocked
AGENT_ID="worker-002" TOOL_NAME="Agent" TOOL_INPUT='{}' run_test "TC-W-07" 2 "Worker: Agent blocked"

# TC-W-08: Lifecycle MCP blocked
AGENT_ID="worker-002" TOOL_NAME="mcp__harness__harness_start" TOOL_INPUT='{}' run_test "TC-W-08" 2 "Worker: lifecycle MCP blocked"

# TC-W-09: Non-lifecycle MCP allowed
AGENT_ID="worker-002" TOOL_NAME="mcp__harness__harness_record_proof" TOOL_INPUT='{}' run_test "TC-W-09" 0 "Worker: non-lifecycle MCP allowed"

# TC-W-10: Skill blocked
AGENT_ID="worker-002" TOOL_NAME="Skill" TOOL_INPUT='{}' run_test "TC-W-10" 2 "Worker: Skill blocked"

# TC-W-11: ToolSearch blocked
AGENT_ID="worker-002" TOOL_NAME="ToolSearch" TOOL_INPUT='{}' run_test "TC-W-11" 2 "Worker: ToolSearch blocked"

# ============================================================
echo ""
echo "--- Extension Enforcement Tests (TC-E) ---"
# ============================================================

# Setup extension file
EXT_FILE="$PROJECT_ROOT/.agent/.worker-allowed-extensions"
echo ".ts,.js,.toon" > "$EXT_FILE"

# TC-E-01: Allowed extension
AGENT_ID="worker-002" TOOL_NAME="Write" TOOL_INPUT='{"file_path":"/tmp/test.ts"}' run_test "TC-E-01" 0 "Extension: .ts allowed"

# TC-E-02: Blocked extension
AGENT_ID="worker-002" TOOL_NAME="Write" TOOL_INPUT='{"file_path":"/tmp/test.py"}' run_test "TC-E-02" 2 "Extension: .py blocked"

# TC-E-03: Edit with blocked extension
AGENT_ID="worker-002" TOOL_NAME="Edit" TOOL_INPUT='{"file_path":"/tmp/test.md"}' run_test "TC-E-03" 2 "Extension: .md blocked for Edit"

rm -f "$EXT_FILE"

# ============================================================
echo ""
echo "--- Edge Case Tests (TC-X) ---"
# ============================================================

# TC-X-01: Empty TOOL_NAME
TOOL_NAME="" TOOL_INPUT='{}' AGENT_ID="" run_test "TC-X-01" 2 "Edge: empty tool name"

# TC-X-02: Coordinator re-identified after orchestrator clears
rm -f "$COORD_ID_FILE"
AGENT_ID="new-coord" TOOL_NAME="Agent" TOOL_INPUT='{}' run_test "TC-X-02" 0 "Edge: new coordinator after clear"
RECORDED=$(cat "$COORD_ID_FILE" 2>/dev/null || echo "")
TOTAL=$((TOTAL + 1))
if [ "$RECORDED" = "new-coord" ]; then
  echo "PASS TC-X-02b: new coordinator recorded"
  PASS=$((PASS + 1))
else
  echo "FAIL TC-X-02b: new coordinator not recorded (got: $RECORDED)"
  FAIL=$((FAIL + 1))
fi

# TC-X-03: Worker with different ID after coordinator set
AGENT_ID="worker-999" TOOL_NAME="Agent" TOOL_INPUT='{}' run_test "TC-X-03" 2 "Edge: Worker cannot use Agent"

# Cleanup
rm -f "$COORD_ID_FILE"

# ============================================================
echo ""
echo "=== Summary ==="
echo "PASS: $PASS / TOTAL: $TOTAL"
echo "FAIL: $FAIL / TOTAL: $TOTAL"

if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  echo "All tests passed!"
  exit 0
fi
