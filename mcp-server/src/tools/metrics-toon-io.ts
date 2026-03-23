/**
 * TOON I/O for MetricsStore — serialize and parse metrics.toon.
 * Delegates to @toon-format/toon via toon-io-adapter.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { MetricsStore } from './metrics.js';
import { toonEncode, toonDecodeSafe } from '../state/toon-io-adapter.js';

export function serializeMetrics(store: MetricsStore): string {
  return toonEncode(store);
}

export function parseMetrics(content: string): MetricsStore {
  const raw = toonDecodeSafe<Record<string, unknown>>(content);
  if (!raw || typeof raw !== 'object') return freshStore();

  // If already has correct nested shape, return directly
  if (raw.aggregate && typeof raw.aggregate === 'object') return raw as unknown as MetricsStore;

  // Reconstruct MetricsStore from flat TOON-decoded structure
  const phaseTimings: Record<string, { count: number; totalMs: number; avgMs: number }> = {};
  const rawTimings = raw.aggregatePhaseTimings;
  if (Array.isArray(rawTimings)) {
    for (const pt of rawTimings) {
      if (pt && typeof pt === 'object' && typeof pt.phase === 'string') {
        phaseTimings[pt.phase] = {
          count: Number(pt.count) || 0,
          totalMs: Number(pt.totalMs) || 0,
          avgMs: Number(pt.avgMs) || 0,
        };
      }
    }
  }

  const tasksRecord: Record<string, import('./metrics.js').TaskMetrics> = {};
  const rawTasks = raw.tasks;
  if (Array.isArray(rawTasks)) {
    for (const t of rawTasks) {
      if (t && typeof t === 'object' && typeof t.taskId === 'string') {
        const phases: Record<string, import('./metrics.js').PhaseMetrics> = {};
        const phaseKey = `taskPhases_${t.taskId}`;
        const rawPhases = raw[phaseKey];
        if (Array.isArray(rawPhases)) {
          for (const p of rawPhases) {
            if (p && typeof p === 'object' && typeof p.phase === 'string') {
              const patterns = typeof p.dodFailurePatterns === 'string'
                ? (p.dodFailurePatterns ? p.dodFailurePatterns.split(';') : [])
                : Array.isArray(p.dodFailurePatterns) ? p.dodFailurePatterns : [];
              phases[p.phase] = {
                startedAt: String(p.startedAt ?? ''),
                endedAt: p.endedAt != null ? String(p.endedAt) : undefined,
                durationMs: Number(p.durationMs) || 0,
                retries: Number(p.retries) || 0,
                dodFailurePatterns: patterns,
              };
            }
          }
        }
        tasksRecord[t.taskId] = {
          taskName: String(t.taskName ?? t.taskId),
          phases,
          retries: Number(t.retries) || 0,
          dodFailures: Number(t.dodFailures) || 0,
          startedAt: String(t.startedAt ?? ''),
          completedAt: t.completedAt != null ? String(t.completedAt) : null,
        };
      }
    }
  }

  return {
    version: 1,
    tasks: tasksRecord,
    aggregate: {
      totalTasks: Number(raw.totalTasks) || 0,
      completedTasks: Number(raw.completedTasks) || 0,
      totalRetries: Number(raw.totalRetries) || 0,
      totalDoDFailures: Number(raw.totalDoDFailures) || 0,
      totalPhaseTransitions: Number(raw.totalPhaseTransitions) || 0,
      firstPassPhases: Number(raw.firstPassPhases) || 0,
      phaseTimings,
    },
  };
}

export function freshStore(): MetricsStore {
  return {
    version: 1,
    tasks: {},
    aggregate: {
      totalTasks: 0,
      completedTasks: 0,
      totalRetries: 0,
      totalDoDFailures: 0,
      totalPhaseTransitions: 0,
      firstPassPhases: 0,
      phaseTimings: {},
    },
  };
}
