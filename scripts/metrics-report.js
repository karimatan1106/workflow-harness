#!/usr/bin/env node
'use strict';
/**
 * Cross-task metrics aggregator for workflow-harness.
 * Reads per-task phase-metrics.toon files and .claude/state/metrics.toon,
 * emits a markdown summary to stdout.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function argVal(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
}
const ROOT = path.resolve(argVal('--root', process.cwd()));
const OUT = argVal('--out', null);
const FORMAT = argVal('--format', 'markdown');

function parseToonKV(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function readTaskMetrics(taskDir) {
  const metricsPath = path.join(taskDir, 'phase-metrics.toon');
  if (!fs.existsSync(metricsPath)) return null;
  let text;
  try { text = fs.readFileSync(metricsPath, 'utf8'); } catch (_) { return null; }
  const result = { taskName: null, totalRetries: 0, totalDoDFailures: 0, phases: {} };
  const kv = parseToonKV(text);
  if (kv.taskName) result.taskName = kv.taskName;
  if (kv.totalRetries) result.totalRetries = Number(kv.totalRetries) || 0;
  if (kv.totalDoDFailures) result.totalDoDFailures = Number(kv.totalDoDFailures) || 0;
  const phaseMatches = text.matchAll(/^  ([a-z_]+):\s*\n(?:    [^\n]*\n)+/gm);
  for (const m of phaseMatches) {
    const name = m[1];
    const body = m[0];
    const durMatch = body.match(/durationSec:\s*([\d.]+)/);
    const retryMatch = body.match(/retries:\s*(\d+)/);
    const dodMatch = body.match(/dodFailures:\s*(\d+)/);
    result.phases[name] = {
      durationMs: durMatch ? Math.round(Number(durMatch[1]) * 1000) : null,
      retries: retryMatch ? Number(retryMatch[1]) : 0,
      dodFailures: dodMatch ? Number(dodMatch[1]) : 0,
    };
  }
  return result;
}

function readTaskErrors(taskDir) {
  const errPath = path.join(taskDir, 'phase-errors.toon');
  if (!fs.existsSync(errPath)) return [];
  let text;
  try { text = fs.readFileSync(errPath, 'utf8'); } catch (_) { return []; }
  const patterns = [];
  let currentPhase = null;
  let inChecks = false;
  for (const raw of text.split(/\r?\n/)) {
    const phaseMatch = raw.match(/^\s+phase:\s*([a-z_]+)\s*$/);
    if (phaseMatch) { currentPhase = phaseMatch[1]; inChecks = false; continue; }
    if (/^\s+checks\[\d+\]\{/.test(raw)) { inChecks = true; continue; }
    if (!inChecks) continue;
    const row = raw.match(/^\s{6,}([a-z_]+),(true|false),/);
    if (!row) { if (raw.match(/^\s{0,4}\S/)) inChecks = false; continue; }
    if (row[2] === 'false') {
      const levelMatch = raw.match(/,(L[1-4]),/);
      patterns.push({ check: row[1], level: levelMatch ? levelMatch[1] : 'L?', phase: currentPhase });
    }
  }
  return patterns;
}

function scanTasks(root) {
  const wfDir = path.join(root, 'docs', 'workflows');
  if (!fs.existsSync(wfDir)) return [];
  const tasks = [];
  for (const entry of fs.readdirSync(wfDir)) {
    const taskDir = path.join(wfDir, entry);
    try { if (!fs.statSync(taskDir).isDirectory()) continue; } catch (_) { continue; }
    const metrics = readTaskMetrics(taskDir);
    if (!metrics) continue;
    metrics.taskDir = entry;
    metrics.errorPatterns = readTaskErrors(taskDir);
    tasks.push(metrics);
  }
  return tasks;
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function median(arr) { return percentile(arr, 0.5); }
function mean(arr) { return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length; }

function aggregatePhases(tasks) {
  const byPhase = {};
  for (const t of tasks) {
    for (const [name, data] of Object.entries(t.phases)) {
      if (!byPhase[name]) byPhase[name] = { durations: [], retries: [], dodFailures: [] };
      if (data.durationMs != null) byPhase[name].durations.push(data.durationMs);
      byPhase[name].retries.push(data.retries);
      byPhase[name].dodFailures.push(data.dodFailures);
    }
  }
  return byPhase;
}

function aggregateErrors(tasks) {
  const counts = {};
  for (const t of tasks) {
    const seenInTask = new Set();
    for (const p of t.errorPatterns) {
      const key = `${p.level}:${p.check}`;
      counts[key] = counts[key] || { check: p.check, level: p.level, total: 0, tasks: new Set(), phases: new Set() };
      counts[key].total++;
      if (p.phase) counts[key].phases.add(p.phase);
      if (!seenInTask.has(key)) { counts[key].tasks.add(t.taskDir); seenInTask.add(key); }
    }
  }
  return Object.values(counts).sort((a, b) => b.total - a.total);
}

function findOutliers(byPhase) {
  const outliers = [];
  for (const [name, data] of Object.entries(byPhase)) {
    if (data.durations.length < 2) continue;
    const p50 = median(data.durations);
    const p95 = percentile(data.durations, 0.95);
    if (p95 > p50 * 2 && p95 > 1000) {
      outliers.push({ phase: name, p50, p95, ratio: (p95 / (p50 || 1)).toFixed(2) });
    }
  }
  return outliers.sort((a, b) => b.ratio - a.ratio);
}

function buildMarkdown(tasks) {
  const lines = [];
  const byPhase = aggregatePhases(tasks);
  const errors = aggregateErrors(tasks);
  const outliers = findOutliers(byPhase);
  const totalRetries = tasks.reduce((a, t) => a + (t.totalRetries || 0), 0);
  const totalDoD = tasks.reduce((a, t) => a + (t.totalDoDFailures || 0), 0);
  const totalPhases = Object.values(byPhase).reduce((a, p) => a + p.durations.length, 0);
  lines.push(`# Workflow Harness Metrics Report`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Tasks scanned: ${tasks.length}`);
  lines.push(``);
  lines.push(`## Overall`);
  lines.push(`- Total phases executed: ${totalPhases}`);
  lines.push(`- Total retries: ${totalRetries}`);
  lines.push(`- Total DoD failures: ${totalDoD}`);
  lines.push(`- Avg phases per task: ${tasks.length ? (totalPhases / tasks.length).toFixed(1) : 0}`);
  lines.push(``);
  lines.push(`## Phase duration distribution (ms)`);
  lines.push(`| Phase | Count | Mean | Median | P95 | Max |`);
  lines.push(`|-------|-------|------|--------|-----|-----|`);
  const phaseNames = Object.keys(byPhase).sort();
  for (const name of phaseNames) {
    const d = byPhase[name].durations;
    if (d.length === 0) continue;
    lines.push(`| ${name} | ${d.length} | ${Math.round(mean(d))} | ${median(d)} | ${percentile(d, 0.95)} | ${Math.max(...d)} |`);
  }
  lines.push(``);
  lines.push(`## Retry hotspots`);
  lines.push(`| Phase | Total retries | Avg/task | Max/task |`);
  lines.push(`|-------|---------------|----------|----------|`);
  const retryRows = phaseNames.map(name => {
    const r = byPhase[name].retries;
    return { name, total: r.reduce((a, b) => a + b, 0), avg: r.length ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(2) : 0, max: r.length ? Math.max(...r) : 0 };
  }).sort((a, b) => b.total - a.total).slice(0, 10);
  for (const r of retryRows) lines.push(`| ${r.name} | ${r.total} | ${r.avg} | ${r.max} |`);
  lines.push(``);
  lines.push(`## Top DoD failure patterns`);
  lines.push(`| Check | Level | Count | Tasks | Phases |`);
  lines.push(`|-------|-------|-------|-------|--------|`);
  for (const e of errors.slice(0, 15)) {
    const phases = [...e.phases].sort().join(', ');
    lines.push(`| ${e.check} | ${e.level} | ${e.total} | ${e.tasks.size} | ${phases} |`);
  }
  lines.push(``);
  lines.push(`## Outlier phases (P95 > 2x median)`);
  if (outliers.length === 0) lines.push(`- No significant outliers detected`);
  for (const o of outliers) lines.push(`- ${o.phase}: P50=${o.p50}ms, P95=${o.p95}ms (ratio ${o.ratio}x)`);
  lines.push(``);
  lines.push(`## Recommendations`);
  const recs = [];
  const highRetry = retryRows.filter(r => r.avg > 0.5);
  for (const r of highRetry.slice(0, 3)) recs.push(`- Phase "${r.name}" retries avg ${r.avg}/task — DoD may be too strict or template ambiguous`);
  for (const e of errors.slice(0, 3)) if (e.tasks.size >= Math.max(2, Math.floor(tasks.length * 0.3))) recs.push(`- DoD check "${e.check}" (${e.level}) fails in ${e.tasks.size}/${tasks.length} tasks — review this validator`);
  for (const o of outliers.slice(0, 2)) recs.push(`- Phase "${o.phase}" P95 is ${o.ratio}x median — investigate blocking behavior`);
  if (recs.length === 0) recs.push(`- No high-confidence recommendations from current data`);
  for (const r of recs) lines.push(r);
  return lines.join('\n') + '\n';
}

function buildJson(tasks) {
  const byPhase = aggregatePhases(tasks);
  const errors = aggregateErrors(tasks);
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    taskCount: tasks.length,
    phaseStats: Object.fromEntries(Object.entries(byPhase).map(([k, v]) => [k, {
      count: v.durations.length,
      meanMs: Math.round(mean(v.durations)),
      medianMs: median(v.durations),
      p95Ms: percentile(v.durations, 0.95),
      totalRetries: v.retries.reduce((a, b) => a + b, 0),
    }])),
    topErrors: errors.slice(0, 15).map(e => ({ check: e.check, level: e.level, total: e.total, taskCount: e.tasks.size, phases: [...e.phases].sort() })),
    outliers: findOutliers(byPhase),
  }, null, 2) + '\n';
}

function main() {
  const tasks = scanTasks(ROOT);
  const output = FORMAT === 'json' ? buildJson(tasks) : buildMarkdown(tasks);
  if (OUT) fs.writeFileSync(OUT, output, 'utf8');
  else process.stdout.write(output);
}

if (require.main === module) main();

module.exports = {
  parseToonKV,
  readTaskMetrics,
  scanTasks,
  aggregatePhases,
  aggregateErrors,
  findOutliers,
  buildMarkdown,
  buildJson,
  percentile,
  median,
  mean,
};
