/**
 * Task-index TOON serialization/parsing.
 * Uses @toon-format/toon via toon-io-adapter.
 * @spec docs/spec/features/workflow-harness.md
 */

import { toonEncode, toonDecodeSafe } from './toon-io-adapter.js';

export interface TaskIndexEntry {
  taskId: string;
  taskName: string;
  phase: string;
  size: string;
  status: string;
}

export interface TaskIndex {
  tasks: TaskIndexEntry[];
  updatedAt: string;
}

export function serializeTaskIndex(index: TaskIndex): string {
  return toonEncode(index);
}

export function parseTaskIndex(content: string): TaskIndex {
  const parsed = toonDecodeSafe<TaskIndex>(content);
  if (parsed && typeof parsed.updatedAt === 'string') {
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      updatedAt: parsed.updatedAt,
    };
  }
  process.stderr.write('[warn] Failed to parse index-toon-io\n');
  return { tasks: [], updatedAt: '' };
}
