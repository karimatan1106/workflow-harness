/**
 * Auto-generate ADR from completed task state.
 * IDD principle: Intent is immutable, stored as ADR (append-only).
 * @spec docs/adr/ADR-004-documentation-layers.md
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProjectPath } from '../utils/project-root.js';
import type { TaskState } from '../state/types.js';

function getNextAdrNumber(adrDir: string): string {
  if (!existsSync(adrDir)) return '005';
  const files = readdirSync(adrDir).filter(f => f.startsWith('ADR-') && f.endsWith('.md'));
  const numbers = files.map(f => {
    const match = f.match(/^ADR-(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const max = numbers.length > 0 ? Math.max(...numbers) : 4;
  return String(max + 1).padStart(3, '0');
}

export function generateTaskAdr(task: TaskState): string | null {
  try {
    const adrDir = resolveProjectPath('docs/adr');
    mkdirSync(adrDir, { recursive: true });

    const num = getNextAdrNumber(adrDir);
    const fileName = `ADR-${num}-${task.taskName}.md`;
    const filePath = join(adrDir, fileName);

    // Don't overwrite if already exists
    if (existsSync(filePath)) return filePath;

    const now = new Date().toISOString().split('T')[0];
    const acList = (task.acceptanceCriteria ?? [])
      .map(ac => `- ${ac.id}: ${ac.description} [${ac.status}]`)
      .join('\n');

    const lines = [
      `# ADR-${num}: ${task.taskName}`,
      '',
      'Status: accepted',
      `Date: ${now}`,
      `TaskId: ${task.taskId}`,
      '',
      '## Intent (Why)',
      task.userIntent ?? '(not recorded)',
      '',
      '## Acceptance Criteria (What)',
      acList || '(none recorded)',
      '',
      '## Scope',
      `Files: ${(task.scopeFiles ?? []).join(', ') || '(none)'}`,
      `Dirs: ${(task.scopeDirs ?? []).join(', ') || '(none)'}`,
      '',
      '## Artifacts',
      `docsDir: ${task.docsDir ?? '(none)'}`,
      `Completed phases: ${(task.completedPhases ?? []).join(' → ') || '(none)'}`,
      '',
      '## Notes',
      'Auto-generated on task completion. This record is immutable.',
      'To revise a decision, create a new ADR that supersedes this one.',
      '',
    ];

    writeFileSync(filePath, lines.join('\n'), 'utf8');
    return filePath;
  } catch {
    return null;
  }
}
