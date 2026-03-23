/**
 * TOON I/O for MetricsStore — serialize and parse metrics.toon.
 * TOON format: key-value pairs + table arrays, no nested objects.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { MetricsStore, AggregateMetrics, TaskMetrics, PhaseMetrics } from './metrics.js';
import { esc, parseCsvRow } from '../state/toon-helpers.js';

function valStr(v: unknown): string {
  return v === null || v === undefined ? 'null' : String(v);
}

export function serializeMetrics(store: MetricsStore): string {
  const L: string[] = [];
  const agg = store.aggregate;
  L.push('version: 1');
  L.push(`totalTasks: ${agg.totalTasks}`);
  L.push(`completedTasks: ${agg.completedTasks}`);
  L.push(`totalRetries: ${agg.totalRetries}`);
  L.push(`totalDoDFailures: ${agg.totalDoDFailures}`);
  L.push(`totalPhaseTransitions: ${agg.totalPhaseTransitions}`);
  L.push(`firstPassPhases: ${agg.firstPassPhases}`);
  L.push('');
  const phases = Object.entries(agg.phaseTimings);
  L.push(`aggregatePhaseTimings[${phases.length}]{phase,count,totalMs,avgMs}:`);
  for (const [p, d] of phases) L.push(`  ${esc(p)}, ${d.count}, ${d.totalMs}, ${d.avgMs}`);
  L.push('');
  const tasks = Object.entries(store.tasks);
  L.push(`tasks[${tasks.length}]{taskId,taskName,retries,dodFailures,startedAt,completedAt}:`);
  for (const [id, t] of tasks) {
    L.push(`  ${esc(id)}, ${esc(t.taskName)}, ${t.retries}, ${t.dodFailures}, ${t.startedAt}, ${valStr(t.completedAt)}`);
  }
  for (const [id, t] of tasks) {
    const phs = Object.entries(t.phases);
    if (!phs.length) continue;
    L.push('');
    L.push(`taskPhases_${id}[${phs.length}]{phase,startedAt,endedAt,durationMs,retries,dodFailurePatterns}:`);
    for (const [p, m] of phs) {
      const pat = m.dodFailurePatterns.length ? esc(m.dodFailurePatterns.join('; ')) : '';
      L.push(`  ${esc(p)}, ${m.startedAt}, ${valStr(m.endedAt)}, ${m.durationMs}, ${m.retries}, ${pat}`);
    }
  }
  L.push('');
  return L.join('\n');
}

export function parseMetrics(content: string): MetricsStore {
  try {
    const store = freshStore();
    const lines = content.split('\n');
    let section = 'kv';
    let tableName = '';
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed) { section = 'kv'; continue; }
      const hdr = trimmed.match(/^(\w+)\[(\d+)]\{([^}]+)}:$/);
      if (hdr) {
        tableName = hdr[1];
        section = 'table';
        continue;
      }
      if (section === 'table' && raw.startsWith('  ')) {
        const vals = parseCsvRow(trimmed);
        if (tableName === 'aggregatePhaseTimings') {
          store.aggregate.phaseTimings[vals[0]] = {
            count: Number(vals[1]), totalMs: Number(vals[2]), avgMs: Number(vals[3]),
          };
        } else if (tableName === 'tasks') {
          store.tasks[vals[0]] = {
            taskName: vals[1], phases: {}, retries: Number(vals[2]),
            dodFailures: Number(vals[3]), startedAt: vals[4],
            completedAt: vals[5] === 'null' ? null : vals[5],
          };
        } else if (tableName.startsWith('taskPhases_')) {
          const taskId = tableName.slice('taskPhases_'.length);
          if (store.tasks[taskId]) {
            const patterns = vals[5]
              ? vals[5].split('; ').map(s => s.trim()).filter(Boolean)
              : [];
            store.tasks[taskId].phases[vals[0]] = {
              startedAt: vals[1],
              endedAt: vals[2] === 'null' ? undefined : vals[2],
              durationMs: Number(vals[3]),
              retries: Number(vals[4]),
              dodFailurePatterns: patterns,
            };
          }
        }
        continue;
      }
      if (section === 'kv') {
        const kv = trimmed.match(/^(\w+):\s*(.*)$/);
        if (kv) {
          const [, k, v] = kv;
          const n = Number(v);
          if (k in store.aggregate) (store.aggregate as any)[k] = isNaN(n) ? v : n;
        }
      }
    }
    return store;
  } catch (e) {
    process.stderr.write(`[warn] Failed to parse metrics-toon-io: ${e instanceof Error ? e.message : String(e)}\n`);
    return freshStore();
  }
}

export function freshStore(): MetricsStore {
  return {
    version: 1,
    tasks: {},
    aggregate: {
      totalTasks: 0, completedTasks: 0, totalRetries: 0,
      totalDoDFailures: 0, totalPhaseTransitions: 0, firstPassPhases: 0,
      phaseTimings: {},
    },
  };
}
