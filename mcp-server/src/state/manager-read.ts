/**
 * State manager — read operations (load, list, query)
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import type { TaskState, PhaseName, TaskSize } from './types.js';
import { verifyStateWithRotation } from '../utils/hmac.js';
import { parseState } from './state-toon-parse.js';
import { getProjectRoot } from '../utils/project-root.js';

function getStateDir(): string {
  return process.env.STATE_DIR || '.claude/state';
}

export function getStatePath(taskId: string, taskName: string): string {
  return join(getStateDir(), 'workflows', `${taskId}_${taskName}`, 'workflow-state.toon');
}

export function getDocsPath(taskName: string): string {
  const DOCS_DIR = process.env.DOCS_DIR || 'docs/workflows';
  const docsPath = join(DOCS_DIR, taskName);
  if (isAbsolute(docsPath)) return docsPath;
  return join(getProjectRoot(), docsPath);
}

export function loadTaskFromDisk(taskId: string): TaskState | null {
  const sd = getStateDir();
  const workflowsDir = join(sd, 'workflows');
  if (!existsSync(workflowsDir)) return null;
  const entries = readdirSync(workflowsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith(taskId)) {
      const dir = join(workflowsDir, entry.name);
      const toonPath = join(dir, 'workflow-state.toon');

      if (!existsSync(toonPath)) continue;
      const state: TaskState = parseState(readFileSync(toonPath, 'utf8'));

      // RC-3: Version migration chain entry point
      if (verifyStateWithRotation(state as unknown as Record<string, unknown>, sd)) {
        return state;
      }
      // PL-D-04: return data with integrityWarning instead of null
      state.integrityWarning = true;
      return state;
    }
  }
  return null;
}

export function listTasksFromDisk(): Array<{ taskId: string; taskName: string; phase: PhaseName; size: TaskSize }> {
  const sd = getStateDir();
  const workflowsDir = join(sd, 'workflows');
  if (!existsSync(workflowsDir)) return [];
  const results: Array<{ taskId: string; taskName: string; phase: PhaseName; size: TaskSize }> = [];
  const entries = readdirSync(workflowsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const state = loadStateFromDir(join(workflowsDir, entry.name));
      if (!state) continue;
      // PL-D-01: check phase before HMAC verification; skip completed tasks entirely
      if (state.phase === 'completed') continue;
      results.push({ taskId: state.taskId, taskName: state.taskName, phase: state.phase, size: state.size });
    }
  }
  return results;
}

function loadStateFromDir(dir: string): TaskState | null {
  const toonPath = join(dir, 'workflow-state.toon');
  try {
    if (existsSync(toonPath)) {
      return parseState(readFileSync(toonPath, 'utf8'));
    }
  } catch { /* skip corrupt entries */ }
  return null;
}

const ABANDON_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * GC: remove abandoned tasks (created == updated, older than 24h).
 * Returns count of removed tasks.
 */
export function gcAbandonedTasks(): number {
  const sd = getStateDir();
  const workflowsDir = join(sd, 'workflows');
  if (!existsSync(workflowsDir)) return 0;
  const now = Date.now();
  let removed = 0;
  const entries = readdirSync(workflowsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(workflowsDir, entry.name);
    const state = loadStateFromDir(dir);
    if (!state) continue;
    if (state.phase === 'completed') continue;
    if (state.createdAt !== state.updatedAt) continue;
    const age = now - new Date(state.createdAt).getTime();
    if (age < ABANDON_THRESHOLD_MS) continue;
    try { rmSync(dir, { recursive: true, force: true }); removed++; } catch { /* skip */ }
  }
  return removed;
}

export function buildTaskIndex(STATE_DIR_PARAM: string): Array<{ taskId: string; taskName: string; phase: string; size: string; status: string }> {
  const workflowsDir = join(STATE_DIR_PARAM, 'workflows');
  if (!existsSync(workflowsDir)) return [];
  const tasks: Array<{ taskId: string; taskName: string; phase: string; size: string; status: string }> = [];
  try {
    const entries = readdirSync(workflowsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const state = loadStateFromDir(join(workflowsDir, entry.name));
        if (!state) continue;
        tasks.push({
          taskId: state.taskId, taskName: state.taskName,
          phase: state.phase, size: state.size,
          status: state.phase === 'completed' ? 'completed' : 'active',
        });
      }
    }
  } catch { }
  return tasks;
}
