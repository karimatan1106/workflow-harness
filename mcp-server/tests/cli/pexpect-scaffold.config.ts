/**
 * N-81: pexpect/expect interactive CLI test scaffold.
 * For testing interactive prompts, password inputs, and TUI flows.
 * Requires pexpect (Python) or expect (Tcl) runtime.
 */

/** Interactive CLI test case definition */
export interface InteractiveCLITest {
  id: string;
  description: string;
  command: string;
  interactions: InteractionStep[];
  timeout: number;
}

export interface InteractionStep {
  expect: string | RegExp;
  send: string;
  timeout?: number;
}

/** Pre-defined interactive test cases for harness CLI */
export const INTERACTIVE_CLI_TESTS: InteractiveCLITest[] = [
  {
    id: 'CLI-01',
    description: 'harness-inv interactive task creation',
    command: 'npx harness-inv start --interactive',
    interactions: [
      { expect: 'Task name:', send: 'test-task' },
      { expect: 'User intent:', send: 'Implement feature X for module Y with tests' },
      { expect: 'Confirm', send: 'y' },
    ],
    timeout: 10_000,
  },
  {
    id: 'CLI-02',
    description: 'harness-inv phase approval prompt',
    command: 'npx harness-inv approve --interactive',
    interactions: [
      { expect: 'Approval type:', send: 'requirements' },
      { expect: 'Confirm approval', send: 'y' },
    ],
    timeout: 10_000,
  },
];

/** pexpect Python test template */
export const PEXPECT_TEMPLATE = `
import pexpect
import pytest

def test_harness_interactive_start():
    """Test interactive task creation via CLI."""
    child = pexpect.spawn('npx harness-inv start --interactive', timeout=10)
    child.expect('Task name:')
    child.sendline('test-task')
    child.expect('User intent:')
    child.sendline('Implement feature X for module Y with tests')
    child.expect('Confirm')
    child.sendline('y')
    child.expect(pexpect.EOF)
    assert child.exitstatus == 0
`.trim();

/** expect (Tcl) test template */
export const EXPECT_TEMPLATE = `
#!/usr/bin/expect -f
set timeout 10
spawn npx harness-inv start --interactive
expect "Task name:"
send "test-task\\r"
expect "User intent:"
send "Implement feature X for module Y with tests\\r"
expect "Confirm"
send "y\\r"
expect eof
catch wait result
exit [lindex $result 3]
`.trim();

/** Bash run_main pattern for testable CLI scripts (bats-core compatible) */
export const BASH_TESTABLE_PATTERN = `
run_main() {
  # Main logic here
  echo "Hello from harness CLI"
}

if [[ "\${BASH_SOURCE[0]}" == "\${0}" ]]; then
  run_main "$@"
fi
`.trim();
