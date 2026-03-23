/**
 * Task-index TOON serialization/parsing.
 * Simple structure: updatedAt KV + tasks table array.
 * @spec docs/spec/features/workflow-harness.md
 */

import { esc, tableHeader, tableRows, parseTableBlock, unesc } from './toon-helpers.js';

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
  const lines: string[] = [];
  lines.push(`updatedAt: ${esc(index.updatedAt)}`);
  lines.push('');
  if (index.tasks.length > 0) {
    lines.push(tableHeader('tasks', index.tasks.length, ['taskId', 'taskName', 'phase', 'size', 'status']));
    lines.push(tableRows(index.tasks.map(t => [t.taskId, t.taskName, t.phase, t.size, t.status])));
  }
  return lines.join('\n') + '\n';
}

export function parseTaskIndex(content: string): TaskIndex {
  try {
    const lines = content.split('\n');
    const result: TaskIndex = { tasks: [], updatedAt: '' };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '' || line.startsWith('  ')) continue;

      // Table header
      if (line.match(/^tasks\[\d+\]\{[^}]+\}:\s*$/)) {
        const { rows } = parseTableBlock(lines, i);
        result.tasks = rows.map(r => ({
          taskId: r[0], taskName: r[1], phase: r[2], size: r[3], status: r[4],
        }));
        break;
      }

      // KV pair
      const colonIdx = line.indexOf(': ');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const val = unesc(line.slice(colonIdx + 2));
        if (key === 'updatedAt') result.updatedAt = val;
      }
    }

    return result;
  } catch (e) {
    process.stderr.write(`[warn] Failed to parse index-toon-io: ${e instanceof Error ? e.message : String(e)}\n`);
    return { tasks: [], updatedAt: '' };
  }
}
