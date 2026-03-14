/**
 * GC — Garbage Collection for stale harness state.
 * Scans reflector lessons, stashed failures, metrics, and ADR entries
 * for staleness. Reports candidates for cleanup without auto-deleting.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parseStore as parseReflectorStore } from './reflector-toon.js';
import { parseMetrics } from './metrics-toon-io.js';
import { parseADRStore } from './adr-toon-io.js';

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

/** Read file content with TOON-first, JSON-fallback strategy. */
function readWithFallback(stateDir: string, baseName: string): { content: string; path: string; isToon: boolean } | null {
  const toonPath = join(stateDir, `${baseName}.toon`);
  if (existsSync(toonPath)) {
    return { content: readFileSync(toonPath, 'utf-8'), path: toonPath, isToon: true };
  }
  const jsonPath = join(stateDir, `${baseName}.json`);
  if (existsSync(jsonPath)) {
    return { content: readFileSync(jsonPath, 'utf-8'), path: jsonPath, isToon: false };
  }
  return null;
}

function scanReflector(stateDir: string): GCCandidate[] {
  const candidates: GCCandidate[] = [];
  const file = readWithFallback(stateDir, 'reflector-log');
  if (!file) return candidates;
  try {
    const store = file.isToon
      ? parseReflectorStore(file.content)
      : JSON.parse(file.content);
    if (Array.isArray(store.lessons)) {
      for (const lesson of store.lessons) {
        const age = daysSince(lesson.createdAt);
        if (age > STALE_LESSON_DAYS && (lesson.hitCount ?? 0) <= 1) {
          candidates.push({
            type: 'stale_lesson',
            id: lesson.id ?? lesson.errorPattern?.substring(0, 30) ?? 'unknown',
            description: `Lesson "${lesson.errorPattern}" is ${age} days old with hitCount=${lesson.hitCount ?? 0}`,
            age,
            path: file.path,
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
            path: file.path,
          });
        }
      }
    }
  } catch { /* corrupted — skip */ }
  return candidates;
}

function scanMetrics(stateDir: string): GCCandidate[] {
  const candidates: GCCandidate[] = [];
  const file = readWithFallback(stateDir, 'metrics');
  if (!file) return candidates;
  try {
    const store = file.isToon
      ? parseMetrics(file.content)
      : JSON.parse(file.content);
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
            path: file.path,
          });
        }
      }
    }
  } catch { /* corrupted — skip */ }
  return candidates;
}

function scanADR(stateDir: string): GCCandidate[] {
  const candidates: GCCandidate[] = [];
  const file = readWithFallback(stateDir, 'adr-store');
  if (!file) return candidates;
  try {
    const store = file.isToon
      ? parseADRStore(file.content)
      : JSON.parse(file.content);
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
              path: file.path,
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
