/**
 * GC — Garbage Collection for stale harness state.
 * Scans reflector lessons, stashed failures, metrics, and ADR entries
 * for staleness. Reports candidates for cleanup without auto-deleting.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const STALE_LESSON_DAYS = 30;
const STALE_STASH_DAYS = 7;
const STALE_METRICS_DAYS = 90;

export type GCCandidateType = 'stale_lesson' | 'expired_stash' | 'stale_metrics' | 'stale_adr';

export interface GCCandidate {
  type: GCCandidateType;
  id: string;
  description: string;
  age: number; // days
  path: string;
}

export interface GCReport {
  scannedAt: string;
  totalCandidates: number;
  candidates: GCCandidate[];
}

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (24 * 60 * 60 * 1000));
}

function scanReflector(stateDir: string): GCCandidate[] {
  const candidates: GCCandidate[] = [];
  const path = join(stateDir, 'reflector-log.json');
  if (!existsSync(path)) return candidates;
  try {
    const store = JSON.parse(readFileSync(path, 'utf-8'));
    if (Array.isArray(store.lessons)) {
      for (const lesson of store.lessons) {
        const age = daysSince(lesson.createdAt);
        if (age > STALE_LESSON_DAYS && (lesson.hitCount ?? 0) <= 1) {
          candidates.push({
            type: 'stale_lesson',
            id: lesson.id ?? lesson.errorPattern?.substring(0, 30) ?? 'unknown',
            description: `Lesson "${lesson.errorPattern}" is ${age} days old with hitCount=${lesson.hitCount ?? 0}`,
            age,
            path,
          });
        }
      }
    }
    if (Array.isArray(store.stashedFailures)) {
      for (const stash of store.stashedFailures) {
        const age = daysSince(stash.createdAt);
        if (age > STALE_STASH_DAYS) {
          candidates.push({
            type: 'expired_stash',
            id: `${stash.taskId}:${stash.phase}`,
            description: `Stashed failure for task "${stash.taskId}" phase "${stash.phase}" is ${age} days old`,
            age,
            path,
          });
        }
      }
    }
  } catch { /* corrupted — skip */ }
  return candidates;
}

function scanMetrics(stateDir: string): GCCandidate[] {
  const candidates: GCCandidate[] = [];
  const path = join(stateDir, 'metrics.json');
  if (!existsSync(path)) return candidates;
  try {
    const store = JSON.parse(readFileSync(path, 'utf-8'));
    if (store.tasks && typeof store.tasks === 'object') {
      for (const [taskId, task] of Object.entries(store.tasks) as [string, any][]) {
        const dateStr = task.completedAt ?? task.startedAt;
        if (!dateStr) continue;
        const age = daysSince(dateStr);
        if (age > STALE_METRICS_DAYS) {
          candidates.push({
            type: 'stale_metrics',
            id: taskId,
            description: `Metrics for task "${task.taskName}" completed ${age} days ago`,
            age,
            path,
          });
        }
      }
    }
  } catch { /* corrupted — skip */ }
  return candidates;
}

function scanADR(stateDir: string): GCCandidate[] {
  const candidates: GCCandidate[] = [];
  const path = join(stateDir, 'adr-store.json');
  if (!existsSync(path)) return candidates;
  try {
    const store = JSON.parse(readFileSync(path, 'utf-8'));
    if (Array.isArray(store.entries)) {
      for (const entry of store.entries) {
        if (entry.status === 'deprecated' || entry.status === 'superseded') {
          const age = daysSince(entry.updatedAt ?? entry.createdAt);
          if (age > STALE_LESSON_DAYS) {
            candidates.push({
              type: 'stale_adr',
              id: entry.id,
              description: `ADR "${entry.id}" (${entry.status}) is ${age} days old`,
              age,
              path,
            });
          }
        }
      }
    }
  } catch { /* corrupted — skip */ }
  return candidates;
}

/**
 * Run a full GC scan across all harness state stores.
 * Returns a report of cleanup candidates without performing any deletions.
 */
export function runGCScan(stateDir?: string): GCReport {
  const dir = stateDir ?? (process.env.STATE_DIR || '.claude/state');
  const candidates = [
    ...scanReflector(dir),
    ...scanMetrics(dir),
    ...scanADR(dir),
  ];
  return {
    scannedAt: new Date().toISOString(),
    totalCandidates: candidates.length,
    candidates,
  };
}
