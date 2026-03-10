#!/usr/bin/env bats
# N-33: Smoke tests for Claude Code hooks (requires bats-core)
# Install: git clone https://github.com/bats-core/bats-core && cd bats-core && ./install.sh /usr/local
# Run: bats tests/hooks/hook-smoke.bats

setup() {
  HOOKS_DIR="${BATS_TEST_DIRNAME}/../../../../.claude/hooks"
  TMPDIR="$(mktemp -d)"
}

teardown() {
  rm -rf "$TMPDIR"
}

@test "post-tool-lint.sh exits 0 for valid TypeScript file" {
  cat > "$TMPDIR/valid.ts" <<'TSEOF'
const x: number = 1;
export function add(a: number, b: number): number {
  return a + b;
}
TSEOF
  # Simulate the hook input (JSON on stdin with tool_input.file_path)
  echo "{\"tool_input\":{\"file_path\":\"$TMPDIR/valid.ts\"}}" | \
    FILE="$TMPDIR/valid.ts" run bash "$HOOKS_DIR/post-tool-lint.sh"
  [ "$status" -eq 0 ]
}

@test "pre-tool-config-guard.sh blocks .env file edit" {
  # pre-tool-config-guard.sh should reject edits to sensitive config files
  echo '{"tool_input":{"file_path":".env"}}' | \
    run bash "$HOOKS_DIR/pre-tool-config-guard.sh"
  [ "$status" -eq 2 ]
}

@test "stop-test-enforcer.sh returns 0 or 2 (pass or block)" {
  # stop-test-enforcer.sh should either pass (0) or block (2)
  # depending on whether tests have been run
  run bash "$HOOKS_DIR/stop-test-enforcer.sh"
  [[ "$status" -eq 0 || "$status" -eq 2 ]]
}
