'use strict';
// TDD Red phase tests for hook-utils TOON read support (fix-hook-mcp-state-sync)
// These tests target functions that are NOT yet implemented:
//   - readToonPhase(buffer|string): extract `phase:` value from a TOON blob
//   - getActivePhaseFromWorkflowState should prefer .json when both present
//   - getActivePhaseFromWorkflowState should fall back to .toon when only .toon exists
// Expected outcome: Red (function not defined / behavior mismatch).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const hookUtils = require('../hook-utils.js');
const { readToonPhase, getActivePhaseFromWorkflowState } = hookUtils;

function mkTmpRoot(prefix) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const wfDir = path.join(base, '.claude', 'state', 'workflows');
  fs.mkdirSync(wfDir, { recursive: true });
  return { base, wfDir };
}

function cleanup(base) {
  try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) {}
}

// TC-AC2-01: readToonPhase returns 'hearing' from `phase: hearing\n`
test('TC-AC2-01: readToonPhase extracts phase value from minimal TOON', () => {
  assert.equal(typeof readToonPhase, 'function', 'readToonPhase must be exported');
  assert.equal(readToonPhase('phase: hearing\n'), 'hearing');
});

// TC-AC2-02: no phase line -> undefined
test('TC-AC2-02: readToonPhase returns undefined when no phase line', () => {
  assert.equal(readToonPhase('name: demo\nversion: 1\n'), undefined);
});

// TC-AC2-03: binary / malformed input returns undefined without throwing
test('TC-AC2-03: readToonPhase swallows malformed binary input', () => {
  const bin = Buffer.from([0x00, 0xff, 0xfe, 0x00, 0x01, 0x02, 0x7f]);
  let result;
  assert.doesNotThrow(() => { result = readToonPhase(bin); });
  assert.equal(result, undefined);
});

// TC-AC2-04: file > 64KB -> reads only head and returns phase immediately
test('TC-AC2-04: readToonPhase reads head only for oversized input (perf contract)', () => {
  const header = 'phase: implementation\n';
  const filler = 'x'.repeat(80 * 1024); // 80KB tail after header
  const started = process.hrtime.bigint();
  const phase = readToonPhase(header + filler);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.equal(phase, 'implementation');
  assert.ok(elapsedMs < 50, `expected <50ms head-only parse, got ${elapsedMs}ms`);
});

// TC-AC4-01: existing behavior preserved for json-only workflow dir
test('TC-AC4-01: getActivePhaseFromWorkflowState still works for .json only', () => {
  const { base, wfDir } = mkTmpRoot('hookutil-json');
  try {
    const taskDir = path.join(wfDir, 'task-A');
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(path.join(taskDir, 'workflow-state.json'),
      JSON.stringify({ phase: 'scope_definition' }));
    assert.equal(getActivePhaseFromWorkflowState(base), 'scope_definition');
  } finally { cleanup(base); }
});

// TC-AC4-02: when both .json and .toon exist, .json wins
test('TC-AC4-02: .json takes precedence over .toon when both exist', () => {
  const { base, wfDir } = mkTmpRoot('hookutil-both');
  try {
    const taskDir = path.join(wfDir, 'task-B');
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(path.join(taskDir, 'workflow-state.json'),
      JSON.stringify({ phase: 'requirements' }));
    fs.writeFileSync(path.join(taskDir, 'workflow-state.toon'),
      'phase: hearing\n');
    assert.equal(getActivePhaseFromWorkflowState(base), 'requirements');
  } finally { cleanup(base); }
});

// TC-AC1-02: .toon only -> active phase is returned (bootstrap-less TOON adoption)
test('TC-AC1-02: getActivePhaseFromWorkflowState reads .toon when only .toon exists', () => {
  const { base, wfDir } = mkTmpRoot('hookutil-toon');
  try {
    const taskDir = path.join(wfDir, 'task-C');
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(path.join(taskDir, 'workflow-state.toon'),
      'phase: test_impl\nversion: 1\n');
    assert.equal(getActivePhaseFromWorkflowState(base), 'test_impl');
  } finally { cleanup(base); }
});
