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

// --- deprecate-task-index-json: readTaskIndexToon + getCurrentPhase ---

const { readTaskIndexToon, getCurrentPhase } = hookUtils;

function mkTempRoot(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-utils-' + name + '-'));
  fs.mkdirSync(path.join(dir, '.claude', 'state'), { recursive: true });
  return dir;
}

test('readTaskIndexToon returns active task phase', () => {
  const root = mkTempRoot('active');
  fs.writeFileSync(
    path.join(root, '.claude', 'state', 'task-index.toon'),
    'tasks[1]{taskId,taskName,phase,size,status}:\nabc-123,demo,implementation,large,active\n'
  );
  assert.strictEqual(readTaskIndexToon(root), 'implementation');
});

test('readTaskIndexToon returns null when file missing', () => {
  const root = mkTempRoot('missing');
  assert.strictEqual(readTaskIndexToon(root), null);
});

test('readTaskIndexToon returns null when malformed header', () => {
  const root = mkTempRoot('malformed');
  fs.writeFileSync(
    path.join(root, '.claude', 'state', 'task-index.toon'),
    'this is not a valid TOON file\n'
  );
  assert.strictEqual(readTaskIndexToon(root), null);
});

test('readTaskIndexToon skips completed and idle, returns first active', () => {
  const root = mkTempRoot('mixed');
  fs.writeFileSync(
    path.join(root, '.claude', 'state', 'task-index.toon'),
    'tasks[3]{taskId,taskName,phase,size,status}:\nold-1,first,push,large,completed\nold-2,second,scope_definition,large,idle\nnew-1,third,hearing,large,active\n'
  );
  assert.strictEqual(readTaskIndexToon(root), 'hearing');
});

test('readTaskIndexToon returns null when all completed', () => {
  const root = mkTempRoot('allcomplete');
  fs.writeFileSync(
    path.join(root, '.claude', 'state', 'task-index.toon'),
    'tasks[1]{taskId,taskName,phase,size,status}:\nx-1,done,push,large,completed\n'
  );
  assert.strictEqual(readTaskIndexToon(root), null);
});

test('readTaskIndexToon handles unicode taskName', () => {
  const root = mkTempRoot('unicode');
  fs.writeFileSync(
    path.join(root, '.claude', 'state', 'task-index.toon'),
    'tasks[1]{taskId,taskName,phase,size,status}:\nu-1,タスク名日本語,research,large,active\n'
  );
  assert.strictEqual(readTaskIndexToon(root), 'research');
});

test('readTaskIndexToon handles quoted values with commas', () => {
  const root = mkTempRoot('quoted');
  fs.writeFileSync(
    path.join(root, '.claude', 'state', 'task-index.toon'),
    'tasks[1]{taskId,taskName,phase,size,status}:\nq-1,"name, with comma",planning,large,active\n'
  );
  assert.strictEqual(readTaskIndexToon(root), 'planning');
});

test('getCurrentPhase falls back to workflow-state when TOON absent', () => {
  const root = mkTempRoot('fallback');
  const wfDir = path.join(root, '.claude', 'state', 'workflows', 'task-1');
  fs.mkdirSync(wfDir, { recursive: true });
  fs.writeFileSync(
    path.join(wfDir, 'workflow-state.toon'),
    'phase: impact_analysis\n'
  );
  assert.strictEqual(getCurrentPhase(root), 'impact_analysis');
});

test('readTaskIndexToon silent null on parse exception', () => {
  const root = mkTempRoot('exception');
  const toonPath = path.join(root, '.claude', 'state', 'task-index.toon');
  fs.writeFileSync(toonPath, 'tasks[bad]{phase,status}:\nfoo,active\n');
  assert.strictEqual(readTaskIndexToon(root), null);
});

test('readTaskIndexToon latency under 5ms p95 for 100 calls', () => {
  const root = mkTempRoot('latency');
  fs.writeFileSync(
    path.join(root, '.claude', 'state', 'task-index.toon'),
    'tasks[3]{taskId,taskName,phase,size,status}:\nt1,a,research,large,active\nt2,b,planning,large,completed\nt3,c,testing,large,idle\n'
  );
  const durations = [];
  for (let i = 0; i < 100; i++) {
    const start = process.hrtime.bigint();
    readTaskIndexToon(root);
    durations.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  durations.sort((a, b) => a - b);
  const p95 = durations[94];
  assert.ok(p95 < 5, `p95 latency should be under 5ms, got ${p95.toFixed(3)}ms`);
});
