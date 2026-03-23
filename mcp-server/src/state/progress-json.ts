/**
 * Progress TOON — structured progress recording for session recovery.
 * Writes claude-progress.toon (TOON-only, no JSON fallback).
 * Uses @toon-format/toon via toon-io-adapter.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { TaskState } from './types.js';
import { toonEncode, toonDecodeSafe } from './toon-io-adapter.js';
import { resolveProjectPath } from '../utils/project-root.js';

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

const TOON_FILE = 'claude-progress.toon';

function serializeProgress(data: ProgressData): string {
  return toonEncode(data);
}

function parseProgress(content: string): ProgressData {
  const parsed = toonDecodeSafe<ProgressData>(content);
  if (parsed && typeof parsed.taskId === 'string') {
    return {
      taskId: parsed.taskId,
      taskName: parsed.taskName ?? '',
      currentPhase: parsed.currentPhase ?? '',
      completedPhases: Array.isArray(parsed.completedPhases)
        ? parsed.completedPhases
        : [],
      completedCount: Number(parsed.completedCount ?? 0),
      updatedAt: parsed.updatedAt ?? '',
      transitions: Array.isArray(parsed.transitions)
        ? parsed.transitions
        : [],
    };
  }
  return {
    taskId: '', taskName: '', currentPhase: '',
    completedPhases: [], completedCount: 0, updatedAt: '',
    transitions: [],
  };
}

export function writeProgressJSON(
  state: TaskState,
  completedPhase: string,
  nextPhase: string,
): void {
  try {
    if (!existsSync(resolveProjectPath(state.docsDir))) return;
    const filePath = join(resolveProjectPath(state.docsDir), TOON_FILE);

    let existing: ProgressData | undefined;
    try {
      if (existsSync(filePath)) {
        existing = parseProgress(readFileSync(filePath, 'utf-8'));
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

    writeFileSync(filePath, serializeProgress(data), 'utf-8');
  } catch { /* non-blocking */ }
}

export function readProgressJSON(
  docsDir: string,
): ProgressData | undefined {
  try {
    const toonPath = join(resolveProjectPath(docsDir), TOON_FILE);
    if (existsSync(toonPath)) {
      return parseProgress(readFileSync(toonPath, 'utf-8'));
    }
    return undefined;
  } catch { return undefined; }
}
