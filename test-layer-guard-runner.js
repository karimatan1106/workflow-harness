'use strict';
const { execSync } = require('child_process');

const SCRIPT = '/c/ツール/Workflow/workflow-harness/hooks/layer-guard.js';

const tests = [
  { id: 1, layer: 'coordinator', tool: 'Write',                                   expect: 0 },
  { id: 2, layer: 'coordinator', tool: 'Edit',                                    expect: 0 },
  { id: 3, layer: 'coordinator', tool: 'Bash',                                    expect: 0 },
  { id: 4, layer: 'coordinator', tool: 'Agent',                                   expect: 0 },
  { id: 5, layer: 'coordinator', tool: 'mcp__harness__harness_start',             expect: 2 },
  { id: 6, layer: 'coordinator', tool: 'mcp__harness__harness_record_test',       expect: 0 },
  { id: 7, layer: 'orchestrator', tool: 'Write',                                  expect: 2 },
  { id: 8, layer: 'orchestrator', tool: 'mcp__harness__harness_start',            expect: 0 },
  { id: 9, layer: 'worker',       tool: 'Write',                                  expect: 0 },
  { id: 10, layer: 'worker',      tool: 'Agent',                                  expect: 2 },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const input = JSON.stringify({ tool_name: t.tool });
  let exitCode;
  try {
    execSync(`echo '${input}' | HARNESS_LAYER=${t.layer} node "${SCRIPT}"`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/bash',
      cwd: '/c/ツール/Workflow'
    });
    exitCode = 0;
  } catch (e) {
    exitCode = e.status;
  }
  const result = exitCode === t.expect ? 'PASS' : 'FAIL';
  if (result === 'PASS') passed++; else failed++;
  console.log(`Test ${t.id}: HARNESS_LAYER=${t.layer}, tool=${t.tool} -> exit=${exitCode} (expected ${t.expect}) -> ${result}`);
}

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${tests.length}`);
