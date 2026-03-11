/**
 * State manager — read operations (load, list, query)
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TaskState, PhaseName, TaskSize } from './types.js';
import { verifyStateWithRotation } from '../utils/hmac.js';

function getStateDir(): string {
  return process.env.STATE_DIR || '.claude/state';
}

export function getStatePath(taskId: string, taskName: string): string {
  return join(getStateDir(), 'workflows', `${taskId}_${taskName}`, 'workflow-state.json');
}

export function getDocsPath(taskName: string): string {
  const DOCS_DIR = process.env.DOCS_DIR || 'docs/workflows';
  return join(DOCS_DIR, taskName);
}

export function loadTaskFromDisk(taskId: string): TaskState | null {
  const sd = getStateDir();
  const workflowsDir = join(sd, 'workflows');
  if (!existsSync(workflowsDir)) return null;
  const entries = readdirSync(workflowsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith(taskId)) {
      const statePath = join(workflowsDir, entry.name, 'workflow-state.json');
      if (existsSync(statePath)) {
        const raw = readFileSync(statePath, 'utf8');
        const state = JSON.parse(raw) as TaskState;
        if (verifyStateWithRotation(state as unknown as Record<string, unknown>, sd)) {
          return state;
        }
        // PL-D-04: return data with integrityWarning instead of null
        state.integrityWarning = true;
        return state;
      }
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
      const statePath = join(workflowsDir, entry.name, 'workflow-state.json');
      if (existsSync(statePath)) {
        try {
          const raw = readFileSync(statePath, 'utf8');
          const state = JSON.parse(raw) as TaskState;
          // PL-D-01: check phase before HMAC verification; skip completed tasks entirely
          if (state.phase === 'completed') continue;
          // HMAC verification for active tasks (non-fatal: include with warning)
          if (!verifyStateWithRotation(state as unknown as Record<string, unknown>, sd)) {
            results.push({ taskId: state.taskId, taskName: state.taskName, phase: state.phase, size: state.size });
            continue;
          }
          results.push({ taskId: state.taskId, taskName: state.taskName, phase: state.phase, size: state.size });
        } catch { }
      }
    }
  }
  return results;
}

export function buildTaskIndex(STATE_DIR_PARAM: string): Array<{ taskId: string; taskName: string; phase: string; size: string; status: string }> {
  const workflowsDir = join(STATE_DIR_PARAM, 'workflows');
  if (!existsSync(workflowsDir)) return [];
  const tasks: Array<{ taskId: string; taskName: string; phase: string; size: string; status: string }> = [];
  try {
    const entries = readdirSync(workflowsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const statePath = join(workflowsDir, entry.name, 'workflow-state.json');
        if (existsSync(statePath)) {
          try {
            const raw = readFileSync(statePath, 'utf8');
            const state = JSON.parse(raw) as TaskState;
            tasks.push({
              taskId: state.taskId,
              taskName: state.taskName,
              phase: state.phase,
              size: state.size,
              status: state.phase === 'completed' ? 'completed' : 'active',
            });
          } catch { }
        }
      }
    }
  } catch { }
  return tasks;
}
