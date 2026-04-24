'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  parseToonKV, aggregatePhases, aggregateErrors, findOutliers,
  buildMarkdown, buildJson, percentile, median, mean, scanTasks,
} = require('../metrics-report');

function mkTempRoot(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-report-' + name + '-'));
  fs.mkdirSync(path.join(dir, 'docs', 'workflows'), { recursive: true });
  return dir;
}

function seedTask(root, name, phases, totalRetries, totalDoD) {
  const taskDir = path.join(root, 'docs', 'workflows', name);
  fs.mkdirSync(taskDir, { recursive: true });
  const lines = [`taskName: ${name}`, `totalRetries: ${totalRetries}`, `totalDoDFailures: ${totalDoD}`];
  for (const [pname, data] of Object.entries(phases)) {
    lines.push(`  ${pname}:`);
    lines.push(`    durationSec: ${(data.durationMs / 1000).toFixed(2)}`);
    lines.push(`    retries: ${data.retries}`);
    lines.push(`    dodFailures: ${data.dodFailures}`);
  }
  fs.writeFileSync(path.join(taskDir, 'phase-metrics.toon'), lines.join('\n') + '\n');
}

test('parseToonKV extracts key:value pairs', () => {
  const kv = parseToonKV('foo: bar\nbaz: 42\n');
  assert.strictEqual(kv.foo, 'bar');
  assert.strictEqual(kv.baz, '42');
});

test('aggregatePhases sums per-phase metrics across tasks', () => {
  const tasks = [
    { phases: { hearing: { durationMs: 1000, retries: 1, dodFailures: 2 } } },
    { phases: { hearing: { durationMs: 2000, retries: 0, dodFailures: 0 } } },
  ];
  const agg = aggregatePhases(tasks);
  assert.deepStrictEqual(agg.hearing.durations, [1000, 2000]);
  assert.deepStrictEqual(agg.hearing.retries, [1, 0]);
});

test('percentile and median are correct', () => {
  assert.strictEqual(median([1, 2, 3, 4, 5]), 3);
  assert.strictEqual(percentile([1, 2, 3, 4, 5], 0.95), 5);
});

test('findOutliers detects P95 > 2x median', () => {
  const byPhase = { slow: { durations: [100, 110, 120, 5000], retries: [], dodFailures: [] } };
  const outliers = findOutliers(byPhase);
  assert.strictEqual(outliers.length, 1);
  assert.strictEqual(outliers[0].phase, 'slow');
});

test('buildMarkdown produces required sections with empty input', () => {
  const md = buildMarkdown([]);
  assert.match(md, /# Workflow Harness Metrics Report/);
  assert.match(md, /## Overall/);
  assert.match(md, /## Phase duration distribution/);
  assert.match(md, /Tasks scanned: 0/);
});

test('buildMarkdown renders per-phase rows when data present', () => {
  const tasks = [{
    taskDir: 't1', totalRetries: 0, totalDoDFailures: 0,
    errorPatterns: [],
    phases: { hearing: { durationMs: 1500, retries: 0, dodFailures: 0 } },
  }];
  const md = buildMarkdown(tasks);
  assert.match(md, /hearing \| 1 \| 1500/);
});

test('aggregateErrors counts check occurrences across tasks', () => {
  const tasks = [
    { taskDir: 't1', errorPatterns: [{ check: 'artifact_quality', level: 'L3', phase: 'hearing' }, { check: 'artifact_quality', level: 'L3', phase: 'hearing' }] },
    { taskDir: 't2', errorPatterns: [{ check: 'artifact_quality', level: 'L3', phase: 'hearing' }] },
  ];
  const e = aggregateErrors(tasks);
  assert.strictEqual(e[0].total, 3);
  assert.strictEqual(e[0].tasks.size, 2);
  assert.strictEqual(e[0].phases.size, 1);
});

test('buildJson produces valid JSON with expected shape', () => {
  const tasks = [{
    taskDir: 't1', totalRetries: 0, totalDoDFailures: 0, errorPatterns: [],
    phases: { hearing: { durationMs: 1000, retries: 0, dodFailures: 0 } },
  }];
  const json = buildJson(tasks);
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.taskCount, 1);
  assert.ok(parsed.phaseStats.hearing);
});

test('scanTasks handles empty workflows dir', () => {
  const root = mkTempRoot('empty');
  assert.deepStrictEqual(scanTasks(root), []);
});

test('scanTasks reads seeded tasks from filesystem', () => {
  const root = mkTempRoot('seed');
  seedTask(root, 'alpha', { hearing: { durationMs: 500, retries: 0, dodFailures: 0 } }, 0, 0);
  seedTask(root, 'beta', { hearing: { durationMs: 800, retries: 1, dodFailures: 2 } }, 1, 2);
  const tasks = scanTasks(root);
  assert.strictEqual(tasks.length, 2);
  const names = tasks.map(t => t.taskName).sort();
  assert.deepStrictEqual(names, ['alpha', 'beta']);
});
