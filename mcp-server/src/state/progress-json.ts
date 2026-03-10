/**
 * Progress JSON — structured progress recording for session recovery.
 * Replaces plain-text claude-progress.txt with machine-parseable JSON.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { TaskState } from './types.js';

export interface ProgressTransition {
  from: string;
  to: string;
  timestamp: string;
}

export interface ProgressData {
  taskId: string;
  taskName: string;
  currentPhase: string;
  completedPhases: string[];
  completedCount: number;
  updatedAt: string;
  transitions: ProgressTransition[];
}

const PROGRESS_FILE = 'claude-progress.json';

export function writeProgressJSON(state: TaskState, completedPhase: string, nextPhase: string): void {
  try {
    if (!existsSync(state.docsDir)) return;
    const filePath = join(state.docsDir, PROGRESS_FILE);

    let existing: ProgressData | undefined;
    try {
      if (existsSync(filePath)) {
        existing = JSON.parse(readFileSync(filePath, 'utf-8')) as ProgressData;
      }
    } catch { /* corrupted — overwrite */ }

    const transition: ProgressTransition = {
      from: completedPhase,
      to: nextPhase,
      timestamp: new Date().toISOString(),
    };

    const data: ProgressData = {
      taskId: state.taskId,
      taskName: state.taskName,
      currentPhase: state.phase,
      completedPhases: [...state.completedPhases],
      completedCount: state.completedPhases.length,
      updatedAt: new Date().toISOString(),
      transitions: [...(existing?.transitions ?? []), transition],
    };

    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch { /* non-blocking */ }
}

export function readProgressJSON(docsDir: string): ProgressData | undefined {
  try {
    const filePath = join(docsDir, PROGRESS_FILE);
    if (!existsSync(filePath)) return undefined;
    return JSON.parse(readFileSync(filePath, 'utf-8')) as ProgressData;
  } catch { return undefined; }
}
