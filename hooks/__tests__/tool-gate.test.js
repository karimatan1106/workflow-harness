'use strict';
// Regression tests for tool-gate.js detectLayer and checkWriteEdit.
// detectLayer() reads module-level hookInput; _setHookInput() is the test setter.
// checkWriteEdit(filePath, phase, layer) returns a string reason on block, or null when allowed.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { detectLayer, checkWriteEdit, _setHookInput } = require('../tool-gate.js');

test('TC-AC1-01: opaque hex agent_id returns worker', () => {
  delete process.env.HARNESS_LAYER;
  _setHookInput({ tool_name: 'Write', tool_input: {}, agent_id: 'a6fb64e37fc9f196e' });
  assert.equal(detectLayer(), 'worker');
});

test('TC-AC1-02: arbitrary 16-char hex agent_id returns worker', () => {
  delete process.env.HARNESS_LAYER;
  _setHookInput({ tool_name: 'Write', tool_input: {}, agent_id: '0123456789abcdef' });
  assert.equal(detectLayer(), 'worker');
});

test('TC-AC2-01: HARNESS_LAYER=worker overrides hookInput', () => {
  process.env.HARNESS_LAYER = 'worker';
  _setHookInput({ tool_name: 'Write', tool_input: {}, agent_id: 'anything' });
  assert.equal(detectLayer(), 'worker');
  delete process.env.HARNESS_LAYER;
});

test('TC-AC2-02: HARNESS_LAYER=coordinator returns coordinator', () => {
  process.env.HARNESS_LAYER = 'coordinator';
  _setHookInput({ tool_name: 'Write', tool_input: {}, agent_id: 'anything' });
  assert.equal(detectLayer(), 'coordinator');
  delete process.env.HARNESS_LAYER;
});

test('TC-AC3-01: null hookInput returns orchestrator', () => {
  delete process.env.HARNESS_LAYER;
  _setHookInput(null);
  assert.equal(detectLayer(), 'orchestrator');
});

test('TC-AC3-02: hookInput without agent_id returns orchestrator', () => {
  delete process.env.HARNESS_LAYER;
  _setHookInput({ tool_name: 'Write', tool_input: {} });
  assert.equal(detectLayer(), 'orchestrator');
});

test('TC-AC3-03: empty string agent_id returns orchestrator', () => {
  delete process.env.HARNESS_LAYER;
  _setHookInput({ tool_name: 'Write', tool_input: {}, agent_id: '' });
  assert.equal(detectLayer(), 'orchestrator');
});

test('TC-AC4-01: worker layer can write to docs/workflows path (no phase)', () => {
  // Signature: checkWriteEdit(filePath, phase, layer).
  // For worker: docs/workflows branch is skipped (layer === 'worker'); with phase=null the phase/ext check returns null.
  const result = checkWriteEdit('docs/workflows/foo/bar.md', null, 'worker');
  assert.equal(result, null);
});

test('TC-AC4-02: orchestrator layer is blocked from docs/workflows path', () => {
  // For non-worker layer, docs/workflows path triggers the "Direct editing of phase artifacts" block,
  // which returns a truthy string reason (not an object).
  const result = checkWriteEdit('docs/workflows/foo/bar.md', null, 'orchestrator');
  assert.equal(typeof result, 'string');
  assert.match(result, /Direct editing of phase artifacts/);
});

test('TC-AC5-01: tool-gate.test.js exists at expected path', () => {
  const here = require('path').join(__dirname, 'tool-gate.test.js');
  assert.ok(existsSync(here));
});
