#!/bin/bash
# AC Test Runner for separate-workflow-harness-from-parent
# Executes 10 test cases defined in test-design.md
# Expected at test_impl phase: Red (all or most FAIL)

set +e

PASS=0
FAIL=0
TOTAL=10

pass() {
  echo "[PASS] $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "[FAIL] $1 - $2"
  FAIL=$((FAIL + 1))
}

# TC-AC1-01: ADR-001 through ADR-027 present in workflow-harness/docs/adr/
tc_ac1_01() {
  local name="TC-AC1-01 ADR files 001..027 present"
  local dir="workflow-harness/docs/adr"
  if [ ! -d "$dir" ]; then
    fail "$name" "dir not found: $dir"
    return
  fi
  local missing=0
  for n in $(seq -f "%03g" 1 27); do
    if ! ls "$dir"/ADR-${n}*.md >/dev/null 2>&1; then
      missing=$((missing + 1))
    fi
  done
  if [ "$missing" -eq 0 ]; then
    pass "$name"
  else
    fail "$name" "$missing ADR file(s) missing"
  fi
}

# TC-AC2-01: 27 files in workflow-harness/.claude/workflow-phases/
tc_ac2_01() {
  local name="TC-AC2-01 workflow-phases has 27 files"
  local dir="workflow-harness/.claude/workflow-phases"
  if [ ! -d "$dir" ]; then
    fail "$name" "dir not found: $dir"
    return
  fi
  local count
  count=$(find "$dir" -maxdepth 1 -type f | wc -l)
  count=$(echo "$count" | tr -d ' ')
  if [ "$count" = "27" ]; then
    pass "$name"
  else
    fail "$name" "expected 27, got $count"
  fi
}

# TC-AC3-01: all listed hooks present
tc_ac3_01() {
  local name="TC-AC3-01 hooks present"
  local dir="workflow-harness/.claude/hooks"
  local hooks=(
    "context-watchdog.sh"
    "handoff-reader.sh"
    "handoff-validator.sh"
    "harness-enforce.sh"
    "post-commit-auto-push.sh"
    "post-tool-lint.sh"
    "pre-compact-context-save.sh"
    "pre-tool-config-guard.sh"
    "pre-tool-gate.sh"
    "pre-tool-no-verify-block.sh"
    "test-guard.sh"
  )
  local missing=""
  for h in "${hooks[@]}"; do
    if [ ! -f "$dir/$h" ]; then
      missing="$missing $h"
    fi
  done
  if [ -z "$missing" ]; then
    pass "$name"
  else
    fail "$name" "missing:$missing"
  fi
}

# TC-AC3-02: check_ocr.py must NOT exist (OCR-only, not migrated)
tc_ac3_02() {
  local name="TC-AC3-02 check_ocr.py absent"
  local f="workflow-harness/.claude/hooks/check_ocr.py"
  if [ ! -f "$f" ]; then
    pass "$name"
  else
    fail "$name" "file unexpectedly present: $f"
  fi
}

# TC-AC4-01: commands present
tc_ac4_01() {
  local name="TC-AC4-01 commands present"
  local dir="workflow-harness/.claude/commands"
  local cmds=("handoff.md" "harness-report.md" "recall.md")
  local missing=""
  for c in "${cmds[@]}"; do
    if [ ! -f "$dir/$c" ]; then
      missing="$missing $c"
    fi
  done
  if [ -z "$missing" ]; then
    pass "$name"
  else
    fail "$name" "missing:$missing"
  fi
}

# TC-AC5-01: code-search-policy.md present
tc_ac5_01() {
  local name="TC-AC5-01 code-search-policy.md present"
  local f="workflow-harness/.claude/rules/code-search-policy.md"
  if [ -f "$f" ]; then
    pass "$name"
  else
    fail "$name" "not found: $f"
  fi
}

# TC-AC5-02: rtk-scope.md present
tc_ac5_02() {
  local name="TC-AC5-02 rtk-scope.md present"
  local f="workflow-harness/.claude/rules/rtk-scope.md"
  if [ -f "$f" ]; then
    pass "$name"
  else
    fail "$name" "not found: $f"
  fi
}

# TC-AC6-01: .mcp.json harness server cwd == "."
tc_ac6_01() {
  local name="TC-AC6-01 .mcp.json harness.cwd == '.'"
  local f="workflow-harness/.mcp.json"
  if [ ! -f "$f" ]; then
    fail "$name" "not found: $f"
    return
  fi
  if ! command -v jq >/dev/null 2>&1; then
    fail "$name" "jq not available"
    return
  fi
  local val
  val=$(jq -r '.mcpServers["workflow-harness"].cwd' "$f" 2>/dev/null)
  if [ "$val" = "." ]; then
    pass "$name"
  else
    fail "$name" "cwd=$val (expected '.')"
  fi
}

# TC-AC7-01: git status --porcelain empty in workflow-harness
tc_ac7_01() {
  local name="TC-AC7-01 workflow-harness git status clean"
  if [ ! -d "workflow-harness/.git" ] && [ ! -f "workflow-harness/.git" ]; then
    fail "$name" "not a git repo: workflow-harness"
    return
  fi
  local out
  out=$(cd workflow-harness && git status --porcelain 2>/dev/null)
  if [ -z "$out" ]; then
    pass "$name"
  else
    fail "$name" "uncommitted changes present"
  fi
}

# TC-AC7-02: git log origin/main..HEAD empty (pushed)
tc_ac7_02() {
  local name="TC-AC7-02 workflow-harness pushed to origin/main"
  if [ ! -d "workflow-harness/.git" ] && [ ! -f "workflow-harness/.git" ]; then
    fail "$name" "not a git repo: workflow-harness"
    return
  fi
  local out
  out=$(cd workflow-harness && git log origin/main..HEAD --oneline 2>/dev/null)
  if [ -z "$out" ]; then
    pass "$name"
  else
    fail "$name" "unpushed commits present"
  fi
}

echo "=== AC Test Runner: separate-workflow-harness-from-parent ==="
echo "CWD: $(pwd)"
echo ""

tc_ac1_01
tc_ac2_01
tc_ac3_01
tc_ac3_02
tc_ac4_01
tc_ac5_01
tc_ac5_02
tc_ac6_01
tc_ac7_01
tc_ac7_02

echo ""
echo "Passed: ${PASS}/${TOTAL}"
echo "Failed: ${FAIL}/${TOTAL}"

if [ "$PASS" = "$TOTAL" ]; then
  exit 0
else
  exit 1
fi
